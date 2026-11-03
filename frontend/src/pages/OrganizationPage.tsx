import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Building2, 
  Shield, 
  Users, 
  Edit3, 
  Calendar, 
  Hash, 
  CheckCircle2, 
  RefreshCw, 
  ArrowRight,
  ExternalLink,
  Layers,
  Database
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog';
import { ErrorState } from '@/components/common/ErrorState';
import { identityApi } from '@/services/identity-api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';

export const OrganizationPage: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const orgId = user?.organizationId || '';
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');

  // Fetch organization metadata
  const { 
    data: org, 
    isLoading: isLoadingOrg, 
    error: orgError, 
    refetch: refetchOrg,
    isFetching: isFetchingOrg 
  } = useQuery({
    queryKey: ['org-detail', orgId],
    queryFn: () => identityApi.getOrganization(orgId),
    enabled: Boolean(orgId),
  });

  // Fetch member count
  const { data: usersData } = useQuery({
    queryKey: ['users-list-summary', orgId],
    queryFn: () => identityApi.listUsers(1, 100),
    enabled: Boolean(orgId),
  });

  const memberCount = usersData?.total ?? usersData?.users?.length ?? 0;

  // Edit Organization Mutation
  const updateOrgMutation = useMutation({
    mutationFn: async (newName: string) => {
      return identityApi.updateOrganization(orgId, { name: newName });
    },
    onSuccess: (updated) => {
      toast({
        title: 'Organization Updated',
        description: `Organization renamed to "${updated.name}".`,
        variant: 'success',
      });
      setIsEditModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['org-detail', orgId] });
    },
    onError: (err: any) => {
      toast({
        title: 'Update Failed',
        description: err.message || 'Unable to update organization details.',
        variant: 'destructive',
      });
    },
  });

  const handleOpenEdit = () => {
    if (org) {
      setEditName(org.name);
      setIsEditModalOpen(true);
    }
  };

  if (isLoadingOrg) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      </div>
    );
  }

  if (orgError) {
    return (
      <div className="p-6">
        <ErrorState
          title="Failed to Load Organization"
          message={(orgError as Error).message}
          onRetry={() => refetchOrg()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            Organization Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Overview and tenant governance settings for your enterprise AI workspace.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchOrg()}
            disabled={isFetchingOrg}
            className="gap-1 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetchingOrg ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          {isAdmin && (
            <Button
              size="sm"
              onClick={handleOpenEdit}
              className="gap-1 text-xs"
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>Edit Organization</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main Details Card */}
      {org && (
        <Card className="border-border shadow-xs">
          <CardHeader className="pb-4 border-b border-border">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Building2 className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-xl font-bold">{org.name}</CardTitle>
                    <Badge variant={org.status === 'ACTIVE' ? 'default' : 'secondary'} className="text-xs">
                      {org.status}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs font-mono mt-0.5">
                    Tenant Slug: {org.slug}
                  </CardDescription>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link to="/developers">
                  <Button variant="outline" size="sm" className="gap-1 text-xs">
                    <Users className="h-3.5 w-3.5" />
                    <span>Manage Members ({memberCount})</span>
                    <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </Link>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-muted/40 border border-border space-y-1">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5" /> Tenant ID
                </span>
                <p className="text-xs font-mono font-semibold text-foreground truncate select-all" title={org.id}>
                  {org.id}
                </p>
              </div>

              <div className="p-4 rounded-lg bg-muted/40 border border-border space-y-1">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Established
                </span>
                <p className="text-xs font-semibold text-foreground">
                  {org.createdAt ? new Date(org.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'N/A'}
                </p>
              </div>

              <div className="p-4 rounded-lg bg-muted/40 border border-border space-y-1">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> Team Size
                </span>
                <p className="text-xs font-semibold text-foreground">
                  {memberCount} active member{memberCount === 1 ? '' : 's'}
                </p>
              </div>

              <div className="p-4 rounded-lg bg-muted/40 border border-border space-y-1">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" /> Governance
                </span>
                <p className="text-xs font-semibold text-foreground flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  Enforced RBAC
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Security Architecture & Tenant Isolation Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              Multi-Tenant Data Isolation
            </CardTitle>
            <CardDescription className="text-xs">
              How AegisAI guarantees isolation for your organization across all 6 microservices.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-muted-foreground">
            <div className="flex items-start gap-2.5">
              <div className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                1
              </div>
              <div>
                <strong className="text-foreground">Authenticated Claims Enforcement:</strong> Every inbound API call resolves tenant identity from cryptographic JWT claims, never from user-supplied URL parameters.
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                2
              </div>
              <div>
                <strong className="text-foreground">Cross-Tenant Protection:</strong> Attempts to query requests, traces, or members from other tenants fail with strict 404/403 responses.
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                3
              </div>
              <div>
                <strong className="text-foreground">Developer Request Sandboxing:</strong> Developers can only view their own generated requests, while organization admins have visibility across all team prompts.
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              Connected Microservice Stores
            </CardTitle>
            <CardDescription className="text-xs">
              State isolation across dedicated persistence layers.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="p-3 rounded-md bg-muted/30 border border-border flex items-center justify-between">
              <div>
                <span className="font-semibold text-foreground block">Identity Database</span>
                <span className="text-muted-foreground text-[11px]">User identities, RBAC roles, tenant memberships</span>
              </div>
              <Badge variant="outline" className="font-mono text-[10px]">PostgreSQL :5432</Badge>
            </div>
            <div className="p-3 rounded-md bg-muted/30 border border-border flex items-center justify-between">
              <div>
                <span className="font-semibold text-foreground block">Gateway & Privacy DBs</span>
                <span className="text-muted-foreground text-[11px]">Request records, sanitization metadata, rate limits</span>
              </div>
              <Badge variant="outline" className="font-mono text-[10px]">PostgreSQL & Redis</Badge>
            </div>
            <div className="p-3 rounded-md bg-muted/30 border border-border flex items-center justify-between">
              <div>
                <span className="font-semibold text-foreground block">Security Audit Store</span>
                <span className="text-muted-foreground text-[11px]">Cryptographic audit trail with SHA-256 integrity chains</span>
              </div>
              <Badge variant="outline" className="font-mono text-[10px]">MongoDB :27017</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Organization Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Edit Organization Details</DialogTitle>
            <DialogDescription className="text-xs">
              Update display information for your workspace.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div>
              <label className="font-medium text-foreground block mb-1">Organization Name</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Enterprise Workspace"
                className="text-xs"
              />
            </div>
            <div>
              <label className="font-medium text-foreground block mb-1">Tenant Slug (Permanent)</label>
              <Input
                value={org?.slug || ''}
                disabled
                className="text-xs font-mono bg-muted text-muted-foreground"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Slugs are immutable identifiers used for routing and tenant isolation.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!editName.trim() || editName === org?.name || updateOrgMutation.isPending}
              onClick={() => updateOrgMutation.mutate(editName.trim())}
            >
              {updateOrgMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
