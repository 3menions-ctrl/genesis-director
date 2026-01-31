import React, { Component, ErrorInfo, ReactNode, useEffect, useRef, useCallback } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface GlobalStabilityBoundaryProps {
  children: ReactNode;
}

interface GlobalStabilityBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
}

/**
 * Global Stability Boundary - Root-level error boundary with:
 * - Catches ALL component-level failures
 * - Prevents white-screening the entire app
 * - Tracks error frequency to detect crash loops
 * - Provides graceful recovery options
 * - Logs errors for debugging
 */
class GlobalStabilityBoundaryClass extends Component<GlobalStabilityBoundaryProps, GlobalStabilityBoundaryState> {
  private errorResetTimer: ReturnType<typeof setTimeout> | null = null;
  
  public state: GlobalStabilityBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
    errorCount: 0,
  };

  public static getDerivedStateFromError(error: Error): Partial<GlobalStabilityBoundaryState> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Increment error count for crash loop detection
    this.setState(prev => ({ 
      errorInfo, 
      errorCount: prev.errorCount + 1 
    }));

    // Log the error with context
    console.error('[GlobalStabilityBoundary] Caught fatal error:', error);
    console.error('[GlobalStabilityBoundary] Component stack:', errorInfo.componentStack);
    
    // Reset error count after 30 seconds to allow recovery
    if (this.errorResetTimer) {
      clearTimeout(this.errorResetTimer);
    }
    this.errorResetTimer = setTimeout(() => {
      this.setState({ errorCount: 0 });
    }, 30000);
  }

  public componentWillUnmount() {
    if (this.errorResetTimer) {
      clearTimeout(this.errorResetTimer);
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    // Use window.location to ensure clean navigation
    window.location.href = '/';
  };

  private handleClearCacheAndReload = () => {
    // Clear React Query cache if possible
    try {
      localStorage.removeItem('REACT_QUERY_OFFLINE_CACHE');
      sessionStorage.clear();
    } catch (e) {
      // Ignore storage errors
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      // If too many errors in a row, suggest harder reset
      const isCrashLoop = this.state.errorCount >= 3;

      return (
        <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center space-y-6">
            {/* Error Icon */}
            <div className="mx-auto w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <AlertTriangle className="w-10 h-10 text-red-400" />
            </div>

            {/* Error Message */}
            <div className="space-y-3">
              <h1 className="text-2xl font-bold text-white">
                {isCrashLoop ? 'App Crash Detected' : 'Something went wrong'}
              </h1>
              <p className="text-zinc-400">
                {isCrashLoop 
                  ? 'The app has crashed multiple times. Try clearing cache or returning home.'
                  : "We've caught an error before it could crash your session. Your work is safe."
                }
              </p>
            </div>

            {/* Error Details (dev only) */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="text-left bg-zinc-800/50 rounded-lg p-4 text-sm border border-zinc-700">
                <summary className="cursor-pointer text-zinc-400 hover:text-white flex items-center gap-2">
                  🐛 Technical Details
                </summary>
                <div className="mt-3 space-y-2">
                  <p className="font-mono text-red-400 break-all text-xs">
                    {this.state.error.message}
                  </p>
                  {this.state.error.stack && (
                    <pre className="text-xs text-zinc-500 overflow-auto max-h-24 bg-zinc-900 p-2 rounded">
                      {this.state.error.stack}
                    </pre>
                  )}
                </div>
              </details>
            )}

            {/* Recovery Actions */}
            <div className="flex flex-col gap-3">
              {!isCrashLoop && (
                <Button
                  onClick={this.handleRetry}
                  className="w-full gap-2 bg-white text-black hover:bg-white/90"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </Button>
              )}
              
              <Button
                onClick={this.handleGoHome}
                variant="outline"
                className="w-full gap-2 border-zinc-700 text-white hover:bg-zinc-800"
              >
                <Home className="w-4 h-4" />
                Go Home
              </Button>

              {isCrashLoop && (
                <Button
                  onClick={this.handleClearCacheAndReload}
                  variant="outline"
                  className="w-full gap-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                >
                  <RefreshCw className="w-4 h-4" />
                  Clear Cache & Reload
                </Button>
              )}
            </div>

            {/* Support Link */}
            <p className="text-xs text-zinc-500">
              If this keeps happening,{' '}
              <a href="/contact" className="text-violet-400 hover:underline">
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

export const GlobalStabilityBoundary = GlobalStabilityBoundaryClass;

/**
 * Hook for safe data access with fallback values
 * Prevents reference errors when data is null/undefined
 */
export function useSafeData<T>(
  data: T | null | undefined,
  fallback: T
): T {
  return data ?? fallback;
}

/**
 * Data guardrail component - renders fallback when data is invalid
 */
export function DataGuard<T>({
  data,
  isLoading,
  error,
  fallback,
  loadingFallback,
  errorFallback,
  children,
}: {
  data: T | null | undefined;
  isLoading?: boolean;
  error?: Error | string | null;
  fallback?: ReactNode;
  loadingFallback?: ReactNode;
  errorFallback?: ReactNode;
  children: (data: T) => ReactNode;
}): JSX.Element {
  // Loading state
  if (isLoading) {
    return <>{loadingFallback || fallback || <DataGuardSkeleton />}</>;
  }

  // Error state
  if (error) {
    return <>{errorFallback || fallback || <DataGuardError error={error} />}</>;
  }

  // Null/undefined data
  if (data === null || data === undefined) {
    return <>{fallback || <DataGuardEmpty />}</>;
  }

  // Valid data
  return <>{children(data)}</>;
}

// Default skeleton for loading state
function DataGuardSkeleton() {
  return (
    <div className="animate-pulse space-y-2 p-4">
      <div className="h-4 bg-zinc-800/50 rounded w-3/4" />
      <div className="h-4 bg-zinc-800/30 rounded w-1/2" />
    </div>
  );
}

// Default empty state
function DataGuardEmpty() {
  return (
    <div className="text-center py-8 text-zinc-500">
      <p className="text-sm">No data available</p>
    </div>
  );
}

// Default error state
function DataGuardError({ error }: { error: Error | string | null }) {
  const message = typeof error === 'string' ? error : error?.message || 'An error occurred';
  return (
    <div className="text-center py-8 text-red-400/70">
      <p className="text-sm">{message}</p>
    </div>
  );
}

/**
 * Hook for cleanup-safe intervals with automatic cleanup
 */
export function useSafeInterval(
  callback: () => void,
  delay: number | null
): void {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;

    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

/**
 * Hook for cleanup-safe timeouts with automatic cleanup
 */
export function useSafeTimeout(
  callback: () => void,
  delay: number | null
): { reset: () => void; clear: () => void } {
  const savedCallback = useRef(callback);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  const clear = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clear();
    if (delay !== null) {
      timeoutRef.current = setTimeout(() => savedCallback.current(), delay);
    }
  }, [delay, clear]);

  useEffect(() => {
    reset();
    return clear;
  }, [delay, reset, clear]);

  return { reset, clear };
}

export default GlobalStabilityBoundary;
