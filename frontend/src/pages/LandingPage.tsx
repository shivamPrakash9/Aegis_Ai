import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Shield, 
  ArrowRight, 
  Lock, 
  Eye, 
  Sliders, 
  CheckCircle2, 
  FileSearch, 
  Cpu, 
  Layers, 
  Bot, 
  Sparkles, 
  Play, 
  RotateCcw, 
  ChevronRight, 
  ExternalLink,
  Server,
  Database,
  Building2,
  Terminal,
  Activity,
  UserCheck
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { useAuth } from '@/hooks/useAuth';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

export const LandingPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);
  const [selectedService, setSelectedService] = useState<number>(0);

  // Microservices architecture details
  const microservices = [
    {
      id: 'gateway',
      name: 'AI Gateway',
      port: ':3001',
      role: 'Request Orchestration & Rate Limiting',
      description: 'Single secure entry point for all enterprise AI traffic. Coordinates the 16-step security pipeline, enforces tenant rate limits, manages request lifecycle states, and handles idempotency.',
      db: 'PostgreSQL (aegis_gateway) + Redis',
      color: 'from-blue-500/20 to-cyan-500/20 border-cyan-500/40 text-cyan-500',
    },
    {
      id: 'identity',
      name: 'Identity & Access',
      port: ':3000',
      role: 'Authentication & Tenant Scoping',
      description: 'Issues cryptographic JWT session tokens, verifies caller identities, and enforces organization-level RBAC across Developers, Security Auditors, and Organization Administrators.',
      db: 'PostgreSQL (aegis_identity)',
      color: 'from-blue-600/20 to-indigo-600/20 border-indigo-500/40 text-indigo-500',
    },
    {
      id: 'privacy',
      name: 'Privacy Scanner',
      port: ':3002',
      role: 'PII Detection & Sanitization',
      description: 'Scans prompts and model completions for sensitive data (PII, credentials, healthcare data, secrets). Enforces ALLOW, MASK, ROUTE, REQUIRE_APPROVAL, or BLOCK actions.',
      db: 'PostgreSQL (aegis_privacy)',
      color: 'from-purple-500/20 to-pink-500/20 border-pink-500/40 text-pink-500',
    },
    {
      id: 'policy',
      name: 'Policy Approval',
      port: ':3003',
      role: 'Governance Rules & Approvals',
      description: 'Evaluates enterprise rules (model allowlists, budget ceilings, risk tolerances). Halts risky executions for human approval in the Approval Center before invoking providers.',
      db: 'PostgreSQL (aegis_policy)',
      color: 'from-amber-500/20 to-orange-500/20 border-amber-500/40 text-amber-500',
    },
    {
      id: 'model',
      name: 'Model Provider',
      port: ':3004',
      role: 'Provider Routing & Completion',
      description: 'Multi-provider adapter normalizing OpenAI, Anthropic, and custom LLM interfaces. Handles credential isolation, dynamic model registration, and token usage telemetry.',
      db: 'PostgreSQL (aegis_model)',
      color: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/40 text-emerald-500',
    },
    {
      id: 'audit',
      name: 'Security Audit',
      port: ':3005',
      role: 'Cryptographic Event Logging',
      description: 'Cross-cutting compliance engine. Records immutable lifecycle events linked by trace IDs with SHA-256 cryptographic verification chains to detect any tampering.',
      db: 'MongoDB (aegis_audit)',
      color: 'from-red-500/20 to-rose-500/20 border-rose-500/40 text-rose-500',
    },
  ];

  // Synthetic simulation steps
  const simulationSteps = [
    {
      title: '1. Inbound Developer Request',
      description: 'Developer submits prompt containing sensitive customer email.',
      content: 'Please summarize this sample customer record: user@example.test',
      status: 'ACCEPTED',
      badge: 'Client -> Gateway :3001',
    },
    {
      title: '2. Privacy Scanner Detection',
      description: 'Preflight scanner detects EMAIL category and applies deterministic MASK action.',
      content: 'Please summarize this sample customer record: [EMAIL_1]',
      status: 'MASKED',
      badge: 'PrivacyScanner :3002',
    },
    {
      title: '3. Enterprise Policy Governance',
      description: 'Governance rules evaluate model permission and token quota. Decision: ALLOW.',
      content: 'Governance evaluation passed: Model allowlisted, quota available.',
      status: 'APPROVED',
      badge: 'PolicyApproval :3003',
    },
    {
      title: '4. Model Provider Invocation',
      description: 'Dispatches sanitized prompt to configured model provider (real or mock).',
      content: 'Summary: Processed record for customer [EMAIL_1]. Account status is verified.',
      status: 'COMPLETED',
      badge: 'ModelProvider :3004',
    },
    {
      title: '5. Cryptographic Trace Recorded',
      description: 'Security Audit records immutable SHA-256 event chain for auditability.',
      content: 'Trace ID: trc_e89a1c... | Event: AI_REQUEST_COMPLETED | Hash: 8f4b...3a1c',
      status: 'VERIFIED',
      badge: 'SecurityAudit :3005',
    },
  ];

  const handleStepForward = () => {
    setActiveStep((prev) => (prev + 1) % simulationSteps.length);
  };

  const handleStepReset = () => {
    setActiveStep(0);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20">
      {/* Sticky Navigation Bar */}
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shadow-md shadow-primary/25">
              <Shield className="h-5 w-5" />
            </div>
            <span className="font-bold text-lg tracking-tight text-foreground flex items-center gap-1.5">
              AegisAI
              <span className="text-[10px] uppercase font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                Gateway
              </span>
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-muted-foreground">
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How It Works</a>
            <a href="#architecture" className="hover:text-foreground transition-colors">Architecture</a>
            <a href="#lifecycle" className="hover:text-foreground transition-colors">Request Lifecycle</a>
            <a href="#security" className="hover:text-foreground transition-colors">Security & Governance</a>
            <Link to="/docs" className="hover:text-foreground transition-colors">Documentation</Link>
          </nav>

          <div className="flex items-center gap-3">
            <ThemeToggle />

            {isAuthenticated ? (
              <Link to="/overview">
                <Button size="sm" className="gap-1.5 text-xs font-medium">
                  <span>Open Dashboard</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm" className="text-xs">
                    Sign In
                  </Button>
                </Link>
                <Link to="/get-started">
                  <Button size="sm" className="gap-1.5 text-xs font-medium">
                    <span>Get Started</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-24 md:pt-24 md:pb-32 border-b border-border">
        {/* Subtle background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-medium">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Zero-Trust Enterprise AI Security & Governance Platform</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-foreground leading-[1.1]">
            Secure Every AI Interaction.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400">
              Govern Every Decision.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            AegisAI is an enterprise AI security and governance gateway that screens sensitive data, evaluates organizational policies, controls model access, and creates auditable request traces before and after AI inference.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/get-started" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto gap-2 text-sm font-semibold h-11 px-6 shadow-lg shadow-primary/20">
                <span>Get Started</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>

            <a href="#how-it-works" className="w-full sm:w-auto">
              <Button variant="outline" size="lg" className="w-full sm:w-auto text-sm font-medium h-11 px-6">
                Explore How It Works
              </Button>
            </a>
          </div>

          <p className="text-xs text-muted-foreground pt-2">
            Already have an organization account?{' '}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Sign in to workspace
            </Link>
          </p>
        </div>
      </section>

      {/* Interactive Microservices Architecture Flow */}
      <section id="architecture" className="py-20 bg-muted/20 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <Badge variant="outline" className="text-xs">Distributed Architecture</Badge>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              Six Independent Microservices, One Unified Gateway
            </h2>
            <p className="text-sm text-muted-foreground">
              Every request passes through decoupled services with dedicated databases, preventing single points of failure and enforcing defense-in-depth.
            </p>
          </div>

          {/* Interactive Service Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {microservices.map((svc, index) => {
              const isSelected = selectedService === index;
              return (
                <div
                  key={svc.id}
                  onClick={() => setSelectedService(index)}
                  className={`p-6 rounded-xl border transition-all cursor-pointer select-none bg-card ${
                    isSelected
                      ? 'border-primary ring-2 ring-primary/20 shadow-md'
                      : 'border-border hover:border-border/80 hover:bg-muted/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-base text-foreground">{svc.name}</span>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {svc.port}
                    </Badge>
                  </div>
                  <span className="text-xs font-semibold text-primary block mb-2">{svc.role}</span>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-4">{svc.description}</p>
                  <div className="pt-3 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1 font-mono">
                      <Database className="h-3 w-3" /> {svc.db}
                    </span>
                    <span className="text-primary font-medium text-[11px]">Inspect</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Microservice Deep-Dive */}
          <div className="p-6 rounded-xl border border-border bg-card shadow-xs">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Active Service Focus
                </span>
                <h3 className="text-xl font-bold text-foreground mt-0.5">
                  {microservices[selectedService].name}{' '}
                  <span className="text-sm font-mono text-muted-foreground">
                    ({microservices[selectedService].port})
                  </span>
                </h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
                  {microservices[selectedService].description}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs font-mono">
                  Store: {microservices[selectedService].db}
                </Badge>
                <Link to="/docs">
                  <Button variant="outline" size="sm" className="text-xs gap-1">
                    <span>API Docs</span>
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Step-by-Step Request Lifecycle & Synthetic Simulation */}
      <section id="how-it-works" className="py-20 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <Badge variant="outline" className="text-xs">Execution Pipeline</Badge>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              End-to-End Request Processing Flow
            </h2>
            <p className="text-sm text-muted-foreground">
              Follow a request as it is authenticated, screened for sensitive data, governed by policies, dispatched to providers, and immutably audited.
            </p>
          </div>

          {/* Interactive Simulation Sandbox */}
          <Card className="border-border bg-card shadow-md">
            <CardHeader className="border-b border-border">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    <span>Synthetic Pipeline Simulation</span>
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Step through the transformation of a request containing sensitive email PII.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleStepReset}
                    className="text-xs gap-1"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Reset</span>
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleStepForward}
                    className="text-xs gap-1"
                  >
                    <Play className="h-3.5 w-3.5" />
                    <span>Next Stage ({activeStep + 1}/5)</span>
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {/* Stepper progress */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {simulationSteps.map((s, idx) => (
                  <div
                    key={s.title}
                    onClick={() => setActiveStep(idx)}
                    className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                      activeStep === idx
                        ? 'border-primary bg-primary/10 text-primary font-semibold'
                        : idx < activeStep
                        ? 'border-emerald-500/30 bg-emerald-500/5 text-muted-foreground'
                        : 'border-border bg-muted/20 text-muted-foreground/60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-[10px]">Step {idx + 1}</span>
                      {idx < activeStep && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                    </div>
                    <span className="truncate block font-medium">{s.title.split('. ')[1]}</span>
                  </div>
                ))}
              </div>

              {/* Step Display Area */}
              <div className="p-6 rounded-xl bg-muted/40 border border-border space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-base font-bold text-foreground">
                      {simulationSteps[activeStep].title}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {simulationSteps[activeStep].description}
                    </p>
                  </div>
                  <Badge variant="outline" className="font-mono text-xs">
                    {simulationSteps[activeStep].badge}
                  </Badge>
                </div>

                {/* Prompt payload visualizer */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-mono text-muted-foreground uppercase">
                    Stage Data Payload:
                  </span>
                  <div className="p-3 rounded-lg bg-background border border-border font-mono text-xs text-foreground select-all">
                    {simulationSteps[activeStep].content}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/60">
                  <span>Simulated Outcome: <strong className="text-foreground">{simulationSteps[activeStep].status}</strong></span>
                  <span className="italic text-[11px]">Illustrative Synthetic Pipeline Demo (Simulated)</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Why AegisAI Features Grid */}
      <section id="features" className="py-20 bg-muted/20 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <Badge variant="outline" className="text-xs">Enterprise Security</Badge>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              Built for High-Stakes Enterprise Environments
            </h2>
            <p className="text-sm text-muted-foreground">
              Comprehensive governance capabilities that protect company IP, prevent data exfiltration, and ensure audit compliance.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <Eye className="h-5 w-5 text-primary mb-2" />
                <CardTitle className="text-base font-semibold">Privacy-Aware AI Access</CardTitle>
                <CardDescription className="text-xs">
                  Automated scanning detects emails, credentials, API keys, and sensitive tokens before prompts leave your network.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Sliders className="h-5 w-5 text-indigo-500 mb-2" />
                <CardTitle className="text-base font-semibold">Policy-Based Governance</CardTitle>
                <CardDescription className="text-xs">
                  Define declarative rules for model allowlists, token budget limits, department-level risk thresholds, and compliance guardrails.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Lock className="h-5 w-5 text-amber-500 mb-2" />
                <CardTitle className="text-base font-semibold">Human Approval Workflows</CardTitle>
                <CardDescription className="text-xs">
                  Automatically intercept high-risk prompts and require authorized human review in the Approval Center before model invocation.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Cpu className="h-5 w-5 text-emerald-500 mb-2" />
                <CardTitle className="text-base font-semibold">Centralized Model Management</CardTitle>
                <CardDescription className="text-xs">
                  Switch dynamically between OpenAI, Anthropic, or mock providers. Manage upstream API credentials securely with zero frontend leakage.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Building2 className="h-5 w-5 text-cyan-500 mb-2" />
                <CardTitle className="text-base font-semibold">Tenant & Role Isolation</CardTitle>
                <CardDescription className="text-xs">
                  Multi-tenant architecture enforces strict organization isolation. Developers only see their own requests while Admins govern the organization.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <FileSearch className="h-5 w-5 text-rose-500 mb-2" />
                <CardTitle className="text-base font-semibold">Cryptographic Audit Traces</CardTitle>
                <CardDescription className="text-xs">
                  Every lifecycle transition produces an immutable audit event in MongoDB with cryptographic SHA-256 verification chains.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Security & Governance Deep-Dive */}
      <section id="security" className="py-20 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <Badge variant="outline" className="text-xs">Zero-Trust Security</Badge>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              Guaranteed Server-Side Verification
            </h2>
            <p className="text-sm text-muted-foreground">
              Security is enforced at the network and service layers, never solely in frontend client code.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-xl border border-border bg-card space-y-3">
              <span className="font-bold text-sm text-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Strict Server-Side Claims
              </span>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Client parameters cannot override authenticated claims. User roles and organization boundaries are verified against the Identity database on every request.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-border bg-card space-y-3">
              <span className="font-bold text-sm text-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Masked Secrets Protection
              </span>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Upstream model API keys are encrypted at rest, masked in API responses, and never transmitted to client browsers or stored in session storage.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-border bg-card space-y-3">
              <span className="font-bold text-sm text-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Independent Scanner Pipeline
              </span>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Even if frontend preflight scanning is skipped or manipulated, the AI Gateway independently invokes the Privacy Scanner before dispatching to any provider.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="py-20 bg-gradient-to-b from-background to-muted/30">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
            Start Securing Your AI Infrastructure Today
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
            Deploy AegisAI to govern model usage, ensure strict privacy boundaries, and establish immutable compliance audit trails.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/get-started" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto gap-2 text-sm font-semibold h-11 px-6">
                <span>Start with AegisAI</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/login" className="w-full sm:w-auto">
              <Button variant="outline" size="lg" className="w-full sm:w-auto text-sm h-11 px-6">
                Sign In to Workspace
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-xs text-muted-foreground">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <span className="font-semibold text-foreground">AegisAI Platform</span>
            <span>• Enterprise AI Security & Governance Gateway</span>
          </div>

          <div className="flex items-center gap-6">
            <Link to="/docs" className="hover:text-foreground">Documentation</Link>
            <Link to="/login" className="hover:text-foreground">Sign In</Link>
            <Link to="/get-started" className="hover:text-foreground">Get Started</Link>
            <span className="font-mono text-[11px]">v1.0.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
