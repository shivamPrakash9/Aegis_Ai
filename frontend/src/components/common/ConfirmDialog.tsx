import React from 'react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { AlertTriangle } from 'lucide-react';

export interface ConfirmDialogProps {
  open?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary' | 'destructive' | 'default';
  isLoading?: boolean;
}

export function ConfirmDialog({
  open,
  isOpen,
  onOpenChange,
  onClose,
  onConfirm,
  title,
  description,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  isLoading = false
}: ConfirmDialogProps) {
  const isCurrentlyOpen = open !== undefined ? open : Boolean(isOpen);
  const handleClose = () => {
    if (onOpenChange) onOpenChange(false);
    if (onClose) onClose();
  };

  const isDestructive = variant === 'danger' || variant === 'destructive';

  return (
    <Dialog isOpen={isCurrentlyOpen} onClose={handleClose} title={title}>
      <div className="flex items-start gap-3 py-2">
        <div className={`p-2 rounded-full shrink-0 ${isDestructive ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
          <AlertTriangle className="h-5 w-5" />
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{description || message}</p>
      </div>
      <div className="flex justify-end gap-2 mt-6 pt-3 border-t border-border">
        <Button variant="outline" size="sm" onClick={handleClose} disabled={isLoading}>
          {cancelLabel}
        </Button>
        <Button
          variant={isDestructive ? 'danger' : 'primary'}
          size="sm"
          onClick={onConfirm}
          isLoading={isLoading}
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
