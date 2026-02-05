 /**
  * Debounce utility with cancel support
  * 
  * Used to prevent rapid-fire async operations from overwhelming the system.
  */
 
 export interface DebouncedFunction<T extends (...args: any[]) => any> {
   (...args: Parameters<T>): void;
   cancel: () => void;
   flush: () => void;
 }
 
 export function debounce<T extends (...args: any[]) => any>(
   fn: T,
   delay: number
 ): DebouncedFunction<T> {
   let timeoutId: ReturnType<typeof setTimeout> | null = null;
   let lastArgs: Parameters<T> | null = null;
 
   const debounced = (...args: Parameters<T>) => {
     lastArgs = args;
     
     if (timeoutId) {
       clearTimeout(timeoutId);
     }
     
     timeoutId = setTimeout(() => {
       timeoutId = null;
       fn(...args);
     }, delay);
   };
 
   debounced.cancel = () => {
     if (timeoutId) {
       clearTimeout(timeoutId);
       timeoutId = null;
     }
     lastArgs = null;
   };
 
   debounced.flush = () => {
     if (timeoutId && lastArgs) {
       clearTimeout(timeoutId);
       timeoutId = null;
       fn(...lastArgs);
       lastArgs = null;
     }
   };
 
   return debounced;
 }
 
 /**
  * Throttle utility - executes at most once per interval
  */
 export function throttle<T extends (...args: any[]) => any>(
   fn: T,
   interval: number
 ): (...args: Parameters<T>) => void {
   let lastExecution = 0;
   let pendingArgs: Parameters<T> | null = null;
   let timeoutId: ReturnType<typeof setTimeout> | null = null;
 
   return (...args: Parameters<T>) => {
     const now = Date.now();
     const elapsed = now - lastExecution;
 
     if (elapsed >= interval) {
       lastExecution = now;
       fn(...args);
     } else {
       // Store args for trailing execution
       pendingArgs = args;
       
       if (!timeoutId) {
         timeoutId = setTimeout(() => {
           if (pendingArgs) {
             lastExecution = Date.now();
             fn(...pendingArgs);
             pendingArgs = null;
           }
           timeoutId = null;
         }, interval - elapsed);
       }
     }
   };
 }
 
 /**
  * Creates an async operation guard that prevents concurrent executions
  * and tracks the latest call to prevent stale state updates.
  */
 export function createAsyncGuard() {
   let currentCallId = 0;
   let isRunning = false;
 
   return {
     /**
      * Wraps an async function to prevent concurrent executions
      * and verify the call is still current before using results.
      */
     wrap: async <T>(
       fn: () => Promise<T>,
       options?: { onStale?: () => void }
     ): Promise<{ result: T; isCurrent: boolean } | null> => {
       const callId = ++currentCallId;
       
       if (isRunning) {
         return null; // Reject concurrent call
       }
       
       isRunning = true;
       
       try {
         const result = await fn();
         const isCurrent = callId === currentCallId;
         
         if (!isCurrent && options?.onStale) {
           options.onStale();
         }
         
         return { result, isCurrent };
       } finally {
         isRunning = false;
       }
     },
     
     /**
      * Check if an operation with this ID is still the latest
      */
     isCurrent: (callId: number) => callId === currentCallId,
     
     /**
      * Get the current call ID for manual tracking
      */
     getCallId: () => ++currentCallId,
     
     /**
      * Reset the guard state
      */
     reset: () => {
       currentCallId++;
       isRunning = false;
     },
   };
 }