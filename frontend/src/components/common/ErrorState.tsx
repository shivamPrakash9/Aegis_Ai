import React from 'react';
import { Button } from '../ui/Button';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Failed to load data',
  message = 'An unexpected error occurred while communicating with the service.',
  onRetry
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center rounded-lg border border-destructive/20 bg-destructive/5 text-foreground my-4">
      <div className="p-3 rounded-full bg-destructive/10 text-destructive mb-3">
        <AlertCircle className="h-8 w-8" />
      </div>
      <h3 className="text-base font-semibold text-destructive">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-md mt-1">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-4 gap-2">
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </Button>
      )}
    </div>
  );
}
