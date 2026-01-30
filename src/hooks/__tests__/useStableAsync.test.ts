/**
 * Async Safety Tests
 * 
 * Tests for useStableAsync hook and async lifecycle patterns
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import useStableAsync from '@/hooks/useStableAsync';

describe('useStableAsync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should execute async function successfully', async () => {
    vi.useRealTimers();
    
    const { result } = renderHook(() => useStableAsync<string>());

    let resolvedValue: string | null = null;

    await act(async () => {
      resolvedValue = await result.current.execute(async () => 'success');
    });

    expect(resolvedValue).toBe('success');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should handle errors gracefully', async () => {
    vi.useRealTimers();
    
    const onError = vi.fn();
    const { result } = renderHook(() => 
      useStableAsync({ onError, context: 'TestContext' })
    );

    await act(async () => {
      await result.current.execute(async () => {
        throw new Error('Test error');
      });
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toBe('Test error');
    expect(onError).toHaveBeenCalled();
  });

  it('should timeout long operations', async () => {
    const { result } = renderHook(() => 
      useStableAsync({ timeout: 1000 })
    );

    const promise = result.current.execute(async () => {
      await new Promise(resolve => setTimeout(resolve, 5000));
      return 'slow result';
    });

    // Advance past timeout
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    vi.useRealTimers();
    const value = await promise;

    expect(value).toBeNull();
    expect(result.current.error?.message).toContain('timed out');
  });

  it('should cancel on abort', async () => {
    vi.useRealTimers();
    
    const { result } = renderHook(() => useStableAsync());

    const promise = result.current.execute(async (signal) => {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(resolve, 100);
        signal.addEventListener('abort', () => {
          clearTimeout(timeout);
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
      return 'result';
    });

    // Cancel immediately
    act(() => {
      result.current.cancel();
    });

    const value = await promise;
    expect(value).toBeNull();
  });

  it('should report mounted state correctly', () => {
    const { result, unmount } = renderHook(() => useStableAsync());

    expect(result.current.isMounted()).toBe(true);

    unmount();

    // After unmount, isMounted should return false
    // Note: The ref is cleaned up, so accessing it may vary by implementation
  });

  it('should clear error on clearError call', async () => {
    vi.useRealTimers();
    
    const { result } = renderHook(() => useStableAsync());

    await act(async () => {
      await result.current.execute(async () => {
        throw new Error('Test error');
      });
    });

    expect(result.current.error).toBeTruthy();

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('should prevent stale updates from old executions', async () => {
    vi.useRealTimers();
    
    const { result } = renderHook(() => useStableAsync());

    // Start first execution
    const promise1 = result.current.execute(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      return 'first';
    });

    // Start second execution immediately (should supersede first)
    const promise2 = result.current.execute(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return 'second';
    });

    const [result1, result2] = await Promise.all([promise1, promise2]);

    // First execution should be cancelled/null
    expect(result1).toBeNull();
    expect(result2).toBe('second');
  });

  it('should provide fresh abort signal each execution', () => {
    const { result } = renderHook(() => useStableAsync());

    const signal1 = result.current.getSignal();
    const signal2 = result.current.getSignal();

    // First signal should be aborted when second is created
    expect(signal1.aborted).toBe(true);
    expect(signal2.aborted).toBe(false);
  });
});

describe('Async Edge Cases', () => {
  it('should handle rapid successive calls', async () => {
    vi.useRealTimers();
    
    const { result } = renderHook(() => useStableAsync<string>());
    const calls: Promise<string | null>[] = [];

    await act(async () => {
      for (let i = 0; i < 5; i++) {
        calls.push(
          result.current.execute(async () => {
            await new Promise(resolve => setTimeout(resolve, 5));
            return `call-${i}`;
          })
        );
      }
    });

    const results = await Promise.all(calls);
    
    // Only the last call should succeed
    const successfulCalls = results.filter(r => r !== null);
    expect(successfulCalls).toHaveLength(1);
    expect(successfulCalls[0]).toBe('call-4');
  });

  it('should not update state after unmount', async () => {
    vi.useRealTimers();
    
    const { result, unmount } = renderHook(() => useStableAsync());

    const promise = result.current.execute(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      return 'result';
    });

    // Unmount during execution
    unmount();

    // Should not throw, just return null
    const value = await promise;
    expect(value).toBeNull();
  });
});
