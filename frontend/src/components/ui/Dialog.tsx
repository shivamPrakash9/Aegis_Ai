import React, { useEffect, createContext, useContext } from 'react';
import { cn } from '../../lib/utils';
import { X } from 'lucide-react';

interface DialogContextType {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
}

const DialogContext = createContext<DialogContextType>({ open: false });

export interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  // Legacy / convenience props:
  isOpen?: boolean;
  onClose?: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export function Dialog({
  open,
  onOpenChange,
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'md'
}: DialogProps) {
  const isCurrentlyOpen = open !== undefined ? open : Boolean(isOpen);
  const handleClose = () => {
    if (onOpenChange) onOpenChange(false);
    if (onClose) onClose();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    if (isCurrentlyOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCurrentlyOpen]);

  if (!isCurrentlyOpen) return null;

  // If using subcomponents directly, wrap in DialogContext
  if (!title && !onClose) {
    return (
      <DialogContext.Provider value={{ open: isCurrentlyOpen, onOpenChange }}>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          {children}
        </div>
      </DialogContext.Provider>
    );
  }

  const maxStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl'
  };

  return (
    <DialogContext.Provider value={{ open: isCurrentlyOpen, onOpenChange }}>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
        <div
          className={cn(
            'relative w-full rounded-xl border border-border bg-card p-6 text-card-foreground shadow-2xl animate-in zoom-in-95 duration-150',
            maxStyles[maxWidth]
          )}
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-start justify-between pb-3 border-b border-border mb-4">
            <div>
              {title && <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>}
              {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
            </div>
            <button
              onClick={handleClose}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="Close dialog"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div>{children}</div>
        </div>
      </div>
    </DialogContext.Provider>
  );
}

export function DialogContent({
  className,
  children
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const { onOpenChange } = useContext(DialogContext);
  return (
    <div
      className={cn(
        'relative w-full max-w-lg rounded-xl border border-border bg-card p-6 text-card-foreground shadow-2xl animate-in zoom-in-95 duration-150',
        className
      )}
      role="dialog"
      aria-modal="true"
    >
      {children}
      <button
        onClick={() => onOpenChange?.(false)}
        className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        aria-label="Close dialog"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function DialogHeader({
  className,
  children
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('flex flex-col space-y-1.5 text-left pb-3 border-b border-border mb-4', className)}>
      {children}
    </div>
  );
}

export function DialogTitle({
  className,
  children
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <h2 className={cn('text-lg font-semibold tracking-tight text-foreground', className)}>
      {children}
    </h2>
  );
}

export function DialogDescription({
  className,
  children
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p className={cn('text-xs text-muted-foreground', className)}>
      {children}
    </p>
  );
}

export function DialogFooter({
  className,
  children
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('flex items-center justify-end gap-2 pt-4 border-t border-border mt-4', className)}>
      {children}
    </div>
  );
}
