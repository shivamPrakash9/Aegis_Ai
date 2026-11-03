import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { 
  Shield, 
  Search, 
  Filter, 
  RefreshCw, 
  ExternalLink, 
  ShieldCheck, 
  ShieldAlert, 
  Clock, 
  FileCode, 
  Copy, 
  Check,
  Layers,
  ChevronRight
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Skeleton } from '@/components/ui/Skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { auditApi } from '@/services/audit-api';
import { useToast } from '@/hooks/useToast';
import { AuditEvent, DigestVerificationResult } from '@/types';

export const SecurityAuditPage: React.FC = () => {
  const { toast } = useToast();

  const [searchId, setSearchId] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [sourceServiceFilter, setSourceServiceFilter] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  // Selected event modal & verification state
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [verifyingEventId, setVerifyingEventId] = useState<string | null>(null);
  const [verificationMap, setVerificationMap] = useState<Record<string, DigestVerificationResult>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['security-audit-events', eventTypeFilter, severityFilter, sourceServiceFilter, searchId, page],
    queryFn: () => {
      const trimmedSearch = searchId.trim();
      const isReq = trimmedSearch.startsWith('req_');
      const isTrace = trimmedSearch.startsWith('trace_') || trimmedSearch.startsWith('trc_');
      return auditApi.searchEvents({
        eventType: eventTypeFilter || undefined,
        severity: severityFilter || undefined,
        sourceService: sourceServiceFilter || undefined,
        requestId: isReq ? trimmedSearch : undefined,
        traceId: isTrace ? trimmedSearch : undefined,
        page,
        limit,
      });
    },
  });

  const events = data?.events || [];
  const pagination = data?.pagination || {
    page: 1,
    limit,
    total: events.length,
    totalPages: 1,
  };

  const handleVerifyDigest = async (eventId: string) => {
    setVerifyingEventId(eventId);
    try {
      const res = await auditApi.verifyEventDigest(eventId);
      setVerificationMap((prev) => ({ ...prev, [eventId]: res }));
      if (res.valid) {
        toast({
          title: 'Cryptographic Integrity Valid',
          description: `Digest matches HMAC/SHA-256 ledger record.`,
          variant: 'success',
        });
      } else {
        toast({
          title: 'Integrity Verification Failed',
          description: 'Calculated hash mismatch detected!',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Verification Failed',
        description: err.message || 'Error communicating with Security Audit service.',
        variant: 'destructive',
      });
    } finally {
      setVerifyingEventId(null);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
    toast({ title: 'Copied to clipboard', variant: 'default' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Security & Audit Explorer
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tamper-evident audit ledger with cryptographic HMAC/SHA-256 verification and distributed trace correlation.
          </p>
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

          <Badge variant="outline" className="px-3 py-1 text-xs font-mono">
            Service :3005
          </Badge>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search Request or Trace ID..."
                className="pl-9 text-xs"
                value={searchId}
                onChange={(e) => {
                  setSearchId(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <div>
              <select
                className="w-full px-3 py-2 text-xs bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                value={eventTypeFilter}
                onChange={(e) => {
                  setEventTypeFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Event Types</option>
                <option value="AI_REQUEST_ACCEPTED">AI_REQUEST_ACCEPTED</option>
                <option value="AI_REQUEST_COMPLETED">AI_REQUEST_COMPLETED</option>
                <option value="AI_REQUEST_BLOCKED_PRIVACY">AI_REQUEST_BLOCKED_PRIVACY</option>
                <option value="AI_REQUEST_BLOCKED_POLICY">AI_REQUEST_BLOCKED_POLICY</option>
                <option value="APPROVAL_REQUESTED">APPROVAL_REQUESTED</option>
                <option value="APPROVAL_DECIDED">APPROVAL_DECIDED</option>
                <option value="PRIVACY_SCAN_PERFORMED">PRIVACY_SCAN_PERFORMED</option>
              </select>
            </div>

            <div>
              <select
                className="w-full px-3 py-2 text-xs bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                value={severityFilter}
                onChange={(e) => {
                  setSeverityFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Severities</option>
                <option value="CRITICAL">CRITICAL</option>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
                <option value="INFO">INFO</option>
              </select>
            </div>

            <div>
              <select
                className="w-full px-3 py-2 text-xs bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                value={sourceServiceFilter}
                onChange={(e) => {
                  setSourceServiceFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Source Services</option>
                <option value="ai-gateway">AI Gateway</option>
                <option value="privacy-scanner">Privacy Scanner</option>
                <option value="policy-service">Policy & Approval</option>
                <option value="model-provider">Model Provider</option>
                <option value="identity-service">Identity</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Events Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : error ? (
            <div className="p-6">
              <ErrorState
                title="Failed to load audit events"
                message={(error as Error).message}
                onRetry={() => refetch()}
              />
            </div>
          ) : events.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={Shield}
                title="No Audit Events Found"
                description="No log records matched your query parameters."
                actionLabel="Reset Filters"
                onAction={() => {
                  setSearchId('');
                  setEventTypeFilter('');
                  setSeverityFilter('');
                  setSourceServiceFilter('');
                  setPage(1);
                }}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event Type</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Trace & Request</TableHead>
                    <TableHead>Integrity</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((ev) => {
                    const verification = verificationMap[ev.eventId];
                    const isVerifying = verifyingEventId === ev.eventId;

                    return (
                      <TableRow key={ev.eventId}>
                        <TableCell>
                          <div className="font-mono text-xs font-semibold text-foreground">
                            {ev.eventType}
                          </div>
                          <div className="font-mono text-[10px] text-muted-foreground">
                            ID: {ev.eventId.slice(0, 14)}...
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          <Badge variant="secondary" className="text-[10px]">
                            {ev.sourceService || 'gateway'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              ev.severity === 'CRITICAL' || ev.severity === 'HIGH'
                                ? 'destructive'
                                : 'outline'
                            }
                            className="text-[10px]"
                          >
                            {ev.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {new Date(ev.occurredAt).toLocaleTimeString()}
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          <div className="space-y-0.5">
                            {ev.traceId && (
                              <Link
                                to={`/traces?traceId=${ev.traceId}`}
                                className="text-primary hover:underline flex items-center gap-1 text-[11px]"
                              >
                                <span>trc: {ev.traceId.slice(0, 8)}...</span>
                                <ExternalLink className="h-2.5 w-2.5" />
                              </Link>
                            )}
                            {ev.requestId && (
                              <Link
                                to={`/requests/${ev.requestId}`}
                                className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-[11px]"
                              >
                                <span>req: {ev.requestId.slice(0, 8)}...</span>
                              </Link>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {verification ? (
                            verification.valid ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                                <ShieldCheck className="h-3.5 w-3.5" />
                                <span>Verified</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-destructive text-xs font-medium">
                                <ShieldAlert className="h-3.5 w-3.5" />
                                <span>Tampered</span>
                              </span>
                            )
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[11px] px-2 gap-1 text-muted-foreground hover:text-foreground"
                              disabled={isVerifying}
                              onClick={() => handleVerifyDigest(ev.eventId)}
                            >
                              {isVerifying ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                <ShieldCheck className="h-3 w-3" />
                              )}
                              <span>Check</span>
                            </Button>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1"
                            onClick={() => setSelectedEvent(ev)}
                          >
                            <FileCode className="h-3.5 w-3.5" />
                            <span>Payload</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span>
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total log records)
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="text-xs h-8"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="text-xs h-8"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Inspect Event Payload Dialog */}
      {selectedEvent && (
        <Dialog open={Boolean(selectedEvent)} onOpenChange={(open) => !open && setSelectedEvent(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold font-mono flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
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
                  onClick={() => handleCopy(JSON.stringify(selectedEvent, null, 2), 'audit-payload')}
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
