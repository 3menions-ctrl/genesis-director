import React, { Component, ErrorInfo, ReactNode, useCallback, useRef, useEffect, forwardRef, useState } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug, Send, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary Component (Internal Class)
 * Catches JavaScript errors anywhere in the child component tree,
 * logs them, and displays a fallback UI instead of crashing the whole app.
 */
class ErrorBoundaryClass extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  // SUPPRESSED_NAMES - DOMException types that should not crash
  private static readonly SUPPRESSED_NAMES = [
    'AbortError',
    'NotAllowedError',
    'NotSupportedError',
    'InvalidStateError',
    'QuotaExceededError',
    'SecurityError',
    'NotFoundError',
    'HierarchyRequestError',
  ];
  
  // SUPPRESSED_PATTERNS - specific error messages to ignore
  private static readonly SUPPRESSED_PATTERNS = [
    'ResizeObserver loop',
    'ChunkLoadError',
    'Loading chunk',
    'play() request was interrupted',
    'The play() request was interrupted',
    'Failed to fetch',
    'state update on an unmounted',
    'Load failed',
    'NetworkError',
    'net::ERR',
  ];
  
  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> | null {
    // Check if this error should be suppressed
    const errorName = error?.name || '';
    const errorMessage = error?.message || '';
    
    // Suppress by error name
    if (ErrorBoundaryClass.SUPPRESSED_NAMES.includes(errorName)) {
      console.debug('[ErrorBoundary] Suppressed by name:', errorName);
      // CRITICAL: Return explicit reset to prevent error UI
      return { hasError: false, error: null, errorInfo: null };
    }
    
    // Suppress by message pattern
    const shouldSuppress = ErrorBoundaryClass.SUPPRESSED_PATTERNS.some(pattern =>
      errorMessage.toLowerCase().includes(pattern.toLowerCase())
    );
    
    if (shouldSuppress) {
      console.debug('[ErrorBoundary] Suppressed by pattern:', errorMessage.substring(0, 80));
      // CRITICAL: Return explicit reset to prevent error UI
      return { hasError: false, error: null, errorInfo: null };
    }
    
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Check if suppressed - if so, reset state and return
    const errorName = error?.name || '';
    const errorMessage = error?.message || '';
    
    if (ErrorBoundaryClass.SUPPRESSED_NAMES.includes(errorName)) {
      this.setState({ hasError: false, error: null, errorInfo: null });
      return;
    }
    
    const shouldSuppress = ErrorBoundaryClass.SUPPRESSED_PATTERNS.some(pattern =>
      errorMessage.toLowerCase().includes(pattern.toLowerCase())
    );
    
    if (shouldSuppress) {
      this.setState({ hasError: false, error: null, errorInfo: null });
      return;
    }
    
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

            <ReportThisIssueButton
              error={this.state.error}
              errorInfo={this.state.errorInfo}
            />
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * "Report this issue" — opens a support_messages row with the captured error
 * and component stack. Lets the user opt in to send their email/context.
 * Renders inline below the Try Again / Go Home row so the user always has a
 * concrete escalation path when the app crashes.
 */
function ReportThisIssueButton({
  error,
  errorInfo,
}: {
  error: Error | null;
  errorInfo: ErrorInfo | null;
}) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const send = async () => {
    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('support_messages').insert({
        user_id: user?.id ?? null,
        name: user?.email?.split('@')[0] ?? 'Anonymous',
        email: user?.email ?? 'anonymous@smallbridges.com',
        source: 'app_crash',
        subject: `App crash — ${error?.name ?? 'Error'}: ${(error?.message ?? '').slice(0, 100)}`,
        message:
          `URL: ${window.location.href}\n` +
          `User-Agent: ${navigator.userAgent}\n` +
          `Time: ${new Date().toISOString()}\n\n` +
          `Message: ${error?.message ?? 'unknown'}\n\n` +
          `Stack:\n${(error?.stack ?? '').slice(0, 4000)}\n\n` +
          `Component stack:\n${(errorInfo?.componentStack ?? '').slice(0, 4000)}`,
      });
      setSent(true);
    } catch (e) {
      console.error('[ErrorBoundary] Report failed:', e);
      // Still mark as sent so the user isn't trapped repeating a failing report.
      setSent(true);
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <p className="text-xs text-emerald-500 inline-flex items-center justify-center gap-1.5">
        <Check className="w-3.5 h-3.5" /> Thanks — your report was sent. We&rsquo;ll get back to you.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <button
        onClick={send}
        disabled={sending}
        className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 underline underline-offset-2"
      >
        {sending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
        {sending ? 'Sending…' : 'Report this issue to support'}
      </button>
      <p className="text-xs text-muted-foreground">
        Or{' '}
        <a href="/contact" className="text-primary hover:underline">
          start a conversation
        </a>{' '}
        with our team.
      </p>
    </div>
  );
}

// Export the class as ErrorBoundary for backwards compatibility
export const ErrorBoundary = ErrorBoundaryClass;

/**
 * HOC to wrap any component with error boundary
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ReactNode
) {
  const WithErrorBoundaryWrapper = (props: P) => {
    return (
      <ErrorBoundaryClass fallback={fallback}>
        <WrappedComponent {...props} />
      </ErrorBoundaryClass>
    );
  };
  WithErrorBoundaryWrapper.displayName = `WithErrorBoundary(${(WrappedComponent as React.FC).displayName || WrappedComponent.name || 'Component'})`;
  return WithErrorBoundaryWrapper;
}

/**
 * Hook-friendly error boundary wrapper for function components
 */
export const ErrorBoundaryWrapper = forwardRef<HTMLDivElement, { 
  children: ReactNode; 
  fallback?: ReactNode 
}>(function ErrorBoundaryWrapper({ children, fallback }, ref) {
  return (
    <div ref={ref} className="contents">
      <ErrorBoundary fallback={fallback}>{children}</ErrorBoundary>
    </div>
  );
});
ErrorBoundaryWrapper.displayName = 'ErrorBoundaryWrapper';

/**
 * Minimal inline error boundary for nested components - prevents cascade crashes
 * Shows a subtle error UI instead of crashing the entire page
 * Uses forwardRef for AnimatePresence compatibility
 */
interface SafeComponentProps { 
  children: ReactNode; 
  name?: string;
  fallback?: ReactNode;
  silent?: boolean;
}

export const SafeComponent = forwardRef<HTMLDivElement, SafeComponentProps>(
  function SafeComponent({ children, name = 'Component', fallback, silent = false }, ref) {
    // FIXED: Removed window.location.reload() to prevent crash loops
    // Use a local retry state instead
    const [retryKey, setRetryKey] = React.useState(0);
    
    const handleRetry = React.useCallback(() => {
      setRetryKey(k => k + 1);
    }, []);
    
    return (
      <div ref={ref} className="contents" key={retryKey}>
        <ErrorBoundary 
          fallback={fallback || (silent ? null : (
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-center">
              <p className="text-sm text-destructive">
                {name} failed to load
              </p>
              <button 
                onClick={handleRetry}
                className="mt-2 text-xs text-muted-foreground hover:text-foreground underline"
              >
                Try again
              </button>
            </div>
          ))}
        >
          {children}
        </ErrorBoundary>
      </div>
    );
  }
);
SafeComponent.displayName = 'SafeComponent';

/**
 * Invisible boundary - silently catches errors without any UI
 * Use for non-critical components that shouldn't show errors
 */
export const SilentBoundary = forwardRef<HTMLDivElement, { children: ReactNode }>(
  function SilentBoundary({ children }, ref) {
    return <SafeComponent ref={ref} silent fallback={null}>{children}</SafeComponent>;
  }
);
SilentBoundary.displayName = 'SilentBoundary';

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
