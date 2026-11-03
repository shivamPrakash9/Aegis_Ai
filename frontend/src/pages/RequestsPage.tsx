import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { 
  FileText, 
  Search, 
  Filter, 
  RefreshCw, 
  ExternalLink, 
  Eye, 
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Layers
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { StatusBadge } from '@/components/common/StatusBadge';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Skeleton } from '@/components/ui/Skeleton';
import { gatewayApi } from '@/services/gateway-api';
import { AiRequestListItem, AiRequestStatus } from '@/types';

export const RequestsPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const limit = 15;

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['ai-requests', statusFilter, page],
    queryFn: () => gatewayApi.listRequests({
      status: statusFilter === 'ALL' ? undefined : statusFilter,
      page,
      limit,
    }),
  });

  const rawItems = data?.data || [];
  const pagination = data?.pagination || {
    page: 1,
    limit,
    total: rawItems.length,
    totalPages: Math.max(1, Math.ceil(rawItems.length / limit)),
  };

  // Client-side search filtering by Request ID
  const filteredItems = rawItems.filter((item) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.id.toLowerCase().includes(query) ||
      (item.modelSelected && item.modelSelected.toLowerCase().includes(query)) ||
      (item.traceId && item.traceId.toLowerCase().includes(query))
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            AI Request Explorer
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor, inspect, and trace AI requests processed through the gateway security pipeline.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-1 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
          <Link to="/playground">
            <Button size="sm" className="gap-1 text-xs">
              <span>New AI Request</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by Request ID, Model, or Trace ID..."
                className="pl-9 text-xs"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="h-4 w-4 text-muted-foreground hidden sm:block" />
              <select
                className="px-3 py-2 text-xs bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring w-full sm:w-44"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">All Statuses</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="WAITING_FOR_APPROVAL">WAITING_FOR_APPROVAL</option>
                <option value="BLOCKED">BLOCKED</option>
                <option value="FAILED">FAILED</option>
                <option value="PROCESSING">PROCESSING</option>
                <option value="ACCEPTED">ACCEPTED</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Requests Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : error ? (
            <div className="p-6">
              <ErrorState
                title="Failed to load requests"
                message={(error as Error).message}
                onRetry={() => refetch()}
              />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={FileText}
                title="No Requests Found"
                description={
                  searchQuery || statusFilter !== 'ALL'
                    ? 'No AI requests matched your active search or filter criteria.'
                    : 'No requests have been executed yet. Submit your first request in the AI Playground.'
                }
                actionLabel={searchQuery || statusFilter !== 'ALL' ? 'Clear Filters' : 'Open Playground'}
                onAction={() => {
                  if (searchQuery || statusFilter !== 'ALL') {
                    setSearchQuery('');
                    setStatusFilter('ALL');
                  } else {
                    window.location.href = '/playground';
                  }
                }}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Request ID</TableHead>
                    <TableHead className="w-[140px]">Status</TableHead>
                    <TableHead className="w-[160px]">Model</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Trace ID</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell className="font-mono text-xs font-medium">
                        <Link
                          to={`/requests/${req.id}`}
                          className="text-primary hover:underline"
                        >
                          {req.id.length > 16 ? `${req.id.slice(0, 16)}...` : req.id}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={req.status} />
                      </TableCell>
                      <TableCell className="text-xs">
                        {req.modelSelected ? (
                          <Badge variant="outline" className="font-mono text-[11px]">
                            {req.modelSelected}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">Auto-routed</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(req.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {req.traceId ? (
                          <Link
                            to={`/traces?traceId=${req.traceId}`}
                            className="text-muted-foreground hover:text-primary flex items-center gap-1"
                          >
                            <span>{req.traceId.slice(0, 10)}...</span>
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        ) : (
                          <span className="text-muted-foreground italic">N/A</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link to={`/requests/${req.id}`}>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
                              <Eye className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Details</span>
                            </Button>
                          </Link>
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

      {/* Pagination controls */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span>
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total requests)
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="text-xs h-8"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="text-xs h-8"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
