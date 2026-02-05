 /**
  * useStablePageMount - Consolidated Page Stability Hook
  * 
  * SINGLE HOOK to replace scattered stability patterns across pages.
  * Combines:
  * - Unconditional hook ordering (prevents hook count mismatches)
  * - Mount-safe state management
  * - Navigation abort handling
  * - Cleanup registration
  * 
  * Usage:
  * ```tsx
  * function MyPage() {
  *   // ALWAYS call at the TOP, before any other hooks
  *   const { isMounted, safeSetState, abortSignal, cleanup } = useStablePageMount('MyPage');
  *   
  *   // Now safe to use other hooks
  *   const [data, setData] = useState(null);
  *   
  *   useEffect(() => {
  *     fetchData(abortSignal).then(d => safeSetState(setData, d));
  *     return cleanup;
  *   }, []);
  * }
  * ```
  */
 
 import { useRef, useEffect, useCallback, useId } from 'react';
 import { useLocation } from 'react-router-dom';
 import { navigationCoordinator } from '@/lib/navigation';
 
 interface StablePageMountReturn {
   /** Check if component is still mounted */
   isMounted: () => boolean;
   /** Ref for direct access to mount state */
   isMountedRef: React.RefObject<boolean>;
   /** Safe setState that only updates if mounted */
   safeSetState: <T>(setter: React.Dispatch<React.SetStateAction<T>>, value: React.SetStateAction<T>) => void;
   /** AbortSignal that aborts on unmount/navigation */
   abortSignal: AbortSignal;
   /** Manual abort function */
   abort: () => void;
   /** Cleanup function to call in useEffect returns */
   cleanup: () => void;
   /** Unique component ID for tracking */
   componentId: string;
   /** Current route path */
   currentPath: string;
 }
 
export type { StablePageMountReturn };

 /**
  * Provides comprehensive stability primitives for page components.
  * MUST be called at the top of the component, before any conditional logic.
  * 
  * @param pageId - Identifier for debugging (e.g., 'AvatarsPage')
  */
 export function useStablePageMount(pageId: string): StablePageMountReturn {
   // CRITICAL: All hooks called unconditionally at top level
   const location = useLocation();
   const componentId = useId();
   const isMountedRef = useRef(true);
   const abortControllerRef = useRef<AbortController | null>(null);
   const cleanupFnsRef = useRef<(() => void)[]>([]);
   const isCleanedUpRef = useRef(false);
 
   // Create managed abort controller on mount
   useEffect(() => {
     isMountedRef.current = true;
     isCleanedUpRef.current = false;
     
     // Create abort controller via coordinator for navigation integration
     abortControllerRef.current = navigationCoordinator.createAbortController();
     
     return () => {
       isMountedRef.current = false;
       isCleanedUpRef.current = true;
       
       // Abort any pending requests
       if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
         abortControllerRef.current.abort();
       }
       abortControllerRef.current = null;
       
       // Run all registered cleanup functions
       cleanupFnsRef.current.forEach(fn => {
         try {
           fn();
         } catch (err) {
           console.debug(`[${pageId}] Cleanup error:`, err);
         }
       });
       cleanupFnsRef.current = [];
       
       // Cleanup component resources via coordinator
       navigationCoordinator.cleanupComponent(componentId);
     };
   }, [componentId, pageId]);
 
   // Stable isMounted check
   const isMounted = useCallback(() => isMountedRef.current, []);
 
   // Safe setState wrapper
   const safeSetState = useCallback(<T>(
     setter: React.Dispatch<React.SetStateAction<T>>,
     value: React.SetStateAction<T>
   ) => {
     if (isMountedRef.current && !isCleanedUpRef.current) {
       setter(value);
     }
   }, []);
 
   // Get abort signal (creates new controller if needed)
   const getAbortSignal = useCallback((): AbortSignal => {
     if (!abortControllerRef.current || abortControllerRef.current.signal.aborted) {
       abortControllerRef.current = navigationCoordinator.createAbortController();
     }
     return abortControllerRef.current.signal;
   }, []);
 
   // Manual abort
   const abort = useCallback(() => {
     if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
       abortControllerRef.current.abort();
     }
   }, []);
 
   // Cleanup function that can be returned from useEffect
   const cleanup = useCallback(() => {
     abort();
     cleanupFnsRef.current.forEach(fn => {
       try {
         fn();
       } catch {
         // Ignore cleanup errors
       }
     });
     cleanupFnsRef.current = [];
   }, [abort]);
 
   return {
     isMounted,
     isMountedRef: isMountedRef as React.RefObject<boolean>,
     safeSetState,
     abortSignal: getAbortSignal(),
     abort,
     cleanup,
     componentId,
     currentPath: location.pathname,
   };
 }
 
 /**
  * Register a cleanup function to run on unmount
  */
 export function useRegisterCleanup(fn: () => void, deps: unknown[] = []): void {
   const location = useLocation();
   const fnRef = useRef(fn);
   
   useEffect(() => {
     fnRef.current = fn;
   }, [fn, ...deps]);
 
   useEffect(() => {
     const unregister = navigationCoordinator.registerCleanup(
       location.pathname,
       () => fnRef.current()
     );
 
     return () => {
       unregister();
       try {
         fnRef.current();
       } catch {
         // Ignore
       }
     };
   }, [location.pathname]);
 }