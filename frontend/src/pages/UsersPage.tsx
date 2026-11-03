import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Users, 
  UserPlus, 
  Building, 
  ShieldCheck, 
  PowerOff, 
  RefreshCw, 
  Lock, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  UserCheck
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
import { identityApi } from '@/services/identity-api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { SafeUser, UserRole } from '@/types';

export const UsersPage: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [disableConfirmUser, setDisableConfirmUser] = useState<SafeUser | null>(null);

  // New user form state
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('DEVELOPER');

  // Fetch users list
  const { data: usersData, isLoading: isLoadingUsers, error: usersError, refetch: refetchUsers, isFetching: isFetchingUsers } = useQuery({
    queryKey: ['users-list', page],
    queryFn: () => identityApi.listUsers(page, 20),
  });

  // Fetch organization metadata
  const orgId = user?.organizationId || '';
  const { data: orgData, isLoading: isLoadingOrg } = useQuery({
    queryKey: ['org-detail', orgId],
    queryFn: () => identityApi.getOrganization(orgId),
    enabled: Boolean(orgId),
  });

  const users = usersData?.users || [];

  // Create User Mutation
  const createUserMutation = useMutation({
    mutationFn: async () => {
      return identityApi.createUser({
        email: newEmail,
        password: newPassword,
        displayName: newDisplayName,
        role: newRole,
        organizationId: orgId,
      });
    },
    onSuccess: (created) => {
      toast({
        title: 'User Created',
        description: `Successfully provisioned ${created.displayName} (${created.email}).`,
        variant: 'success',
      });
      setIsAddUserOpen(false);
      setNewEmail('');
      setNewPassword('');
      setNewDisplayName('');
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
    },
    onError: (err: any) => {
      toast({
        title: 'User Creation Failed',
        description: err.message || 'Error creating user in Identity service.',
        variant: 'destructive',
      });
    },
  });

  // Disable User Mutation
  const disableUserMutation = useMutation({
    mutationFn: async (target: SafeUser) => {
      return identityApi.disableUser(target.id);
    },
    onSuccess: (updated) => {
      toast({
        title: 'User Disabled',
        description: `Account access for ${updated.email} has been revoked.`,
        variant: 'default',
      });
      setDisableConfirmUser(null);
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Failed to Disable User',
        description: err.message || 'Error updating user status.',
        variant: 'destructive',
      });
      setDisableConfirmUser(null);
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Users & Organizations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage tenant identities, RBAC role assignments, and organization membership.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchUsers()}
            disabled={isFetchingUsers}
            className="gap-1 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetchingUsers ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          {isAdmin && (
            <Button size="sm" onClick={() => setIsAddUserOpen(true)} className="gap-1 text-xs">
              <UserPlus className="h-3.5 w-3.5" />
              <span>Provision User</span>
            </Button>
          )}
        </div>
      </div>

      {/* Organization Info Banner */}
      {orgData && (
        <Card className="bg-muted/30 border-border">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Building className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-foreground">{orgData.name}</h3>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {orgData.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  Tenant ID: {orgData.id} • Slug: {orgData.slug}
                </p>
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              Total Members: <strong className="text-foreground">{usersData?.total || users.length}</strong>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Users Table Card */}
      <Card>
        <CardContent className="p-0">
          {isLoadingUsers ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : usersError ? (
            <div className="p-6">
              <ErrorState
                title="Failed to load users"
                message={(usersError as Error).message}
                onRetry={() => refetchUsers()}
              />
            </div>
          ) : users.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={Users}
                title="No Users Registered"
                description="No member accounts found in this organization."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Assigned Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="font-semibold text-xs text-foreground">{u.displayName}</div>
                        <div className="text-xs text-muted-foreground font-mono">{u.email}</div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            u.role === 'ORGANIZATION_ADMIN' || u.role === 'ADMIN'
                              ? 'default'
                              : u.role === 'SECURITY_AUDITOR'
                              ? 'secondary'
                              : 'outline'
                          }
                          className="text-[11px]"
                        >
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={u.status === 'ACTIVE' ? 'default' : 'secondary'}
                          className="text-[10px]"
                        >
                          {u.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        {isAdmin && u.id !== user?.id && u.status === 'ACTIVE' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                            onClick={() => setDisableConfirmUser(u)}
                          >
                            <PowerOff className="h-3.5 w-3.5 mr-1" />
                            <span>Revoke</span>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add User Modal */}
      <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Provision Organization User</DialogTitle>
            <DialogDescription className="text-xs">
              Create a new user identity with organization-scoped role credentials.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div>
              <label className="font-medium text-foreground block mb-1">Display Name</label>
              <Input
                placeholder="e.g., Jane Doe"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                className="text-xs"
              />
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">Email Address</label>
              <Input
                type="email"
                placeholder="jane.doe@company.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="text-xs"
              />
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">Initial Password</label>
              <Input
                type="password"
                placeholder="Minimum 8 characters..."
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="text-xs"
              />
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">RBAC Role</label>
              <select
                className="w-full px-3 py-2 text-xs bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
              >
                <option value="DEVELOPER">DEVELOPER (Prompt submission & request viewing)</option>
                <option value="SECURITY_AUDITOR">SECURITY_AUDITOR (Approvals, logs, & tamper verification)</option>
                <option value="ORGANIZATION_ADMIN">ORGANIZATION_ADMIN (Full tenant management)</option>
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsAddUserOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={
                !newEmail.trim() ||
                !newPassword.trim() ||
                !newDisplayName.trim() ||
                createUserMutation.isPending
              }
              onClick={() => createUserMutation.mutate()}
            >
              {createUserMutation.isPending ? 'Creating...' : 'Provision User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Disabling User */}
      {disableConfirmUser && (
        <ConfirmDialog
          open={Boolean(disableConfirmUser)}
          onOpenChange={(open) => !open && setDisableConfirmUser(null)}
          title="Revoke User Access"
          description={`Are you sure you want to disable ${disableConfirmUser.displayName} (${disableConfirmUser.email})? They will immediately lose access to the gateway.`}
          confirmLabel="Revoke Access"
          variant="destructive"
          onConfirm={() => disableUserMutation.mutate(disableConfirmUser)}
        />
      )}
    </div>
  );
};
