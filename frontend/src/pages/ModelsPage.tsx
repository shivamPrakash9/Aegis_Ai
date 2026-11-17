import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Cpu, 
  RefreshCw, 
  BarChart3, 
  Power, 
  PowerOff,
  Plus,
  Server,
  Activity,
  Key,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Search,
  ExternalLink,
  Shield,
  Sparkles
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
import { ModelConfig, ProviderConfig, ProviderTestResult } from '@/types';

export const ModelsPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const canAdminister = ['ORGANIZATION_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'MODEL_ADMIN'].includes(user?.role || '');

  // Tab & search states
  const [activeTab, setActiveTab] = useState<'catalog' | 'providers' | 'telemetry'>('providers');
  const [modelSearch, setModelSearch] = useState('');
  const [providerSearch, setProviderSearch] = useState('');

  // Confirmation toggles and deletion states
  const [confirmToggleModel, setConfirmToggleModel] = useState<ModelConfig | null>(null);
  const [confirmToggleProvider, setConfirmToggleProvider] = useState<ProviderConfig | null>(null);
  const [confirmDeleteProvider, setConfirmDeleteProvider] = useState<ProviderConfig | null>(null);
  const [confirmDeleteModel, setConfirmDeleteModel] = useState<ModelConfig | null>(null);

  // Model modal state (Add / Edit)
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<ModelConfig | null>(null);
  const [mModelId, setMModelId] = useState('');
  const [mProvider, setMProvider] = useState('groq');
  const [mProviderModelName, setMProviderModelName] = useState('');
  const [mContextWindow, setMContextWindow] = useState('128000');
  const [mMaxTokens, setMMaxTokens] = useState('4096');
  const [mCapabilities, setMCapabilities] = useState('chat, reasoning');
  const [mDescription, setMDescription] = useState('');
  const [mEnabled, setMEnabled] = useState(true);
  const [mIsDefault, setMIsDefault] = useState(false);

  // Provider modal state (Add / Edit)
  const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ProviderConfig | null>(null);
  const [pId, setPId] = useState('');
  const [pName, setPName] = useState('');
  const [pType, setPType] = useState<'openai' | 'anthropic' | 'gemini' | 'mock' | 'custom'>('openai');
  const [pBaseUrl, setPBaseUrl] = useState('');
  const [pApiKey, setPApiKey] = useState('');
  const [pDescription, setPDescription] = useState('');
  const [pEnabled, setPEnabled] = useState(true);

  // Live test results state map: providerId -> ProviderTestResult
  const [testResults, setTestResults] = useState<Record<string, ProviderTestResult>>({});
  const [testingProviderId, setTestingProviderId] = useState<string | null>(null);

  // Query models list
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

  // Query providers list
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

  // Query usage telemetry
  const { data: usageData, isLoading: isLoadingUsage } = useQuery({
    queryKey: ['models-usage'],
    queryFn: () => modelApi.getUsage({ limit: 15 }),
    staleTime: 30000,
  });

  // Open Add Provider modal
  const handleOpenAddProvider = () => {
    setEditingProvider(null);
    setPId('');
    setPName('');
    setPType('openai');
    setPBaseUrl('https://api.groq.com/openai/v1');
    setPApiKey('');
    setPDescription('');
    setPEnabled(true);
    setIsProviderModalOpen(true);
  };

  // Open Edit Provider modal
  const handleOpenEditProvider = (p: ProviderConfig) => {
    setEditingProvider(p);
    setPId(p.id);
    setPName(p.name);
    setPType(p.type);
    setPBaseUrl(p.baseUrl || '');
    setPApiKey(''); // Leave blank to preserve existing key
    setPDescription(p.description || '');
    setPEnabled(p.enabled);
    setIsProviderModalOpen(true);
  };

  // Open Add Model modal
  const handleOpenAddModel = () => {
    setEditingModel(null);
    setMModelId('');
    setMProvider(providers[0]?.id || 'groq');
    setMProviderModelName('');
    setMContextWindow('128000');
    setMMaxTokens('4096');
    setMCapabilities('chat, reasoning');
    setMDescription('');
    setMEnabled(true);
    setMIsDefault(false);
    setIsModelModalOpen(true);
  };

  // Open Edit Model modal
  const handleOpenEditModel = (m: ModelConfig) => {
    setEditingModel(m);
    setMModelId(m.modelId);
    setMProvider(m.provider);
    setMProviderModelName(m.providerModelName || m.modelId);
    setMContextWindow(String(m.contextWindow || 128000));
    setMMaxTokens(String(m.maxTokens || 4096));
    setMCapabilities(Array.isArray(m.capabilities) ? m.capabilities.join(', ') : 'chat');
    setMDescription(m.description || '');
    setMEnabled(m.enabled);
    setMIsDefault(Boolean(m.isDefault));
    setIsModelModalOpen(true);
  };

  // Toggle Model Enabled Mutation
  const toggleModelMutation = useMutation({
    mutationFn: async (model: ModelConfig) => {
      return model.enabled ? modelApi.disableModel(model.modelId) : modelApi.enableModel(model.modelId);
    },
    onSuccess: (updated) => {
      toast({
        title: `Model ${updated.enabled ? 'Enabled' : 'Disabled'}`,
        description: `Model ${updated.modelId} is now ${updated.enabled ? 'active' : 'disabled'}.`,
        variant: 'default',
      });
      queryClient.invalidateQueries({ queryKey: ['models-list'] });
      queryClient.invalidateQueries({ queryKey: ['available-models'] });
      setConfirmToggleModel(null);
    },
    onError: (err: any) => {
      toast({ title: 'Action Failed', description: err.message, variant: 'destructive' });
      setConfirmToggleModel(null);
    },
  });

  // Toggle Provider Enabled Mutation
  const toggleProviderMutation = useMutation({
    mutationFn: async (provider: ProviderConfig) => {
      return provider.enabled ? modelApi.disableProvider(provider.id) : modelApi.enableProvider(provider.id);
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
      toast({ title: 'Action Failed', description: err.message, variant: 'destructive' });
      setConfirmToggleProvider(null);
    },
  });

  // Save Provider Mutation (Add or Edit)
  const saveProviderMutation = useMutation({
    mutationFn: async () => {
      if (editingProvider) {
        return modelApi.updateProvider(editingProvider.id, {
          name: pName.trim(),
          type: pType,
          baseUrl: pBaseUrl.trim() || undefined,
          apiKey: pApiKey.trim() || undefined, // Blank preserves old key
          description: pDescription.trim() || undefined,
          enabled: pEnabled,
          organizationId: user?.organizationId || 'org-alpha'
        });
      } else {
        return modelApi.registerProvider({
          id: pId.trim().toLowerCase(),
          name: pName.trim(),
          type: pType,
          baseUrl: pBaseUrl.trim() || undefined,
          apiKey: pApiKey.trim() || undefined,
          description: pDescription.trim() || undefined,
          organizationId: user?.organizationId || 'org-alpha',
          enabled: pEnabled,
        });
      }
    },
    onSuccess: (saved) => {
      toast({
        title: editingProvider ? 'Provider Updated' : 'Provider Registered',
        description: `Provider '${saved.name}' (${saved.id}) saved with secure encrypted credentials.`,
        variant: 'success',
      });
      setIsProviderModalOpen(false);
      setEditingProvider(null);
      setPApiKey('');
      queryClient.invalidateQueries({ queryKey: ['providers-list'] });
      queryClient.invalidateQueries({ queryKey: ['models-list'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Save Failed',
        description: err.message || 'Error persisting provider configuration.',
        variant: 'destructive',
      });
    },
  });

  // Delete Provider Mutation
  const deleteProviderMutation = useMutation({
    mutationFn: async (id: string) => {
      return modelApi.deleteProvider(id);
    },
    onSuccess: (_, id) => {
      toast({
        title: 'Provider Deleted',
        description: `Provider '${id}' removed from configuration.`,
        variant: 'success',
      });
      setConfirmDeleteProvider(null);
      queryClient.invalidateQueries({ queryKey: ['providers-list'] });
      queryClient.invalidateQueries({ queryKey: ['models-list'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Delete Failed',
        description: err.message || 'Cannot delete provider.',
        variant: 'destructive',
      });
      setConfirmDeleteProvider(null);
    },
  });

  // Save Model Mutation (Add or Edit)
  const saveModelMutation = useMutation({
    mutationFn: async () => {
      const caps = mCapabilities
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);

      if (editingModel) {
        return modelApi.updateModel(editingModel.modelId, {
          provider: mProvider.trim(),
          providerModelName: mProviderModelName.trim() || mModelId.trim(),
          contextWindow: parseInt(mContextWindow, 10) || 128000,
          maxTokens: parseInt(mMaxTokens, 10) || 4096,
          capabilities: caps.length > 0 ? caps : ['chat'],
          description: mDescription.trim() || undefined,
          enabled: mEnabled,
          isDefault: mIsDefault,
        });
      } else {
        return modelApi.registerModel({
          modelId: mModelId.trim(),
          provider: mProvider.trim(),
          providerModelName: mProviderModelName.trim() || mModelId.trim(),
          contextWindow: parseInt(mContextWindow, 10) || 128000,
          maxTokens: parseInt(mMaxTokens, 10) || 4096,
          capabilities: caps.length > 0 ? caps : ['chat'],
          description: mDescription.trim() || undefined,
          enabled: mEnabled,
          isDefault: mIsDefault,
        });
      }
    },
    onSuccess: (saved) => {
      toast({
        title: editingModel ? 'Model Updated' : 'Model Registered',
        description: `Model ${saved.modelId} under provider ${saved.provider} is saved.`,
        variant: 'success',
      });
      setIsModelModalOpen(false);
      setEditingModel(null);
      queryClient.invalidateQueries({ queryKey: ['models-list'] });
      queryClient.invalidateQueries({ queryKey: ['available-models'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Model Operation Failed',
        description: err.message || 'Error saving model.',
        variant: 'destructive',
      });
    },
  });

  // Delete Model Mutation
  const deleteModelMutation = useMutation({
    mutationFn: async (modelId: string) => {
      return modelApi.deleteModel(modelId);
    },
    onSuccess: (_, modelId) => {
      toast({
        title: 'Model Deleted',
        description: `Model ${modelId} removed from catalog.`,
        variant: 'success',
      });
      setConfirmDeleteModel(null);
      queryClient.invalidateQueries({ queryKey: ['models-list'] });
      queryClient.invalidateQueries({ queryKey: ['available-models'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Delete Failed',
        description: err.message,
        variant: 'destructive',
      });
      setConfirmDeleteModel(null);
    },
  });

  // Real Provider Connection Test
  const handleTestProvider = async (providerId: string) => {
    setTestingProviderId(providerId);
    try {
      const res = await modelApi.testProvider(providerId);
      setTestResults((prev) => ({ ...prev, [providerId]: res }));
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

  // Filtered lists
  const filteredProviders = providers.filter((p) => {
    const q = providerSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      p.id.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      p.type.toLowerCase().includes(q) ||
      (p.baseUrl && p.baseUrl.toLowerCase().includes(q))
    );
  });

  const filteredModels = models.filter((m) => {
    const q = modelSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      m.modelId.toLowerCase().includes(q) ||
      m.provider.toLowerCase().includes(q) ||
      (m.providerModelName && m.providerModelName.toLowerCase().includes(q)) ||
      (m.description && m.description.toLowerCase().includes(q))
    );
  });

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
                onClick={handleOpenAddProvider}
                className="gap-1 text-xs"
              >
                <Server className="h-3.5 w-3.5 text-primary" />
                <span>Add Provider</span>
              </Button>
              <Button
                size="sm"
                onClick={handleOpenAddModel}
                className="gap-1 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Register Model</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="providers" className="text-xs">
            Providers ({providers.length})
          </TabsTrigger>
          <TabsTrigger value="catalog" className="text-xs">
            Model Catalog ({models.length})
          </TabsTrigger>
          <TabsTrigger value="telemetry" className="text-xs">
            Usage Telemetry
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Providers (Primary Management Focus) */}
        <TabsContent value="providers" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search providers by name, id, or url..."
                value={providerSearch}
                onChange={(e) => setProviderSearch(e.target.value)}
                className="pl-8 text-xs h-8"
              />
            </div>
            {canAdminister && (
              <Button size="sm" onClick={handleOpenAddProvider} className="gap-1.5 text-xs h-8">
                <Plus className="h-3.5 w-3.5" />
                <span>Add Provider</span>
              </Button>
            )}
          </div>

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
              ) : filteredProviders.length === 0 ? (
                <div className="p-8">
                  <EmptyState
                    icon={Server}
                    title="No Providers Found"
                    description="No upstream LLM providers match your filter or have been registered yet."
                    actionLabel={canAdminister ? "Add Provider" : undefined}
                    onAction={canAdminister ? handleOpenAddProvider : undefined}
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Provider</TableHead>
                        <TableHead>Adapter Type</TableHead>
                        <TableHead>Base Endpoint</TableHead>
                        <TableHead>Credentials</TableHead>
                        <TableHead>Live Health</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProviders.map((p) => {
                        const testInfo = testResults[p.id];
                        return (
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
                              {p.description && (
                                <div className="text-[11px] text-muted-foreground mt-0.5 max-w-xs truncate">
                                  {p.description}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  p.type === 'gemini'
                                    ? 'default'
                                    : p.type === 'anthropic'
                                    ? 'secondary'
                                    : 'outline'
                                }
                                className="text-[11px] uppercase font-mono"
                              >
                                {p.type === 'gemini' ? 'Google Gemini' : p.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs font-mono text-muted-foreground max-w-[200px] truncate">
                              {p.baseUrl || <span className="italic text-muted-foreground/60">Cloud Default</span>}
                            </TableCell>
                            <TableCell>
                              {p.apiKeyConfigured ? (
                                <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-mono">
                                  <Key className="h-3 w-3" />
                                  <span>{p.apiKeyMasked || '••••••••'}</span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">None / Unconfigured</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`h-2 w-2 rounded-full ${
                                      p.isHealthy ? 'bg-emerald-500' : 'bg-destructive'
                                    }`}
                                  />
                                  <span className="text-xs text-foreground font-medium">
                                    {p.isHealthy ? 'Healthy' : 'Degraded'}
                                  </span>
                                </div>
                                {p.lastError && !p.isHealthy && (
                                  <div className="text-[10px] text-destructive max-w-[180px] truncate" title={p.lastError}>
                                    {p.lastError}
                                  </div>
                                )}
                                {testInfo && (
                                  <div className="text-[10px] text-muted-foreground font-mono">
                                    {testInfo.latencyMs}ms • {testInfo.healthy ? 'OK' : 'Error'}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={p.enabled ? 'default' : 'secondary'} className="text-[11px]">
                                {p.enabled ? 'ENABLED' : 'DISABLED'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
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
                                      className="h-7 px-2 text-xs gap-1"
                                      onClick={() => handleOpenEditProvider(p)}
                                      title="Edit provider configuration & API key"
                                    >
                                      <Edit2 className="h-3 w-3" />
                                      <span className="hidden sm:inline">Edit</span>
                                    </Button>

                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className={`h-7 px-2 text-xs gap-1 ${
                                        p.enabled ? 'text-destructive hover:text-destructive' : 'text-emerald-600 hover:text-emerald-700'
                                      }`}
                                      onClick={() => setConfirmToggleProvider(p)}
                                    >
                                      {p.enabled ? <PowerOff className="h-3 w-3" /> : <Power className="h-3 w-3" />}
                                    </Button>

                                    {!p.isBuiltin && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                                        onClick={() => setConfirmDeleteProvider(p)}
                                        title="Delete provider"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </>
                                )}
                              </div>
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
        </TabsContent>

        {/* Tab 2: Model Catalog */}
        <TabsContent value="catalog" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search models by id, provider, or capabilities..."
                value={modelSearch}
                onChange={(e) => setModelSearch(e.target.value)}
                className="pl-8 text-xs h-8"
              />
            </div>
            {canAdminister && (
              <Button size="sm" onClick={handleOpenAddModel} className="gap-1.5 text-xs h-8">
                <Plus className="h-3.5 w-3.5" />
                <span>Register Model</span>
              </Button>
            )}
          </div>

          <Card>
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Cpu className="h-5 w-5 text-primary" />
                <span>Enterprise Model Allowlist</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Models authorized for client requests and routing through the AI Gateway.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingModels ? (
                <div className="p-6 space-y-4">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : modelsError ? (
                <div className="p-6">
                  <ErrorState
                    title="Failed to load models"
                    message={(modelsError as Error).message}
                    onRetry={() => refetchModels()}
                  />
                </div>
              ) : filteredModels.length === 0 ? (
                <div className="p-8">
                  <EmptyState
                    icon={Cpu}
                    title="No Models Found"
                    description="No authorized models match your query."
                    actionLabel={canAdminister ? "Register Model" : undefined}
                    onAction={canAdminister ? handleOpenAddModel : undefined}
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Model ID</TableHead>
                        <TableHead>Provider</TableHead>
                        <TableHead>Upstream Identifier</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Context / Max Tokens</TableHead>
                        <TableHead>Capabilities</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredModels.map((m) => (
                        <TableRow key={m.modelId}>
                          <TableCell className="font-semibold text-xs font-mono">
                            <div className="flex items-center gap-1.5">
                              <span>{m.modelId}</span>
                              {m.isDefault && (
                                <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                                  DEFAULT
                                </Badge>
                              )}
                            </div>
                            {m.description && (
                              <div className="text-[11px] text-muted-foreground font-sans mt-0.5 truncate max-w-xs">
                                {m.description}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            <span className="font-mono bg-muted/60 px-2 py-0.5 rounded text-[11px] uppercase">
                              {m.provider}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">
                            {m.providerModelName || m.modelId}
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
                            {m.contextWindow.toLocaleString()} / {m.maxTokens.toLocaleString()}
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
                            <div className="flex items-center justify-end gap-1">
                              {canAdminister && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs"
                                    onClick={() => handleOpenEditModel(m)}
                                    title="Edit model"
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={`h-7 px-2 text-xs ${
                                      m.enabled ? 'text-destructive hover:text-destructive' : 'text-emerald-600 hover:text-emerald-700'
                                    }`}
                                    onClick={() => setConfirmToggleModel(m)}
                                  >
                                    {m.enabled ? <PowerOff className="h-3 w-3" /> : <Power className="h-3 w-3" />}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                                    onClick={() => setConfirmDeleteModel(m)}
                                    title="Delete model"
                                  >
                                    <Trash2 className="h-3 w-3" />
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
                          <TableCell className="text-xs font-medium text-foreground uppercase">
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
          } ${confirmToggleModel.modelId}?`}
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
          } provider ${confirmToggleProvider.name} (${confirmToggleProvider.id})?`}
          confirmLabel={confirmToggleProvider.enabled ? 'Disable Provider' : 'Enable Provider'}
          variant={confirmToggleProvider.enabled ? 'destructive' : 'default'}
          onConfirm={() => toggleProviderMutation.mutate(confirmToggleProvider)}
        />
      )}

      {/* Confirmation Dialog for Deleting Provider */}
      {confirmDeleteProvider && (
        <ConfirmDialog
          open={Boolean(confirmDeleteProvider)}
          onOpenChange={(open) => !open && setConfirmDeleteProvider(null)}
          title={`Delete Provider: ${confirmDeleteProvider.name}`}
          description={`Are you sure you want to permanently delete provider '${confirmDeleteProvider.id}'? This action cannot be undone.`}
          confirmLabel="Delete Provider"
          variant="destructive"
          onConfirm={() => deleteProviderMutation.mutate(confirmDeleteProvider.id)}
        />
      )}

      {/* Confirmation Dialog for Deleting Model */}
      {confirmDeleteModel && (
        <ConfirmDialog
          open={Boolean(confirmDeleteModel)}
          onOpenChange={(open) => !open && setConfirmDeleteModel(null)}
          title={`Delete Model: ${confirmDeleteModel.modelId}`}
          description={`Are you sure you want to remove model '${confirmDeleteModel.modelId}' from the platform catalog?`}
          confirmLabel="Delete Model"
          variant="destructive"
          onConfirm={() => deleteModelMutation.mutate(confirmDeleteModel.modelId)}
        />
      )}

      {/* Provider Modal (Add / Edit) */}
      <Dialog open={isProviderModalOpen} onOpenChange={setIsProviderModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              <span>{editingProvider ? 'Edit AI Provider Adapter' : 'Add AI Provider Adapter'}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {editingProvider
                ? `Update configuration and credentials for provider '${editingProvider.id}'.`
                : 'Configure a new upstream AI model provider (e.g. Google Gemini, Groq, OpenAI, Anthropic, or Ollama).'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-medium text-foreground block mb-1">Provider ID (Slug)</label>
                <Input
                  placeholder="e.g., groq, gemini, local-ollama"
                  value={pId}
                  disabled={Boolean(editingProvider)}
                  onChange={(e) => setPId(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1">Provider Adapter Type</label>
                <select
                  className="w-full px-3 py-2 text-xs bg-background border border-input rounded-md focus:outline-none"
                  value={pType}
                  onChange={(e) => {
                    const val = e.target.value as any;
                    setPType(val);
                    if (!editingProvider) {
                      if (val === 'gemini') {
                        setPBaseUrl('https://generativelanguage.googleapis.com/v1beta');
                        if (!pName) setPName('Google Gemini');
                      } else if (val === 'openai') {
                        setPBaseUrl('https://api.groq.com/openai/v1');
                        if (!pName) setPName('Groq Cloud');
                      } else if (val === 'anthropic') {
                        setPBaseUrl('https://api.anthropic.com');
                        if (!pName) setPName('Anthropic Claude');
                      }
                    }
                  }}
                >
                  <option value="openai">OpenAI / OpenAI-Compatible (Groq, vLLM)</option>
                  <option value="gemini">Google Gemini (Native API)</option>
                  <option value="anthropic">Anthropic Claude</option>
                  <option value="mock">Mock Adapter (Offline / Local Dev)</option>
                  <option value="custom">Custom Endpoint</option>
                </select>
              </div>
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">Display Name</label>
              <Input
                placeholder="e.g., Groq Cloud or Google Gemini"
                value={pName}
                onChange={(e) => setPName(e.target.value)}
                className="text-xs"
              />
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">
                API Base URL {pType === 'mock' ? '(Not required for mock)' : ''}
              </label>
              <Input
                placeholder={
                  pType === 'gemini'
                    ? 'https://generativelanguage.googleapis.com/v1beta'
                    : pType === 'anthropic'
                    ? 'https://api.anthropic.com'
                    : 'https://api.groq.com/openai/v1 or https://api.openai.com/v1'
                }
                value={pBaseUrl}
                onChange={(e) => setPBaseUrl(e.target.value)}
                className="text-xs font-mono"
              />
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">
                API Key / Secret Token {editingProvider ? '(Leave blank to keep existing key)' : ''}
              </label>
              <Input
                type="password"
                placeholder={
                  editingProvider?.apiKeyConfigured
                    ? `${editingProvider.apiKeyMasked || '••••••••'} (Leave empty to keep existing)`
                    : 'Enter secret API key...'
                }
                value={pApiKey}
                onChange={(e) => setPApiKey(e.target.value)}
                className="text-xs font-mono"
                autoComplete="off"
              />
              <span className="text-[10px] text-muted-foreground mt-1 block">
                API keys are encrypted using AES-256-GCM at rest and never exposed to clients or stored in browser state.
              </span>
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">Description (Optional)</label>
              <Input
                placeholder="Operational notes, quota limits, or tier information..."
                value={pDescription}
                onChange={(e) => setPDescription(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="pEnabledCheck"
                checked={pEnabled}
                onChange={(e) => setPEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <label htmlFor="pEnabledCheck" className="text-xs font-medium cursor-pointer">
                Provider is Enabled for Routing
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsProviderModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={(!editingProvider && !pId.trim()) || !pName.trim() || saveProviderMutation.isPending}
              onClick={() => saveProviderMutation.mutate()}
            >
              {saveProviderMutation.isPending ? 'Saving...' : editingProvider ? 'Update Provider' : 'Save Provider'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Model Modal (Add / Edit) */}
      <Dialog open={isModelModalOpen} onOpenChange={setIsModelModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <Cpu className="h-5 w-5 text-primary" />
              <span>{editingModel ? 'Edit Model Configuration' : 'Register AI Model Endpoint'}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure and authorize an LLM model under an active provider for organizational dispatch.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-medium text-foreground block mb-1">Model ID (Platform Key)</label>
                <Input
                  placeholder="e.g., gpt-4o or gemini-1.5-flash"
                  value={mModelId}
                  disabled={Boolean(editingModel)}
                  onChange={(e) => setMModelId(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1">Associated Provider</label>
                <select
                  className="w-full px-3 py-2 text-xs bg-background border border-input rounded-md focus:outline-none"
                  value={mProvider}
                  onChange={(e) => setMProvider(e.target.value)}
                >
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.id}) {p.enabled ? '' : '[DISABLED]'}
                    </option>
                  ))}
                  {providers.length === 0 && (
                    <>
                      <option value="groq">Groq Cloud (groq)</option>
                      <option value="gemini">Google Gemini (gemini)</option>
                      <option value="openai">OpenAI (openai)</option>
                      <option value="mock">Mock Adapter (mock)</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">Upstream Provider Model ID</label>
              <Input
                placeholder="e.g., llama-3.3-70b-versatile, gemini-1.5-flash, or gpt-4o"
                value={mProviderModelName}
                onChange={(e) => setMProviderModelName(e.target.value)}
                className="text-xs font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-medium text-foreground block mb-1">Context Window (Tokens)</label>
                <Input
                  type="number"
                  placeholder="128000"
                  value={mContextWindow}
                  onChange={(e) => setMContextWindow(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1">Max Output Tokens</label>
                <Input
                  type="number"
                  placeholder="4096"
                  value={mMaxTokens}
                  onChange={(e) => setMMaxTokens(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">Capabilities (Comma Separated)</label>
              <Input
                placeholder="chat, reasoning, code, multimodal"
                value={mCapabilities}
                onChange={(e) => setMCapabilities(e.target.value)}
                className="text-xs"
              />
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">Description (Optional)</label>
              <Input
                placeholder="Model specifications, safety policies, or recommended tasks..."
                value={mDescription}
                onChange={(e) => setMDescription(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="mEnabledCheck"
                  checked={mEnabled}
                  onChange={(e) => setMEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <label htmlFor="mEnabledCheck" className="text-xs font-medium cursor-pointer">
                  Model is Enabled
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="mDefaultCheck"
                  checked={mIsDefault}
                  onChange={(e) => setMIsDefault(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <label htmlFor="mDefaultCheck" className="text-xs font-medium cursor-pointer">
                  Default Platform Model
                </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsModelModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={(!editingModel && !mModelId.trim()) || saveModelMutation.isPending}
              onClick={() => saveModelMutation.mutate()}
            >
              {saveModelMutation.isPending ? 'Saving...' : editingModel ? 'Update Model' : 'Register Model'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
