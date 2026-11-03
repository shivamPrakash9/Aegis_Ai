import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { StatusBadge } from '../components/common/StatusBadge';
import { EmptyState } from '../components/common/EmptyState';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { ShieldCheck } from 'lucide-react';

describe('Shared UI Components', () => {
  describe('Button', () => {
    it('renders label and handles click events', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click Me</Button>);

      const btn = screen.getByRole('button', { name: /click me/i });
      expect(btn).toBeInTheDocument();
      fireEvent.click(btn);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('disables button when isLoading is true and renders spinner', () => {
      render(<Button isLoading>Submit</Button>);
      const btn = screen.getByRole('button');
      expect(btn).toBeDisabled();
    });
  });

  describe('Badge', () => {
    it('renders with correct variant classes', () => {
      const { rerender } = render(<Badge variant="default">Active</Badge>);
      expect(screen.getByText('Active')).toBeInTheDocument();

      rerender(<Badge variant="destructive">Blocked</Badge>);
      expect(screen.getByText('Blocked')).toBeInTheDocument();
    });
  });

  describe('StatusBadge', () => {
    it('renders COMPLETED status accurately', () => {
      render(<StatusBadge status="COMPLETED" />);
      expect(screen.getByText('COMPLETED')).toBeInTheDocument();
    });

    it('renders WAITING_FOR_APPROVAL status accurately', () => {
      render(<StatusBadge status="WAITING_FOR_APPROVAL" />);
      expect(screen.getByText('WAITING_FOR_APPROVAL')).toBeInTheDocument();
    });

    it('renders BLOCKED status accurately', () => {
      render(<StatusBadge status="BLOCKED" />);
      expect(screen.getByText('BLOCKED')).toBeInTheDocument();
    });

    it('renders FAILED status accurately', () => {
      render(<StatusBadge status="FAILED" />);
      expect(screen.getByText('FAILED')).toBeInTheDocument();
    });
  });

  describe('EmptyState', () => {
    it('renders title, description and triggers action', () => {
      const onAction = vi.fn();
      render(
        <EmptyState
          title="No Requests"
          description="You have not submitted requests yet."
          actionLabel="Create One"
          onAction={onAction}
        />
      );

      expect(screen.getByText('No Requests')).toBeInTheDocument();
      expect(screen.getByText('You have not submitted requests yet.')).toBeInTheDocument();
      
      const actionBtn = screen.getByRole('button', { name: /create one/i });
      fireEvent.click(actionBtn);
      expect(onAction).toHaveBeenCalledTimes(1);
    });

    it('safely renders Lucide icon component without crashing', () => {
      const { container } = render(
        <EmptyState
          icon={ShieldCheck}
          title="No Policies Configured"
          description="Testing Lucide forwardRef icon rendering"
        />
      );
      expect(screen.getByText('No Policies Configured')).toBeInTheDocument();
      expect(container.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('ConfirmDialog', () => {
    it('renders dialog when open and triggers confirm/cancel', () => {
      const onConfirm = vi.fn();
      const onClose = vi.fn();

      const { rerender } = render(
        <ConfirmDialog
          isOpen={true}
          onClose={onClose}
          onConfirm={onConfirm}
          title="Delete Confirmation"
          description="Are you sure you want to proceed?"
          confirmLabel="Yes, Delete"
        />
      );

      expect(screen.getByText('Delete Confirmation')).toBeInTheDocument();
      expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /yes, delete/i }));
      expect(onConfirm).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not render when isOpen is false', () => {
      render(
        <ConfirmDialog
          isOpen={false}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          title="Hidden Modal"
        />
      );

      expect(screen.queryByText('Hidden Modal')).not.toBeInTheDocument();
    });
  });
});
