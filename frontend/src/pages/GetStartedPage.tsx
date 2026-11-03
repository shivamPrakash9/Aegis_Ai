import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { 
  Building2, 
  Shield, 
  ArrowRight, 
  UserPlus, 
  LogIn, 
  CheckCircle2, 
  AlertCircle, 
  Lock, 
  Mail, 
  User, 
  Key,
  Sparkles,
  Users
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { identityApi } from '@/services/identity-api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

export const GetStartedPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');

  // Form fields
  const [orgName, setOrgName] = useState('');
  const [slug, setSlug] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  // Auto-slugify organization name
  const handleOrgNameChange = (val: string) => {
    setOrgName(val);
    const generated = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 30);
    setSlug(generated);
  };

  // Create Organization Mutation
  const createOrgMutation = useMutation({
    mutationFn: async () => {
      return identityApi.createOrganization({
        name: orgName.trim(),
        slug: slug.trim().toLowerCase(),
        adminUser: {
          displayName: adminName.trim(),
          email: adminEmail.trim().toLowerCase(),
          password: adminPassword,
        },
      });
    },
    onSuccess: async (data) => {
      toast({
        title: 'Organization Created',
        description: `Welcome to AegisAI, ${data.adminUser?.displayName}! Your organization is ready.`,
        variant: 'success',
      });

      // Attempt immediate login with credentials
      try {
        await login({ email: adminEmail.trim().toLowerCase(), password: adminPassword });
        navigate('/overview');
      } catch {
        navigate('/login');
      }
    },
    onError: (err: any) => {
      toast({
        title: 'Registration Failed',
        description: err.message || 'Unable to complete organization registration.',
        variant: 'destructive',
      });
    },
  });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between selection:bg-primary/20">
      {/* Top Navbar */}
      <header className="border-b border-border py-4 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shadow-sm shadow-primary/20">
              <Shield className="h-5 w-5" />
            </div>
            <span className="font-bold text-base tracking-tight text-foreground">
              AegisAI Gateway
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link to="/login">
              <Button variant="ghost" size="sm" className="text-xs">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-12 flex flex-col items-center justify-center">
        <div className="text-center max-w-xl mb-8 space-y-2">
          <Badge variant="outline" className="text-xs">
            Onboarding Gateway
          </Badge>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Get Started with AegisAI
          </h1>
          <p className="text-xs text-muted-foreground">
            Choose how you would like to begin. Create a new organization workspace or join an existing enterprise deployment.
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center p-1 bg-muted/60 rounded-lg border border-border mb-6 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 rounded-md transition-all ${
              activeTab === 'create'
                ? 'bg-background text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Create New Organization
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('join')}
            className={`px-4 py-2 rounded-md transition-all ${
              activeTab === 'join'
                ? 'bg-background text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Join Existing Organization
          </button>
        </div>

        {/* Tab Content: Create Organization */}
        {activeTab === 'create' && (
          <Card className="w-full max-w-xl border-border shadow-md">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <span>Register Organization Workspace</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Creates an isolated enterprise tenant and provisions your primary administrator account.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-medium text-foreground block mb-1">Organization Name</label>
                  <Input
                    placeholder="Acme Technologies"
                    value={orgName}
                    onChange={(e) => handleOrgNameChange(e.target.value)}
                    className="text-xs"
                  />
                </div>

                <div>
                  <label className="font-medium text-foreground block mb-1">Tenant Slug</label>
                  <Input
                    placeholder="acme-technologies"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="text-xs font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Lowercase letters, numbers, and hyphens.
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-border">
                <span className="font-bold text-foreground text-xs block mb-3">
                  Initial Organization Administrator
                </span>

                <div className="space-y-3">
                  <div>
                    <label className="font-medium text-foreground block mb-1">Admin Full Name</label>
                    <Input
                      placeholder="Jane Doe"
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      className="text-xs"
                    />
                  </div>

                  <div>
                    <label className="font-medium text-foreground block mb-1">Corporate Email Address</label>
                    <Input
                      type="email"
                      placeholder="admin@company.com"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      className="text-xs"
                    />
                  </div>

                  <div>
                    <label className="font-medium text-foreground block mb-1">Password</label>
                    <Input
                      type="password"
                      placeholder="Minimum 8 characters..."
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="p-3 bg-muted/40 rounded-lg border border-border text-[11px] text-muted-foreground space-y-1">
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <Lock className="h-3.5 w-3.5 text-primary" />
                  <span>Security Notice</span>
                </div>
                <p>
                  Your account will be granted <strong>ORGANIZATION_ADMIN</strong> privileges scoped strictly to this new organization. All AI requests, traces, and policies are isolated at the database level.
                </p>
              </div>
            </CardContent>

            <CardFooter className="border-t border-border p-4 flex items-center justify-between">
              <Link to="/login" className="text-xs text-muted-foreground hover:text-foreground">
                Already have an account? Sign In
              </Link>

              <Button
                size="sm"
                disabled={
                  !orgName.trim() ||
                  !slug.trim() ||
                  !adminName.trim() ||
                  !adminEmail.trim() ||
                  adminPassword.length < 8 ||
                  createOrgMutation.isPending
                }
                onClick={() => createOrgMutation.mutate()}
                className="gap-1.5 text-xs font-semibold"
              >
                <span>{createOrgMutation.isPending ? 'Provisioning...' : 'Create Organization'}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* Tab Content: Join Existing Organization */}
        {activeTab === 'join' && (
          <Card className="w-full max-w-xl border-border shadow-md">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-500" />
                <span>Join an Existing Organization</span>
              </CardTitle>
              <CardDescription className="text-xs">
                How developers and auditors access their company workspace.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-4 text-xs">
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card">
                  <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground">Contact your Organization Administrator</h4>
                    <p className="text-muted-foreground text-[11px] mt-0.5">
                      To preserve enterprise tenant boundaries, developers cannot unilaterally self-register into an existing organization without administrator authorization.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card">
                  <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground">Receive your provisioned credentials</h4>
                    <p className="text-muted-foreground text-[11px] mt-0.5">
                      Your administrator will provision your identity from the <strong>Developers & Team</strong> management tab and assign you the <code>DEVELOPER</code> or <code>SECURITY_AUDITOR</code> role.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card">
                  <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground">Sign in to your workspace</h4>
                    <p className="text-muted-foreground text-[11px] mt-0.5">
                      Once provisioned, sign in with your corporate email and password.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>

            <CardFooter className="border-t border-border p-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setActiveTab('create')}
                className="text-xs text-primary hover:underline"
              >
                Need to create a new organization instead?
              </button>

              <Link to="/login">
                <Button size="sm" className="gap-1.5 text-xs">
                  <LogIn className="h-3.5 w-3.5" />
                  <span>Go to Sign In</span>
                </Button>
              </Link>
            </CardFooter>
          </Card>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-4 px-4 text-center text-xs text-muted-foreground">
        <p>AegisAI Enterprise AI Security Gateway • v1.0.0</p>
      </footer>
    </div>
  );
};
