import { useRef, useEffect, useCallback, useMemo, useState } from 'react';

/**
 * Comprehensive Stability Guard Hook
 * 
 * Provides a unified API for:
 * - Mount tracking (prevents setState on unmounted components)
 * - AbortController management (cancels pending requests on unmount)
 * - Safe timeouts/intervals (auto-cleanup)
 * - Safe state updates (mount-checked)
 * - Async operation safety (catches AbortErrors silently)
 * 
 * Use this hook in ANY component that performs async operations
 * to prevent crashes during fast navigation.
 */
export function useStabilityGuard() {
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingTimeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const pendingIntervalsRef = useRef<Set<ReturnType<typeof setInterval>>>(new Set());

  // Cleanup everything on unmount
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      
      // Abort any pending fetch requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      // Clear all pending timeouts
      pendingTimeoutsRef.current.forEach(clearTimeout);
      pendingTimeoutsRef.current.clear();
      
      // Clear all pending intervals
      pendingIntervalsRef.current.forEach(clearInterval);
      pendingIntervalsRef.current.clear();
    };
  }, []);

  /**
   * Check if component is still mounted
   */
  const isMounted = useCallback(() => isMountedRef.current, []);

  /**
   * Get a fresh AbortController, aborting any previous one
   */
  const getAbortController = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    return abortControllerRef.current;
  }, []);

  /**
   * Get the abort signal for fetch requests
   */
  const getAbortSignal = useCallback(() => {
    return getAbortController().signal;
  }, [getAbortController]);

  /**
   * Abort any pending requests
   */
  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  /**
   * Safe setTimeout that auto-clears on unmount
   */
  const safeTimeout = useCallback((callback: () => void, delay: number) => {
    const timeoutId = setTimeout(() => {
      pendingTimeoutsRef.current.delete(timeoutId);
      if (isMountedRef.current) {
        callback();
      }
    }, delay);
    pendingTimeoutsRef.current.add(timeoutId);
    return timeoutId;
  }, []);

  /**
   * Safe setInterval that auto-clears on unmount
   */
  const safeInterval = useCallback((callback: () => void, delay: number) => {
    const intervalId = setInterval(() => {
      if (isMountedRef.current) {
        callback();
      }
    }, delay);
    pendingIntervalsRef.current.add(intervalId);
    return intervalId;
  }, []);

  /**
   * Clear a specific timeout
   */
  const clearSafeTimeout = useCallback((timeoutId: ReturnType<typeof setTimeout>) => {
    clearTimeout(timeoutId);
    pendingTimeoutsRef.current.delete(timeoutId);
  }, []);

  /**
   * Clear a specific interval
   */
  const clearSafeInterval = useCallback((intervalId: ReturnType<typeof setInterval>) => {
    clearInterval(intervalId);
    pendingIntervalsRef.current.delete(intervalId);
  }, []);

  /**
   * Safe state setter wrapper - only calls setState if mounted
   */
  const safeSetState = useCallback(<T>(
    setState: React.Dispatch<React.SetStateAction<T>>,
    value: React.SetStateAction<T>
  ) => {
    if (isMountedRef.current) {
      setState(value);
    }
  }, []);

  /**
   * Run an async function safely with mount checking
   * Automatically catches and ignores AbortErrors
   */
  const safeAsync = useCallback(<T>(
    asyncFn: () => Promise<T>,
    onSuccess?: (result: T) => void,
    onError?: (error: Error) => void
  ): void => {
    asyncFn()
      .then((result) => {
        if (isMountedRef.current && onSuccess) {
          onSuccess(result);
        }
      })
      .catch((error) => {
        // Ignore abort errors - these are expected during navigation
        if (isAbortError(error)) return;
        if (isMountedRef.current && onError) {
          onError(error);
        }
      });
  }, []);

  /**
   * Run an async function with automatic abort signal
   */
  const safeAsyncWithAbort = useCallback(<T>(
    asyncFn: (signal: AbortSignal) => Promise<T>,
    onSuccess?: (result: T) => void,
    onError?: (error: Error) => void
  ): void => {
    const signal = getAbortSignal();
    
    asyncFn(signal)
      .then((result) => {
        if (isMountedRef.current && onSuccess) {
          onSuccess(result);
        }
      })
      .catch((error) => {
        // Ignore abort errors
        if (isAbortError(error)) return;
        if (isMountedRef.current && onError) {
          onError(error);
        }
      });
  }, [getAbortSignal]);

  return {
    isMounted,
    isMountedRef,
    getAbortController,
    getAbortSignal,
    abort,
    safeTimeout,
    safeInterval,
    clearSafeTimeout,
    clearSafeInterval,
    safeSetState,
    safeAsync,
    safeAsyncWithAbort,
  };
}

/**
 * Check if an error is an AbortError (should be silently ignored)
 */
export function isAbortError(error: unknown): boolean {
  if (!error) return false;
  
  if (error instanceof Error) {
    if (error.name === 'AbortError') return true;
    if (error.message?.includes('aborted')) return true;
    if (error.message?.includes('AbortError')) return true;
  }
  
  if (typeof error === 'object' && error !== null) {
    const e = error as Record<string, unknown>;
    if (e.name === 'AbortError') return true;
    if (typeof e.message === 'string' && e.message.includes('aborted')) return true;
  }
  
  return false;
}

/**
 * Lightweight version for simple components that only need mount checking
 */
export function useMountSafe() {
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const isMounted = useCallback(() => isMountedRef.current, []);

  const safeSetState = useCallback(<T>(
    setState: React.Dispatch<React.SetStateAction<T>>,
    value: React.SetStateAction<T>
  ) => {
    if (isMountedRef.current) {
      setState(value);
    }
  }, []);

  return { isMounted, isMountedRef, safeSetState };
}

/**
 * Hook for safe state that checks mount status before updates
 */
export function useSafeState<T>(initialValue: T): [T, (value: React.SetStateAction<T>) => void] {
  const [state, setState] = useState<T>(initialValue);
  const isMountedRef = useRef(true);
  
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  const safeSetState = useCallback((value: React.SetStateAction<T>) => {
    if (isMountedRef.current) {
      setState(value);
    }
  }, []);
  
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
