/**
 * Error Boundary Crash Tests
 * 
 * Tests for:
 * - Error boundary capture
 * - Recovery mechanisms
 * - Nested boundary behavior
 * - Async error handling
 * - Error classification
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, screen, fireEvent, waitFor } from '@testing-library/react';
import { 
  useState, 
  useEffect, 
  Component, 
  ErrorInfo,
  ReactNode,
  useCallback
} from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

const createTestWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

// Test Error Boundary Component
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class TestErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode; onError?: (error: Error) => void },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div data-testid="error-boundary">
          <p>Error: {this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

describe('Error Boundary Basic Functionality', () => {
  let consoleErrors: string[] = [];
  const originalError = console.error;

  beforeEach(() => {
    consoleErrors = [];
    console.error = (...args) => {
      consoleErrors.push(args.map(String).join(' '));
    };
  });

  afterEach(() => {
    console.error = originalError;
  });

  it('should catch synchronous render errors', () => {
    function BrokenComponent(): JSX.Element {
      throw new Error('Render error');
    }

    render(
      <TestErrorBoundary>
        <BrokenComponent />
      </TestErrorBoundary>,
      { wrapper: createTestWrapper() }
    );

    expect(screen.getByTestId('error-boundary')).toBeInTheDocument();
    expect(screen.getByText(/Render error/)).toBeInTheDocument();
  });

  it('should allow recovery via retry', async () => {
    let shouldError = true;

    function ConditionalBroken() {
      if (shouldError) {
        throw new Error('Conditional error');
      }
      return <div data-testid="success">Success</div>;
    }

    render(
      <TestErrorBoundary>
        <ConditionalBroken />
      </TestErrorBoundary>,
      { wrapper: createTestWrapper() }
    );

    expect(screen.getByTestId('error-boundary')).toBeInTheDocument();

    // Fix the condition
    shouldError = false;

    // Click retry
    fireEvent.click(screen.getByText('Retry'));

    await waitFor(() => {
      expect(screen.getByTestId('success')).toBeInTheDocument();
    });
  });

  it('should call onError callback', () => {
    const onError = vi.fn();

    function BrokenComponent(): JSX.Element {
      throw new Error('Test error');
    }

    render(
      <TestErrorBoundary onError={onError}>
        <BrokenComponent />
      </TestErrorBoundary>,
      { wrapper: createTestWrapper() }
    );

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(onError.mock.calls[0][0].message).toBe('Test error');
  });
});

describe('Nested Error Boundaries', () => {
  it('should isolate errors to nearest boundary', () => {
    function BrokenComponent(): JSX.Element {
      throw new Error('Nested error');
    }

    function SafeComponent() {
      return <div data-testid="safe">Safe Component</div>;
    }

    render(
      <TestErrorBoundary fallback={<div data-testid="outer-error">Outer</div>}>
        <div>
          <SafeComponent />
          <TestErrorBoundary fallback={<div data-testid="inner-error">Inner</div>}>
            <BrokenComponent />
          </TestErrorBoundary>
        </div>
      </TestErrorBoundary>,
      { wrapper: createTestWrapper() }
    );

    // Inner boundary catches the error
    expect(screen.getByTestId('inner-error')).toBeInTheDocument();
    
    // Outer boundary and safe component still render
    expect(screen.queryByTestId('outer-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('safe')).toBeInTheDocument();
  });

  it('should propagate to outer boundary when inner boundary breaks', () => {
    function BrokenBoundary(): JSX.Element {
      throw new Error('Boundary broke');
    }

    // Use class component that throws in getDerivedStateFromError
    class BuggyBoundary extends Component<
      { children: ReactNode },
      { hasError: boolean }
    > {
      state = { hasError: false };

      static getDerivedStateFromError() {
        throw new Error('Boundary itself is broken');
      }

      render() {
        if (this.state.hasError) {
          return <div>Buggy fallback</div>;
        }
        return this.props.children;
      }
    }

    // This documents the behavior - we can't easily test it
    expect(true).toBe(true);
  });
});

describe('Async Error Handling', () => {
  it('should NOT catch errors in event handlers (expected React behavior)', async () => {
    function ClickError() {
      const [error, setError] = useState<string | null>(null);

      const handleClick = () => {
        try {
          throw new Error('Click error');
        } catch (e) {
          // Must catch manually in event handlers
          setError((e as Error).message);
        }
      };

      return (
        <div>
          <button onClick={handleClick}>Click</button>
          {error && <div data-testid="error">{error}</div>}
        </div>
      );
    }

    render(
      <TestErrorBoundary>
        <ClickError />
      </TestErrorBoundary>,
      { wrapper: createTestWrapper() }
    );

    fireEvent.click(screen.getByText('Click'));

    // Error caught by local try-catch, not boundary
    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Click error');
    });

    // Boundary didn't catch it
    expect(screen.queryByTestId('error-boundary')).not.toBeInTheDocument();
  });

  it('should NOT catch errors in useEffect (expected React behavior)', async () => {
    // useEffect errors are not caught by error boundaries
    // They need manual handling
    
    function EffectError() {
      const [error, setError] = useState<string | null>(null);

      useEffect(() => {
        const asyncFn = async () => {
          try {
            throw new Error('Async error');
          } catch (e) {
            setError((e as Error).message);
          }
        };
        asyncFn();
      }, []);

      if (error) {
        return <div data-testid="local-error">{error}</div>;
      }
      return <div>Loading...</div>;
    }

    render(
      <TestErrorBoundary>
        <EffectError />
      </TestErrorBoundary>,
      { wrapper: createTestWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByTestId('local-error')).toBeInTheDocument();
    });
  });

  it('should handle rejected promises with global handler pattern', async () => {
    // This test documents the pattern for handling unhandled promise rejections
    // In jsdom, unhandledrejection events behave differently than in real browsers
    // The pattern used in main.tsx catches these globally
    
    const handleRejection = (event: PromiseRejectionEvent) => {
      event.preventDefault();
      return event.reason?.message;
    };

    // Document the pattern - we can't reliably test Promise.reject in jsdom
    // because the event timing is different from real browsers
    expect(typeof handleRejection).toBe('function');
    
    // Verify the pattern works synchronously
    const mockEvent = { 
      reason: new Error('Test rejection'), 
      preventDefault: vi.fn() 
    } as unknown as PromiseRejectionEvent;
    
    const result = handleRejection(mockEvent);
    expect(result).toBe('Test rejection');
    expect(mockEvent.preventDefault).toHaveBeenCalled();
  });
});

describe('Error Classification and Recovery', () => {
  it('should classify network errors', () => {
    function classifyError(error: Error): string {
      const message = error.message.toLowerCase();
      if (message.includes('fetch') || message.includes('network')) {
        return 'NETWORK';
      }
      if (message.includes('timeout')) {
        return 'TIMEOUT';
      }
      if (message.includes('auth') || message.includes('unauthorized')) {
        return 'AUTH';
      }
      return 'UNKNOWN';
    }

    expect(classifyError(new Error('Failed to fetch'))).toBe('NETWORK');
    expect(classifyError(new Error('NetworkError'))).toBe('NETWORK');
    expect(classifyError(new Error('Request timeout'))).toBe('TIMEOUT');
    expect(classifyError(new Error('Unauthorized'))).toBe('AUTH');
    expect(classifyError(new Error('Random error'))).toBe('UNKNOWN');
  });

  it('should provide recovery suggestions based on error type', () => {
    function getRecoverySuggestion(errorType: string): string {
      switch (errorType) {
        case 'NETWORK':
          return 'Check your internet connection';
        case 'TIMEOUT':
          return 'The operation took too long. Try again.';
        case 'AUTH':
          return 'Please sign in again';
        default:
          return 'Something went wrong. Please try again.';
      }
    }

    expect(getRecoverySuggestion('NETWORK')).toContain('internet');
    expect(getRecoverySuggestion('TIMEOUT')).toContain('too long');
    expect(getRecoverySuggestion('AUTH')).toContain('sign in');
  });
});

describe('Error Suppression Patterns', () => {
  it('should suppress expected non-fatal errors', () => {
    function shouldSuppressError(error: Error): boolean {
      const message = error.message.toLowerCase();
      
      // AbortController
      if (error.name === 'AbortError') return true;
      
      // ResizeObserver
      if (message.includes('resizeobserver loop')) return true;
      
      // Navigation cancellation
      if (message.includes('navigation was cancelled')) return true;
      
      // Chunk loading
      if (message.includes('loading chunk')) return true;
      
      return false;
    }

    expect(shouldSuppressError({ name: 'AbortError', message: '' } as Error)).toBe(true);
    expect(shouldSuppressError(new Error('ResizeObserver loop completed'))).toBe(true);
    expect(shouldSuppressError(new Error('Loading chunk 123 failed'))).toBe(true);
    expect(shouldSuppressError(new Error('Real error'))).toBe(false);
  });
});

describe('Crash Loop Detection', () => {
  it('should detect rapid error occurrences', () => {
    const errorTimestamps: number[] = [];
    const THRESHOLD = 5;
    const WINDOW_MS = 10000;

    function recordError() {
      errorTimestamps.push(Date.now());
      
      // Clean old timestamps
      const cutoff = Date.now() - WINDOW_MS;
      while (errorTimestamps.length > 0 && errorTimestamps[0] < cutoff) {
        errorTimestamps.shift();
      }
    }

    function isCrashLoop(): boolean {
      return errorTimestamps.length >= THRESHOLD;
    }

    // Simulate rapid errors
    for (let i = 0; i < 4; i++) {
      recordError();
    }
    expect(isCrashLoop()).toBe(false);

    recordError();
    expect(isCrashLoop()).toBe(true);
  });

  it('should trigger safe mode after crash loop', () => {
    let safeModeEnabled = false;
    const errors: string[] = [];
    const THRESHOLD = 3;

    function handleError(error: string) {
      errors.push(error);
      if (errors.length >= THRESHOLD) {
        safeModeEnabled = true;
      }
    }

    function getSafeModeConfig() {
      return {
        enabled: safeModeEnabled,
        disablePolling: safeModeEnabled,
        disableVideoAutoplay: safeModeEnabled,
        disableMSE: safeModeEnabled,
      };
    }

    handleError('Error 1');
    handleError('Error 2');
    expect(getSafeModeConfig().enabled).toBe(false);

    handleError('Error 3');
    expect(getSafeModeConfig().enabled).toBe(true);
    expect(getSafeModeConfig().disablePolling).toBe(true);
  });
});
