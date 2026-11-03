import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  Search, 
  RefreshCw, 
  Copy, 
  Check, 
  Info, 
  Layers, 
  Plus, 
  Lock, 
  Eye, 
  SlidersHorizontal,
  Code
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog';
import { privacyApi } from '@/services/privacy-api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { PrivacyScanResponse, PrivacyFinding } from '@/types';

export const PrivacyScannerPage: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  const [promptText, setPromptText] = useState('');
  const [scanMode, setScanMode] = useState<'MASK' | 'BLOCK' | 'AUDIT' | 'ALLOW'>('MASK');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Custom pattern dialog state
  const [isPatternModalOpen, setIsPatternModalOpen] = useState(false);
  const [patternName, setPatternName] = useState('');
  const [patternRegex, setPatternRegex] = useState('');
  const [patternSeverity, setPatternSeverity] = useState('HIGH');
  const [patternAction, setPatternAction] = useState('MASK');
  const [patternReplacement, setPatternReplacement] = useState('[REDACTED_CUSTOM]');

  // Fetch engine limitations
  const { data: limitations, isLoading: isLoadingLimits } = useQuery({
    queryKey: ['privacy-limitations'],
    queryFn: () => privacyApi.getLimitations(),
    staleTime: 300000,
  });

  // Fetch active privacy config
  const { data: privacyConfig, refetch: refetchConfig } = useQuery({
    queryKey: ['privacy-config'],
    queryFn: () => privacyApi.getConfig(),
    staleTime: 60000,
  });

  // Scanner Mutation
  const scanMutation = useMutation({
    mutationFn: async () => {
      const orgId = user?.organizationId || 'default-org';
      return privacyApi.scan({
        organizationId: orgId,
        messages: [{ role: 'user', content: promptText }],
        mode: scanMode,
      });
    },
    onSuccess: (data) => {
      toast({
        title: 'Scan Completed',
        description: `Evaluated in ${data.durationMs}ms. Action: ${data.action}`,
        variant: data.action === 'BLOCK' ? 'destructive' : 'default',
      });
    },
    onError: (err: any) => {
      toast({
        title: 'Scan Failed',
        description: err.message || 'Error executing privacy scan.',
        variant: 'destructive',
      });
    },
  });

  // Add Pattern Mutation
  const addPatternMutation = useMutation({
    mutationFn: async () => {
      return privacyApi.addCustomPattern({
        name: patternName,
        pattern: patternRegex,
        severity: patternSeverity,
        action: patternAction,
        replacement: patternReplacement,
      });
    },
    onSuccess: () => {
      toast({ title: 'Custom Pattern Added', variant: 'success' });
      setIsPatternModalOpen(false);
      setPatternName('');
      setPatternRegex('');
      refetchConfig();
    },
    onError: (err: any) => {
      toast({ title: 'Failed to add pattern', description: err.message, variant: 'destructive' });
    },
  });

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
    toast({ title: 'Copied to clipboard', variant: 'default' });
  };

  const loadPreset = (preset: string) => {
    switch (preset) {
      case 'pii':
        setPromptText('Please send the contract to customer john.doe@example.com or call him at +1-555-0199 for verification.');
        break;
      case 'secret':
        setPromptText('Deploy the service using AWS_SECRET_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE and database password postgres://admin:secretPass123@prod-db.internal:5432');
        break;
      case 'ip':
        setPromptText('Investigate unauthorized intrusion attempts from source IP address 192.168.1.105 targeting API host 10.0.0.1.');
        break;
      default:
        break;
    }
  };

  const scanResult: PrivacyScanResponse | undefined = scanMutation.data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-primary" />
            Privacy Scanner
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Detect and redact PII, credentials, API secrets, and proprietary tokens across AI payloads.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1 text-xs font-mono">
            Service :3002
          </Badge>
          <Badge variant="secondary" className="px-3 py-1 text-xs">
            Zero Raw-Data Logging
          </Badge>
        </div>
      </div>

      {/* Standalone Scan Clarification Banner */}
      <div className="p-3.5 bg-muted/60 border border-border rounded-lg flex items-start gap-3 text-xs text-muted-foreground">
        <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-foreground block mb-0.5">
            Standalone Privacy Evaluation Notice
          </span>
          This tool tests the Privacy Scanner microservice directly. Standalone scans evaluate and redact data but do not submit requests through downstream LLMs or trigger policy evaluation. To test full request flow, use the AI Playground.
        </div>
      </div>

      <Tabs defaultValue="scanner" className="space-y-6">
        <TabsList>
          <TabsTrigger value="scanner">Interactive Scanner</TabsTrigger>
          <TabsTrigger value="limitations">Engine Specifications</TabsTrigger>
          <TabsTrigger value="configuration">Rules & Patterns</TabsTrigger>
        </TabsList>

        {/* Tab 1: Interactive Scanner */}
        <TabsContent value="scanner" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Input Form */}
            <div className="lg:col-span-6 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">Test Input Payload</CardTitle>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground mr-1">Presets:</span>
                      <button
                        type="button"
                        onClick={() => loadPreset('pii')}
                        className="text-[11px] px-2 py-0.5 rounded bg-muted hover:bg-accent text-foreground transition-colors"
                      >
                        PII
                      </button>
                      <button
                        type="button"
                        onClick={() => loadPreset('secret')}
                        className="text-[11px] px-2 py-0.5 rounded bg-muted hover:bg-accent text-foreground transition-colors"
                      >
                        Secrets
                      </button>
                      <button
                        type="button"
                        onClick={() => loadPreset('ip')}
                        className="text-[11px] px-2 py-0.5 rounded bg-muted hover:bg-accent text-foreground transition-colors"
                      >
                        IP
                      </button>
                    </div>
                  </div>
                  <CardDescription className="text-xs">
                    Input prompt text or simulated data to test sensitive token detection and redaction.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="text-xs font-medium text-foreground block mb-1">
                        Scanning Mode
                      </label>
                      <select
                        className="w-full px-3 py-2 text-xs bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                        value={scanMode}
                        onChange={(e) => setScanMode(e.target.value as any)}
                        disabled={scanMutation.isPending}
                      >
                        <option value="MASK">MASK (Redact findings with tokens)</option>
                        <option value="BLOCK">BLOCK (Block request on critical finding)</option>
                        <option value="AUDIT">AUDIT (Detect without altering text)</option>
                        <option value="ALLOW">ALLOW (Bypass scan)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">
                      Text to Scan
                    </label>
                    <textarea
                      className="w-full h-44 p-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring resize-y font-mono"
                      placeholder="Paste messages or text here to scan..."
                      value={promptText}
                      onChange={(e) => setPromptText(e.target.value)}
                      disabled={scanMutation.isPending}
                    />
                  </div>
                </CardContent>
                <CardFooter className="flex items-center justify-between border-t border-border pt-3">
                  <span className="text-xs text-muted-foreground">
                    {promptText.length} characters
                  </span>
                  <Button
                    onClick={() => scanMutation.mutate()}
                    disabled={scanMutation.isPending || !promptText.trim()}
                    className="gap-2 text-xs"
                  >
                    {scanMutation.isPending ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>Analyzing...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span>Execute Privacy Scan</span>
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </div>

            {/* Right: Scan Results */}
            <div className="lg:col-span-6 space-y-4">
              <Card className="min-h-[460px] flex flex-col">
                <CardHeader className="pb-3 border-b border-border">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Eye className="h-4 w-4 text-primary" />
                      <span>Scanner Decision & Findings</span>
                    </CardTitle>
                    {scanResult && (
                      <Badge
                        variant={
                          scanResult.action === 'BLOCK'
                            ? 'destructive'
                            : scanResult.action === 'MASK'
                            ? 'default'
                            : 'secondary'
                        }
                      >
                        {scanResult.action}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 p-4 space-y-4">
                  {!scanResult && !scanMutation.isPending ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground min-h-[300px]">
                      <ShieldCheck className="h-10 w-10 text-muted-foreground/30 mb-3" />
                      <p className="text-sm font-medium">No Scan Executed</p>
                      <p className="text-xs mt-1 max-w-xs text-muted-foreground/80">
                        Input text on the left and run a scan to inspect privacy actions and token replacements.
                      </p>
                    </div>
                  ) : scanMutation.isPending ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 min-h-[300px]">
                      <RefreshCw className="h-8 w-8 text-primary animate-spin mb-3" />
                      <p className="text-sm font-medium">Scanning against regex rules...</p>
                    </div>
                  ) : scanResult ? (
                    <div className="space-y-4">
                      {/* Scan Header Metrics */}
                      <div className="grid grid-cols-3 gap-2 p-3 bg-muted/40 rounded-lg border border-border text-xs">
                        <div>
                          <span className="text-muted-foreground block">Decision</span>
                          <span className="font-semibold text-foreground">{scanResult.decision}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Findings</span>
                          <span className="font-semibold text-foreground">{scanResult.findings.length} detected</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Scan Time</span>
                          <span className="font-semibold text-foreground">{scanResult.durationMs}ms</span>
                        </div>
                      </div>

                      {/* Findings Table */}
                      <div>
                        <h4 className="text-xs font-semibold text-foreground mb-2">Detected Sensitive Tokens</h4>
                        {scanResult.findings.length === 0 ? (
                          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-md text-xs flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4" />
                            <span>No sensitive entities or secrets were identified.</span>
                          </div>
                        ) : (
                          <div className="border border-border rounded-md overflow-hidden max-h-48 overflow-y-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-[11px] py-1.5">Category</TableHead>
                                  <TableHead className="text-[11px] py-1.5">Severity</TableHead>
                                  <TableHead className="text-[11px] py-1.5">Action</TableHead>
                                  <TableHead className="text-[11px] py-1.5">Replacement</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {scanResult.findings.map((f, i) => (
                                  <TableRow key={i}>
                                    <TableCell className="font-mono text-xs py-1.5">{f.category}</TableCell>
                                    <TableCell className="py-1.5">
                                      <Badge
                                        variant={f.severity === 'CRITICAL' || f.severity === 'HIGH' ? 'destructive' : 'outline'}
                                        className="text-[10px] px-1.5 py-0"
                                      >
                                        {f.severity}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs py-1.5">{f.action}</TableCell>
                                    <TableCell className="font-mono text-[11px] py-1.5 text-muted-foreground">
                                      {f.replacementToken || 'N/A'}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>

                      {/* Sanitized Messages View */}
                      {scanResult.sanitizedMessages && scanResult.sanitizedMessages.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <h4 className="text-xs font-semibold text-foreground">Sanitized Output Payload</h4>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[11px] px-2 gap-1"
                              onClick={() => handleCopy(scanResult.sanitizedMessages[0]?.content || '', 'sanitized')}
                            >
                              {copiedKey === 'sanitized' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                              <span>{copiedKey === 'sanitized' ? 'Copied' : 'Copy'}</span>
                            </Button>
                          </div>
                          <div className="p-3 bg-muted/60 border border-border rounded-md font-mono text-xs text-foreground whitespace-pre-wrap max-h-40 overflow-y-auto">
                            {scanResult.sanitizedMessages[0]?.content}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Limitations & Engine Specs */}
        <TabsContent value="limitations">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Engine Specifications & Limitations</CardTitle>
              <CardDescription className="text-xs">
                Verified capabilities and boundaries of the high-throughput Privacy Scanner service.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingLimits ? (
                <div className="p-6 space-y-2">
                  <div className="h-4 bg-muted rounded w-1/3 animate-pulse" />
                  <div className="h-20 bg-muted rounded animate-pulse" />
                </div>
              ) : limitations ? (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-xs font-semibold text-foreground mb-2">Supported Sensitive Categories</h4>
                    <div className="flex flex-wrap gap-2">
                      {limitations.supportedCategories?.map((cat) => (
                        <Badge key={cat} variant="secondary" className="font-mono text-xs px-2.5 py-1">
                          {cat}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {limitations.regexLimits && (
                    <div>
                      <h4 className="text-xs font-semibold text-foreground mb-2">Regex Engine Limits</h4>
                      <div className="p-3 bg-muted rounded-md font-mono text-xs overflow-x-auto">
                        <pre>{JSON.stringify(limitations.regexLimits, null, 2)}</pre>
                      </div>
                    </div>
                  )}

                  <div className="p-3.5 bg-blue-500/10 border border-blue-500/30 rounded-lg text-xs text-blue-600 dark:text-blue-400 space-y-1">
                    <span className="font-semibold block">Boundary Guarantees:</span>
                    <p>
                      1. Regular expressions are executed within bounded time limits to prevent ReDoS.
                    </p>
                    <p>
                      2. Sensitive strings are replaced with contextual tokens (e.g. [REDACTED_EMAIL_1]) to preserve semantic sentence structure for downstream LLM processing.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">Unable to query limitations.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Configuration & Custom Patterns */}
        <TabsContent value="configuration">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-semibold">Organization Privacy Rules</CardTitle>
                <CardDescription className="text-xs">
                  Configure enabled scanning categories and custom enterprise regex patterns.
                </CardDescription>
              </div>
              {isAdmin && (
                <Button size="sm" className="gap-1 text-xs" onClick={() => setIsPatternModalOpen(true)}>
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Custom Pattern</span>
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {privacyConfig ? (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-semibold text-foreground mb-2">Currently Enabled Categories</h4>
                    <div className="flex flex-wrap gap-2">
                      {privacyConfig.enabledCategories?.map((c) => (
                        <Badge key={c} variant="outline" className="text-xs font-mono">
                          {c}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  Loading configuration...
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Custom Pattern Dialog */}
      <Dialog open={isPatternModalOpen} onOpenChange={setIsPatternModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Add Custom Privacy Pattern</DialogTitle>
            <DialogDescription className="text-xs">
              Define an enterprise-specific regular expression pattern to detect and redact confidential tokens.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Pattern Name</label>
              <Input
                placeholder="e.g., Internal Project Codename"
                value={patternName}
                onChange={(e) => setPatternName(e.target.value)}
                className="text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Regex Expression</label>
              <Input
                placeholder="e.g., (PROJECT_AEGIS_[A-Z0-9]+)"
                value={patternRegex}
                onChange={(e) => setPatternRegex(e.target.value)}
                className="font-mono text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Severity</label>
                <select
                  className="w-full px-3 py-2 text-xs bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                  value={patternSeverity}
                  onChange={(e) => setPatternSeverity(e.target.value)}
                >
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="HIGH">HIGH</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="LOW">LOW</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Action</label>
                <select
                  className="w-full px-3 py-2 text-xs bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                  value={patternAction}
                  onChange={(e) => setPatternAction(e.target.value)}
                >
                  <option value="MASK">MASK</option>
                  <option value="BLOCK">BLOCK</option>
                  <option value="AUDIT">AUDIT</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Replacement Token</label>
              <Input
                value={patternReplacement}
                onChange={(e) => setPatternReplacement(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsPatternModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!patternName.trim() || !patternRegex.trim() || addPatternMutation.isPending}
              onClick={() => addPatternMutation.mutate()}
            >
              {addPatternMutation.isPending ? 'Saving...' : 'Save Pattern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
