 /**
  * Concurrency utilities for managing async operations
  * 
  * Prevents race conditions and memory exhaustion from:
  * - Rapid-fire realtime subscription updates
  * - Overlapping async state updates
  * - Stale closure data
  */
 
 export { debounce, throttle, createAsyncGuard } from './debounce';
 export type { DebouncedFunction } from './debounce';