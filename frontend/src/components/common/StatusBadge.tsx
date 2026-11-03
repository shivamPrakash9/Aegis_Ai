import React from 'react';
import { Badge } from '../ui/Badge';
import { CheckCircle2, Clock, ShieldAlert, XCircle, AlertTriangle, ArrowRight } from 'lucide-react';

interface StatusBadgeProps {
  status: string | null | undefined;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  if (!status) return <span className="text-muted-foreground text-xs">—</span>;

  const normalized = status.toUpperCase();

  switch (normalized) {
    case 'COMPLETED':
    case 'APPROVED':
    case 'ALLOW':
    case 'ACTIVE':
    case 'PERSISTED':
    case 'UP':
      return (
        <Badge variant="success">
          <CheckCircle2 className="h-3 w-3" />
          {normalized}
        </Badge>
      );

    case 'WAITING_FOR_APPROVAL':
    case 'PENDING':
    case 'PROCESSING':
    case 'ACCEPTED':
      return (
        <Badge variant="warning">
          <Clock className="h-3 w-3" />
          {normalized}
        </Badge>
      );

    case 'BLOCKED':
    case 'DENY':
    case 'REJECTED':
    case 'FAILED':
    case 'DOWN':
    case 'CRITICAL':
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3" />
          {normalized}
        </Badge>
      );

    case 'MASK':
    case 'WARN':
    case 'WARNING':
      return (
        <Badge variant="warning">
          <ShieldAlert className="h-3 w-3" />
          {normalized}
        </Badge>
      );

    case 'ROUTE':
    case 'INFO':
    case 'AUDIT':
      return (
        <Badge variant="info">
          <ArrowRight className="h-3 w-3" />
          {normalized}
        </Badge>
      );

    case 'EXPIRED':
    case 'INACTIVE':
    case 'DISABLED':
      return (
        <Badge variant="secondary">
          <AlertTriangle className="h-3 w-3" />
          {normalized}
        </Badge>
      );

    default:
      return <Badge variant="outline">{normalized}</Badge>;
  }
}
