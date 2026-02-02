/**
 * Unified Navigation Hooks - Single Source of Truth
 * 
 * This module consolidates ALL stability/navigation hooks into one canonical API.
 * Replaces: useNavigationGuard, useStabilityGuard, useMountSafe, useMountGuard
 * 
 * MIGRATION: Import from '@/lib/navigation' instead of individual hook files
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { navigationCoordinator, CleanupFunction } from './NavigationCoordinator';

// ============= Core Mount Safety =============

/**
 * Lightweight mount tracking - use when you only need isMounted checks
 * This is the simplest stability primitive.
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
    setter: React.Dispatch<React.SetStateAction<T>>,
    value: React.SetStateAction<T>
  ) => {
    if (isMountedRef.current) {
      setter(value);
    }
  }, []);

  return { safeSetState, isMounted, isMountedRef };
}

// ============= Full Stability Guard =============

interface StabilityGuardReturn {
  // Mount tracking
  isMounted: () => boolean;
  isMountedRef: React.RefObject<boolean>;
  safeSetState: <T>(setter: React.Dispatch<React.SetStateAction<T>>, value: React.SetStateAction<T>) => void;
  
  // AbortController (coordinated with NavigationCoordinator)
  getAbortController: () => AbortController;
  getAbortSignal: () => AbortSignal;
  abort: () => void;
  
  // Safe timers
  safeTimeout: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  safeInterval: (callback: () => void, delay: number) => ReturnType<typeof setInterval>;
  clearSafeTimeout: (id: ReturnType<typeof setTimeout>) => void;
  clearSafeInterval: (id: ReturnType<typeof setInterval>) => void;
  
  // Safe async
  safeAsync: <T>(fn: () => Promise<T>, onSuccess?: (r: T) => void, onError?: (e: Error) => void) => void;
  safeAsyncWithAbort: <T>(fn: (signal: AbortSignal) => Promise<T>, onSuccess?: (r: T) => void, onError?: (e: Error) => void) => void;
}

/**
 * Full stability guard with coordinated abort management.
 * This is the comprehensive solution for components with async operations.
 * 
 * All AbortControllers are registered with NavigationCoordinator for
 * automatic abortion during navigation.
 */
export function useStabilityGuard(): StabilityGuardReturn {
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingTimeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const pendingIntervalsRef = useRef<Set<ReturnType<typeof setInterval>>>(new Set());

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      
      // Abort pending fetch
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      // Clear timers
      pendingTimeoutsRef.current.forEach(clearTimeout);
      pendingTimeoutsRef.current.clear();
      pendingIntervalsRef.current.forEach(clearInterval);
      pendingIntervalsRef.current.clear();
    };
  }, []);

  const isMounted = useCallback(() => isMountedRef.current, []);

  // Use coordinator-managed AbortController
  const getAbortController = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    // Create via coordinator so it gets aborted on navigation
    abortControllerRef.current = navigationCoordinator.createAbortController();
    return abortControllerRef.current;
  }, []);

  const getAbortSignal = useCallback(() => {
    return getAbortController().signal;
  }, [getAbortController]);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const safeTimeout = useCallback((callback: () => void, delay: number) => {
    const id = setTimeout(() => {
      pendingTimeoutsRef.current.delete(id);
      if (isMountedRef.current) callback();
    }, delay);
    pendingTimeoutsRef.current.add(id);
    return id;
  }, []);

  const safeInterval = useCallback((callback: () => void, delay: number) => {
    const id = setInterval(() => {
      if (isMountedRef.current) callback();
    }, delay);
    pendingIntervalsRef.current.add(id);
    return id;
  }, []);

  const clearSafeTimeout = useCallback((id: ReturnType<typeof setTimeout>) => {
    clearTimeout(id);
    pendingTimeoutsRef.current.delete(id);
  }, []);

  const clearSafeInterval = useCallback((id: ReturnType<typeof setInterval>) => {
    clearInterval(id);
    pendingIntervalsRef.current.delete(id);
  }, []);

  const safeSetState = useCallback(<T>(
    setter: React.Dispatch<React.SetStateAction<T>>,
    value: React.SetStateAction<T>
  ) => {
    if (isMountedRef.current) {
      setter(value);
    }
  }, []);

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
        if (isAbortError(error)) return;
        if (isMountedRef.current && onError) {
          onError(error);
        }
      });
  }, []);

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
        if (isAbortError(error)) return;
        if (isMountedRef.current && onError) {
          onError(error);
        }
      });
  }, [getAbortSignal]);

  return {
    isMounted,
    isMountedRef: isMountedRef as React.RefObject<boolean>,
    safeSetState,
    getAbortController,
    getAbortSignal,
    abort,
    safeTimeout,
    safeInterval,
    clearSafeTimeout,
    clearSafeInterval,
    safeAsync,
    safeAsyncWithAbort,
  };
}

