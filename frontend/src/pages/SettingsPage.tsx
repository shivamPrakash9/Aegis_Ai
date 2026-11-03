import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Activity, 
  ShieldCheck, 
  Moon, 
  Sun, 
  Laptop, 
  User, 
  Building, 
  Key, 
  RefreshCw, 
  CheckCircle2, 
  XCircle,
  AlertTriangle
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/useToast';
import { API_CONFIG } from '@/services/api-client';

interface ServiceProbe {
  name: string;
  endpoint: string;
  port: number;
  status: 'ONLINE' | 'OFFLINE' | 'CHECKING';
  latencyMs?: number;
}

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

  const [probes, setProbes] = useState<ServiceProbe[]>([
    { name: 'Identity Service', endpoint: `${API_CONFIG.identity}/health/live`, port: 3000, status: 'CHECKING' },
    { name: 'AI Gateway', endpoint: `${API_CONFIG.gateway}/health/live`, port: 3001, status: 'CHECKING' },
    { name: 'Privacy Scanner', endpoint: `${API_CONFIG.privacy}/health/live`, port: 3002, status: 'CHECKING' },
    { name: 'Policy & Approval', endpoint: `${API_CONFIG.policy}/health/live`, port: 3003, status: 'CHECKING' },
    { name: 'Model & Provider', endpoint: `${API_CONFIG.model}/health/live`, port: 3004, status: 'CHECKING' },
    { name: 'Security & Audit', endpoint: `${API_CONFIG.audit}/health/live`, port: 3005, status: 'CHECKING' },
  ]);

  const [isProbing, setIsProbing] = useState(false);

  const probeAllServices = async () => {
    setIsProbing(true);
    const updated = await Promise.all(
      probes.map(async (probe) => {
        const start = performance.now();
        try {
          const res = await fetch(probe.endpoint, { method: 'GET' });
          const latency = Math.round(performance.now() - start);
          if (res.ok) {
            return { ...probe, status: 'ONLINE' as const, latencyMs: latency };
          }
          return { ...probe, status: 'OFFLINE' as const, latencyMs: latency };
        } catch {
          return { ...probe, status: 'OFFLINE' as const, latencyMs: undefined };
        }
      })
    );
    setProbes(updated);
    setIsProbing(false);
  };

  useEffect(() => {
    probeAllServices();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <SettingsIcon className="h-6 w-6 text-primary" />
          Gateway Settings & Cluster Status
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review active tenant identity, cluster microservice connectivity, and client configuration.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Cluster Health Probes */}
        <div className="lg:col-span-7 space-y-6">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  <span>Microservices Health Probes</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Real-time connectivity diagnostics across all 6 AegisAI microservices.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={probeAllServices}
                disabled={isProbing}
                className="gap-1 text-xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isProbing ? 'animate-spin' : ''}`} />
                <span>Probe Cluster</span>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {probes.map((probe) => (
                  <div
                    key={probe.name}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30"
                  >
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold text-foreground flex items-center gap-2">
                        <span>{probe.name}</span>
                        <Badge variant="outline" className="text-[10px] font-mono">
                          :{probe.port}
                        </Badge>
                      </div>
                      <div className="text-[11px] font-mono text-muted-foreground">
                        {probe.endpoint}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {probe.latencyMs !== undefined && (
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {probe.latencyMs}ms
                        </span>
                      )}
                      {probe.status === 'ONLINE' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Online</span>
                        </span>
                      ) : probe.status === 'OFFLINE' ? (
                        <span className="inline-flex items-center gap-1 text-destructive text-xs font-semibold">
                          <XCircle className="h-4 w-4" />
                          <span>Offline</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          <span>Checking...</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Theme Preferences */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Display & Theme</CardTitle>
              <CardDescription className="text-xs">
                Select your preferred interface color mode. Persists across browser sessions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`flex flex-col items-center justify-center p-4 rounded-lg border text-xs font-medium transition-all ${
                    theme === 'light'
                      ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                      : 'border-border bg-card hover:bg-muted text-muted-foreground'
                  }`}
                >
                  <Sun className="h-5 w-5 mb-2" />
                  <span>Light Theme</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`flex flex-col items-center justify-center p-4 rounded-lg border text-xs font-medium transition-all ${
                    theme === 'dark'
                      ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                      : 'border-border bg-card hover:bg-muted text-muted-foreground'
                  }`}
                >
                  <Moon className="h-5 w-5 mb-2" />
                  <span>Dark Theme</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTheme('system')}
                  className={`flex flex-col items-center justify-center p-4 rounded-lg border text-xs font-medium transition-all ${
                    theme === 'system'
                      ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                      : 'border-border bg-card hover:bg-muted text-muted-foreground'
                  }`}
                >
                  <Laptop className="h-5 w-5 mb-2" />
                  <span>System Default</span>
                </button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Identity Claims & Architecture Notes */}
        <div className="lg:col-span-5 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                <span>Active Principal Identity</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Verified claims from the active JWT issued by Identity Service.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="p-3 bg-muted/40 rounded-lg space-y-2">
                <div className="flex justify-between items-center py-1 border-b border-border">
                  <span className="text-muted-foreground">User Name:</span>
                  <span className="font-semibold text-foreground">{user?.displayName || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border">
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-mono text-foreground">{user?.email || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border">
                  <span className="text-muted-foreground">Role:</span>
                  <Badge variant="default" className="text-[10px]">
                    {user?.role || 'USER'}
                  </Badge>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border">
                  <span className="text-muted-foreground">Organization ID:</span>
                  <span className="font-mono text-[11px] text-foreground">{user?.organizationId || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-muted-foreground">Principal Type:</span>
                  <span className="font-mono text-foreground">{user?.type || 'USER'}</span>
                </div>
              </div>

              {user?.permissions && user.permissions.length > 0 && (
                <div>
                  <h4 className="font-semibold text-foreground mb-1.5">Granted Permissions:</h4>
                  <div className="flex flex-wrap gap-1">
                    {user.permissions.map((p) => (
                      <Badge key={p} variant="outline" className="font-mono text-[10px] px-1.5 py-0">
                        {p}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Enterprise Security Architecture Info */}
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span>Zero-Trust Enterprise Guarantees</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <p>
                <strong>1. No Secret Exposure:</strong> Provider keys and database credentials are held strictly within backend microservices and are never delivered to the client.
              </p>
              <p>
                <strong>2. In-Memory Token Isolation:</strong> Session tokens reside in secure browser memory and session storage, isolated from persistent localStorage.
              </p>
              <p>
                <strong>3. Audit Immutability:</strong> Security events are cryptographically sealed with HMAC/SHA-256 digests and cross-service traces.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
