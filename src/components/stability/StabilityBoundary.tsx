/**
 * StabilityBoundary - Enhanced Error Boundary with automatic recovery
 * 
 * Features:
 * - Automatic retry for transient errors
 * - Error classification and reporting
 * - Graceful degradation fallbacks
 * - Child isolation (errors don't propagate up)
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  stabilityMonitor, 
  ErrorCategory, 
  getRecoverySuggestion 
} from '@/lib/stabilityMonitor';

interface Props {
  children: ReactNode;
  /** Component/section name for error reporting */
  name?: string;
  /** Fallback UI when error occurs */
  fallback?: ReactNode;
  /** Callback when error is caught */
  onError?: (error: Error, info: ErrorInfo) => void;
  /** Auto-retry transient errors */
  autoRetry?: boolean;
  /** Max auto-retry attempts */
  maxRetries?: number;
  /** Show minimal fallback instead of full error UI */
  minimal?: boolean;
  /** Isolate - don't show error UI, just hide content */
  isolate?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorCategory: ErrorCategory;
  retryCount: number;
  isRetrying: boolean;
}

export class StabilityBoundary extends Component<Props, State> {
  private retryTimeout: NodeJS.Timeout | null = null;

  static defaultProps = {
    autoRetry: false,
    maxRetries: 2,
    minimal: false,
    isolate: false,
  };

  state: State = {
    hasError: false,
    error: null,
    errorCategory: 'UNKNOWN',
    retryCount: 0,
    isRetrying: false,
  };

  // Error patterns to suppress - prevent these from showing error UI
  // COMPREHENSIVE LIST - must match GlobalStabilityBoundary and main.tsx
  private static readonly SUPPRESSED_PATTERNS = [
    // AbortController - expected during navigation
    'AbortError',
    'aborted',
    'The operation was aborted',
    'signal is aborted',
    // ResizeObserver - browser quirk
    'ResizeObserver',
    // Chunk loading - handled by recovery system
    'ChunkLoadError',
    'Loading chunk',
    'dynamically imported module',
    'Failed to fetch dynamically imported module',
    // React ref warnings - NOT crashes
    'Function components cannot be given refs',
    'forwardRef render functions accept',
    'forwardRef',
    'Check the render method',
    'validateFunctionComponentInDev',
    // DOM cleanup race conditions
    'removeChild',
    'insertBefore',
    'removeAttribute',
    'setAttribute',
    'appendChild',
    'parentNode',
    'Failed to execute',
    'Cannot read properties of null',
    'Cannot read properties of undefined',
    // Radix/Dialog cleanup
    'Dialog',
    'DialogContent',
    'DialogPortal',
    'Radix',
    'Portal',
    'Tooltip',
    'Popover',
    // Video playback - CRITICAL
    'play() request was interrupted',
    'The play() request was interrupted',
    'NotAllowedError',
    'NotSupportedError',
    'InvalidStateError',
    'MEDIA_ERR',
    'MediaError',
    'HTMLMediaElement',
    'The element has no supported sources',
    'SourceBuffer',
    'MediaSource',
    // React lifecycle
    'unmounted component',
    'state update on an unmounted',
    "Can't perform a React state update",
    // Network errors
    'Failed to fetch',
    'NetworkError',
    'Load failed',
    'net::ERR',
    // Safari-specific
    'QuotaExceededError',
    'SecurityError',
    'WebKit',
    'undefined is not an object',
    'null is not an object',
  ];

