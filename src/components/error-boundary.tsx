'use client';

import React, { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary Component
 *
 * Catches JavaScript errors in child components and displays
 * a fallback UI instead of crashing the whole app.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error to console
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);

    // Call optional error handler
    this.props.onError?.(error, errorInfo);

    // TODO: Send to error tracking service (Sentry)
    // if (typeof window !== 'undefined' && window.Sentry) {
    //   window.Sentry.captureException(error, { extra: errorInfo });
    // }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  handleGoHome = (): void => {
    window.location.href = '/';
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-[var(--loss)]/10 flex items-center justify-center mb-4">
                  <AlertTriangle className="w-8 h-8 text-[var(--loss)]" />
                </div>

                <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
                  Something went wrong
                </h2>

                <p className="text-[var(--text-secondary)] mb-6">
                  An unexpected error occurred. Please try refreshing the page or go back to the dashboard.
                </p>

                {/* Error details (dev only) */}
                {process.env.NODE_ENV === 'development' && this.state.error && (
                  <div className="w-full mb-6 p-3 bg-[var(--bg-tertiary)] rounded text-left overflow-auto">
                    <p className="text-xs font-mono text-[var(--loss)] break-all">
                      {this.state.error.message}
                    </p>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    icon={<RefreshCw className="w-4 h-4" />}
                    onClick={this.handleReload}
                  >
                    Refresh Page
                  </Button>
                  <Button
                    variant="primary"
                    icon={<Home className="w-4 h-4" />}
                    onClick={this.handleGoHome}
                  >
                    Go to Dashboard
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Async Error Boundary for Suspense boundaries
 */
export function AsyncErrorFallback({
  error,
  resetErrorBoundary,
}: {
  error: Error;
  resetErrorBoundary: () => void;
}): JSX.Element {
  return (
    <div className="min-h-[200px] flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center">
            <AlertTriangle className="w-10 h-10 text-[var(--warning)] mb-4" />

            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
              Failed to load
            </h3>

            <p className="text-sm text-[var(--text-secondary)] mb-4">
              {error.message || 'An error occurred while loading this content.'}
            </p>

            <Button variant="secondary" onClick={resetErrorBoundary}>
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Simple inline error display for smaller components
 */
export function InlineError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}): JSX.Element {
  return (
    <div className="flex items-center gap-2 p-3 bg-[var(--loss)]/10 border border-[var(--loss)]/20 rounded text-sm">
      <AlertTriangle className="w-4 h-4 text-[var(--loss)] flex-shrink-0" />
      <span className="text-[var(--text-secondary)] flex-1">{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-[var(--accent-primary)] hover:underline text-xs"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export default ErrorBoundary;
