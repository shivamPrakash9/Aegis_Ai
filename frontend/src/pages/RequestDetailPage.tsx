import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  FileText, 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle, 
  Copy, 
  Check, 
  ExternalLink, 
  Play, 
  RefreshCw,
  Clock,
  Layers,
  Sparkles,
  Bot
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { gatewayApi } from '@/services/gateway-api';
import { useToast } from '@/hooks/useToast';

export const RequestDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const { data: request, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['ai-request-detail', id],
    queryFn: () => gatewayApi.getRequestById(id!),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 1000;
      if (['ACCEPTED', 'PROCESSING'].includes(data.status)) {
        return 1200;
      }
      return false;
    },
  });

  const resumeMutation = useMutation({
    mutationFn: () => gatewayApi.resumeRequest(id!),
    onSuccess: (updated) => {
      toast({
        title: 'Request Resumed',
        description: `Request transitioned to ${updated.status}.`,
        variant: 'success',
      });
      queryClient.invalidateQueries({ queryKey: ['ai-request-detail', id] });
      refetch();
    },
    onError: (err: any) => {
      toast({
        title: 'Resume Failed',
        description: err.message || 'Could not resume request. Ensure it has been approved in the Approval Center.',
        variant: 'destructive',
      });
    },
  });

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
    toast({ title: 'Copied to clipboard', variant: 'default' });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="p-6">
        <ErrorState
          title="Request Not Found"
          message={(error as Error)?.message || 'The specified AI request could not be retrieved.'}
          onRetry={() => refetch()}
        />
        <div className="mt-4">
          <Button variant="outline" size="sm" onClick={() => navigate('/requests')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Requests
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/requests')}
            className="h-8 px-2"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <span>Request Details</span>
            </h1>
            <p className="text-xs font-mono text-muted-foreground mt-0.5">
              ID: {request.id}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-1 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
          {request.traceId && (
            <Link to={`/traces?traceId=${request.traceId}`}>
              <Button size="sm" variant="secondary" className="gap-1 text-xs">
                <Layers className="h-3.5 w-3.5" />
                <span>View Trace</span>
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Primary Status Banner */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <span className="text-xs text-muted-foreground block mb-1">Status</span>
              <StatusBadge status={request.status} />
            </div>

            <div>
              <span className="text-xs text-muted-foreground block mb-1">Dispatched Model</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-sm text-foreground">
                  {request.modelSelected || 'Not selected / Auto-routed'}
                </span>
                {(request.sanitizedResult?.includes('[Mock Assistant Response]') ||
                  request.modelSelected?.includes('mock')) && (
                  <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30">
                    MOCK
                  </Badge>
                )}
              </div>
            </div>

            <div>
              <span className="text-xs text-muted-foreground block mb-1">Privacy Decision</span>
              <Badge variant={request.privacyAction === 'BLOCK' ? 'destructive' : 'secondary'} className="text-xs">
                {request.privacyAction || 'ALLOW'}
              </Badge>
            </div>

            <div>
              <span className="text-xs text-muted-foreground block mb-1">Policy Decision</span>
              <Badge variant={request.policyDecision === 'DENY' ? 'destructive' : 'secondary'} className="text-xs">
                {request.policyDecision || 'ALLOW'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Human Approval Alert if applicable */}
      {request.status === 'WAITING_FOR_APPROVAL' && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-foreground">Awaiting Human Approval</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  This request exceeded standard organizational risk thresholds and requires review in the Approval Center.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Link to="/approvals" className="w-full sm:w-auto">
                <Button size="sm" variant="outline" className="w-full text-xs">
                  Review Approvals
                </Button>
              </Link>
              <Button
                size="sm"
                onClick={() => resumeMutation.mutate()}
                disabled={resumeMutation.isPending}
                className="w-full sm:w-auto text-xs gap-1"
              >
                {resumeMutation.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                <span>Resume Execution</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sanitized Prompt Dispatched (if privacy filtering applied) */}
      {request.sanitizedPromptSummary && (
        <Card>
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <span>Sanitized Prompt (Privacy Enforced)</span>
              </CardTitle>
              <Badge variant="outline" className="text-xs">Masked Input</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-5">
            <div className="p-4 rounded-md bg-muted/30 border border-border font-mono text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {request.sanitizedPromptSummary}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assistant Model Output */}
      {(() => {
        const outputText =
          request.assistantAnswer ??
          request.sanitizedResult ??
          (request as any).result ??
          (request as any).response;

        const isMock =
          (outputText && outputText.includes('[Mock Assistant Response]')) ||
          request.modelSelected?.includes('mock');

        return (
          <Card>
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Bot className="h-5 w-5 text-primary" />
                    <span>Assistant Answer (Sanitized Model Output)</span>
                  </CardTitle>
                  {isMock ? (
                    <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30 bg-amber-500/5">
                      DETERMINISTIC MOCK ADAPTER
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/30 bg-emerald-500/5">
                      LIVE UPSTREAM COMPLETION
                    </Badge>
                  )}
                </div>
                {outputText && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => handleCopy(outputText, 'sanitizedResult')}
                  >
                    {copiedKey === 'sanitizedResult' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedKey === 'sanitizedResult' ? 'Copied' : 'Copy'}</span>
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-5">
              {outputText ? (
                <div className="p-4 rounded-md bg-muted/60 border border-border text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">
                  {outputText}
                </div>
              ) : request.errorMessage ? (
                <div className="p-4 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <ShieldAlert className="h-4 w-4" />
                    <span>Execution Error ({request.errorCode || 'UNKNOWN_ERROR'})</span>
                  </div>
                  <p className="text-xs">{request.errorMessage}</p>
                </div>
              ) : ['ACCEPTED', 'PROCESSING'].includes(request.status) ? (
                <div className="p-8 text-center text-muted-foreground text-xs flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                  <span>Request is currently processing through the gateway security pipeline...</span>
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground text-xs italic">
                  No output generated yet for this request state.
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* Metadata & Audit Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Timing & Lifecycle</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex justify-between items-center py-1.5 border-b border-border">
              <span className="text-muted-foreground">Submitted At:</span>
              <span className="font-mono text-foreground">{new Date(request.createdAt).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-border">
              <span className="text-muted-foreground">Last Updated:</span>
              <span className="font-mono text-foreground">{new Date(request.updatedAt).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center py-1.5">
              <span className="text-muted-foreground">Completed At:</span>
              <span className="font-mono text-foreground">
                {request.completedAt ? new Date(request.completedAt).toLocaleString() : 'In Progress / Pending'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Correlation & Audit</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex justify-between items-center py-1.5 border-b border-border">
              <span className="text-muted-foreground">Request ID:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="font-mono text-primary hover:underline flex items-center gap-1"
                  onClick={() => handleCopy(request.id, 'id')}
                >
                  <span>{request.id}</span>
                  {copiedKey === 'id' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                </button>
                <span className="text-muted-foreground">·</span>
                <Link
                  to={`/audit?query=${request.id}`}
                  className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                  title="Search in Security Audit"
                >
                  <span>Audit</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>

            <div className="flex justify-between items-center py-1.5">
              <span className="text-muted-foreground">Security Trace:</span>
              {request.traceId ? (
                <div className="flex items-center gap-2">
                  <Link
                    to={`/traces?traceId=${request.traceId}`}
                    className="font-mono text-primary hover:underline flex items-center gap-1"
                  >
                    <span>{request.traceId}</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                  <span className="text-muted-foreground">·</span>
                  <Link
                    to={`/audit?query=${request.traceId}`}
                    className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                    title="Audit Trace Events"
                  >
                    <span>Audit Explorer</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              ) : (
                <span className="text-muted-foreground italic">None</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
