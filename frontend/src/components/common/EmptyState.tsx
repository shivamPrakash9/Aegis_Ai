import React from 'react';
import { Button } from '../ui/Button';
import { Inbox } from 'lucide-react';

export interface EmptyStateProps {
  icon?: React.ReactNode | React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction
}: EmptyStateProps) {
  const renderIcon = () => {
    if (!icon) {
      return <Inbox className="h-10 w-10 text-muted-foreground/60" />;
    }
    if (React.isValidElement(icon)) {
      return icon;
    }
    // Handle component types: functions or forwardRef objects ({ $$typeof, render })
    if (
      typeof icon === 'function' ||
      (typeof icon === 'object' && icon !== null && ('render' in icon || '$$typeof' in icon))
    ) {
      const IconComponent = icon as React.ComponentType<{ className?: string }>;
      return <IconComponent className="h-10 w-10 text-muted-foreground/60" />;
    }
    if (typeof icon === 'string' || typeof icon === 'number') {
      return <span>{icon}</span>;
    }
    return <Inbox className="h-10 w-10 text-muted-foreground/60" />;
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center rounded-lg border border-dashed border-border bg-card/50 my-4">
      <div className="mb-3 p-3 rounded-full bg-muted/60">{renderIcon()}</div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && <p className="text-sm text-muted-foreground max-w-sm mt-1">{description}</p>}
      {actionLabel && onAction && (
        <Button variant="outline" size="sm" onClick={onAction} className="mt-4">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
