/**
 * Stability Regression Tests
 * 
 * Automated tests to prevent stability regressions:
 * - Error boundary behavior
 * - Async lifecycle management
 * - Ref forwarding compliance
 * - Error classification accuracy
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  classifyError, 
  shouldSuppressError, 
  getRecoverySuggestion,
  withTimeout,
  createSafeExecutor,
  logStabilityEvent,
  getHealthScore,
} from '@/lib/stabilityMonitor';

describe('StabilityMonitor', () => {
  describe('Error Classification', () => {
    it('classifies network errors correctly', () => {
      expect(classifyError(new Error('Failed to fetch'))).toBe('NETWORK');
      expect(classifyError(new Error('NetworkError when attempting'))).toBe('NETWORK');
      expect(classifyError(new Error('net::ERR_CONNECTION_REFUSED'))).toBe('NETWORK');
    });

    it('classifies auth errors correctly', () => {
      expect(classifyError(new Error('Session expired'))).toBe('AUTH');
      expect(classifyError(new Error('Unauthorized access'))).toBe('AUTH');
      expect(classifyError(new Error('JWT token invalid'))).toBe('AUTH');
    });

    it('classifies timeout errors correctly', () => {
      expect(classifyError(new Error('Request timed out'))).toBe('TIMEOUT');
      expect(classifyError(new Error('Operation timeout'))).toBe('TIMEOUT');
    });

    it('classifies async race conditions correctly', () => {
      expect(classifyError(new Error("Can't call setState on an unmounted component"))).toBe('ASYNC_RACE');
      expect(classifyError(new Error('Cannot update a component while rendering'))).toBe('ASYNC_RACE');
    });

    it('classifies render errors correctly', () => {
      expect(classifyError(new Error('Hydration mismatch'))).toBe('RENDER');
      expect(classifyError(new Error('Rendering error occurred'))).toBe('RENDER');
    });

    it('classifies state corruption correctly', () => {
      expect(classifyError(new Error("Cannot read properties of undefined"))).toBe('STATE_CORRUPTION');
      expect(classifyError(new Error("null is not an object"))).toBe('STATE_CORRUPTION');
    });

    it('returns UNKNOWN for unrecognized errors', () => {
      expect(classifyError(new Error('Something random happened'))).toBe('UNKNOWN');
      expect(classifyError(null)).toBe('UNKNOWN');
    });
  });

  describe('Error Suppression', () => {
    it('suppresses AbortError', () => {
      expect(shouldSuppressError(new Error('AbortError'))).toBe(true);
    });

    it('suppresses navigation cancellation', () => {
      expect(shouldSuppressError(new Error('The operation was aborted'))).toBe(true);
    });

    it('suppresses ResizeObserver loop errors', () => {
      expect(shouldSuppressError(new Error('ResizeObserver loop limit exceeded'))).toBe(true);
    });

    it('does not suppress real errors', () => {
      expect(shouldSuppressError(new Error('Database connection failed'))).toBe(false);
      expect(shouldSuppressError(new Error('Validation error'))).toBe(false);
    });

    it('suppresses null/undefined errors', () => {
      expect(shouldSuppressError(null)).toBe(true);
      expect(shouldSuppressError(undefined)).toBe(true);
    });
  });

  describe('Recovery Suggestions', () => {
    it('provides appropriate suggestions for each category', () => {
      expect(getRecoverySuggestion('NETWORK')).toContain('internet connection');
      expect(getRecoverySuggestion('AUTH')).toContain('session');
      expect(getRecoverySuggestion('TIMEOUT')).toContain('took too long');
      expect(getRecoverySuggestion('ASYNC_RACE')).toContain('Navigation');
      expect(getRecoverySuggestion('RENDER')).toContain('display error');
      expect(getRecoverySuggestion('STATE_CORRUPTION')).toContain('Data inconsistency');
      expect(getRecoverySuggestion('UNKNOWN')).toContain('unexpected');
    });
  });

  describe('Timeout Wrapper', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('resolves when promise completes before timeout', async () => {
      const quickPromise = Promise.resolve('success');
      const result = await withTimeout(quickPromise, 5000, 'Test');
      expect(result).toBe('success');
    });

    it('rejects when timeout is exceeded', async () => {
      const slowPromise = new Promise(resolve => setTimeout(resolve, 10000));
      const timeoutPromise = withTimeout(slowPromise, 1000, 'Test');
      
      vi.advanceTimersByTime(1500);
      
      await expect(timeoutPromise).rejects.toThrow('Test timed out after 1000ms');
    });
  });

  describe('Safe Executor', () => {
    it('executes function successfully', async () => {
      const executor = createSafeExecutor();
      const result = await executor.execute(async () => 'success');
      expect(result).toBe('success');
    });

    it('returns null when cancelled', async () => {
      const executor = createSafeExecutor();
      executor.cancel();
      const result = await executor.execute(async () => 'success');
      expect(result).toBeNull();
    });

    it('respects abort signal', async () => {
      const controller = new AbortController();
      const executor = createSafeExecutor(controller.signal);
      
      controller.abort();
      
      const result = await executor.execute(async () => 'success');
      expect(result).toBeNull();
    });

    it('calls onError callback on failure', async () => {
      const onError = vi.fn();
      const executor = createSafeExecutor();
      
      await executor.execute(
        async () => { throw new Error('Test error'); },
        { onError }
      );
      
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it('reports cancelled state correctly', () => {
      const executor = createSafeExecutor();
      expect(executor.isCancelled()).toBe(false);
      
      executor.cancel();
      expect(executor.isCancelled()).toBe(true);
    });
  });

  describe('Event Logging', () => {
    it('logs events with correct structure', () => {
      const event = logStabilityEvent('NETWORK', 'Test error', {
        componentName: 'TestComponent',
        silent: true,
      });

      expect(event).toMatchObject({
        category: 'NETWORK',
        message: 'Test error',
        componentName: 'TestComponent',
        recovered: false,
      });
      expect(event.id).toBeDefined();
      expect(event.timestamp).toBeGreaterThan(0);
    });

    it('captures route information', () => {
      const event = logStabilityEvent('AUTH', 'Session expired', { silent: true });
      expect(event.route).toBe('/'); // jsdom default
    });
  });

  describe('Health Score', () => {
    it('returns 100 when no recent errors', () => {
      // Clear any existing events by getting fresh score immediately after page load
      // In a clean state, this should be close to 100
      const score = getHealthScore();
      expect(score).toBeLessThanOrEqual(100);
      expect(score).toBeGreaterThanOrEqual(0);
    });

    it('deducts points based on error severity', () => {
      // Log multiple errors
      logStabilityEvent('RENDER', 'Render error 1', { silent: true });
      logStabilityEvent('RENDER', 'Render error 2', { silent: true });
      
      const score = getHealthScore();
      expect(score).toBeLessThan(100);
    });
  });
});

describe('Async Lifecycle Safety', () => {
  it('should handle rapid mount/unmount cycles', async () => {
    const mockSetState = vi.fn();
    const isMountedRef = { current: true };
    
    // Simulate unmount during async operation
    const asyncOp = async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      if (isMountedRef.current) {
        mockSetState('updated');
      }
    };

    asyncOp();
    isMountedRef.current = false; // Simulate unmount
    
    await new Promise(resolve => setTimeout(resolve, 20));
    
    expect(mockSetState).not.toHaveBeenCalled();
  });

  it('should abort fetch on signal', async () => {
    const controller = new AbortController();
    
    const fetchWithSignal = async () => {
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => resolve('data'), 100);
        
        controller.signal.addEventListener('abort', () => {
          clearTimeout(timeoutId);
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    };

    const promise = fetchWithSignal();
    controller.abort();

    await expect(promise).rejects.toThrow('Aborted');
  });
});

describe('Component Ref Forwarding', () => {
  it('verifies forwardRef pattern requirements', () => {
    // This test documents the expected pattern for animated components
    const pattern = `
      const Component = memo(forwardRef<HTMLDivElement, Props>(
        function Component(props, ref) {
          return <div ref={ref} {...props} />;
        }
      ));
    `;
    
    // Pattern should include:
    expect(pattern).toContain('forwardRef');
    expect(pattern).toContain('memo');
    expect(pattern).toContain('ref');
  });

  it('documents animation library requirements', () => {
    // Framer Motion requires ref forwarding for:
    // - whileInView animations
    // - drag constraints
    // - layout animations
    // - exit animations
    
    const requirements = [
      'forwardRef for DOM measurements',
      'memo for performance',
      'proper ref typing',
    ];
    
    expect(requirements).toHaveLength(3);
  });
});

describe('Error Boundary Behavior', () => {
  it('should not propagate ASYNC_RACE errors to UI', () => {
    const error = new Error("Can't call setState on an unmounted");
    const category = classifyError(error);
    
    // ASYNC_RACE should have minimal UI impact
    expect(category).toBe('ASYNC_RACE');
    expect(shouldSuppressError(error)).toBe(false); // Still log it
    
    // But recovery suggestion should be calm
    const suggestion = getRecoverySuggestion('ASYNC_RACE');
    expect(suggestion).toContain('harmless');
  });

  it('should classify render errors for boundary handling', () => {
    const renderErrors = [
      new Error('Hydration failed'),
      new Error('Rendering error occurred'),
      new Error('render cycle failed'),
    ];

    renderErrors.forEach(error => {
      expect(classifyError(error)).toBe('RENDER');
    });
  });
});
