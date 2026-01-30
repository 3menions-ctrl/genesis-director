import React, { Component, ErrorInfo, ReactNode, forwardRef, memo, useCallback, useRef, useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree,
 * logs them, and displays a fallback UI instead of crashing the whole app.
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
    
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground">
                Something went wrong
              </h1>
              <p className="text-muted-foreground">
                We encountered an unexpected error. Don't worry, your work is safe.
              </p>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="text-left bg-muted/50 rounded-lg p-4 text-sm">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground flex items-center gap-2">
                  <Bug className="w-4 h-4" />
                  Technical Details
                </summary>
                <div className="mt-3 space-y-2">
                  <p className="font-mono text-destructive break-all">
                    {this.state.error.message}
                  </p>
                  {this.state.errorInfo?.componentStack && (
                    <pre className="text-xs text-muted-foreground overflow-auto max-h-32 bg-background p-2 rounded">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              </details>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={this.handleReset}
                variant="default"
                className="gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </Button>
              <Button
                onClick={this.handleGoHome}
                variant="outline"
                className="gap-2"
              >
                <Home className="w-4 h-4" />
                Go Home
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              If this keeps happening, please{' '}
              <a href="/contact" className="text-primary hover:underline">
                contact support
              </a>
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * HOC to wrap any component with error boundary
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ReactNode
) {
  const WithErrorBoundaryWrapper = (props: P) => {
    return (
      <ErrorBoundary fallback={fallback}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
  WithErrorBoundaryWrapper.displayName = `WithErrorBoundary(${(WrappedComponent as React.FC).displayName || WrappedComponent.name || 'Component'})`;
  return WithErrorBoundaryWrapper;
}

/**
 * Hook-friendly error boundary wrapper for function components
 */
export function ErrorBoundaryWrapper({ 
  children, 
  fallback 
}: { 
  children: ReactNode; 
  fallback?: ReactNode 
}) {
  return <ErrorBoundary fallback={fallback}>{children}</ErrorBoundary>;
}

/**
 * Minimal inline error boundary for nested components - prevents cascade crashes
 * Shows a subtle error UI instead of crashing the entire page
 */
export function SafeComponent({ 
  children, 
  name = 'Component',
  fallback,
  silent = false,
}: { 
  children: ReactNode; 
  name?: string;
  fallback?: ReactNode;
  silent?: boolean;
}) {
  return (
    <ErrorBoundary 
      fallback={fallback || (silent ? null : (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-center">
          <p className="text-sm text-destructive">
            {name} failed to load
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-2 text-xs text-muted-foreground hover:text-foreground underline"
          >
            Reload page
          </button>
        </div>
      ))}
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Invisible boundary - silently catches errors without any UI
 * Use for non-critical components that shouldn't show errors
 */
export function SilentBoundary({ children }: { children: ReactNode }) {
  return <SafeComponent silent fallback={null}>{children}</SafeComponent>;
}

/**
 * Async-safe hook for components that fetch data
 * Prevents setState on unmounted components
 */
export function useAsyncSafe() {
  const isMountedRef = useRef(true);
  
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);
  
  const safeSetState = useCallback(<T,>(
    setter: React.Dispatch<React.SetStateAction<T>>,
    value: React.SetStateAction<T>
  ) => {
    if (isMountedRef.current) {
      setter(value);
    }
  }, []);
  
  const runAsync = useCallback(<T,>(
    asyncFn: () => Promise<T>,
    onSuccess?: (result: T) => void,
    onError?: (error: Error) => void
  ) => {
    asyncFn()
      .then((result) => {
        if (isMountedRef.current && onSuccess) {
          onSuccess(result);
        }
      })
      .catch((error) => {
        if (error?.name === 'AbortError') return;
        if (isMountedRef.current && onError) {
          onError(error);
        }
      });
  }, []);
  
  return { isMountedRef, safeSetState, runAsync };
}
