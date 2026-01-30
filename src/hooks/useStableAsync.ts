/**
 * useStableAsync - Production-grade async hook with full lifecycle management
 * 
 * Features:
 * - Automatic cancellation on unmount
 * - Timeout protection
 * - Retry logic with exponential backoff
 * - Race condition prevention
 * - Error classification and handling
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { stabilityMonitor } from '@/lib/stabilityMonitor';

interface UseStableAsyncOptions {
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Enable automatic retry on failure */
  retry?: boolean;
  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay for exponential backoff in ms (default: 1000) */
  retryDelay?: number;
  /** Context name for error reporting */
  context?: string;
  /** Callback on error */
  onError?: (error: Error) => void;
  /** Callback on success */
  onSuccess?: () => void;
}

interface UseStableAsyncReturn<T> {
  /** Execute the async function */
  execute: (fn: (signal: AbortSignal) => Promise<T>) => Promise<T | null>;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Clear error state */
  clearError: () => void;
  /** Cancel current operation */
  cancel: () => void;
  /** Check if component is mounted */
  isMounted: () => boolean;
  /** Get fresh abort signal */
  getSignal: () => AbortSignal;
}

export function useStableAsync<T = unknown>(
  options: UseStableAsyncOptions = {}
): UseStableAsyncReturn<T> {
  const {
    timeout = 30000,
    retry = false,
    maxRetries = 3,
    retryDelay = 1000,
    context,
    onError,
    onSuccess,
  } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const executionIdRef = useRef(0);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  const isMounted = useCallback(() => isMountedRef.current, []);

  const getSignal = useCallback(() => {
    // Abort previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    return abortControllerRef.current.signal;
  }, []);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (isMountedRef.current) {
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    if (isMountedRef.current) {
      setError(null);
    }
  }, []);

  const execute = useCallback(
    async (fn: (signal: AbortSignal) => Promise<T>): Promise<T | null> => {
      // Track execution ID to prevent stale updates
      const currentExecutionId = ++executionIdRef.current;
      
      if (!isMountedRef.current) return null;

      const signal = getSignal();
      
      if (isMountedRef.current) {
        setIsLoading(true);
        setError(null);
      }

      let lastError: Error | null = null;
      const attempts = retry ? maxRetries : 1;

      for (let attempt = 0; attempt < attempts; attempt++) {
        // Check if this execution is still current
        if (executionIdRef.current !== currentExecutionId) {
          return null;
        }

        if (!isMountedRef.current) return null;
        if (signal.aborted) return null;

        try {
          // Execute with timeout
          const result = await stabilityMonitor.withTimeout(
            fn(signal),
            timeout,
            context || 'Async operation'
          );

          // Validate execution is still current and component mounted
          if (executionIdRef.current !== currentExecutionId) return null;
          if (!isMountedRef.current) return null;
          if (signal.aborted) return null;

          setIsLoading(false);
          onSuccess?.();
          return result;

        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));

          // Don't retry abort errors
          if (lastError.name === 'AbortError') {
            if (isMountedRef.current) setIsLoading(false);
            return null;
          }

          // Log to stability monitor
          stabilityMonitor.handle(lastError, context, { silent: attempt < attempts - 1 });

          // Wait before retry (exponential backoff)
          if (retry && attempt < attempts - 1) {
            const delay = retryDelay * Math.pow(2, attempt);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      // All attempts failed
      if (executionIdRef.current === currentExecutionId && isMountedRef.current) {
        setIsLoading(false);
        setError(lastError);
        onError?.(lastError!);
      }

      return null;
    },
    [timeout, retry, maxRetries, retryDelay, context, onError, onSuccess, getSignal]
  );

  return {
    execute,
    isLoading,
    error,
    clearError,
    cancel,
    isMounted,
    getSignal,
  };
}

/**
 * Simplified hook for fire-and-forget async operations
 */
export function useAsyncCallback<Args extends unknown[], T>(
  callback: (...args: Args) => Promise<T>,
  options: UseStableAsyncOptions = {}
): [(...args: Args) => Promise<T | null>, boolean, Error | null] {
  const { execute, isLoading, error } = useStableAsync<T>(options);

  const wrappedCallback = useCallback(
    async (...args: Args): Promise<T | null> => {
      return execute(async () => callback(...args));
    },
    [callback, execute]
  );

  return [wrappedCallback, isLoading, error];
}

/**
 * Hook for async operations that should execute once on mount
 */
export function useAsyncEffect(
  effect: (signal: AbortSignal) => Promise<void>,
  deps: React.DependencyList,
  options: UseStableAsyncOptions = {}
): { isLoading: boolean; error: Error | null } {
  const { execute, isLoading, error } = useStableAsync(options);

  useEffect(() => {
    execute(effect);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { isLoading, error };
}

export default useStableAsync;
