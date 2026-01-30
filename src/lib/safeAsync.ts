import { useRef, useEffect, useCallback } from 'react';

/**
 * Hook that returns a ref tracking if component is mounted.
 * Use this to guard async operations from updating state after unmount.
 */
export function useIsMounted() {
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return isMountedRef;
}

/**
 * Hook that provides an AbortController that automatically aborts on unmount.
 * Use for fetch requests and other cancellable async operations.
 */
export function useAbortController() {
  const abortControllerRef = useRef<AbortController | null>(null);

  const getController = useCallback(() => {
    // Abort any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    return abortControllerRef.current;
  }, []);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return { getController, abort, controllerRef: abortControllerRef };
}

/**
 * Creates a safe async function that checks isMounted before each state update.
 * Wraps any async operation to prevent state updates after unmount.
 */
export function useSafeAsync() {
  const isMountedRef = useIsMounted();

  const safeAsync = useCallback(<T>(
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
        // Ignore abort errors
        if (error?.name === 'AbortError') return;
        if (isMountedRef.current && onError) {
          onError(error);
        }
      });
  }, [isMountedRef]);

  const isMounted = useCallback(() => isMountedRef.current, [isMountedRef]);

  return { safeAsync, isMounted, isMountedRef };
}

/**
 * Type-safe wrapper for setState that checks isMounted first.
 * Returns a safe version of the setState function.
 */
export function createSafeSetState<T>(
  setState: React.Dispatch<React.SetStateAction<T>>,
  isMountedRef: React.RefObject<boolean>
): React.Dispatch<React.SetStateAction<T>> {
  return (value: React.SetStateAction<T>) => {
    if (isMountedRef.current) {
      setState(value);
    }
  };
}
