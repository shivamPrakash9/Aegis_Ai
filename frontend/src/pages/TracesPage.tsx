import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  Layers, 
  Search, 
  ShieldCheck, 
  ShieldAlert, 
  CheckCircle, 
  Clock, 
  ExternalLink, 
  Check, 
  Copy, 
  ChevronRight,
  ChevronDown,
  Info,
  RefreshCw,
  FileCode,
  Cpu,
  Server,
  ArrowRight,
  Lock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Activity,
  Filter,
  Database
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog';
import { auditApi } from '@/services/audit-api';
import { gatewayApi } from '@/services/gateway-api';
import { useToast } from '@/hooks/useToast';
import { 
  AuditEvent, 
  AuditTrace, 
  DigestVerificationResult, 
  AiRequestListItem, 
  EnrichedAiRequestTrace, 
  PipelineStage, 
  TraceTimelineStep 
} from '@/types';

export const TracesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialId = searchParams.get('requestId') || searchParams.get('traceId') || '';
  const [searchInput, setSearchInput] = useState(initialId);
  const [activeIdentifier, setActiveIdentifier] = useState(initialId);
  const { toast } = useToast();

  // Selector state for selecting existing AI requests
  const [isSelectorOpen, setIsSelectorOpen] = useState(true);
  const [requestFilterSearch, setRequestFilterSearch] = useState('');
  const [requestFilterStatus, setRequestFilterStatus] = useState<string>('');

  // Selected event modal and verification state
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [expandedStepIndex, setExpandedStepIndex] = useState<number | null>(null);
  const [verifyingEventId, setVerifyingEventId] = useState<string | null>(null);
  const [verificationResults, setVerificationResults] = useState<Record<string, DigestVerificationResult>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const urlId = searchParams.get('requestId') || searchParams.get('traceId');
    if (urlId && urlId !== activeIdentifier) {
      setSearchInput(urlId);
      setActiveIdentifier(urlId);
    }
  }, [searchParams]);

  // Query existing AI requests for selector panel
  const { 
    data: existingRequestsData, 
    isLoading: isLoadingRequests,
    refetch: refetchRequests 
  } = useQuery({
    queryKey: ['existing-ai-requests', requestFilterSearch, requestFilterStatus],
    queryFn: () => gatewayApi.listRequests({ 
      limit: 12, 
      search: requestFilterSearch.trim() || undefined,
      status: requestFilterStatus || undefined
    }),
    staleTime: 10000
  });

  // Query active trace (tries Gateway Enriched Trace first, falls back to Audit Service Trace)
  const { 
    data: traceData, 
    isLoading: isLoadingTrace, 
    error: traceError, 
    refetch: refetchTrace, 
    isFetching: isFetchingTrace 
  } = useQuery({
    queryKey: ['request-trace-detail', activeIdentifier],
    queryFn: async (): Promise<EnrichedAiRequestTrace | AuditTrace> => {
      const cleanId = activeIdentifier.trim();
      if (!cleanId) throw new Error('No identifier provided');

      // If it looks like a request ID, call gateway enriched trace directly
      if (cleanId.startsWith('req_')) {
        return await gatewayApi.getRequestTrace(cleanId);
      }

      // Otherwise attempt gateway trace first, then fall back to security audit service
      try {
        return await gatewayApi.getRequestTrace(cleanId);
      } catch {
        return await auditApi.getTrace(cleanId);
      }
    },
    enabled: Boolean(activeIdentifier.trim()),
    retry: 1
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchInput.trim();
    if (!trimmed) return;
    setActiveIdentifier(trimmed);
    if (trimmed.startsWith('req_')) {
      setSearchParams({ requestId: trimmed });
    } else {
      setSearchParams({ traceId: trimmed });
    }
  };

  const handleSelectRequest = (reqItem: AiRequestListItem) => {
    setSearchInput(reqItem.id);
    setActiveIdentifier(reqItem.id);
    setSearchParams({ requestId: reqItem.id });
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: 'Copied to clipboard', variant: 'default' });
  };

  const handleVerifyDigest = async (eventId: string) => {
    setVerifyingEventId(eventId);
    try {
      const res = await auditApi.verifyEventDigest(eventId);
      setVerificationResults((prev) => ({ ...prev, [eventId]: res }));
      if (res.valid) {
        toast({
          title: 'Integrity Verified',
          description: `Cryptographic digest matches audit log record (${res.algorithm}).`,
          variant: 'success'
        });
      } else {
        toast({
          title: 'Integrity Check Failed',
          description: 'Digest recalculation did not match stored record hash!',
          variant: 'destructive'
        });
      }
    } catch (err: any) {
      toast({
        title: 'Verification Failed',
        description: err.message || 'Could not verify event digest.',
        variant: 'destructive'
      });
    } finally {
      setVerifyingEventId(null);
    }
  };

  // Helper to determine if current payload is enriched
  const isEnriched = Boolean(traceData && 'pipelineStages' in traceData);
  const enrichedTrace = isEnriched ? (traceData as EnrichedAiRequestTrace) : null;
  const eventsList: AuditEvent[] = (traceData && 'events' in traceData && traceData.events) ? traceData.events : [];

  const getStageColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
      case 'BLOCKED':
      case 'DENIED':
      case 'FAILED':
        return 'border-destructive/40 bg-destructive/10 text-destructive';
      case 'WAITING_FOR_APPROVAL':
        return 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400';
      case 'SKIPPED':
        return 'border-muted-foreground/30 bg-muted/40 text-muted-foreground';
      default:
        return 'border-primary/40 bg-primary/10 text-primary';
    }
  };

  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'COMPLETED':
        return 'secondary';
      case 'BLOCKED':
      case 'FAILED':
      case 'DENY':
      case 'DENIED':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Layers className="h-6 w-6 text-primary" />
          Request Trace Explorer
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Inspect end-to-end distributed audit logs, multi-service execution pipelines, and cryptographic signatures.
        </p>
      </div>

      {/* Trace / Request ID Search Card */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search or enter Request ID (req_...) or Trace ID (trc_... / uuid)..."
                className="pl-9 font-mono text-xs"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button type="submit" disabled={!searchInput.trim() || isFetchingTrace} className="gap-2 text-xs flex-1 sm:flex-initial">
                {isFetchingTrace ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                <span>Inspect Trace</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="text-xs gap-1.5"
                onClick={() => setIsSelectorOpen(!isSelectorOpen)}
              >
                <Activity className="h-3.5 w-3.5 text-primary" />
                <span>{isSelectorOpen ? 'Hide Requests' : 'Select Request'}</span>
                {isSelectorOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Select Existing AI Request Panel */}
      {isSelectorOpen && (
        <Card className="border-primary/20 bg-muted/20">
          <CardHeader className="py-3 px-4 border-b border-border/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Database className="h-4 w-4 text-primary" />
                  Select an Existing AI Request to Trace
                </CardTitle>
                <CardDescription className="text-xs">
                  Click any request to visualize its full 6-microservice execution trace and audit chain.
                </CardDescription>
              </div>

              {/* Status Filter Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {['', 'COMPLETED', 'BLOCKED', 'WAITING_FOR_APPROVAL', 'FAILED'].map((st) => (
                  <Button
                    key={st || 'ALL'}
                    type="button"
                    variant={requestFilterStatus === st ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-[11px] px-2.5"
                    onClick={() => setRequestFilterStatus(st)}
                  >
                    {st || 'All'}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => refetchRequests()}
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3">
            {isLoadingRequests ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : existingRequestsData?.data?.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">
                No matching AI requests found. Submit a request from Playground to generate traces.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto pr-1">
                {existingRequestsData?.data.map((reqItem) => {
                  const isSelected = activeIdentifier === reqItem.id || activeIdentifier === reqItem.traceId;
                  return (
                    <button
                      key={reqItem.id}
                      type="button"
                      onClick={() => handleSelectRequest(reqItem)}
                      className={`text-left p-2.5 rounded-md border transition-all text-xs flex flex-col justify-between gap-1.5 ${
                        isSelected 
                          ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary' 
                          : 'border-border/60 bg-background hover:border-primary/40 hover:bg-muted/30'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-mono font-semibold text-[11px] truncate max-w-[170px]">
                          {reqItem.id}
                        </span>
                        <Badge variant={getStatusBadgeVariant(reqItem.status)} className="text-[10px] px-1.5 py-0 h-4">
                          {reqItem.status}
                        </Badge>
                      </div>

                      <div className="text-muted-foreground text-[11px] truncate w-full">
                        {reqItem.sanitizedPromptSummary || reqItem.modelSelected || 'AI Completion Request'}
                      </div>

                      <div className="flex items-center justify-between w-full text-[10px] text-muted-foreground font-mono pt-1 border-t border-border/30">
                        <span>{reqItem.modelSelected || 'auto-route'}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {reqItem.durationMs ? `${reqItem.durationMs}ms` : new Date(reqItem.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Main Trace Display Area */}
      {!activeIdentifier ? (
        <Card className="p-12 text-center">
          <Layers className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-foreground">No Request or Trace Selected</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Choose an existing request from the list above or enter a Request ID or Trace ID to inspect its distributed execution steps.
          </p>
        </Card>
      ) : isLoadingTrace ? (
        <Card className="p-6 space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </Card>
      ) : traceError ? (
        <Card className="p-6">
          <ErrorState
            title="Trace Not Found"
            message={(traceError as Error).message || `No execution trace found matching identifier: ${activeIdentifier}`}
            onRetry={() => refetchTrace()}
          />
        </Card>
      ) : traceData ? (
        <div className="space-y-6">
          {/* Metadata Summary Banner */}
          <Card>
            <CardContent className="p-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3 flex-wrap">
                    {enrichedTrace?.requestId && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-muted-foreground">Request ID:</span>
                        <button
                          type="button"
                          className="font-mono text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                          onClick={() => handleCopy(enrichedTrace.requestId, 'requestId')}
                        >
                          <span>{enrichedTrace.requestId}</span>
                          {copiedId === 'requestId' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-muted-foreground">Trace ID:</span>
                      <button
                        type="button"
                        className="font-mono text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                        onClick={() => handleCopy(traceData.traceId, 'traceId')}
                      >
                        <span>{traceData.traceId}</span>
                        {copiedId === 'traceId' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>

                    {enrichedTrace?.status && (
                      <Badge variant={getStatusBadgeVariant(enrichedTrace.status)} className="text-xs">
                        {enrichedTrace.status}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                    {enrichedTrace?.modelSelected && (
                      <span>Model: <strong className="text-foreground font-mono">{enrichedTrace.modelSelected}</strong></span>
                    )}
                    {enrichedTrace?.durationMs !== undefined && enrichedTrace.durationMs !== null && (
                      <span>Duration: <strong className="text-foreground font-mono">{enrichedTrace.durationMs}ms</strong></span>
                    )}
                    {enrichedTrace?.privacyAction && (
                      <span>Privacy Action: <strong className="text-foreground font-mono">{enrichedTrace.privacyAction}</strong></span>
                    )}
                    {enrichedTrace?.policyDecision && (
                      <span>Policy Decision: <strong className="text-foreground font-mono">{enrichedTrace.policyDecision}</strong></span>
                    )}
                    {enrichedTrace?.createdAt && (
                      <span>Created: {new Date(enrichedTrace.createdAt).toLocaleString()}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {eventsList.length} {eventsList.length === 1 ? 'Audit Event' : 'Audit Events'}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => refetchTrace()}
                    disabled={isFetchingTrace}
                    className="h-8 text-xs gap-1"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isFetchingTrace ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Visual 6-Stage End-to-End Pipeline Diagram */}
          {enrichedTrace?.pipelineStages && enrichedTrace.pipelineStages.length > 0 && (
            <Card>
              <CardHeader className="py-3 px-5 border-b border-border/50">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-primary" />
                  Distributed Service Pipeline Execution (6 Microservices)
                </CardTitle>
                <CardDescription className="text-xs">
                  End-to-end traversal sequence across AegisAI independent microservices with boundary status.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {enrichedTrace.pipelineStages.map((stage, idx) => (
                    <div
                      key={stage.id}
                      className={`relative p-3 rounded-lg border flex flex-col justify-between gap-2 ${getStageColor(stage.status)}`}
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-mono font-bold">Stage {idx + 1}</span>
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-current">
                          :{stage.servicePort}
                        </Badge>
                      </div>

                      <div className="space-y-0.5">
                        <div className="font-semibold text-xs text-foreground truncate" title={stage.name}>
                          {stage.name}
                        </div>
                        <div className="text-[11px] opacity-80 truncate">
                          {stage.service}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-mono pt-1.5 border-t border-current/20">
                        <span className="font-semibold">{stage.status}</span>
                        {stage.durationMs ? <span>{stage.durationMs}ms</span> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Detailed Timeline Steps View */}
          {enrichedTrace?.timeline && enrichedTrace.timeline.length > 0 && (
            <Card>
              <CardHeader className="py-3 px-5 border-b border-border/50">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Granular Step Execution Timeline
                </CardTitle>
                <CardDescription className="text-xs">
                  Sequential operations, latency per hop, and decision checkpoints.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5">
                <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                  {enrichedTrace.timeline.map((step, sIdx) => {
                    const isExpanded = expandedStepIndex === sIdx;
                    return (
                      <div key={step.id || sIdx} className="relative group">
                        <div className="absolute -left-6 top-3 flex items-center justify-center w-5 h-5 rounded-full bg-background border-2 border-primary text-primary">
                          <span className="text-[10px] font-mono font-bold">{step.stepNumber || sIdx + 1}</span>
                        </div>

                        <div className="rounded-lg border border-border bg-card p-3.5 space-y-2 hover:border-primary/40 transition-colors">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-foreground">
                                {step.name}
                              </span>
                              <Badge variant="secondary" className="text-[11px] font-mono">
                                {step.service}
                              </Badge>
                              {step.httpStatus && (
                                <Badge variant="outline" className="text-[10px] font-mono">
                                  HTTP {step.httpStatus}
                                </Badge>
                              )}
                              <Badge variant={getStatusBadgeVariant(step.status)} className="text-[10px]">
                                {step.status}
                              </Badge>
                            </div>

                            <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                              {step.durationMs ? (
                                <span className="flex items-center gap-1 text-primary">
                                  <Clock className="h-3 w-3" />
                                  {step.durationMs}ms
                                </span>
                              ) : null}
                              <span>{new Date(step.timestamp).toLocaleTimeString()}</span>
                            </div>
                          </div>

                          {step.details && Object.keys(step.details).length > 0 && (
                            <div className="text-xs pt-1.5 border-t border-border/50">
                              <button
                                type="button"
                                className="text-primary hover:underline flex items-center gap-1 font-medium text-[11px]"
                                onClick={() => setExpandedStepIndex(isExpanded ? null : sIdx)}
                              >
                                {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                <span>{isExpanded ? 'Hide Step Details' : 'View Step Metadata'}</span>
                              </button>

                              {isExpanded && (
                                <div className="mt-2 p-2.5 rounded bg-muted font-mono text-[11px] overflow-x-auto">
                                  <pre>{JSON.stringify(step.details, null, 2)}</pre>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Prompt and Result Summary Panels */}
          {(enrichedTrace?.sanitizedPromptSummary || enrichedTrace?.sanitizedResult) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {enrichedTrace.sanitizedPromptSummary && (
                <Card>
                  <CardHeader className="py-2.5 px-4 border-b border-border/50">
                    <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-primary" />
                      Sanitized Prompt Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 text-xs font-mono bg-muted/30 overflow-x-auto max-h-48">
                    {enrichedTrace.sanitizedPromptSummary}
                  </CardContent>
                </Card>
              )}

              {enrichedTrace.sanitizedResult && (
                <Card>
                  <CardHeader className="py-2.5 px-4 border-b border-border/50">
                    <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      Model Inference Result
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 text-xs font-mono bg-muted/30 overflow-x-auto max-h-48">
                    {enrichedTrace.sanitizedResult}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Audit Log Events & Cryptographic Verification Section */}
          <Card>
            <CardHeader className="py-3 px-5 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Cryptographic Audit Event Chain
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Immutable SHA-256 tamper-evident event log records stored in Security Audit service.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs font-mono">
                  {eventsList.length} Events
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-5">
              {eventsList.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground">
                  Zero audit events found for trace {traceData.traceId}.
                </div>
              ) : (
                <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                  {eventsList.map((event) => {
                    const verification = verificationResults[event.eventId];
                    const isVerifying = verifyingEventId === event.eventId;

                    return (
                      <div key={event.eventId} className="relative group">
                        <div className="absolute -left-6 top-3 flex items-center justify-center w-5 h-5 rounded-full bg-background border-2 border-primary text-primary">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        </div>

                        <Card className="hover:border-primary/40 transition-colors">
                          <CardContent className="p-4 space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-bold text-foreground">
                                  {event.eventType}
                                </span>
                                <Badge variant="secondary" className="text-[11px] font-mono">
                                  {event.sourceService || 'gateway'}
                                </Badge>
                                <Badge 
                                  variant={
                                    event.severity === 'CRITICAL' || event.severity === 'HIGH' 
                                      ? 'destructive' 
                                      : 'outline'
                                  } 
                                  className="text-[10px]"
                                >
                                  {event.severity}
                                </Badge>
                              </div>

                              <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                                <Clock className="h-3.5 w-3.5" />
                                <span>{new Date(event.occurredAt).toLocaleString()}</span>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground pt-1 border-t border-border/50">
                              <div>
                                <span>Event ID: </span>
                                <button
                                  type="button"
                                  className="font-mono text-primary hover:underline"
                                  onClick={() => handleCopy(event.eventId, `ev-${event.eventId}`)}
                                >
                                  {event.eventId.slice(0, 16)}...
                                </button>
                              </div>

                              {event.outcome && (
                                <div>
                                  <span>Outcome: </span>
                                  <span className="font-semibold text-foreground">{event.outcome}</span>
                                </div>
                              )}

                              {event.action && (
                                <div>
                                  <span>Action: </span>
                                  <span className="font-semibold text-foreground">{event.action}</span>
                                </div>
                              )}
                            </div>

                            {/* Integrity Verification and JSON Inspection Footer */}
                            <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs">
                              <div className="flex items-center gap-2">
                                {verification ? (
                                  verification.valid ? (
                                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                                      <ShieldCheck className="h-3.5 w-3.5" />
                                      <span>Digest Verified ({verification.algorithm})</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-destructive font-medium">
                                      <ShieldAlert className="h-3.5 w-3.5" />
                                      <span>Digest Mismatch</span>
                                    </span>
                                  )
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs gap-1"
                                    disabled={isVerifying}
                                    onClick={() => handleVerifyDigest(event.eventId)}
                                  >
                                    {isVerifying ? (
                                      <RefreshCw className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <ShieldCheck className="h-3 w-3 text-muted-foreground" />
                                    )}
                                    <span>Verify Digest</span>
                                  </Button>
                                )}
                              </div>

                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs gap-1 text-primary"
                                onClick={() => setSelectedEvent(event)}
                              >
                                <FileCode className="h-3.5 w-3.5" />
                                <span>Inspect Payload</span>
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Event Details JSON Modal */}
      {selectedEvent && (
        <Dialog open={Boolean(selectedEvent)} onOpenChange={(open) => !open && setSelectedEvent(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold font-mono flex items-center gap-2">
                <FileCode className="h-5 w-5 text-primary" />
                <span>{selectedEvent.eventType}</span>
              </DialogTitle>
              <DialogDescription className="text-xs font-mono">
                Event ID: {selectedEvent.eventId}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="rounded-md bg-muted p-3 font-mono text-xs overflow-x-auto max-h-96">
                <pre>{JSON.stringify(selectedEvent, null, 2)}</pre>
              </div>

              <div className="flex justify-between items-center pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1"
                  onClick={() => handleCopy(JSON.stringify(selectedEvent, null, 2), 'raw-json')}
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy Payload</span>
                </Button>
                <Button size="sm" onClick={() => setSelectedEvent(null)}>
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
