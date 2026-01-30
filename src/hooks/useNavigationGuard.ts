import { useRef, useEffect, useCallback } from 'react';

/**
 * Comprehensive navigation guard hook for fast navigation resilience.
 * Provides mount tracking, abort controllers, and safe state updates
 * to prevent crashes when users navigate quickly between pages.
 */
export function useNavigationGuard() {
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingTimeoutsRef = useRef<Set<NodeJS.Timeout>>(new Set());
  const pendingIntervalsRef = useRef<Set<NodeJS.Timeout>>(new Set());

  // Cleanup all pending operations on unmount
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
  const safeTimeout = useCallback((callback: () => void, delay: number): NodeJS.Timeout => {
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
  const safeInterval = useCallback((callback: () => void, delay: number): NodeJS.Timeout => {
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
  const clearSafeTimeout = useCallback((timeoutId: NodeJS.Timeout) => {
    clearTimeout(timeoutId);
    pendingTimeoutsRef.current.delete(timeoutId);
  }, []);

  /**
   * Clear a specific interval
   */
  const clearSafeInterval = useCallback((intervalId: NodeJS.Timeout) => {
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
        if (error?.name === 'AbortError') return;
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
        if (error?.name === 'AbortError') return;
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
 * Lightweight version for simple components that only need mount checking
 */
export function useMountGuard() {
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
 * Hook for components with polling/intervals
 */
export function usePollingGuard(callback: () => void, intervalMs: number, enabled: boolean = true) {
  const { isMounted, safeInterval, clearSafeInterval } = useNavigationGuard();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (enabled && isMounted()) {
      intervalRef.current = safeInterval(callback, intervalMs);
    }

    return () => {
      if (intervalRef.current) {
        clearSafeInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, callback, intervalMs, isMounted, safeInterval, clearSafeInterval]);
}
