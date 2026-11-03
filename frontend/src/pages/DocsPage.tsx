import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Shield, 
  ArrowLeft, 
  Server, 
  Terminal, 
  Layers, 
  Key, 
  Database, 
  Cpu, 
  Sliders, 
  CheckCircle2, 
  Lock, 
  Copy, 
  Check 
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

export const DocsPage: React.FC = () => {
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const sampleCurl = `curl -X POST http://localhost:3001/v1/ai-requests \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <YOUR_ACCESS_TOKEN>" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{
    "messages": [
      { "role": "user", "content": "Analyze quarterly revenue report for Acme Corp." }
    ],
    "modelPreference": { "model": "mock-gpt-4o" }
  }'`;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md py-4 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                <Shield className="h-4 w-4" />
              </div>
              <span className="font-bold text-sm tracking-tight text-foreground">
                AegisAI
              </span>
            </Link>
            <span className="text-muted-foreground text-xs font-mono">/docs</span>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to Home</span>
              </Button>
            </Link>
            <Link to="/login">
              <Button size="sm" className="text-xs">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-12 space-y-12">
        <div className="space-y-3">
          <Badge variant="outline" className="text-xs">Platform Documentation</Badge>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            AegisAI Architecture & Integration Guide
          </h1>
          <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">
            Technical reference for the AegisAI Enterprise AI Security & Governance Gateway, including microservice specifications, authentication flow, and REST API contracts.
          </p>
        </div>

        {/* Microservice Port Matrix */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            Microservice Network & Persistence Topology
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-foreground">Identity Service</span>
                  <Badge variant="outline" className="font-mono text-[10px]">Port 3000</Badge>
                </div>
                <p className="text-muted-foreground">
                  User accounts, organizations, PBKDF2/Argon2 password hashes, JWT token pairs, and RBAC permissions.
                </p>
                <div className="pt-2 text-[11px] font-mono text-muted-foreground flex items-center gap-1">
                  <Database className="h-3 w-3" /> PostgreSQL: aegis_identity
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-foreground">AI Gateway</span>
                  <Badge variant="outline" className="font-mono text-[10px]">Port 3001</Badge>
                </div>
                <p className="text-muted-foreground">
                  Pipeline orchestrator, rate limiter, request persistence, idempotency reservation, and status polling.
                </p>
                <div className="pt-2 text-[11px] font-mono text-muted-foreground flex items-center gap-1">
                  <Database className="h-3 w-3" /> PostgreSQL: aegis_gateway + Redis
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-foreground">Privacy Scanner</span>
                  <Badge variant="outline" className="font-mono text-[10px]">Port 3002</Badge>
                </div>
                <p className="text-muted-foreground">
                  Deterministic regex and NLP pattern scanning. Evaluates PII, secrets, credentials, and DLP rules.
                </p>
                <div className="pt-2 text-[11px] font-mono text-muted-foreground flex items-center gap-1">
                  <Database className="h-3 w-3" /> PostgreSQL: aegis_privacy
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-foreground">Policy Approval</span>
                  <Badge variant="outline" className="font-mono text-[10px]">Port 3003</Badge>
                </div>
                <p className="text-muted-foreground">
                  Governance engine, rule compilation, model allowlists, and human-in-the-loop approval workflows.
                </p>
                <div className="pt-2 text-[11px] font-mono text-muted-foreground flex items-center gap-1">
                  <Database className="h-3 w-3" /> PostgreSQL: aegis_policy
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-foreground">Model Provider</span>
                  <Badge variant="outline" className="font-mono text-[10px]">Port 3004</Badge>
                </div>
                <p className="text-muted-foreground">
                  Dynamic provider adapters (OpenAI, Anthropic, Mock), model catalog, and token usage telemetry.
                </p>
                <div className="pt-2 text-[11px] font-mono text-muted-foreground flex items-center gap-1">
                  <Database className="h-3 w-3" /> PostgreSQL: aegis_model
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-foreground">Security Audit</span>
                  <Badge variant="outline" className="font-mono text-[10px]">Port 3005</Badge>
                </div>
                <p className="text-muted-foreground">
                  Immutable event ledger. Stores correlated traces with SHA-256 tamper-evident integrity chains.
                </p>
                <div className="pt-2 text-[11px] font-mono text-muted-foreground flex items-center gap-1">
                  <Database className="h-3 w-3" /> MongoDB: aegis_audit
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* API Usage Quickstart */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Terminal className="h-5 w-5 text-primary" />
              API Quickstart: Submitting AI Requests
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopy(sampleCurl, 'curl')}
              className="text-xs gap-1"
            >
              {copiedKey === 'curl' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedKey === 'curl' ? 'Copied' : 'Copy cURL'}</span>
            </Button>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border font-mono text-xs overflow-x-auto text-foreground whitespace-pre">
            {sampleCurl}
          </div>
        </section>

        {/* Role Matrix */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            Role-Based Access Control (RBAC) Matrix
          </h2>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="p-3 font-semibold text-foreground">Capability</th>
                    <th className="p-3 font-semibold text-foreground">DEVELOPER</th>
                    <th className="p-3 font-semibold text-foreground">SECURITY_AUDITOR</th>
                    <th className="p-3 font-semibold text-foreground">ORGANIZATION_ADMIN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="p-3 font-medium">Submit AI Requests</td>
                    <td className="p-3 text-emerald-500 font-semibold">Yes</td>
                    <td className="p-3 text-emerald-500 font-semibold">Yes</td>
                    <td className="p-3 text-emerald-500 font-semibold">Yes</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium">View Own AI Requests</td>
                    <td className="p-3 text-emerald-500 font-semibold">Yes</td>
                    <td className="p-3 text-emerald-500 font-semibold">Yes</td>
                    <td className="p-3 text-emerald-500 font-semibold">Yes</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium">View All Organization Requests</td>
                    <td className="p-3 text-destructive font-semibold">No (Isolated)</td>
                    <td className="p-3 text-emerald-500 font-semibold">Yes</td>
                    <td className="p-3 text-emerald-500 font-semibold">Yes</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium">Manage Governance Policies</td>
                    <td className="p-3 text-destructive font-semibold">No</td>
                    <td className="p-3 text-muted-foreground">Read Only</td>
                    <td className="p-3 text-emerald-500 font-semibold">Yes (CRUD)</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium">Review & Resume Approvals</td>
                    <td className="p-3 text-destructive font-semibold">No</td>
                    <td className="p-3 text-emerald-500 font-semibold">Yes</td>
                    <td className="p-3 text-emerald-500 font-semibold">Yes</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium">Register Providers & Models</td>
                    <td className="p-3 text-destructive font-semibold">No</td>
                    <td className="p-3 text-destructive font-semibold">No</td>
                    <td className="p-3 text-emerald-500 font-semibold">Yes</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium">Manage Members & Onboarding</td>
                    <td className="p-3 text-destructive font-semibold">No</td>
                    <td className="p-3 text-destructive font-semibold">No</td>
                    <td className="p-3 text-emerald-500 font-semibold">Yes</td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 px-4 text-center text-xs text-muted-foreground">
        <p>AegisAI Enterprise AI Security & Governance Gateway • v1.0.0</p>
      </footer>
    </div>
  );
};
