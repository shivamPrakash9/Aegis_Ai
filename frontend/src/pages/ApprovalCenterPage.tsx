import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  RefreshCw, 
  ExternalLink, 
  FileText, 
  UserCheck, 
  ShieldAlert, 
  MessageSquare,
  Play
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { policyApi } from '@/services/policy-api';
import { gatewayApi } from '@/services/gateway-api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { ApprovalRequest, ApprovalStatus } from '@/types';

export const ApprovalCenterPage: React.FC = () => {
  const { user, isAuditor } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'PENDING' | 'HISTORY'>('PENDING');
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [decisionAction, setDecisionAction] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [decisionReason, setDecisionReason] = useState('');
  const [autoResumeGateway, setAutoResumeGateway] = useState(true);

  // Fetch pending approvals
  const { 
    data: pendingData, 
    isLoading: isLoadingPending, 
    error: pendingError, 
    refetch: refetchPending,
    isFetching: isFetchingPending
  } = useQuery({
    queryKey: ['approvals', 'PENDING'],
    queryFn: () => policyApi.listApprovals({ status: 'PENDING' }),
  });

  // Fetch history approvals
  const { 
    data: historyData, 
    isLoading: isLoadingHistory, 
    error: historyError, 
    refetch: refetchHistory,
    isFetching: isFetchingHistory 
  } = useQuery({
    queryKey: ['approvals', 'HISTORY'],
    queryFn: () => policyApi.listApprovals(),
    enabled: activeTab === 'HISTORY',
  });

  const pendingApprovals = pendingData?.items || [];
  const allApprovals = historyData?.items || [];
  const historyApprovals = allApprovals.filter((a) => a.status !== 'PENDING');

  // Submit Approval Decision Mutation
  const decisionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedApproval) throw new Error('No approval selected');
      
      const updated = await policyApi.submitApprovalDecision(
        selectedApproval.id,
        decisionAction,
        decisionReason || `Reviewed by ${user?.displayName || 'Approver'}`
      );

      // If approved and auto-resume is toggled on, unblock the AI Gateway pipeline
      if (decisionAction === 'APPROVED' && selectedApproval.requestId && autoResumeGateway) {
        try {
          await gatewayApi.resumeRequest(selectedApproval.requestId);
          toast({
            title: 'Gateway Pipeline Resumed',
            description: `Request ${selectedApproval.requestId.slice(0, 8)}... was resumed to execution.`,
            variant: 'success',
          });
        } catch (resErr: any) {
          toast({
            title: 'Gateway Resume Failed',
            description: resErr.message || 'Approval logged, but automated resume call returned an error.',
            variant: 'destructive',
          });
        }
      }

      return updated;
    },
    onSuccess: (result) => {
      toast({
        title: `Approval ${result.status}`,
        description: `Decision has been recorded in the security audit ledger.`,
        variant: result.status === 'APPROVED' ? 'success' : 'destructive',
      });
      setSelectedApproval(null);
      setDecisionReason('');
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      refetchPending();
    },
    onError: (err: any) => {
      toast({
        title: 'Decision Error',
        description: err.message || 'Failed to submit approval decision.',
        variant: 'destructive',
      });
    },
  });

  const openDecisionModal = (approval: ApprovalRequest, action: 'APPROVED' | 'REJECTED') => {
    setSelectedApproval(approval);
    setDecisionAction(action);
    setDecisionReason(action === 'APPROVED' ? 'Approved for execution after review.' : 'Rejected by security auditor policy check.');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-primary" />
            Human Approval Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review, authorize, or reject flagged AI requests suspended by policy evaluation gates.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchPending();
              if (activeTab === 'HISTORY') refetchHistory();
            }}
            disabled={isFetchingPending || isFetchingHistory}
            className="gap-1 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${(isFetchingPending || isFetchingHistory) ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          <Badge variant="outline" className="px-3 py-1 text-xs font-mono">
            {pendingApprovals.length} Pending Action
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="PENDING" className="gap-2">
            <span>Pending Approvals</span>
            {pendingApprovals.length > 0 && (
              <span className="h-4 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                {pendingApprovals.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="HISTORY">Decision History</TabsTrigger>
        </TabsList>

        {/* Tab 1: Pending Queue */}
        <TabsContent value="PENDING">
          <Card>
            <CardContent className="p-0">
              {isLoadingPending ? (
                <div className="p-6 space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : pendingError ? (
                <div className="p-6">
                  <ErrorState
                    title="Failed to load approvals"
                    message={(pendingError as Error).message}
                    onRetry={() => refetchPending()}
                  />
                </div>
              ) : pendingApprovals.length === 0 ? (
                <div className="p-8">
                  <EmptyState
                    icon={CheckCircle2}
                    title="All Caught Up"
                    description="There are currently no AI requests awaiting human approval."
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Correlated Request</TableHead>
                        <TableHead>Reason & Trigger</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead>Requester</TableHead>
                        <TableHead>Expires In</TableHead>
                        <TableHead className="text-right">Decision Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingApprovals.map((req) => (
                        <TableRow key={req.id}>
                          <TableCell className="font-mono text-xs font-medium">
                            {req.requestId ? (
                              <Link
                                to={`/requests/${req.requestId}`}
                                className="text-primary hover:underline flex items-center gap-1"
                              >
                                <span>{req.requestId.slice(0, 14)}...</span>
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                            ) : (
                              <span className="text-muted-foreground italic">None</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-xs font-semibold text-foreground">{req.reason}</div>
                            {req.ruleId && (
                              <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
                                Rule: {req.ruleId}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="outline" className="font-mono text-[11px]">
                              {req.modelRequested || 'Auto-select'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            <span className="font-medium text-foreground">{req.requesterRole || 'DEVELOPER'}</span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground font-mono">
                            {req.expiresAt ? new Date(req.expiresAt).toLocaleTimeString() : 'N/A'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2.5 text-xs text-destructive hover:bg-destructive/10 border-destructive/30"
                                onClick={() => openDecisionModal(req, 'REJECTED')}
                              >
                                <XCircle className="h-3.5 w-3.5 mr-1" />
                                <span>Reject</span>
                              </Button>
                              <Button
                                size="sm"
                                className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => openDecisionModal(req, 'APPROVED')}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                <span>Approve</span>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Decision History */}
        <TabsContent value="HISTORY">
          <Card>
            <CardContent className="p-0">
              {isLoadingHistory ? (
                <div className="p-6 space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : historyError ? (
                <div className="p-6">
                  <ErrorState
                    title="Failed to load approval history"
                    message={(historyError as Error).message}
                    onRetry={() => refetchHistory()}
                  />
                </div>
              ) : historyApprovals.length === 0 ? (
                <div className="p-8">
                  <EmptyState
                    icon={Clock}
                    title="No Historical Decisions"
                    description="No prior approvals or rejections have been processed."
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Request ID</TableHead>
                        <TableHead>Outcome</TableHead>
                        <TableHead>Trigger Reason</TableHead>
                        <TableHead>Decision Justification</TableHead>
                        <TableHead>Decided At</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyApprovals.map((req) => (
                        <TableRow key={req.id}>
                          <TableCell className="font-mono text-xs">
                            {req.requestId ? (
                              <Link to={`/requests/${req.requestId}`} className="text-primary hover:underline">
                                {req.requestId.slice(0, 14)}...
                              </Link>
                            ) : (
                              'N/A'
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                req.status === 'APPROVED'
                                  ? 'default'
                                  : req.status === 'REJECTED'
                                  ? 'destructive'
                                  : 'secondary'
                              }
                              className="text-[11px]"
                            >
                              {req.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-medium text-foreground">
                            {req.reason}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground italic">
                            {req.decisionReason || 'No comment provided'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground font-mono">
                            {req.decisionAt ? new Date(req.decisionAt).toLocaleString() : 'N/A'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Decision Input Modal */}
      {selectedApproval && (
        <Dialog open={Boolean(selectedApproval)} onOpenChange={(open) => !open && setSelectedApproval(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-base font-semibold flex items-center gap-2">
                {decisionAction === 'APPROVED' ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
                <span>
                  {decisionAction === 'APPROVED' ? 'Authorize AI Request' : 'Reject AI Request'}
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Provide an audit justification for your decision. This will be signed into the security audit ledger.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div className="p-3 bg-muted/50 rounded-lg space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Trigger Reason:</span>
                  <span className="font-medium text-foreground">{selectedApproval.reason}</span>
                </div>
                {selectedApproval.modelRequested && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Requested Model:</span>
                    <span className="font-mono text-foreground">{selectedApproval.modelRequested}</span>
                  </div>
                )}
                {selectedApproval.requestId && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Request ID:</span>
                    <span className="font-mono text-foreground">{selectedApproval.requestId}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1">
                  Audit Justification / Comment (Required)
                </label>
                <textarea
                  className="w-full h-24 p-2.5 text-xs bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring resize-none font-sans"
                  placeholder="Enter reason for this decision..."
                  value={decisionReason}
                  onChange={(e) => setDecisionReason(e.target.value)}
                />
              </div>

              {decisionAction === 'APPROVED' && selectedApproval.requestId && (
                <div className="flex items-center gap-2 p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-md text-xs text-foreground">
                  <input
                    type="checkbox"
                    id="auto-resume"
                    checked={autoResumeGateway}
                    onChange={(e) => setAutoResumeGateway(e.target.checked)}
                    className="h-4 w-4 rounded accent-primary"
                  />
                  <label htmlFor="auto-resume" className="cursor-pointer">
                    Automatically resume AI Gateway request processing immediately upon approval
                  </label>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setSelectedApproval(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant={decisionAction === 'APPROVED' ? 'default' : 'destructive'}
                disabled={!decisionReason.trim() || decisionMutation.isPending}
                onClick={() => decisionMutation.mutate()}
                className="gap-1.5"
              >
                {decisionMutation.isPending ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : decisionAction === 'APPROVED' ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <XCircle className="h-3.5 w-3.5" />
                )}
                <span>Confirm {decisionAction === 'APPROVED' ? 'Approval' : 'Rejection'}</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
