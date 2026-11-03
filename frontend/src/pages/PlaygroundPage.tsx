import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { 
  Send, 
  Bot, 
  Sparkles, 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle, 
  Copy, 
  Check, 
  RefreshCw, 
  ExternalLink,
  Zap,
  Eye,
  Shield
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatusBadge } from '@/components/common/StatusBadge';
import { gatewayApi } from '@/services/gateway-api';
import { modelApi } from '@/services/model-api';
import { privacyApi } from '@/services/privacy-api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { 
  ChatMessage, 
  AiRequestDetail,
  PrivacyScanResponse
} from '@/types';

export const PlaygroundPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'user', content: '' }
  ]);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>('gpt-4o');
  const [capabilityPreference, setCapabilityPreference] = useState<'general' | 'code' | 'analysis'>('general');
  const [temperature, setTemperature] = useState<number>(0.7);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Preflight privacy scan preview state
  const [preflightResult, setPreflightResult] = useState<PrivacyScanResponse | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  // Active request tracking & polling
  const [activeRequest, setActiveRequest] = useState<AiRequestDetail | null>(() => {
    try {
      const saved = sessionStorage.getItem('aegis_playground_last_request');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.id) return parsed;
      }
    } catch {
      // ignore
    }
    return null;
  });
  const [activeRequestId, setActiveRequestId] = useState<string | null>(() => {
    try {
      const saved = sessionStorage.getItem('aegis_playground_last_request');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.id) return parsed.id;
      }
    } catch {
      // ignore
    }
    return null;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answerRef = useRef<HTMLDivElement | null>(null);

  // Fetch available models
  const { data: models = [], isLoading: isLoadingModels } = useQuery({
    queryKey: ['available-models'],
    queryFn: () => modelApi.listModels(true),
    staleTime: 60000,
  });

  // Update selected model when models list loads
  useEffect(() => {
    if (models.length > 0 && !models.some(m => m.modelId === selectedModel)) {
      setSelectedModel(models[0].modelId);
    }
  }, [models, selectedModel]);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  // Poll request status until terminal with bounded exponential backoff
  const pollRequest = async (requestId: string, attempt = 0) => {
    if (attempt >= 30) {
      setIsPolling(false);
      toast({
        title: 'Request Timed Out',
        description: 'The request took longer than expected to process. Check the requests explorer.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const req = await gatewayApi.getRequestById(requestId);
      setActiveRequest(req);

      // Invalidate and sync React Query caches
      queryClient.setQueryData(['ai-request-detail', req.id], req);
      queryClient.invalidateQueries({ queryKey: ['ai-requests'] });

      if (['COMPLETED', 'BLOCKED', 'FAILED', 'WAITING_FOR_APPROVAL'].includes(req.status)) {
        setIsPolling(false);
        try {
          sessionStorage.setItem('aegis_playground_last_request', JSON.stringify(req));
        } catch {
          // ignore
        }

        setTimeout(() => {
          if (typeof answerRef.current?.scrollIntoView === 'function') {
            answerRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }, 100);

        if (req.status === 'COMPLETED') {
          toast({
            title: 'Request Completed',
            description: 'AI Gateway processed and sanitized the response successfully.',
            variant: 'success',
          });
        } else if (req.status === 'WAITING_FOR_APPROVAL') {
          toast({
            title: 'Approval Required',
            description: 'This request triggered an organizational policy and is awaiting approval.',
            variant: 'default',
          });
        } else if (req.status === 'BLOCKED') {
          toast({
            title: 'Request Blocked',
            description: req.errorMessage || 'Request was blocked by privacy scanner or enterprise policy.',
            variant: 'destructive',
          });
        } else if (req.status === 'FAILED') {
          toast({
            title: 'Request Failed',
            description: req.errorMessage || 'Model invocation or gateway processing encountered a failure.',
            variant: 'destructive',
          });
        }
        return;
      }

      // Schedule next poll with backoff
      const nextDelay = Math.min(1000 + attempt * 250, 4000);
      pollTimerRef.current = setTimeout(() => {
        pollRequest(requestId, attempt + 1);
      }, nextDelay);
    } catch (err) {
      console.error('Polling error:', err);
      setIsPolling(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: 'Copied to clipboard', variant: 'default' });
  };

  const handlePreflightScan = async () => {
    const userPrompt = messages[0]?.content?.trim();
    if (!userPrompt) {
      toast({
        title: 'Empty Prompt',
        description: 'Please enter a prompt to run the privacy preview.',
        variant: 'destructive',
      });
      return;
    }

    setIsScanning(true);
    try {
      const chatPayload: ChatMessage[] = [];
      if (systemPrompt.trim()) {
        chatPayload.push({ role: 'system', content: systemPrompt.trim() });
      }
      chatPayload.push({ role: 'user', content: userPrompt });

      const res = await privacyApi.scan({
        messages: chatPayload,
        organizationId: user?.organizationId || 'org-alpha',
      });
      setPreflightResult(res);
      toast({
        title: 'Privacy Preview Completed',
        description: `Action: ${res.action} — ${res.findings?.length || 0} sensitive items detected.`,
        variant: res.findings?.length > 0 ? 'default' : 'success',
      });
    } catch (err: any) {
      toast({
        title: 'Scan Failed',
        description: err.message || 'Privacy scanner service unavailable.',
        variant: 'destructive',
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const userPrompt = messages[0]?.content?.trim();
    if (!userPrompt) {
      toast({ title: 'Empty Prompt', description: 'Please enter a prompt to submit.', variant: 'destructive' });
      return;
    }

    const chatPayload: ChatMessage[] = [];
    if (systemPrompt.trim()) {
      chatPayload.push({ role: 'system', content: systemPrompt.trim() });
    }
    chatPayload.push({ role: 'user', content: userPrompt });

    setIsSubmitting(true);
    setActiveRequest(null);

    try {
      const submission = await gatewayApi.submitRequest({
        messages: chatPayload,
        modelPreference: {
          model: selectedModel || undefined,
          capability: capabilityPreference,
        },
        metadata: {
          source: 'aegis-frontend-playground',
          temperature,
        },
      });
      setActiveRequestId(submission.requestId);

      // Initial temporary state
      setActiveRequest({
        id: submission.requestId,
        status: submission.status,
        traceId: submission.traceId,
        modelSelected: submission.modelSelected || selectedModel,
        sanitizedResult: submission.sanitizedResult || submission.result || null,
        privacyAction: submission.privacyAction,
        policyDecision: submission.policyDecision,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setIsPolling(true);
      setIsSubmitting(false);
      pollRequest(submission.requestId);
    } catch (error: any) {
      setIsSubmitting(false);
      setIsPolling(false);
      toast({
        title: 'Submission Failed',
        description: error.message || 'Failed to submit request through the AI Gateway.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            AI Playground
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Test and interact with AI models through the secure AegisAI Gateway pipeline.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1 text-xs font-mono">
            Gateway :3001
          </Badge>
          <Badge variant="secondary" className="px-3 py-1 text-xs">
            Privacy & Policy Protected
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form Controls & Prompt Composer */}
        <div className="lg:col-span-7 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center justify-between">
                <span>Model & Parameters</span>
                {isLoadingModels && <span className="text-xs text-muted-foreground">Loading models...</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">
                    Select Model
                  </label>
                  <select
                    className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    disabled={isSubmitting || isPolling}
                  >
                    {models.map((m) => (
                      <option key={m.modelId} value={m.modelId}>
                        {m.modelId} ({m.provider})
                      </option>
                    ))}
                    {models.length === 0 && (
                      <option value="gpt-4o">gpt-4o (default)</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">
                    Capability Preference
                  </label>
                  <select
                    className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                    value={capabilityPreference}
                    onChange={(e) => setCapabilityPreference(e.target.value as any)}
                    disabled={isSubmitting || isPolling}
                  >
                    <option value="general">General Purpose</option>
                    <option value="code">Code Generation</option>
                    <option value="analysis">Deep Analysis</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-foreground">Temperature: {temperature}</span>
                  <span className="text-muted-foreground">0 = deterministic, 1 = creative</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  disabled={isSubmitting || isPolling}
                  className="w-full accent-primary h-1.5 bg-secondary rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  System Prompt (Optional)
                </label>
                <textarea
                  className="w-full h-16 px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                  placeholder="You are a helpful and compliant enterprise AI assistant..."
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  disabled={isSubmitting || isPolling}
                />
              </div>
            </CardContent>
          </Card>

          {/* User Prompt */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">User Prompt</CardTitle>
              <CardDescription className="text-xs">
                Enter your prompt below. AegisAI will evaluate privacy boundaries and enterprise governance policies prior to model dispatch.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-3">
                <textarea
                  className="w-full h-36 p-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring resize-y font-sans"
                  placeholder="Ask a question, generate code, or analyze data... Try including simulated PII (e.g., test@example.com) to test privacy masking."
                  value={messages[0]?.content || ''}
                  onChange={(e) => setMessages([{ role: 'user', content: e.target.value }])}
                  disabled={isSubmitting || isPolling}
                />

                {/* Preflight Privacy Preview */}
                {preflightResult && (
                  <div className="p-3 bg-muted/60 border border-primary/20 rounded-lg text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground flex items-center gap-1.5">
                        <Shield className="h-3.5 w-3.5 text-primary" />
                        Preflight Privacy Scan Preview
                      </span>
                      <Badge
                        variant={preflightResult.action === 'BLOCK' ? 'destructive' : 'secondary'}
                        className="text-[10px]"
                      >
                        Action: {preflightResult.action}
                      </Badge>
                    </div>

                    {preflightResult.findings && preflightResult.findings.length > 0 ? (
                      <div>
                        <span className="text-[11px] text-muted-foreground block mb-1">
                          Detected Sensitive Data Categories ({preflightResult.findings.length}):
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {preflightResult.findings.map((f, i) => (
                            <Badge key={i} variant="outline" className="text-[10px] text-amber-500 border-amber-500/30">
                              {f.category}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-emerald-500 flex items-center gap-1">
                        <Check className="h-3 w-3" /> No PII or secrets detected.
                      </p>
                    )}

                    {preflightResult.sanitizedMessages?.[preflightResult.sanitizedMessages.length - 1]?.content && (
                      <div className="space-y-1">
                        <span className="text-[11px] text-muted-foreground block">
                          Sanitized / Masked Preview (Dispatched to Model):
                        </span>
                        <div className="p-2 bg-background border border-border rounded font-mono text-[11px] text-foreground">
                          {preflightResult.sanitizedMessages[preflightResult.sanitizedMessages.length - 1].content}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>

              <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border pt-3">
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Payload will be scanned for secrets & PII</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handlePreflightScan}
                    disabled={isScanning || isSubmitting || !messages[0]?.content?.trim()}
                    className="gap-1.5 text-xs"
                  >
                    {isScanning ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                    <span>Preview Masking</span>
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={isSubmitting || isPolling || !messages[0]?.content?.trim()}
                    className="gap-2"
                  >
                    {isSubmitting || isPolling ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>{isPolling ? 'Processing...' : 'Submitting...'}</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        <span>Execute Request</span>
                      </>
                    )}
                  </Button>
                </div>
              </CardFooter>
            </form>
          </Card>

          {/* Prominent AI Assistant Response Section (Directly below prompt composer) */}
          {(isSubmitting || isPolling || activeRequest) && (
            <div ref={answerRef} className="scroll-mt-6">
              <Card
                className={`transition-all duration-300 border-2 ${
                  activeRequest?.status === 'COMPLETED'
                    ? 'border-primary/50 shadow-lg bg-card'
                    : activeRequest?.status === 'BLOCKED' || activeRequest?.status === 'FAILED'
                    ? 'border-destructive/40 shadow-md bg-card'
                    : 'border-primary/30 shadow-md bg-card'
                }`}
              >
              <CardHeader className="pb-3 border-b border-border bg-primary/5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                      activeRequest?.status === 'COMPLETED'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-primary/10 text-primary'
                    }`}>
                      <Bot className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                        <span>AI Assistant Answer</span>
                        {activeRequest && <StatusBadge status={activeRequest.status} />}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {isSubmitting || isPolling
                          ? 'Evaluating governance rules and generating response...'
                          : `Response from ${activeRequest?.modelSelected || selectedModel}`}
                      </CardDescription>
                    </div>
                  </div>

                  {activeRequest && (
                    <div className="flex items-center gap-2">
                      {(() => {
                        const output =
                          activeRequest.assistantAnswer ??
                          activeRequest.sanitizedResult ??
                          (activeRequest as any).result ??
                          (activeRequest as any).response;
                        const isMock =
                          (output && output.includes('[Mock Assistant Response]')) ||
                          activeRequest.modelSelected?.includes('mock') ||
                          selectedModel?.includes('mock');

                        return isMock ? (
                          <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30 bg-amber-500/10">
                            DETERMINISTIC MOCK ADAPTER
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/30 bg-emerald-500/10">
                            LIVE UPSTREAM COMPLETION
                          </Badge>
                        );
                      })()}

                      {(() => {
                        const output =
                          activeRequest.assistantAnswer ??
                          activeRequest.sanitizedResult ??
                          (activeRequest as any).result ??
                          (activeRequest as any).response;
                        if (!output) return null;
                        return (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1.5"
                            onClick={() => handleCopy(output, 'main-response')}
                          >
                            {copiedId === 'main-response' ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-emerald-500" />
                                <span className="text-emerald-500 font-medium">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" />
                                <span>Copy Answer</span>
                              </>
                            )}
                          </Button>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="p-5">
                {isSubmitting || isPolling ? (
                  <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
                    <RefreshCw className="h-8 w-8 text-primary animate-spin" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {activeRequest?.status === 'ACCEPTED' ? 'Request Accepted by Gateway' : 'Processing AI Inference...'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                        Pre-flight privacy scan completed, enterprise policy checked, model dispatched.
                      </p>
                    </div>
                  </div>
                ) : activeRequest?.status === 'COMPLETED' ? (
                  <div className="space-y-4">
                    {(() => {
                      const outputText =
                        activeRequest.assistantAnswer ??
                        activeRequest.sanitizedResult ??
                        (activeRequest as any).result ??
                        (activeRequest as any).response;

                      return outputText ? (
                        <div className="p-4 rounded-lg bg-background border-2 border-primary/20 shadow-sm text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed selection:bg-primary/20">
                          {outputText}
                        </div>
                      ) : (
                        <div className="p-4 rounded-lg bg-muted/40 border border-border text-xs text-muted-foreground italic">
                          Request processed successfully, but the model provider returned an empty completion.
                        </div>
                      );
                    })()}

                    {/* Quick navigation to full details */}
                    <div className="flex items-center justify-between pt-2 border-t border-border text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span>ID: <code className="font-mono text-foreground">{activeRequest.id.slice(0, 10)}...</code></span>
                        {activeRequest.traceId && (
                          <span className="hidden sm:inline">
                            • Trace: <code className="font-mono text-foreground">{activeRequest.traceId.slice(0, 10)}...</code>
                          </span>
                        )}
                      </div>
                      <Link
                        to={`/requests/${activeRequest.id}`}
                        className="text-primary hover:underline font-medium inline-flex items-center gap-1"
                      >
                        <span>View Full Audit Details</span>
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                ) : activeRequest?.status === 'WAITING_FOR_APPROVAL' ? (
                  <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs space-y-2">
                    <div className="flex items-center gap-1.5 font-semibold text-sm">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Action Required: Awaiting Human Approval</span>
                    </div>
                    <p>
                      This request triggered an organizational policy threshold. The AI model has not been invoked yet.
                    </p>
                    <Link to="/approvals" className="text-primary underline font-medium inline-flex items-center gap-1">
                      Open Approval Center <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                ) : activeRequest?.status === 'BLOCKED' || activeRequest?.status === 'FAILED' ? (
                  <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-sm">
                      <ShieldAlert className="h-4 w-4" />
                      <span>Request {activeRequest.status}</span>
                    </div>
                    <p className="text-sm">
                      {activeRequest.errorMessage || 'The request was terminated by security or governance controls.'}
                    </p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        )}
        </div>

        {/* Right Column: Execution Status & Gateway Telemetry */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="min-h-[460px] flex flex-col">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  <span>Gateway Output</span>
                </CardTitle>
                {activeRequest && (
                  <StatusBadge status={activeRequest.status} />
                )}
              </div>
            </CardHeader>

            <CardContent className="flex-1 p-4 space-y-4">
              {!activeRequest && !isSubmitting && !isPolling ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground min-h-[300px]">
                  <Zap className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-medium">Ready for Execution</p>
                  <p className="text-xs mt-1 max-w-xs text-muted-foreground/80">
                    Submit a prompt to view the sanitized model response, governance decisions, and trace events.
                  </p>
                </div>
              ) : isSubmitting || isPolling ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 min-h-[300px]">
                  <RefreshCw className="h-8 w-8 text-primary animate-spin mb-3" />
                  <p className="text-sm font-medium text-foreground">
                    {activeRequest?.status === 'ACCEPTED' ? 'Request Accepted' : 'Pipeline Processing...'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                    Scanning privacy boundaries, checking organizational policies, and dispatching to provider.
                  </p>
                  {activeRequestId && (
                    <span className="mt-3 text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
                      ID: {activeRequestId.slice(0, 8)}...
                    </span>
                  )}
                </div>
              ) : activeRequest ? (
                <div className="space-y-4">
                  {/* Gateway Telemetry & Inference Status */}
                  <div className="p-3.5 bg-primary/5 rounded-lg border border-primary/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Bot className="h-4 w-4 text-primary" />
                        Inference Pipeline Status:
                      </span>
                      {(() => {
                        const outputText =
                          activeRequest.assistantAnswer ??
                          activeRequest.sanitizedResult ??
                          (activeRequest as any).result ??
                          (activeRequest as any).response;
                        const isMock =
                          (outputText && outputText.includes('[Mock Assistant Response]')) ||
                          activeRequest.modelSelected?.includes('mock') ||
                          selectedModel?.includes('mock');

                        return isMock ? (
                          <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30 bg-amber-500/10">
                            MOCK ADAPTER
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/30 bg-emerald-500/10">
                            LIVE UPSTREAM
                          </Badge>
                        );
                      })()}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      AI response generated and sanitized. Displayed in the primary answer card below the prompt composer.
                    </p>
                  </div>

                  {/* Warning if WAITING_FOR_APPROVAL */}
                  {activeRequest.status === 'WAITING_FOR_APPROVAL' && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-600 dark:text-amber-400 text-xs space-y-2">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <AlertTriangle className="h-4 w-4" />
                        <span>Awaiting Human Approval</span>
                      </div>
                      <p>
                        This request violates automated policy limits and has been placed in the approval queue.
                      </p>
                      <div className="pt-1 flex items-center gap-2">
                        <Link 
                          to="/approvals" 
                          className="inline-flex items-center gap-1 text-primary underline font-medium hover:text-primary/80"
                        >
                          Go to Approval Center <ExternalLink className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>
                  )}

                  {/* Error / Blocked notification */}
                  {(activeRequest.status === 'BLOCKED' || activeRequest.status === 'FAILED') && (
                    <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <ShieldAlert className="h-4 w-4" />
                        <span>Request {activeRequest.status}</span>
                      </div>
                      <p>
                        {activeRequest.errorMessage || 'The request was terminated by security controls.'}
                      </p>
                    </div>
                  )}

                  {/* Sanitized Prompt Summary (if privacy filtering applied) */}
                  {activeRequest.sanitizedPromptSummary && (
                    <div className="p-3 bg-muted/30 border border-border rounded-lg space-y-1.5 text-xs">
                      <div className="flex items-center justify-between text-muted-foreground font-medium">
                        <span className="flex items-center gap-1.5 text-foreground font-semibold">
                          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                          Sanitized Prompt Dispatched:
                        </span>
                        <Badge variant="outline" className="text-[10px]">Privacy Enforced</Badge>
                      </div>
                      <div className="p-2 bg-background rounded border border-border/60 font-mono text-[11px] text-muted-foreground whitespace-pre-wrap max-h-28 overflow-y-auto">
                        {activeRequest.sanitizedPromptSummary}
                      </div>
                    </div>
                  )}

                  {/* Governance summary bar */}
                  <div className="grid grid-cols-2 gap-2 p-3 bg-muted/40 rounded-lg border border-border text-xs">
                    <div>
                      <span className="text-muted-foreground block">Privacy Action</span>
                      <span className="font-semibold text-foreground">
                        {activeRequest.privacyAction || 'ALLOW'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Policy Decision</span>
                      <span className="font-semibold text-foreground">
                        {activeRequest.policyDecision || 'ALLOW'}
                      </span>
                    </div>
                  </div>

                  {/* Metadata & Trace link */}
                  <div className="pt-2 border-t border-border space-y-2 text-xs">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Request ID:</span>
                      <button
                        type="button"
                        className="font-mono text-primary hover:underline flex items-center gap-1"
                        onClick={() => handleCopy(activeRequest.id, 'req-id')}
                      >
                        {activeRequest.id.slice(0, 12)}...
                        {copiedId === 'req-id' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>

                    {activeRequest.traceId && (
                      <>
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>Trace ID:</span>
                          <Link
                            to={`/traces?traceId=${activeRequest.traceId}`}
                            className="font-mono text-primary hover:underline flex items-center gap-1"
                          >
                            {activeRequest.traceId.slice(0, 12)}...
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </div>
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>Audit Ledger:</span>
                          <Link
                            to={`/audit?traceId=${activeRequest.traceId}`}
                            className="text-primary hover:underline flex items-center gap-1 font-medium"
                          >
                            <span>Verify in Audit Explorer</span>
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </div>
                      </>
                    )}

                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Dispatched Model:</span>
                      <span className="font-medium text-foreground">
                        {activeRequest.modelSelected || selectedModel}
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}
            </CardContent>

            {activeRequest && (
              <CardFooter className="border-t border-border p-3 flex justify-between items-center text-xs text-muted-foreground">
                <Link
                  to={`/requests/${activeRequest.id}`}
                  className="text-primary hover:underline font-medium inline-flex items-center gap-1"
                >
                  Inspect Full Details <ExternalLink className="h-3 w-3" />
                </Link>
                <span>Status: {activeRequest.status}</span>
              </CardFooter>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