// ============= Navigation-Aware Hooks =============

/**
 * Register cleanup that runs on route exit AND component unmount.
 * Cleanup is coordinated with NavigationCoordinator.
 */
export function useRouteCleanup(cleanup: CleanupFunction, deps: unknown[] = []): void {
  const location = useLocation();
  const cleanupRef = useRef(cleanup);
  
  useEffect(() => {
    cleanupRef.current = cleanup;
  }, [cleanup, ...deps]);

  useEffect(() => {
    const currentPath = location.pathname;
    
    const unregister = navigationCoordinator.registerCleanup(
      currentPath,
      () => cleanupRef.current()
    );

    return () => {
      unregister();
      try {
        const result = cleanupRef.current();
        if (result instanceof Promise) {
          result.catch(() => {});
        }
      } catch {
        // Ignore
      }
    };
  }, [location.pathname]);
}

/**
 * Safe navigation hook that respects navigation locking.
 * Prevents double-navigation race conditions.
 */
export function useSafeNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const pendingNavRef = useRef<string | null>(null);

  const safeNavigate = useCallback(async (
    to: string, 
    options?: { replace?: boolean; skipLock?: boolean }
  ): Promise<boolean> => {
    if (pendingNavRef.current === to) return false;

    if (!options?.skipLock) {
      const canNavigate = await navigationCoordinator.beginNavigation(
        location.pathname,
        to
      );
      if (!canNavigate) {
        console.debug('[useSafeNavigation] Navigation rejected (locked)');
        return false;
      }
    }

    pendingNavRef.current = to;

    try {
      navigate(to, { replace: options?.replace });
      return true;
    } finally {
      requestAnimationFrame(() => {
        pendingNavRef.current = null;
      });
    }
  }, [navigate, location.pathname]);

  const emergencyNavigate = useCallback((to: string) => {
    navigationCoordinator.forceUnlock();
    navigate(to, { replace: true });
  }, [navigate]);

  return {
    navigate: safeNavigate,
    emergencyNavigate,
    isLocked: navigationCoordinator.isLocked(),
  };
}

/**
 * Get a managed AbortController that aborts on navigation and unmount.
 */
export function useNavigationAbort() {
  const controllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  const getController = useCallback((): AbortController => {
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    controllerRef.current = navigationCoordinator.createAbortController();
    return controllerRef.current;
  }, []);

  const getSignal = useCallback((): AbortSignal => {
    if (!controllerRef.current) {
      controllerRef.current = navigationCoordinator.createAbortController();
    }
    return controllerRef.current.signal;
  }, []);

  const abort = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
  }, []);

  const isMounted = useCallback(() => isMountedRef.current, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abort();
    };
  }, [abort]);

  return { getController, getSignal, abort, isMounted };
}

/**
 * Navigation-safe async execution.
 * Automatically cancels on navigation/unmount.
 */
export function useNavigationSafeAsync() {
  const { getSignal, isMounted } = useNavigationAbort();

  const safeAsync = useCallback(<T>(
    asyncFn: (signal: AbortSignal) => Promise<T>
  ): Promise<T | null> => {
    const signal = getSignal();
    
    return asyncFn(signal)
      .then(result => {
        if (!isMounted()) return null;
        return result;
      })
      .catch(err => {
        if (err?.name === 'AbortError') return null;
        if (isMounted()) throw err;
        return null;
      });
  }, [getSignal, isMounted]);

  return safeAsync;
}

/**
 * Automatically pause and cleanup media elements on unmount.
 */
export function useMediaCleanup(
  mediaRef: React.RefObject<HTMLVideoElement | HTMLAudioElement | null>
): void {
  useEffect(() => {
    const element = mediaRef.current;
    if (!element) return;

    navigationCoordinator.registerMediaElement(element);

    return () => {
      try {
        if (!element.paused) {
          element.pause();
        }
      } catch {
        // Element may be destroyed
      }
    };
  }, [mediaRef]);
}

/**
 * Safe state hook with mount checking built-in.
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
 * Debounced value with cleanup.
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  
  return debouncedValue;
}

// ============= Utilities =============

/**
 * Check if error is an AbortError that should be silently ignored.
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

// ============= Legacy Aliases =============
// These provide backward compatibility during migration

/** @deprecated Use useStabilityGuard instead */
export const useNavigationGuard = useStabilityGuard;

/** @deprecated Use useMountSafe instead */
export const useMountGuard = useMountSafe;
