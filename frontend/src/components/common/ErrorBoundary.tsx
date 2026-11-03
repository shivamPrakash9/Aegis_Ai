import React, { Component, ErrorInfo, ReactNode } from 'react';
import { useRouteError, useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[400px] flex flex-col items-center justify-center p-8 text-center bg-card/60 border border-destructive/20 rounded-xl my-6 mx-auto max-w-2xl shadow-sm">
          <div className="p-3.5 rounded-full bg-destructive/10 text-destructive mb-4">
            <AlertTriangle className="h-9 w-9" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Something went wrong</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-md">
            {this.state.error?.message || 'An unexpected rendering error occurred in this view.'}
          </p>
          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => this.setState({ hasError: false, error: null })}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => (window.location.href = '/')}
              className="gap-2"
            >
              <Home className="h-4 w-4" />
              Back to Overview
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * RouteErrorElement for React Router's createBrowserRouter errorElement
 */
export function RouteErrorElement() {
  const error = useRouteError() as any;
  const navigate = useNavigate();

  console.error('Route error occurred:', error);

  const errorMessage =
    error?.statusText || error?.message || 'An unexpected error occurred while loading this page.';

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 text-center bg-card border border-destructive/20 rounded-2xl my-8 mx-auto max-w-2xl shadow-lg">
      <div className="p-4 rounded-full bg-destructive/10 text-destructive mb-4">
        <AlertTriangle className="h-10 w-10" />
      </div>
      <h1 className="text-2xl font-bold text-foreground">Page Rendering Failure</h1>
      <p className="text-sm text-muted-foreground mt-2 max-w-lg">
        {errorMessage}
      </p>
      {error?.stack && import.meta.env.DEV && (
        <pre className="mt-4 p-4 text-xs text-left bg-muted rounded-lg overflow-x-auto max-w-full text-muted-foreground font-mono">
          {error.stack}
        </pre>
      )}
      <div className="flex gap-4 mt-6">
        <Button
          variant="outline"
          onClick={() => window.location.reload()}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Reload Page
        </Button>
        <Button
          variant="default"
          onClick={() => navigate('/overview')}
          className="gap-2"
        >
          <Home className="h-4 w-4" />
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
}
