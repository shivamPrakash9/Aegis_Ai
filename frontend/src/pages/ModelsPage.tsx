import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Bot, 
  Cpu, 
  RefreshCw, 
  BarChart3, 
  Power, 
  PowerOff,
  Plus,
  Server,
  Activity,
  Key
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
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { modelApi } from '@/services/model-api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { ModelConfig, ProviderConfig } from '@/types';

export const ModelsPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const canAdminister = ['ORGANIZATION_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'MODEL_ADMIN'].includes(user?.role || '');

  // Active tab state
  const [activeTab, setActiveTab] = useState<'catalog' | 'providers' | 'telemetry'>('catalog');

  // Confirmation toggles
  const [confirmToggleModel, setConfirmToggleModel] = useState<ModelConfig | null>(null);
  const [confirmToggleProvider, setConfirmToggleProvider] = useState<ProviderConfig | null>(null);

  // Register model modal state
  const [isRegisterModelOpen, setIsRegisterModelOpen] = useState(false);
  const [newModelId, setNewModelId] = useState('');
  const [newModelProvider, setNewModelProvider] = useState('openai');
  const [newProviderModelName, setNewProviderModelName] = useState('');
  const [newContextWindow, setNewContextWindow] = useState('128000');
  const [newMaxTokens, setNewMaxTokens] = useState('4096');
  const [newCapabilities, setNewCapabilities] = useState('general, code, analysis');
  const [newModelDescription, setNewModelDescription] = useState('');

  // Register provider modal state
  const [isRegisterProviderOpen, setIsRegisterProviderOpen] = useState(false);
  const [newProviderId, setNewProviderId] = useState('');
  const [newProviderName, setNewProviderName] = useState('');
  const [newProviderType, setNewProviderType] = useState<'openai' | 'anthropic' | 'mock' | 'custom'>('openai');
  const [newProviderBaseUrl, setNewProviderBaseUrl] = useState('');
  const [newProviderApiKey, setNewProviderApiKey] = useState('');

  // Provider testing state
  const [testingProviderId, setTestingProviderId] = useState<string | null>(null);

  // Fetch models list
  const {
    data: models = [],
    isLoading: isLoadingModels,
    error: modelsError,
    refetch: refetchModels,
    isFetching: isFetchingModels
  } = useQuery({
    queryKey: ['models-list'],
    queryFn: () => modelApi.listModels(),
  });

  // Fetch providers list
  const {
    data: providers = [],
    isLoading: isLoadingProviders,
    error: providersError,
    refetch: refetchProviders,
    isFetching: isFetchingProviders
  } = useQuery({
    queryKey: ['providers-list'],
    queryFn: () => modelApi.listProviders(),
  });

  // Fetch usage telemetry
  const { data: usageData, isLoading: isLoadingUsage } = useQuery({
    queryKey: ['models-usage'],
    queryFn: () => modelApi.getUsage({ limit: 15 }),
    staleTime: 30000,
  });

  // Enable/Disable Model Mutation
  const toggleModelMutation = useMutation({
    mutationFn: async (model: ModelConfig) => {
      if (model.enabled) {
        return modelApi.disableModel(model.modelId);
      } else {
        return modelApi.enableModel(model.modelId);
      }
    },
    onSuccess: (updated) => {
      toast({
        title: `Model ${updated.enabled ? 'Enabled' : 'Disabled'}`,
        description: `Model ${updated.modelId} is now ${updated.enabled ? 'available' : 'unavailable'} for routing.`,
        variant: 'default',
      });
      queryClient.invalidateQueries({ queryKey: ['models-list'] });
      queryClient.invalidateQueries({ queryKey: ['available-models'] });
      setConfirmToggleModel(null);
    },
    onError: (err: any) => {
      toast({
        title: 'Action Failed',
        description: err.message || 'Could not toggle model state.',
        variant: 'destructive',
      });
      setConfirmToggleModel(null);
    },
  });

  // Enable/Disable Provider Mutation
  const toggleProviderMutation = useMutation({
    mutationFn: async (provider: ProviderConfig) => {
      if (provider.enabled) {
        return modelApi.disableProvider(provider.id);
      } else {
        return modelApi.enableProvider(provider.id);
      }
    },
    onSuccess: (updated) => {
      toast({
        title: `Provider ${updated.enabled ? 'Enabled' : 'Disabled'}`,
        description: `Provider ${updated.name} (${updated.id}) is now ${updated.enabled ? 'enabled' : 'disabled'}.`,
        variant: 'default',
      });
      queryClient.invalidateQueries({ queryKey: ['providers-list'] });
      queryClient.invalidateQueries({ queryKey: ['models-list'] });
      setConfirmToggleProvider(null);
    },
    onError: (err: any) => {
      toast({
        title: 'Action Failed',
        description: err.message || 'Could not toggle provider state.',
        variant: 'destructive',
      });
      setConfirmToggleProvider(null);
    },
  });

  // Register Model Mutation
  const registerModelMutation = useMutation({
    mutationFn: async () => {
      const caps = newCapabilities
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);

      return modelApi.registerModel({
        modelId: newModelId.trim(),
        provider: newModelProvider.trim(),
        providerModelName: newProviderModelName.trim() || newModelId.trim(),
        contextWindow: parseInt(newContextWindow, 10) || 128000,
        maxTokens: parseInt(newMaxTokens, 10) || 4096,
        capabilities: caps.length > 0 ? caps : ['chat'],
        description: newModelDescription.trim() || undefined,
        enabled: true,
      });
    },
    onSuccess: (registered) => {
      toast({
        title: 'Model Registered Successfully',
        description: `Model ${registered.modelId} registered under provider ${registered.provider} and persisted.`,
        variant: 'success',
      });
      setIsRegisterModelOpen(false);
      setNewModelId('');
      setNewProviderModelName('');
      setNewModelDescription('');
      queryClient.invalidateQueries({ queryKey: ['models-list'] });
      queryClient.invalidateQueries({ queryKey: ['available-models'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Model Registration Failed',
        description: err.message || 'Error registering new model.',
        variant: 'destructive',
      });
    },
  });

  // Register Provider Mutation
  const registerProviderMutation = useMutation({
    mutationFn: async () => {
      return modelApi.registerProvider({
        id: newProviderId.trim().toLowerCase(),
        name: newProviderName.trim(),
        type: newProviderType,
        baseUrl: newProviderBaseUrl.trim() || undefined,
        apiKey: newProviderApiKey.trim() || undefined,
        enabled: true,
      });
    },
    onSuccess: (registered) => {
      toast({
        title: 'Provider Registered Successfully',
        description: `Provider '${registered.name}' (${registered.id}) has been persisted to the platform catalog.`,
        variant: 'success',
      });
      setIsRegisterProviderOpen(false);
      setNewProviderId('');
      setNewProviderName('');
      setNewProviderBaseUrl('');
      setNewProviderApiKey('');
      queryClient.invalidateQueries({ queryKey: ['providers-list'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Provider Registration Failed',
        description: err.message || 'Error registering new provider configuration.',
        variant: 'destructive',
      });
    },
  });

  // Test Provider Connection
  const handleTestProvider = async (providerId: string) => {
    setTestingProviderId(providerId);
    try {
      const res = await modelApi.testProvider(providerId);
      if (res.healthy) {
        toast({
          title: 'Connection Succeeded',
          description: `${res.message} (${res.latencyMs}ms)`,
          variant: 'success',
        });
      } else {
        toast({
          title: 'Connection Issue',
          description: res.message,
          variant: 'destructive',
        });
      }
      queryClient.invalidateQueries({ queryKey: ['providers-list'] });
    } catch (err: any) {
      toast({
        title: 'Connection Test Failed',
        description: err.message || 'Could not reach provider service endpoint.',
        variant: 'destructive',
      });
    } finally {
      setTestingProviderId(null);
    }
  };

  const usageRecords = usageData?.items || [];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Cpu className="h-6 w-6 text-primary" />
            Model & Provider Administration
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure upstream AI model providers, manage routing policies, and monitor token usage.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchModels();
              refetchProviders();
            }}
            disabled={isFetchingModels || isFetchingProviders}
            className="gap-1 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetchingModels || isFetchingProviders ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          {canAdminister && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsRegisterProviderOpen(true)}
                className="gap-1 text-xs"
              >
                <Server className="h-3.5 w-3.5 text-primary" />
                <span>Add Provider</span>
              </Button>

              <Button
                size="sm"
                onClick={() => {
                  if (providers.length > 0 && !newModelProvider) {
                    setNewModelProvider(providers[0].id);
                  }
                  setIsRegisterModelOpen(true);
                }}
                className="gap-1 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Register Model</span>
              </Button>
            </>
          )}

          <Badge variant="outline" className="px-3 py-1 text-xs font-mono">
            {models.filter((m) => m.enabled).length} / {models.length} Models Active
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="catalog" className="gap-1.5">
            <Bot className="h-4 w-4" />
            <span>Model Catalog ({models.length})</span>
          </TabsTrigger>
          <TabsTrigger value="providers" className="gap-1.5">
            <Server className="h-4 w-4" />
            <span>AI Providers ({providers.length})</span>
          </TabsTrigger>
          <TabsTrigger value="telemetry" className="gap-1.5">
            <BarChart3 className="h-4 w-4" />
            <span>Usage Telemetry</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Model Catalog */}
        <TabsContent value="catalog">
          <Card>
            <CardContent className="p-0">
              {isLoadingModels ? (
                <div className="p-6 space-y-4">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : modelsError ? (
                <div className="p-6">
                  <ErrorState
                    title="Failed to load model catalog"
                    message={(modelsError as Error).message}
                    onRetry={() => refetchModels()}
                  />
                </div>
              ) : models.length === 0 ? (
                <div className="p-8">
                  <EmptyState
                    icon={Cpu}
                    title="No Models Registered"
                    description="No upstream LLM models have been registered yet. Click 'Register Model' to add a model."
                    actionLabel={canAdminister ? "Register Model" : undefined}
                    onAction={canAdminister ? () => setIsRegisterModelOpen(true) : undefined}
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Model Identifier</TableHead>
                        <TableHead>Provider</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Context Window</TableHead>
                        <TableHead>Max Output</TableHead>
                        <TableHead>Capabilities</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {models.map((m) => (
                        <TableRow key={m.modelId}>
                          <TableCell>
                            <div className="font-mono text-xs font-semibold text-foreground flex items-center gap-2">
                              <span>{m.modelId}</span>
                              {m.isDefault && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  DEFAULT
                                </Badge>
                              )}
                            </div>
                            <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
                              Upstream: {m.providerModelName}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs font-medium text-foreground">
                            <span className="font-mono bg-muted/60 px-2 py-0.5 rounded text-[11px]">
                              {m.provider}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={m.enabled ? 'default' : 'secondary'}
                              className="text-[11px]"
                            >
                              {m.enabled ? 'ENABLED' : 'DISABLED'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-mono">
                            {m.contextWindow.toLocaleString()} tokens
                          </TableCell>
                          <TableCell className="text-xs font-mono">
                            {m.maxTokens.toLocaleString()} tokens
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {m.capabilities?.map((cap) => (
                                <Badge key={cap} variant="outline" className="text-[10px] px-1.5 py-0">
                                  {cap}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {canAdminister && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`h-7 px-2 text-xs gap-1 ${
                                  m.enabled ? 'text-destructive hover:text-destructive' : 'text-emerald-600 hover:text-emerald-700'
                                }`}
                                onClick={() => setConfirmToggleModel(m)}
                              >
                                {m.enabled ? (
                                  <>
                                    <PowerOff className="h-3.5 w-3.5" />
                                    <span>Disable</span>
                                  </>
                                ) : (
                                  <>
                                    <Power className="h-3.5 w-3.5" />
                                    <span>Enable</span>
                                  </>
                                )}
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
        </TabsContent>

        {/* Tab 2: Providers */}
        <TabsContent value="providers">
          <Card>
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Server className="h-5 w-5 text-primary" />
                    <span>Configured AI Provider Adapters</span>
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Upstream LLM platforms, API credentials, and network connectivity status.
                  </CardDescription>
                </div>
                {canAdminister && (
                  <Button
                    size="sm"
                    onClick={() => setIsRegisterProviderOpen(true)}
                    className="gap-1.5 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Register Provider</span>
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingProviders ? (
                <div className="p-6 space-y-4">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : providersError ? (
                <div className="p-6">
                  <ErrorState
                    title="Failed to load providers"
                    message={(providersError as Error).message}
                    onRetry={() => refetchProviders()}
                  />
                </div>
              ) : providers.length === 0 ? (
                <div className="p-8">
                  <EmptyState
                    icon={Server}
                    title="No Providers Configured"
                    description="No upstream LLM providers have been registered yet."
                    actionLabel={canAdminister ? "Add Provider" : undefined}
                    onAction={canAdminister ? () => setIsRegisterProviderOpen(true) : undefined}
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Provider</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Endpoint / Base URL</TableHead>
                        <TableHead>Credentials</TableHead>
                        <TableHead>Health</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {providers.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>
                            <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                              <span>{p.name}</span>
                              {p.isBuiltin && (
                                <Badge variant="secondary" className="text-[10px] px-1 py-0">
                                  BUILT-IN
                                </Badge>
                              )}
                            </div>
                            <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
                              ID: {p.id}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[11px] uppercase font-mono">
                              {p.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground max-w-[200px] truncate">
                            {p.baseUrl || <span className="italic text-muted-foreground/60">Cloud Default</span>}
                          </TableCell>
                          <TableCell>
                            {p.apiKeyConfigured ? (
                              <div className="flex items-center gap-1 text-emerald-600 text-xs font-mono">
                                <Key className="h-3 w-3" />
                                <span>{p.apiKeyMasked || 'Configured'}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">None / Not Required</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <span className={`h-2 w-2 rounded-full ${p.isHealthy ? 'bg-emerald-500' : 'bg-destructive'}`} />
                              <span className="text-xs text-foreground font-medium">
                                {p.isHealthy ? 'Healthy' : 'Degraded'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={p.enabled ? 'default' : 'secondary'} className="text-[11px]">
                              {p.enabled ? 'ENABLED' : 'DISABLED'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {canAdminister && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={testingProviderId === p.id}
                                    onClick={() => handleTestProvider(p.id)}
                                    className="h-7 px-2 text-xs gap-1"
                                    title="Verify live network connectivity"
                                  >
                                    <Activity className={`h-3 w-3 ${testingProviderId === p.id ? 'animate-spin' : ''}`} />
                                    <span>{testingProviderId === p.id ? 'Testing...' : 'Test'}</span>
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={`h-7 px-2 text-xs gap-1 ${
                                      p.enabled ? 'text-destructive hover:text-destructive' : 'text-emerald-600 hover:text-emerald-700'
                                    }`}
                                    onClick={() => setConfirmToggleProvider(p)}
                                  >
                                    {p.enabled ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                                    <span>{p.enabled ? 'Disable' : 'Enable'}</span>
                                  </Button>
                                </>
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
        </TabsContent>

        {/* Tab 3: Usage Telemetry */}
        <TabsContent value="telemetry">
          <Card>
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <span>Recent Upstream Provider Dispatch Records</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Tokens consumed, latency, and dispatch execution status recorded by the Model Provider service.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingUsage ? (
                <div className="p-6 space-y-3">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : usageRecords.length === 0 ? (
                <div className="p-8">
                  <EmptyState
                    icon={BarChart3}
                    title="No Usage Records"
                    description="No provider dispatches have been recorded yet."
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Provider</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead>Prompt Tokens</TableHead>
                        <TableHead>Completion Tokens</TableHead>
                        <TableHead>Total Tokens</TableHead>
                        <TableHead>Latency</TableHead>
                        <TableHead className="text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usageRecords.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="text-xs text-muted-foreground font-mono">
                            {new Date(u.createdAt).toLocaleTimeString()}
                          </TableCell>
                          <TableCell className="text-xs font-medium text-foreground">
                            {u.provider}
                          </TableCell>
                          <TableCell className="text-xs font-mono">
                            {u.model}
                          </TableCell>
                          <TableCell className="text-xs font-mono">
                            {u.promptTokens}
                          </TableCell>
                          <TableCell className="text-xs font-mono">
                            {u.completionTokens}
                          </TableCell>
                          <TableCell className="text-xs font-mono font-bold text-foreground">
                            {u.totalTokens}
                          </TableCell>
                          <TableCell className="text-xs font-mono">
                            {u.latencyMs}ms
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant={u.status === 'COMPLETED' ? 'default' : 'secondary'} className="text-[10px]">
                              {u.status}
                            </Badge>
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

      {/* Confirmation Dialog for Toggling Model */}
      {confirmToggleModel && (
        <ConfirmDialog
          open={Boolean(confirmToggleModel)}
          onOpenChange={(open) => !open && setConfirmToggleModel(null)}
          title={`${confirmToggleModel.enabled ? 'Disable' : 'Enable'} Model`}
          description={`Are you sure you want to ${
            confirmToggleModel.enabled ? 'disable' : 'enable'
          } ${confirmToggleModel.modelId}? ${
            confirmToggleModel.enabled
              ? 'Requests specifying this model will be rejected or rerouted.'
              : 'This model will immediately become available for dispatch.'
          }`}
          confirmLabel={confirmToggleModel.enabled ? 'Disable Model' : 'Enable Model'}
          variant={confirmToggleModel.enabled ? 'destructive' : 'default'}
          onConfirm={() => toggleModelMutation.mutate(confirmToggleModel)}
        />
      )}

      {/* Confirmation Dialog for Toggling Provider */}
      {confirmToggleProvider && (
        <ConfirmDialog
          open={Boolean(confirmToggleProvider)}
          onOpenChange={(open) => !open && setConfirmToggleProvider(null)}
          title={`${confirmToggleProvider.enabled ? 'Disable' : 'Enable'} Provider`}
          description={`Are you sure you want to ${
            confirmToggleProvider.enabled ? 'disable' : 'enable'
          } provider ${confirmToggleProvider.name} (${confirmToggleProvider.id})? Models routed to this provider will be affected.`}
          confirmLabel={confirmToggleProvider.enabled ? 'Disable Provider' : 'Enable Provider'}
          variant={confirmToggleProvider.enabled ? 'destructive' : 'default'}
          onConfirm={() => toggleProviderMutation.mutate(confirmToggleProvider)}
        />
      )}

      {/* Register Model Dialog */}
      <Dialog open={isRegisterModelOpen} onOpenChange={setIsRegisterModelOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <Cpu className="h-5 w-5 text-primary" />
              <span>Register AI Model Endpoint</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure and authorize a new upstream LLM model for organizational routing and dispatch.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-medium text-foreground block mb-1">Model Identifier (Internal Key)</label>
                <Input
                  placeholder="e.g., llama-3-8b"
                  value={newModelId}
                  onChange={(e) => setNewModelId(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1">Provider Adapter</label>
                <select
                  className="w-full px-3 py-2 text-xs bg-background border border-input rounded-md focus:outline-none"
                  value={newModelProvider}
                  onChange={(e) => setNewModelProvider(e.target.value)}
                >
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.id})
                    </option>
                  ))}
                  {providers.length === 0 && (
                    <>
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic</option>
                      <option value="mock">Mock</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">Upstream Model Identifier</label>
              <Input
                placeholder="e.g., meta-llama/Meta-Llama-3-8B-Instruct or gpt-4o"
                value={newProviderModelName}
                onChange={(e) => setNewProviderModelName(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-medium text-foreground block mb-1">Context Window (Tokens)</label>
                <Input
                  type="number"
                  placeholder="128000"
                  value={newContextWindow}
                  onChange={(e) => setNewContextWindow(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1">Max Output Tokens</label>
                <Input
                  type="number"
                  placeholder="4096"
                  value={newMaxTokens}
                  onChange={(e) => setNewMaxTokens(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">Capabilities (Comma Separated)</label>
              <Input
                placeholder="general, code, analysis, reasoning"
                value={newCapabilities}
                onChange={(e) => setNewCapabilities(e.target.value)}
                className="text-xs"
              />
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">Description (Optional)</label>
              <Input
                placeholder="Brief summary of model capabilities and usage policies..."
                value={newModelDescription}
                onChange={(e) => setNewModelDescription(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsRegisterModelOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!newModelId.trim() || registerModelMutation.isPending}
              onClick={() => registerModelMutation.mutate()}
            >
              {registerModelMutation.isPending ? 'Registering...' : 'Register Model'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Register Provider Dialog */}
      <Dialog open={isRegisterProviderOpen} onOpenChange={setIsRegisterProviderOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              <span>Configure AI Provider Adapter</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Register a new upstream provider endpoint (e.g. OpenAI, Anthropic, vLLM, or Ollama).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-medium text-foreground block mb-1">Provider ID (Slug)</label>
                <Input
                  placeholder="e.g., local-ollama"
                  value={newProviderId}
                  onChange={(e) => setNewProviderId(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1">Provider Type</label>
                <select
                  className="w-full px-3 py-2 text-xs bg-background border border-input rounded-md focus:outline-none"
                  value={newProviderType}
                  onChange={(e) => setNewProviderType(e.target.value as any)}
                >
                  <option value="openai">OpenAI / OpenAI-Compatible</option>
                  <option value="anthropic">Anthropic Claude</option>
                  <option value="mock">Mock Provider (Local Dev)</option>
                  <option value="custom">Custom Endpoint</option>
                </select>
              </div>
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">Display Name</label>
              <Input
                placeholder="e.g., Production Ollama Cluster"
                value={newProviderName}
                onChange={(e) => setNewProviderName(e.target.value)}
                className="text-xs"
              />
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">
                Base URL / Endpoint {newProviderType === 'mock' ? '(Optional for mock)' : ''}
              </label>
              <Input
                placeholder={
                  newProviderType === 'anthropic'
                    ? 'https://api.anthropic.com'
                    : 'http://127.0.0.1:11434/v1 or https://api.openai.com/v1'
                }
                value={newProviderBaseUrl}
                onChange={(e) => setNewProviderBaseUrl(e.target.value)}
                className="text-xs font-mono"
              />
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">
                API Key / Secret Token (Masked & Encrypted)
              </label>
              <Input
                type="password"
                placeholder="sk-... or Bearer secret (optional for local models)"
                value={newProviderApiKey}
                onChange={(e) => setNewProviderApiKey(e.target.value)}
                className="text-xs font-mono"
                autoComplete="off"
              />
              <span className="text-[10px] text-muted-foreground mt-1 block">
                Secrets are stored securely in backend configuration and never returned in plaintext.
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsRegisterProviderOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!newProviderId.trim() || !newProviderName.trim() || registerProviderMutation.isPending}
              onClick={() => registerProviderMutation.mutate()}
            >
              {registerProviderMutation.isPending ? 'Saving Provider...' : 'Save Provider'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
