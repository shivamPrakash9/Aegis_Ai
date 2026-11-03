import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Users, 
  UserPlus, 
  Search, 
  RefreshCw, 
  PowerOff, 
  Trash2, 
  Edit2, 
  ShieldAlert, 
  Key, 
  Check, 
  Copy, 
  ShieldCheck, 
  Code2, 
  Lock, 
  Clock, 
  CheckCircle2, 
  UserCheck,
  Building2,
  ExternalLink
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

export const DevelopersPage: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Modals state
  const [isOnboardModalOpen, setIsOnboardModalOpen] = useState(false);
  const [editRoleUser, setEditRoleUser] = useState<SafeUser | null>(null);
  const [disableConfirmUser, setDisableConfirmUser] = useState<SafeUser | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<SafeUser | null>(null);
  const [createdUserCredentials, setCreatedUserCredentials] = useState<{
    displayName: string;
    email: string;
    password: string;
    role: string;
  } | null>(null);

  // New developer form state
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('DEVELOPER');
  const [formValidationError, setFormValidationError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Fetch current organization details
  const { data: organization } = useQuery({
    queryKey: ['current-organization', user?.organizationId],
    queryFn: () => identityApi.getOrganization(user!.organizationId),
    enabled: !!user?.organizationId,
  });

  // Fetch database statistics
  const {
    data: statsData,
    isLoading: isLoadingStats,
    isError: isStatsError,
    refetch: refetchStats,
    isFetching: isFetchingStats,
  } = useQuery({
    queryKey: ['team-members-stats'],
    queryFn: () => identityApi.getUserStats(),
  });

  // Fetch users with search and role filters
  const { 
    data: usersData, 
    isLoading: isLoadingUsers, 
    error: usersError, 
    refetch: refetchUsers, 
    isFetching: isFetchingUsers 
  } = useQuery({
    queryKey: ['team-members-list', page, searchQuery, roleFilter],
    queryFn: () => identityApi.listUsers(page, 50, {
      search: searchQuery.trim() || undefined,
      role: roleFilter === 'ALL' ? undefined : roleFilter,
    }),
    placeholderData: (prev) => prev,
  });

  const users = usersData?.users || usersData?.data || [];

  // Filtered users (ensures immediate local consistency alongside server filtering)
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch = 
        u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, roleFilter]);

  // Telemetry counts from backend database, with safe fallback to returned user list
  const stats = useMemo(() => {
    if (statsData) {
      return statsData;
    }
    const total = users.length;
    const developers = users.filter((u) => u.role === 'DEVELOPER').length;
    const auditors = users.filter((u) => u.role === 'SECURITY_AUDITOR').length;
    const admins = users.filter((u) => u.role === 'ORGANIZATION_ADMIN' || u.role === 'ADMIN').length;
    return { total, developers, auditors, admins };
  }, [statsData, users]);

  // Create/Onboard User Mutation
  const onboardUserMutation = useMutation({
    mutationFn: async () => {
      return identityApi.createUser({
        displayName: newDisplayName.trim(),
        email: newEmail.trim().toLowerCase(),
        password: newPassword,
        role: newRole,
        organizationId: user?.organizationId,
      });
    },
    onSuccess: (created) => {
      setCreatedUserCredentials({
        displayName: created.displayName,
        email: created.email,
        password: newPassword,
        role: created.role,
      });
      setIsOnboardModalOpen(false);
      setNewDisplayName('');
      setNewEmail('');
      setNewPassword('');
      setFormValidationError(null);
      queryClient.invalidateQueries({ queryKey: ['team-members-list'] });
      queryClient.invalidateQueries({ queryKey: ['team-members-stats'] });
      toast({
        title: 'Developer Provisioned',
        description: `Successfully onboarded ${created.displayName}.`,
        variant: 'success',
      });
    },
    onError: (err: any) => {
      toast({
        title: 'Onboarding Failed',
        description: err.message || 'Could not provision developer account.',
        variant: 'destructive',
      });
    },
  });

  // Update Role Mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: UserRole }) => {
      return identityApi.updateUser(userId, { role });
    },
    onSuccess: (updated) => {
      toast({
        title: 'Role Updated',
        description: `${updated.displayName} is now assigned role ${updated.role}.`,
        variant: 'success',
      });
      setEditRoleUser(null);
      queryClient.invalidateQueries({ queryKey: ['team-members-list'] });
      queryClient.invalidateQueries({ queryKey: ['team-members-stats'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Role Update Failed',
        description: err.message || 'Unable to update role.',
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
        title: 'Account Disabled',
        description: `Access revoked for ${updated.email}.`,
        variant: 'default',
      });
      setDisableConfirmUser(null);
      queryClient.invalidateQueries({ queryKey: ['team-members-list'] });
      queryClient.invalidateQueries({ queryKey: ['team-members-stats'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Action Failed',
        description: err.message || 'Error revoking account access.',
        variant: 'destructive',
      });
      setDisableConfirmUser(null);
    },
  });

  // Delete User Mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (target: SafeUser) => {
      return identityApi.deleteUser(target.id);
    },
    onSuccess: () => {
      toast({
        title: 'Member Removed',
        description: 'User has been permanently removed from the organization.',
        variant: 'success',
      });
      setDeleteConfirmUser(null);
      queryClient.invalidateQueries({ queryKey: ['team-members-list'] });
      queryClient.invalidateQueries({ queryKey: ['team-members-stats'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Removal Failed',
        description: err.message || 'Error removing member.',
        variant: 'destructive',
      });
      setDeleteConfirmUser(null);
    },
  });

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleGeneratePassword = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*';
    let pwd = '';
    for (let i = 0; i < 14; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(pwd);
  };

  const isRefreshing = isFetchingUsers || isFetchingStats;

  const handleRefresh = async () => {
    await Promise.all([refetchUsers(), refetchStats()]);
  };

  const handleValidateAndSubmit = () => {
    setFormValidationError(null);
    if (!newDisplayName.trim() || newDisplayName.trim().length < 2) {
      setFormValidationError('Developer name must be at least 2 characters long.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!newEmail.trim() || !emailRegex.test(newEmail.trim())) {
      setFormValidationError('Please provide a valid corporate email address.');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setFormValidationError('Initial password must be at least 8 characters long.');
      return;
    }
    onboardUserMutation.mutate();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Developers & Team Members
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage organization members, assign AI gateway access roles, and onboard developers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-1 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          {isAdmin && (
            <Button
              size="sm"
              onClick={() => {
                handleGeneratePassword();
                setFormValidationError(null);
                setIsOnboardModalOpen(true);
              }}
              className="gap-1 text-xs"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Onboard Developer</span>
            </Button>
          )}
        </div>
      </div>

      {/* Role Counts Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 bg-card border-border">
          <span className="text-xs text-muted-foreground block">Total Members</span>
          {isLoadingStats ? (
            <Skeleton className="h-8 w-14 mt-1" />
          ) : isStatsError ? (
            <span className="text-sm font-semibold text-destructive mt-1 block">Unavailable</span>
          ) : (
            <span className="text-2xl font-bold text-foreground mt-1 block">{stats.total}</span>
          )}
          <span className="text-[11px] text-muted-foreground mt-0.5 block">Organization roster</span>
        </Card>

        <Card className="p-4 bg-card border-border">
          <span className="text-xs text-muted-foreground block flex items-center gap-1">
            <Code2 className="h-3.5 w-3.5 text-blue-500" /> Developers
          </span>
          {isLoadingStats ? (
            <Skeleton className="h-8 w-14 mt-1" />
          ) : isStatsError ? (
            <span className="text-sm font-semibold text-destructive mt-1 block">Unavailable</span>
          ) : (
            <span className="text-2xl font-bold text-foreground mt-1 block">{stats.developers}</span>
          )}
          <span className="text-[11px] text-muted-foreground mt-0.5 block">AI prompt submitters</span>
        </Card>

        <Card className="p-4 bg-card border-border">
          <span className="text-xs text-muted-foreground block flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-indigo-500" /> Auditors
          </span>
          {isLoadingStats ? (
            <Skeleton className="h-8 w-14 mt-1" />
          ) : isStatsError ? (
            <span className="text-sm font-semibold text-destructive mt-1 block">Unavailable</span>
          ) : (
            <span className="text-2xl font-bold text-foreground mt-1 block">{stats.auditors}</span>
          )}
          <span className="text-[11px] text-muted-foreground mt-0.5 block">Trace & log verifiers</span>
        </Card>

        <Card className="p-4 bg-card border-border">
          <span className="text-xs text-muted-foreground block flex items-center gap-1">
            <Lock className="h-3.5 w-3.5 text-amber-500" /> Admins
          </span>
          {isLoadingStats ? (
            <Skeleton className="h-8 w-14 mt-1" />
          ) : isStatsError ? (
            <span className="text-sm font-semibold text-destructive mt-1 block">Unavailable</span>
          ) : (
            <span className="text-2xl font-bold text-foreground mt-1 block">{stats.admins}</span>
          )}
          <span className="text-[11px] text-muted-foreground mt-0.5 block">Tenant administrators</span>
        </Card>
      </div>

      {/* Search & Filter Toolbar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Role:</span>
              <select
                className="px-3 py-2 text-xs bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring w-full sm:w-auto"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="ALL">All Roles</option>
                <option value="DEVELOPER">Developers</option>
                <option value="SECURITY_AUDITOR">Security Auditors</option>
                <option value="ORGANIZATION_ADMIN">Organization Admins</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Team Table */}
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
                title="Failed to Load Team Members"
                message={(usersError as Error).message || 'An unexpected internal server error occurred.'}
                onRetry={() => {
                  refetchUsers();
                  refetchStats();
                }}
              />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={Users}
                title="No Members Found"
                description={
                  searchQuery || roleFilter !== 'ALL'
                    ? 'No team members match your filter criteria.'
                    : 'No team members found. Onboard your first developer to get started.'
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Assigned Role</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead>Onboarded</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((u) => {
                    const isSelf = u.id === user?.id;
                    return (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                              {u.displayName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                                <span>{u.displayName}</span>
                                {isSelf && (
                                  <span className="text-[10px] font-mono bg-primary/15 text-primary px-1.5 py-0.2 rounded">
                                    You
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground font-mono">{u.email}</div>
                            </div>
                          </div>
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
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
                            <span>{organization?.name || 'Enterprise Alpha Corp'}</span>
                          </div>
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
                          {isAdmin && !isSelf && (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => setEditRoleUser(u)}
                                title="Change Role"
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>

                              {u.status === 'ACTIVE' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs text-amber-500 hover:text-amber-600 hover:bg-amber-500/10"
                                  onClick={() => setDisableConfirmUser(u)}
                                  title="Disable Account"
                                >
                                  <PowerOff className="h-3.5 w-3.5" />
                                </Button>
                              )}

                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                                onClick={() => setDeleteConfirmUser(u)}
                                title="Remove Member"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
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

      {/* Onboard Developer Modal */}
      <Dialog open={isOnboardModalOpen} onOpenChange={setIsOnboardModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Onboard Organization Developer
            </DialogTitle>
            <DialogDescription className="text-xs">
              Provision credentials and role access for a new team member in your organization.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {formValidationError && (
              <div className="p-2.5 rounded bg-destructive/10 text-destructive text-xs flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>{formValidationError}</span>
              </div>
            )}

            <div>
              <label className="font-medium text-foreground block mb-1">Developer Full Name</label>
              <Input
                placeholder="e.g., Alex Johnson"
                value={newDisplayName}
                onChange={(e) => {
                  setNewDisplayName(e.target.value);
                  if (formValidationError) setFormValidationError(null);
                }}
                className="text-xs"
              />
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">Corporate Email Address</label>
              <Input
                type="email"
                placeholder="alex.johnson@company.com"
                value={newEmail}
                onChange={(e) => {
                  setNewEmail(e.target.value);
                  if (formValidationError) setFormValidationError(null);
                }}
                className="text-xs"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-medium text-foreground">Initial Temporary Password</label>
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="text-primary hover:underline text-[11px]"
                >
                  Generate Strong
                </button>
              </div>
              <Input
                type="text"
                placeholder="Secure initial password..."
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (formValidationError) setFormValidationError(null);
                }}
                className="text-xs font-mono"
              />
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">Assigned Access Role</label>
              <select
                className="w-full px-3 py-2 text-xs bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
              >
                <option value="DEVELOPER">DEVELOPER — Submit prompts & inspect own requests</option>
                <option value="SECURITY_AUDITOR">SECURITY_AUDITOR — Review policies, approvals & audit logs</option>
                <option value="ORGANIZATION_ADMIN">ORGANIZATION_ADMIN — Tenant administration</option>
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsOnboardModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={
                !newDisplayName.trim() ||
                !newEmail.trim() ||
                !newPassword.trim() ||
                onboardUserMutation.isPending
              }
              onClick={handleValidateAndSubmit}
            >
              {onboardUserMutation.isPending ? 'Provisioning...' : 'Complete Onboarding'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Post-Onboarding Credentials Dialog */}
      {createdUserCredentials && (
        <Dialog open={Boolean(createdUserCredentials)} onOpenChange={() => setCreatedUserCredentials(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-base font-semibold flex items-center gap-2 text-emerald-500">
                <CheckCircle2 className="h-5 w-5" />
                Developer Account Ready
              </DialogTitle>
              <DialogDescription className="text-xs">
                Share these initial credentials securely with the onboarded developer.
              </DialogDescription>
            </DialogHeader>

            <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Email:</span>
                <span className="font-mono font-semibold text-foreground">{createdUserCredentials.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Password:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-foreground bg-background px-2 py-0.5 rounded border border-border">
                    {createdUserCredentials.password}
                  </span>
                  <button
                    onClick={() => handleCopy(createdUserCredentials.password, 'cred-pwd')}
                    className="p-1 hover:text-primary"
                    title="Copy Password"
                  >
                    {copiedKey === 'cred-pwd' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Assigned Role:</span>
                <Badge variant="outline" className="text-[10px]">{createdUserCredentials.role}</Badge>
              </div>
            </div>

            <DialogFooter>
              <Button size="sm" onClick={() => setCreatedUserCredentials(null)}>
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Role Dialog */}
      {editRoleUser && (
        <Dialog open={Boolean(editRoleUser)} onOpenChange={(open) => !open && setEditRoleUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">Change Member Role</DialogTitle>
              <DialogDescription className="text-xs">
                Update permissions for {editRoleUser.displayName} ({editRoleUser.email}).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div>
                <label className="font-medium text-foreground block mb-1">Select Role</label>
                <select
                  className="w-full px-3 py-2 text-xs bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                  defaultValue={editRoleUser.role}
                  id="role-select"
                >
                  <option value="DEVELOPER">DEVELOPER</option>
                  <option value="SECURITY_AUDITOR">SECURITY_AUDITOR</option>
                  <option value="ORGANIZATION_ADMIN">ORGANIZATION_ADMIN</option>
                </select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setEditRoleUser(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const selectEl = document.getElementById('role-select') as HTMLSelectElement;
                  if (selectEl) {
                    updateRoleMutation.mutate({
                      userId: editRoleUser.id,
                      role: selectEl.value as UserRole,
                    });
                  }
                }}
                disabled={updateRoleMutation.isPending}
              >
                {updateRoleMutation.isPending ? 'Updating...' : 'Save Role'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Disable Confirmation */}
      {disableConfirmUser && (
        <ConfirmDialog
          open={Boolean(disableConfirmUser)}
          onOpenChange={(open) => !open && setDisableConfirmUser(null)}
          title="Revoke Member Access"
          description={`Are you sure you want to disable ${disableConfirmUser.displayName} (${disableConfirmUser.email})? Their sessions will be revoked.`}
          confirmLabel="Revoke Access"
          variant="destructive"
          onConfirm={() => disableUserMutation.mutate(disableConfirmUser)}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirmUser && (
        <ConfirmDialog
          open={Boolean(deleteConfirmUser)}
          onOpenChange={(open) => !open && setDeleteConfirmUser(null)}
          title="Remove Member from Organization"
          description={`Are you sure you want to permanently remove ${deleteConfirmUser.displayName} (${deleteConfirmUser.email}) from the organization?`}
          confirmLabel="Remove Member"
          variant="destructive"
          onConfirm={() => deleteUserMutation.mutate(deleteConfirmUser)}
        />
      )}
    </div>
  );
};
