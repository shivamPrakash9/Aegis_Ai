import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ShieldCheck, 
  Plus, 
  Power, 
  PowerOff, 
  RefreshCw, 
  Eye, 
  AlertTriangle, 
  CheckCircle, 
  Sliders, 
  FileCode,
  Tag,
  Edit3,
  Trash2
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Skeleton } from '@/components/ui/Skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { policyApi } from '@/services/policy-api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Policy, PolicyRule } from '@/types';

export const PoliciesPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [toggleConfirmPolicy, setToggleConfirmPolicy] = useState<Policy | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Edit policy state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);
  const [editRules, setEditRules] = useState<PolicyRule[]>([]);
  const [editVersionDesc, setEditVersionDesc] = useState('');

  // New policy form state
  const [newPolicyName, setNewPolicyName] = useState('');
  const [newPolicyDesc, setNewPolicyDesc] = useState('');
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleEffect, setNewRuleEffect] = useState<'ALLOW' | 'DENY' | 'REQUIRE_APPROVAL'>('REQUIRE_APPROVAL');
  const [newRuleReason, setNewRuleReason] = useState('');
  const [newRuleField, setNewRuleField] = useState('modelPreference.model');
  const [newRuleOperator, setNewRuleOperator] = useState<'eq' | 'neq' | 'contains' | 'has_role'>('contains');
  const [newRuleValue, setNewRuleValue] = useState('claude-3-opus');

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['policies-list'],
    queryFn: () => policyApi.listPolicies(),
  });

  const policies = data?.items || [];

  // Toggle Policy Activation Mutation
  const toggleMutation = useMutation({
    mutationFn: async (policy: Policy) => {
      if (policy.status === 'ACTIVE') {
        return policyApi.deactivatePolicy(policy.id);
      } else {
        return policyApi.activatePolicy(policy.id);
      }
    },
    onSuccess: (updated) => {
      toast({
        title: `Policy ${updated.status === 'ACTIVE' ? 'Activated' : 'Deactivated'}`,
        description: `Policy "${updated.name}" is now ${updated.status.toLowerCase()}.`,
        variant: 'default',
      });
      queryClient.invalidateQueries({ queryKey: ['policies-list'] });
      setToggleConfirmPolicy(null);
    },
    onError: (err: any) => {
      toast({
        title: 'Action Failed',
        description: err.message || 'Could not update policy status.',
        variant: 'destructive',
      });
      setToggleConfirmPolicy(null);
    },
  });

  // Create Policy Mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const initialRule: PolicyRule = {
        id: `rule_${Date.now()}`,
        name: newRuleName || 'Default Evaluation Rule',
        effect: newRuleEffect,
        reason: newRuleReason || `Triggered effect: ${newRuleEffect}`,
        condition: {
          field: newRuleField,
          operator: newRuleOperator,
          value: newRuleValue,
        },
      };

      return policyApi.createPolicy({
        name: newPolicyName,
        description: newPolicyDesc,
        rules: [initialRule],
      });
    },
    onSuccess: () => {
      toast({
        title: 'Policy Created',
        description: 'New enterprise governance policy saved successfully.',
        variant: 'success',
      });
      setIsCreateModalOpen(false);
      setNewPolicyName('');
      setNewPolicyDesc('');
      queryClient.invalidateQueries({ queryKey: ['policies-list'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Failed to create policy',
        description: err.message || 'Error creating policy.',
        variant: 'destructive',
      });
    },
  });

  const openEditModal = (policy: Policy) => {
    setEditingPolicy(policy);
    const existingRules = policy.versions?.[0]?.rules || [];
    if (existingRules.length > 0) {
      setEditRules([...existingRules]);
    } else {
      setEditRules([
        {
          id: `rule_${Date.now()}`,
          name: 'Primary Access Rule',
          effect: 'REQUIRE_APPROVAL',
          reason: 'Automated policy rule check',
          condition: {
            field: 'modelPreference.model',
            operator: 'contains',
            value: 'gpt-4',
          },
        },
      ]);
    }
    setEditVersionDesc(`Updated rules on ${new Date().toLocaleDateString()}`);
    setIsEditModalOpen(true);
  };

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editingPolicy) throw new Error('No policy selected for editing');
      return policyApi.createPolicyVersion(editingPolicy.id, {
        rules: editRules,
        description: editVersionDesc,
        activate: true,
      });
    },
    onSuccess: () => {
      toast({
        title: 'Policy Updated',
        description: 'New policy version published and activated successfully.',
        variant: 'success',
      });
      setIsEditModalOpen(false);
      setEditingPolicy(null);
      queryClient.invalidateQueries({ queryKey: ['policies-list'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Failed to update policy',
        description: err.message || 'Error updating policy version.',
        variant: 'destructive',
      });
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Enterprise Policy Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure automated rules, approval gates, and model access boundaries across your organization.
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

          {isAdmin && (
            <Button size="sm" onClick={() => setIsCreateModalOpen(true)} className="gap-1 text-xs">
              <Plus className="h-3.5 w-3.5" />
              <span>Create Policy</span>
            </Button>
          )}
        </div>
      </div>

      {/* Policies Table Card */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : error ? (
            <div className="p-6">
              <ErrorState
                title="Failed to load policies"
                message={(error as Error).message}
                onRetry={() => refetch()}
              />
            </div>
          ) : policies.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={ShieldCheck}
                title="No Policies Configured"
                description="Your organization has not defined any enterprise governance policies yet."
                actionLabel={isAdmin ? 'Create First Policy' : undefined}
                onAction={isAdmin ? () => setIsCreateModalOpen(true) : undefined}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Policy Name</TableHead>
                    <TableHead className="w-[120px]">Status</TableHead>
                    <TableHead className="w-[100px]">Priority</TableHead>
                    <TableHead className="w-[120px]">Version</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policies.map((policy) => (
                    <TableRow key={policy.id}>
                      <TableCell>
                        <div className="font-semibold text-xs text-foreground">{policy.name}</div>
                        {policy.description && (
                          <div className="text-[11px] text-muted-foreground mt-0.5 max-w-sm truncate">
                            {policy.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={policy.status === 'ACTIVE' ? 'default' : 'secondary'}
                          className="text-[11px]"
                        >
                          {policy.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono font-medium">
                        {policy.priority}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        v{policy.activeVersion}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="text-[10px]">
                          {policy.category || 'GENERAL'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1"
                            onClick={() => setSelectedPolicy(policy)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Rules</span>
                          </Button>

                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs gap-1 text-primary hover:text-primary"
                              onClick={() => openEditModal(policy)}
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                              <span>Edit</span>
                            </Button>
                          )}

                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-7 px-2 text-xs gap-1 ${
                                policy.status === 'ACTIVE' ? 'text-destructive' : 'text-emerald-600'
                              }`}
                              onClick={() => setToggleConfirmPolicy(policy)}
                            >
                              {policy.status === 'ACTIVE' ? (
                                <>
                                  <PowerOff className="h-3.5 w-3.5" />
                                  <span>Deactivate</span>
                                </>
                              ) : (
                                <>
                                  <Power className="h-3.5 w-3.5" />
                                  <span>Activate</span>
                                </>
                              )}
                            </Button>
                          )}
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

      {/* Inspect Policy Rules Modal */}
      {selectedPolicy && (
        <Dialog open={Boolean(selectedPolicy)} onOpenChange={(open) => !open && setSelectedPolicy(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold flex items-center gap-2">
                <FileCode className="h-5 w-5 text-primary" />
                <span>{selectedPolicy.name}</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                {selectedPolicy.description || 'Active policy rules and evaluation criteria.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-3 text-xs">
                <Badge variant={selectedPolicy.status === 'ACTIVE' ? 'default' : 'secondary'}>
                  {selectedPolicy.status}
                </Badge>
                <span className="text-muted-foreground">Priority: <strong className="text-foreground">{selectedPolicy.priority}</strong></span>
                <span className="text-muted-foreground">Version: <strong className="text-foreground">v{selectedPolicy.activeVersion}</strong></span>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-foreground">Rule Definitions</h4>
                {selectedPolicy.versions?.[0]?.rules?.length ? (
                  selectedPolicy.versions[0].rules.map((rule, idx) => (
                    <Card key={rule.id || idx} className="p-3 bg-muted/40 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">{rule.name}</span>
                        <Badge
                          variant={
                            rule.effect === 'DENY'
                              ? 'destructive'
                              : rule.effect === 'REQUIRE_APPROVAL'
                              ? 'default'
                              : 'secondary'
                          }
                          className="text-[10px]"
                        >
                          {rule.effect}
                        </Badge>
                      </div>

                      {rule.reason && (
                        <p className="text-muted-foreground text-[11px]">{rule.reason}</p>
                      )}

                      <div className="p-2 bg-background border border-border rounded font-mono text-[11px] overflow-x-auto">
                        <pre>{JSON.stringify(rule.condition, null, 2)}</pre>
                      </div>
                    </Card>
                  ))
                ) : (
                  <div className="p-4 bg-muted rounded text-xs text-muted-foreground text-center">
                    Rule definition structure: {JSON.stringify(selectedPolicy.versions || selectedPolicy)}
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Button size="sm" onClick={() => setSelectedPolicy(null)}>
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Confirmation Dialog for Toggle Status */}
      {toggleConfirmPolicy && (
        <ConfirmDialog
          open={Boolean(toggleConfirmPolicy)}
          onOpenChange={(open) => !open && setToggleConfirmPolicy(null)}
          title={`${toggleConfirmPolicy.status === 'ACTIVE' ? 'Deactivate' : 'Activate'} Policy`}
          description={`Are you sure you want to ${
            toggleConfirmPolicy.status === 'ACTIVE' ? 'deactivate' : 'activate'
          } "${toggleConfirmPolicy.name}"? This will immediately affect live AI request evaluation.`}
          confirmLabel={toggleConfirmPolicy.status === 'ACTIVE' ? 'Deactivate Policy' : 'Activate Policy'}
          variant={toggleConfirmPolicy.status === 'ACTIVE' ? 'destructive' : 'default'}
          onConfirm={() => toggleMutation.mutate(toggleConfirmPolicy)}
        />
      )}

      {/* Create Policy Dialog */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Create Governance Policy</DialogTitle>
            <DialogDescription className="text-xs">
              Define a new organizational policy rule to enforce model usage restrictions or require manual approvals.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div>
              <label className="font-medium text-foreground block mb-1">Policy Name</label>
              <Input
                placeholder="e.g., Require Approval for Frontier LLMs"
                value={newPolicyName}
                onChange={(e) => setNewPolicyName(e.target.value)}
                className="text-xs"
              />
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">Description</label>
              <Input
                placeholder="Brief justification or purpose..."
                value={newPolicyDesc}
                onChange={(e) => setNewPolicyDesc(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="p-3 bg-muted/40 rounded-lg border border-border space-y-3">
              <h4 className="font-semibold text-foreground">Initial Rule Definition</h4>

              <div>
                <label className="font-medium text-foreground block mb-1">Rule Name</label>
                <Input
                  placeholder="e.g., Block Frontier Models"
                  value={newRuleName}
                  onChange={(e) => setNewRuleName(e.target.value)}
                  className="text-xs bg-background"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-foreground block mb-1">Enforcement Effect</label>
                  <select
                    className="w-full px-3 py-2 text-xs bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                    value={newRuleEffect}
                    onChange={(e) => setNewRuleEffect(e.target.value as any)}
                  >
                    <option value="REQUIRE_APPROVAL">REQUIRE_APPROVAL</option>
                    <option value="DENY">DENY</option>
                    <option value="ALLOW">ALLOW</option>
                  </select>
                </div>

                <div>
                  <label className="font-medium text-foreground block mb-1">Target Field</label>
                  <select
                    className="w-full px-3 py-2 text-xs bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                    value={newRuleField}
                    onChange={(e) => setNewRuleField(e.target.value)}
                  >
                    <option value="modelPreference.model">modelPreference.model</option>
                    <option value="caller.role">caller.role</option>
                    <option value="metadata.environment">metadata.environment</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-foreground block mb-1">Operator</label>
                  <select
                    className="w-full px-3 py-2 text-xs bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                    value={newRuleOperator}
                    onChange={(e) => setNewRuleOperator(e.target.value as any)}
                  >
                    <option value="contains">contains</option>
                    <option value="eq">equals (eq)</option>
                    <option value="neq">not equals (neq)</option>
                    <option value="has_role">has_role</option>
                  </select>
                </div>

                <div>
                  <label className="font-medium text-foreground block mb-1">Value Match</label>
                  <Input
                    placeholder="e.g., claude-3-opus or gpt-4"
                    value={newRuleValue}
                    onChange={(e) => setNewRuleValue(e.target.value)}
                    className="text-xs bg-background"
                  />
                </div>
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1">Audit Reason</label>
                <Input
                  placeholder="Reason logged in audit trail..."
                  value={newRuleReason}
                  onChange={(e) => setNewRuleReason(e.target.value)}
                  className="text-xs bg-background"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!newPolicyName.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? 'Creating...' : 'Create Policy'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Policy Version Dialog */}
      {editingPolicy && (
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold flex items-center gap-2">
                <Edit3 className="h-5 w-5 text-primary" />
                <span>Edit Policy: {editingPolicy.name}</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Publish a new version (v{editingPolicy.activeVersion + 1}) with updated governance rules and enforcement criteria.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div>
                <label className="font-medium text-foreground block mb-1">Version Release Notes</label>
                <Input
                  placeholder="e.g., Updated model restrictions for Q2 security baseline"
                  value={editVersionDesc}
                  onChange={(e) => setEditVersionDesc(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-foreground">Active Rules ({editRules.length})</h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => {
                      setEditRules((prev) => [
                        ...prev,
                        {
                          id: `rule_${Date.now()}`,
                          name: `Rule ${prev.length + 1}`,
                          effect: 'REQUIRE_APPROVAL',
                          reason: 'Human review required for high-risk model usage',
                          condition: {
                            field: 'modelPreference.model',
                            operator: 'contains',
                            value: 'gpt-4',
                          },
                        },
                      ]);
                    }}
                  >
                    <Plus className="h-3 w-3" />
                    Add Rule
                  </Button>
                </div>

                {editRules.map((rule, idx) => (
                  <div key={rule.id || idx} className="p-3 bg-muted/40 rounded-lg border border-border space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Input
                        value={rule.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditRules((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, name: val } : r))
                          );
                        }}
                        placeholder="Rule name"
                        className="text-xs font-semibold bg-background h-7"
                      />
                      <select
                        className="px-2 py-1 text-xs bg-background border border-input rounded-md h-7 focus:outline-none"
                        value={rule.effect}
                        onChange={(e) => {
                          const val = e.target.value as any;
                          setEditRules((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, effect: val } : r))
                          );
                        }}
                      >
                        <option value="REQUIRE_APPROVAL">REQUIRE_APPROVAL</option>
                        <option value="DENY">DENY</option>
                        <option value="ALLOW">ALLOW</option>
                      </select>
                      {editRules.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                          onClick={() => setEditRules((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-0.5">Target Field</label>
                        <select
                          className="w-full px-2 py-1 text-xs bg-background border border-input rounded-md h-7 focus:outline-none"
                          value={rule.condition?.field || 'modelPreference.model'}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditRules((prev) =>
                              prev.map((r, i) =>
                                i === idx ? { ...r, condition: { ...r.condition, field: val } } : r
                              )
                            );
                          }}
                        >
                          <option value="modelPreference.model">modelPreference.model</option>
                          <option value="caller.role">caller.role</option>
                          <option value="metadata.environment">metadata.environment</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-0.5">Operator</label>
                        <select
                          className="w-full px-2 py-1 text-xs bg-background border border-input rounded-md h-7 focus:outline-none"
                          value={rule.condition?.operator || 'contains'}
                          onChange={(e) => {
                            const val = e.target.value as any;
                            setEditRules((prev) =>
                              prev.map((r, i) =>
                                i === idx ? { ...r, condition: { ...r.condition, operator: val } } : r
                              )
                            );
                          }}
                        >
                          <option value="contains">contains</option>
                          <option value="eq">equals (eq)</option>
                          <option value="neq">not equals (neq)</option>
                          <option value="has_role">has_role</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-0.5">Match Value</label>
                        <Input
                          value={String(rule.condition?.value ?? '')}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditRules((prev) =>
                              prev.map((r, i) =>
                                i === idx ? { ...r, condition: { ...r.condition, value: val } } : r
                              )
                            );
                          }}
                          placeholder="e.g., claude or gpt-4"
                          className="text-xs bg-background h-7"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-0.5">Audit Reason</label>
                      <Input
                        value={rule.reason || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditRules((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, reason: val } : r))
                          );
                        }}
                        placeholder="Reason logged when triggered"
                        className="text-xs bg-background h-7"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={editRules.length === 0 || editMutation.isPending}
                onClick={() => editMutation.mutate()}
              >
                {editMutation.isPending ? 'Publishing Version...' : 'Publish & Activate Version'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