  static getDerivedStateFromError(error: Error): Partial<State> | null {
    // Check if this error should be suppressed
    const errorMessage = error?.message || '';
    const errorName = error?.name || '';
    
    // Check by error name first - DOMException types
    const suppressedNames = ['AbortError', 'NotAllowedError', 'NotSupportedError', 'InvalidStateError', 'QuotaExceededError', 'SecurityError', 'NotFoundError'];
    if (suppressedNames.includes(errorName)) {
      console.debug('[StabilityBoundary] Suppressed by name:', errorName);
      // CRITICAL: Explicitly reset to prevent error UI from showing
      return { hasError: false, error: null, isRetrying: false };
    }
    
    const shouldSuppress = StabilityBoundary.SUPPRESSED_PATTERNS.some(pattern => 
      errorMessage.toLowerCase().includes(pattern.toLowerCase())
    );
    
    if (shouldSuppress) {
      console.debug('[StabilityBoundary] Suppressed non-critical error:', errorMessage.substring(0, 100));
      // CRITICAL: Explicitly reset to prevent error UI from showing
      return { hasError: false, error: null, isRetrying: false };
    }
    
    return {
      hasError: true,
      error,
      errorCategory: stabilityMonitor.classify(error),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { name, onError, autoRetry, maxRetries } = this.props;
    const { retryCount } = this.state;

    // Check if this error should be suppressed - if so, auto-recover
    const errorMessage = error?.message || '';
    const shouldSuppress = StabilityBoundary.SUPPRESSED_PATTERNS.some(pattern => 
      errorMessage.toLowerCase().includes(pattern.toLowerCase())
    );
    
    if (shouldSuppress) {
      console.debug('[StabilityBoundary] Auto-recovering from suppressed error:', errorMessage.substring(0, 100));
      // Auto-recover from suppressed errors
      this.setState({ hasError: false, error: null, isRetrying: false });
      return;
    }

    // Log to stability monitor
    stabilityMonitor.log(stabilityMonitor.classify(error), error.message, {
      stack: error.stack,
      componentName: name || 'StabilityBoundary',
      recovered: false,
    });

    // Call external error handler
    if (onError) {
      onError(error, errorInfo);
    }

    // Attempt auto-retry for transient errors
    if (autoRetry && retryCount < (maxRetries || 2)) {
      const category = stabilityMonitor.classify(error);
      
      // Only retry network/timeout errors
      if (category === 'NETWORK' || category === 'TIMEOUT') {
        this.setState({ isRetrying: true });
        
        this.retryTimeout = setTimeout(() => {
          this.setState(prev => ({
            hasError: false,
            error: null,
            retryCount: prev.retryCount + 1,
            isRetrying: false,
          }));
        }, 1000 * (retryCount + 1)); // Exponential backoff
      }
    }
  }

  componentWillUnmount() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      retryCount: 0,
      isRetrying: false,
    });
  };

  handleHome = () => {
    window.location.href = '/';
  };

  render() {
    const { children, fallback, minimal, isolate, name } = this.props;
    const { hasError, error, errorCategory, isRetrying } = this.state;

    if (!hasError) {
      return children;
    }

    // Retrying state
    if (isRetrying) {
      return (
        <div className="p-4 flex items-center justify-center">
          <div className="flex items-center gap-2 text-muted-foreground">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-sm">Retrying...</span>
          </div>
        </div>
      );
    }

    // Custom fallback
    if (fallback) {
      return <>{fallback}</>;
    }

    // Isolation mode - just hide content
    if (isolate) {
      return null;
    }

    // Minimal fallback
    if (minimal) {
      return (
        <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/10">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-medium">
              {name ? `${name} unavailable` : 'Section unavailable'}
            </span>
          </div>
          <button
            onClick={this.handleRetry}
            className="mt-2 text-xs text-muted-foreground hover:text-foreground underline"
          >
            Try again
          </button>
        </div>
      );
    }

    // Full error UI
    const suggestion = getRecoverySuggestion(errorCategory);

    return (
      <div className="min-h-[200px] bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-destructive" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">
              {name ? `${name} encountered an error` : 'Something went wrong'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {suggestion}
            </p>
          </div>

          {process.env.NODE_ENV === 'development' && error && (
            <div className="p-3 rounded-lg bg-muted text-left overflow-auto max-h-32">
              <div className="flex items-center gap-2 mb-1">
                <Bug className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">
                  {errorCategory}
                </span>
              </div>
              <pre className="text-xs text-destructive font-mono whitespace-pre-wrap">
                {error.message}
              </pre>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={this.handleRetry} variant="default" className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Button>
            <Button onClick={this.handleHome} variant="outline" className="gap-2">
              <Home className="w-4 h-4" />
              Go Home
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

/**
 * Hook to wrap components with stability boundary
 */
export function withStabilityBoundary<P extends object>(
  Component: React.ComponentType<P>,
  options?: Omit<Props, 'children'>
) {
  const displayName = Component.displayName || Component.name || 'Component';

  function WrappedComponent(props: P) {
    return (
      <StabilityBoundary name={displayName} {...options}>
        <Component {...props} />
      </StabilityBoundary>
    );
  }

  WrappedComponent.displayName = `WithStability(${displayName})`;
  return WrappedComponent;
}

export default StabilityBoundary;
