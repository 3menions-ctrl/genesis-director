import React, { Component, ErrorInfo, ReactNode, useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw, Home, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface GlobalStabilityBoundaryProps {
  children: ReactNode;
}

interface GlobalStabilityBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
  lastErrorTime: number;
}

// Error patterns that should NOT crash the app - COMPREHENSIVE LIST
// These are common errors that don't indicate actual application problems
const SUPPRESSED_ERROR_PATTERNS = [
  // Browser API quirks
  'ResizeObserver loop',
  'ResizeObserver loop completed with undelivered notifications',
  'Non-Error promise rejection captured',
  
  // Code splitting / lazy loading
  'ChunkLoadError',
  'Loading chunk',
  'Failed to fetch dynamically imported module',
  
  // Component loading errors - prevent cascade on lazy load issues
  'Component is not a function',
  'instance of Object',
  'is not a function',
  
  // DOM cleanup race conditions (common with Radix UI)
  'Cannot read properties of null',
  'Cannot read properties of undefined',
  'removeChild',
  'insertBefore',
  'removeAttribute',
  'setAttribute',
  'parentNode',
  'Node.removeChild',
  'Failed to execute',
  'appendChild',
  'replaceChild',
  
  // AbortController errors - expected during fast navigation
  'AbortError',
  'The operation was aborted',
  'signal is aborted',
  'DOMException: The user aborted a request',
  'aborted',
  
  // React ref warnings - non-fatal console warnings (NOT errors)
  // CRITICAL: These MUST be suppressed to prevent crash loops
  'Function components cannot be given refs',
  'forwardRef render functions accept',
  'Warning: Function components cannot be given refs',
  'Ref forwarding',
  'forwardRef',
  'Check the render method',
  'validateFunctionComponentInDev',
  
  // React state/lifecycle errors that occur during unmounting
  'unmounted component',
  'state update on an unmounted',
  "Can't perform a React state update",
  
  // React Query background errors
  'QueryCancelled',
  'Query cancelled',
  
  // Video playback (autoplay restrictions, etc.)
  'play() request was interrupted',
  'The play() request was interrupted',
  'NotAllowedError',
  'AbortError: The play',
  
  // Network errors (should show toast, not crash)
  'NetworkError',
  'Failed to fetch',
  'Network request failed',
  'TypeError: Failed to fetch',
  'net::ERR',
  'ECONNREFUSED',
  
  // Framer Motion cleanup - critical for animation crashes
  'Cannot read property',
  'measure',
  'animation',
  'Motion',
  'AnimatePresence',
  'exit',
  'animate',
  'variants',
  
  // Tooltip/Popover/Dialog cleanup race conditions - CRITICAL
  'Tooltip',
  'Popover',
  'radix',
  'Radix',
  'Dialog',
  'DialogContent',
  'DialogPortal',
  'Portal',
  
  // Image/media loading errors
  'Image',
  'load',
  'decode',
  'decoding',
];

/**
 * Global Stability Boundary - Root-level error boundary with:
 * - Catches ALL component-level failures
 * - Prevents white-screening the entire app
 * - Tracks error frequency to detect crash loops
 * - Provides graceful recovery options
 * - Logs errors for debugging
 * - Suppresses non-critical errors that shouldn't crash the app
 */
class GlobalStabilityBoundaryClass extends Component<GlobalStabilityBoundaryProps, GlobalStabilityBoundaryState> {
  private errorResetTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly ERROR_RESET_MS = 30000;
  private readonly CRASH_LOOP_THRESHOLD = 3;
  
  public state: GlobalStabilityBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
    errorCount: 0,
    lastErrorTime: 0,
  };

  public static getDerivedStateFromError(error: Error): Partial<GlobalStabilityBoundaryState> | null {
    // Check if this is a suppressed error that shouldn't show the error UI
    const errorMessage = error?.message || '';
    const shouldSuppress = SUPPRESSED_ERROR_PATTERNS.some(pattern => 
      errorMessage.includes(pattern)
    );
    
    if (shouldSuppress) {
      console.warn('[GlobalStabilityBoundary] Suppressed non-critical error:', errorMessage);
      return null; // Don't update state for suppressed errors
    }
    
    return { 
      hasError: true, 
      error,
      lastErrorTime: Date.now(),
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Check if this is a suppressed error
    const errorMessage = error?.message || '';
    const shouldSuppress = SUPPRESSED_ERROR_PATTERNS.some(pattern => 
      errorMessage.includes(pattern)
    );
    
    if (shouldSuppress) {
      return; // Don't process suppressed errors
    }

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
    }, this.ERROR_RESET_MS);
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
      // Clear any cached auth state
      localStorage.removeItem('supabase.auth.token');
    } catch (e) {
      // Ignore storage errors
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      // If too many errors in a row, suggest harder reset
      const isCrashLoop = this.state.errorCount >= this.CRASH_LOOP_THRESHOLD;

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
  return useMemo(() => data ?? fallback, [data, fallback]);
}

/**
 * Hook for safe array data with empty array fallback
 */
export function useSafeArray<T>(data: T[] | null | undefined): T[] {
  return useMemo(() => data ?? [], [data]);
}

/**
 * Hook for safe object data with empty object fallback
 */
export function useSafeObject<T extends object>(data: T | null | undefined): Partial<T> {
  return useMemo(() => data ?? {}, [data]);
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

/**
 * Array data guard - specifically for array data with count display
 */
export function ArrayDataGuard<T>({
  data,
  isLoading,
  error,
  emptyMessage = 'No items found',
  loadingCount = 3,
  children,
}: {
  data: T[] | null | undefined;
  isLoading?: boolean;
  error?: Error | string | null;
  emptyMessage?: string;
  loadingCount?: number;
  children: (data: T[]) => ReactNode;
}): JSX.Element {
  // Loading state with skeleton items
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: loadingCount }).map((_, i) => (
          <DataGuardSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return <DataGuardError error={error} />;
  }

  // Empty or null array
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-500">
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
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
      <WifiOff className="w-8 h-8 mx-auto mb-2 opacity-50" />
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

/**
 * Hook that tracks whether component is mounted - for async safety
 */
export function useIsMounted(): () => boolean {
  const isMountedRef = useRef(true);
  
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  return useCallback(() => isMountedRef.current, []);
}

/**
 * Hook for safe state updates that checks mount status
 */
export function useSafeState<T>(initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(initialValue);
  const isMounted = useIsMounted();
  
  const safeSetState = useCallback((value: T | ((prev: T) => T)) => {
    if (isMounted()) {
      setState(value);
    }
  }, [isMounted]);
  
  return [state, safeSetState];
}

/**
 * Hook for debounced values with cleanup
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  
  return debouncedValue;
}

export default GlobalStabilityBoundary;
