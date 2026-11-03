import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { gatewayApi } from '../services/gateway-api';
import { auditApi } from '../services/audit-api';
import { modelApi } from '../services/model-api';
import { API_CONFIG } from '../services/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { StatusBadge } from '../components/common/StatusBadge';
import { Skeleton } from '../components/ui/Skeleton';
import { Button } from '../components/ui/Button';
import { formatDate, formatRelativeTime } from '../lib/utils';
import type { AiRequestListItem, AuditEvent } from '../types';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Legend
} from 'recharts';
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  RefreshCw,
  Server,
  ArrowUpRight,
  TrendingUp,
  Cpu
} from 'lucide-react';

interface ServiceHealthStatus {
  service: string;
  url: string;
  status: 'UP' | 'DOWN' | 'CHECKING';
  latencyMs?: number;
}

export function OverviewPage() {
  const [requests, setRequests] = useState<AiRequestListItem[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [totalRequestsCount, setTotalRequestsCount] = useState<number>(0);
  const [totalTokensCount, setTotalTokensCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Microservices Health State
  const [servicesHealth, setServicesHealth] = useState<ServiceHealthStatus[]>([
    { service: 'Identity Service', url: `${API_CONFIG.identity}/health/live`, status: 'CHECKING' },
    { service: 'AI Gateway', url: `${API_CONFIG.gateway}/health/live`, status: 'CHECKING' },
    { service: 'Privacy Scanner', url: `${API_CONFIG.privacy}/health/live`, status: 'CHECKING' },
    { service: 'Policy & Approval', url: `${API_CONFIG.policy}/health/live`, status: 'CHECKING' },
    { service: 'Model Provider', url: `${API_CONFIG.model}/health/live`, status: 'CHECKING' },
    { service: 'Security Audit', url: `${API_CONFIG.audit}/health/live`, status: 'CHECKING' }
  ]);

  const checkHealth = useCallback(async () => {
    const updated = await Promise.all(
      servicesHealth.map(async (item) => {
        const start = Date.now();
        try {
          const res = await fetch(item.url, { method: 'GET' });
          const latency = Date.now() - start;
          return {
            ...item,
            status: res.ok ? ('UP' as const) : ('DOWN' as const),
            latencyMs: latency
          };
        } catch {
          return {
            ...item,
            status: 'DOWN' as const,
            latencyMs: undefined
          };
        }
      })
    );
    setServicesHealth(updated);
  }, []);

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch AI requests for status calculation
      const reqRes = await gatewayApi.listRequests({ limit: 50 });
      setRequests(reqRes.data || []);
      setTotalRequestsCount(reqRes.pagination?.total || reqRes.data?.length || 0);

      // 2. Fetch recent audit events
      try {
        const auditRes = await auditApi.searchEvents({ limit: 10 });
        setAuditEvents(auditRes.events || []);
      } catch {
        setAuditEvents([]);
      }

      // 3. Fetch token usage metrics
      try {
        const usageRes = await modelApi.getUsage({ limit: 50 });
        const tokens = (usageRes.items || []).reduce((acc, cur) => acc + (cur.totalTokens || 0), 0);
        setTotalTokensCount(tokens);
      } catch {
        setTotalTokensCount(0);
      }

      // 4. Ping microservices health
      await checkHealth();

      setLastUpdated(new Date());
    } finally {
      setIsLoading(false);
    }
  }, [checkHealth]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Aggregate metrics from real backend list
  const completedCount = requests.filter((r) => r.status === 'COMPLETED').length;
  const waitingApprovalCount = requests.filter((r) => r.status === 'WAITING_FOR_APPROVAL').length;
  const blockedCount = requests.filter((r) => r.status === 'BLOCKED').length;
  const failedCount = requests.filter((r) => r.status === 'FAILED').length;

  const chartData = [
    { name: 'Completed', value: completedCount, color: '#10b981' },
    { name: 'Waiting Approval', value: waitingApprovalCount, color: '#f59e0b' },
    { name: 'Blocked', value: blockedCount, color: '#ef4444' },
    { name: 'Failed', value: failedCount, color: '#64748b' }
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Security & Governance Overview</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time telemetry aggregated from active AegisAI microservices
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-[11px] text-muted-foreground">
              Updated {formatRelativeTime(lastUpdated.toISOString())}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={loadDashboardData} disabled={isLoading} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Requests
            </CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <div className="text-2xl font-bold text-foreground">{totalRequestsCount}</div>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">Processed through AI Gateway</p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Completed
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{completedCount}</div>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">Successfully fulfilled</p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Pending Approval
            </CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{waitingApprovalCount}</div>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">Gated by governance policies</p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Blocked by Guardrails
            </CardTitle>
            <XCircle className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">{blockedCount}</div>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">Privacy secrets or policy denials</p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tokens Consumed
            </CardTitle>
            <Cpu className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{totalTokensCount.toLocaleString()}</div>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">Operational token telemetry</p>
          </CardContent>
        </Card>
      </div>

      {/* Middle Row: Status Distribution & Service Health Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Breakdown Chart */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Request Status Distribution
            </CardTitle>
            <CardDescription className="text-xs">
              Breakdown of recent request states
            </CardDescription>
          </CardHeader>
          <CardContent className="h-64 flex items-center justify-center">
            {isLoading ? (
              <Skeleton className="h-48 w-48 rounded-full" />
            ) : chartData.length === 0 ? (
              <div className="text-center text-xs text-muted-foreground">
                <p>No request traffic recorded yet.</p>
                <Link to="/playground" className="text-primary hover:underline mt-1 inline-block">
                  Submit test prompt in Playground
                </Link>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Microservices Health Mesh */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Server className="h-4 w-4 text-primary" />
              Microservices Cluster Connectivity
            </CardTitle>
            <CardDescription className="text-xs">
              Live health probes across all 6 AegisAI microservices
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {servicesHealth.map((item) => (
                <div
                  key={item.service}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`h-2.5 w-2.5 rounded-full ${
                        item.status === 'UP'
                          ? 'bg-emerald-500'
                          : item.status === 'CHECKING'
                          ? 'bg-amber-400 animate-pulse'
                          : 'bg-rose-500'
                      }`}
                    />
                    <div>
                      <p className="text-xs font-semibold text-foreground">{item.service}</p>
                      <p className="text-[10px] text-muted-foreground truncate max-w-[170px]">{item.url}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-xs font-bold ${
                        item.status === 'UP'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : item.status === 'CHECKING'
                          ? 'text-amber-500'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {item.status}
                    </span>
                    {item.latencyMs !== undefined && (
                      <p className="text-[10px] text-muted-foreground">{item.latencyMs}ms</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row: Recent Requests & Recent Audit Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent AI Requests */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Recent AI Requests</CardTitle>
              <CardDescription className="text-xs">Latest submissions via AI Gateway</CardDescription>
            </div>
            <Link to="/requests" className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
              View All <ArrowUpRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : requests.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No requests recorded yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {requests.slice(0, 5).map((req) => (
                  <Link
                    key={req.id}
                    to={`/requests/${req.id}`}
                    className="py-2.5 flex items-center justify-between hover:bg-muted/30 px-2 rounded-md transition-colors block"
                  >
                    <div className="min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-foreground truncate max-w-[160px]">
                          {req.id}
                        </span>
                        <StatusBadge status={req.status} />
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        Model: {req.modelSelected || 'Auto'} &bull; {formatRelativeTime(req.createdAt)}
                      </p>
                    </div>
                    <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Security Audit Events */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Recent Security Audit Activity</CardTitle>
              <CardDescription className="text-xs">Immutable cryptographically signed event traces</CardDescription>
            </div>
            <Link to="/audit" className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
              Audit Explorer <ArrowUpRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : auditEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No audit activity recorded yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {auditEvents.slice(0, 5).map((evt) => (
                  <div key={evt.eventId} className="py-2.5 flex items-center justify-between px-2">
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-foreground">
                          {evt.eventType}
                        </span>
                        <StatusBadge status={evt.severity} />
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        Trace: {evt.traceId ? evt.traceId.slice(0, 16) + '...' : '—'} &bull; {formatRelativeTime(evt.occurredAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span title="Cryptographically Digest Signed">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
