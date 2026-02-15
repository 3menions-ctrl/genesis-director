/**
 * Centralized Stability Monitor
 * 
 * Production-grade error tracking, performance monitoring,
 * and automatic recovery patterns for app-wide stability.
 */

import { toast } from 'sonner';

// Error classification for targeted recovery
export type ErrorCategory =
  | 'NETWORK'
  | 'AUTH'
  | 'RENDER'
  | 'ASYNC_RACE'
  | 'STATE_CORRUPTION'
  | 'TIMEOUT'
  | 'UNKNOWN';

export interface StabilityEvent {
  id: string;
  category: ErrorCategory;
  message: string;
  stack?: string;
  componentName?: string;
  route?: string;
  timestamp: number;
  recovered: boolean;
  recoveryAction?: string;
}

// In-memory event log (capped at 50 events)
const eventLog: StabilityEvent[] = [];
const MAX_EVENTS = 50;

// Error pattern detection
const errorPatterns: Map<string, number> = new Map();
const PATTERN_THRESHOLD = 3;
const PATTERN_WINDOW_MS = 60000;

/**
 * Classify error into actionable category
 */
export function classifyError(error: unknown): ErrorCategory {
  if (!error) return 'UNKNOWN';

  const message = error instanceof Error ? error.message : String(error);
  const lowered = message.toLowerCase();

  // Network errors
  if (
    lowered.includes('failed to fetch') ||
    lowered.includes('networkerror') ||
    lowered.includes('net::err') ||
    lowered.includes('connection refused')
  ) {
    return 'NETWORK';
  }

  // Auth errors
  if (
    lowered.includes('session') ||
    lowered.includes('auth') ||
    lowered.includes('unauthorized') ||
    lowered.includes('jwt')
  ) {
    return 'AUTH';
  }

  // Timeout errors
  if (lowered.includes('timeout') || lowered.includes('timed out')) {
    return 'TIMEOUT';
  }

  // Async race conditions
  if (
    lowered.includes('unmounted') ||
    lowered.includes('cannot update a component') ||
    lowered.includes('state update on an unmounted')
  ) {
    return 'ASYNC_RACE';
  }

  // Render errors - TIGHTENED: 'ref' alone is too broad
  if (
    lowered.includes('render') ||
    lowered.includes('hydration')
  ) {
    return 'RENDER';
  }

  // State corruption
  if (
    lowered.includes('undefined is not') ||
    lowered.includes('null is not') ||
    lowered.includes('cannot read properties')
  ) {
    return 'STATE_CORRUPTION';
  }

  return 'UNKNOWN';
}

/**
 * Get recovery suggestion based on error category
 */
export function getRecoverySuggestion(category: ErrorCategory): string {
  switch (category) {
    case 'NETWORK':
      return 'Check your internet connection and try again.';
    case 'AUTH':
      return 'Your session may have expired. Try signing in again.';
    case 'TIMEOUT':
      return 'The operation took too long. Please try again.';
    case 'ASYNC_RACE':
      return 'Navigation interrupted an operation. This is usually harmless.';
    case 'RENDER':
      return 'A display error occurred. Refreshing may help.';
    case 'STATE_CORRUPTION':
      return 'Data inconsistency detected. Refreshing may resolve this.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

/**
 * Check if error should be silently suppressed
 * TIGHTENED list - only specific, unambiguous non-fatal errors
 * FIX: Removed overly broad patterns that masked real crashes
 */
export function shouldSuppressError(error: unknown): boolean {
  if (!error) return true;

  const message = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : '';
  const lowered = message.toLowerCase();

  // AbortController errors (normal during navigation)
  if (name === 'AbortError') return true;
  if (lowered.includes('aborterror')) return true;
  if (lowered.includes('the operation was aborted')) return true;
  if (lowered.includes('signal is aborted')) return true;

  // ResizeObserver loop errors (browser quirk)
  if (lowered.includes('resizeobserver loop')) return true;

  // Chunk loading errors (network issues) - handled by recovery system
  if (lowered.includes('chunkloaderror')) return true;
  if (lowered.includes('loading chunk')) return true;
  if (lowered.includes('failed to fetch dynamically imported module')) return true;

  // Video/Media playback interruptions - specific patterns only
  if (lowered.includes('play() request was interrupted')) return true;
  if (lowered.includes('the play() request was interrupted')) return true;

  // React state updates on unmounted - warning, not crash
  if (lowered.includes("can't perform a react state update on an unmounted")) return true;
  if (lowered.includes('state update on an unmounted')) return true;

  // Network failures - should show toast, not crash
  if (lowered.includes('failed to fetch')) return true;
  if (lowered.includes('networkerror')) return true;
  if (lowered.includes('load failed')) return true;

  // Non-error promise rejections
  if (lowered.includes('non-error promise rejection')) return true;

  return false;
}

/**
 * Log stability event with pattern detection
 */
export function logStabilityEvent(
  category: ErrorCategory,
  message: string,
  options?: {
    stack?: string;
    componentName?: string;
    route?: string;
    recovered?: boolean;
    recoveryAction?: string;
    silent?: boolean;
  }
): StabilityEvent {
  const event: StabilityEvent = {
    id: crypto.randomUUID(),
    category,
    message,
    stack: options?.stack,
    componentName: options?.componentName,
    route: options?.route || window.location.pathname,
    timestamp: Date.now(),
    recovered: options?.recovered ?? false,
    recoveryAction: options?.recoveryAction,
  };

  // Add to log (FIFO)
  eventLog.push(event);
  if (eventLog.length > MAX_EVENTS) {
    eventLog.shift();
  }

  // Pattern detection
  const patternKey = `${category}:${message.slice(0, 50)}`;
  const now = Date.now();
  
  // Clean old patterns
  errorPatterns.forEach((timestamp, key) => {
    if (now - timestamp > PATTERN_WINDOW_MS) {
      errorPatterns.delete(key);
    }
  });

  const patternCount = Array.from(errorPatterns.keys())
    .filter(k => k === patternKey).length + 1;

  errorPatterns.set(`${patternKey}:${now}`, now);

  // Warn on repeated patterns
  if (patternCount >= PATTERN_THRESHOLD && !options?.silent) {
    console.warn(
      `[StabilityMonitor] Repeated error pattern detected (${patternCount}x): ${category}`
    );
  }

  // Console logging for debugging
  if (process.env.NODE_ENV === 'development') {
    console.group(`[Stability] ${category}`);
    console.log('Message:', message);
    if (options?.componentName) console.log('Component:', options.componentName);
    if (options?.stack) console.log('Stack:', options.stack);
    console.groupEnd();
  }

  return event;
}

/**
 * Handle error with appropriate user feedback
 */
export function handleStabilityError(
  error: unknown,
  context?: string,
  options?: {
    showToast?: boolean;
    silent?: boolean;
  }
): StabilityEvent | null {
  if (shouldSuppressError(error)) {
    return null;
  }

  const category = classifyError(error);
  const message = error instanceof Error ? error.message : String(error);

  const event = logStabilityEvent(category, message, {
    stack: error instanceof Error ? error.stack : undefined,
    componentName: context,
    silent: options?.silent,
  });

  // Show user-friendly toast
  if (options?.showToast !== false && !options?.silent) {
    const suggestion = getRecoverySuggestion(category);
    
    // Don't spam toasts for race conditions
    if (category !== 'ASYNC_RACE') {
      toast.error('Something went wrong. Please try again.', {
        description: suggestion,
        duration: 5000,
      });
    }
  }

  return event;
}

/**
 * Get recent stability events (for debugging UI)
 */
export function getRecentEvents(limit = 10): StabilityEvent[] {
  return eventLog.slice(-limit);
}

/**
 * Get stability health score (0-100)
 */
export function getHealthScore(): number {
  const recentWindow = Date.now() - 300000; // Last 5 minutes
  const recentErrors = eventLog.filter(e => e.timestamp > recentWindow);
  
  if (recentErrors.length === 0) return 100;
  
  // Deduct points based on severity
  let score = 100;
  recentErrors.forEach(e => {
    switch (e.category) {
      case 'RENDER':
      case 'STATE_CORRUPTION':
        score -= 20;
        break;
      case 'NETWORK':
      case 'TIMEOUT':
        score -= 10;
        break;
      case 'ASYNC_RACE':
        score -= 2; // Minor, expected during navigation
        break;
      default:
        score -= 5;
    }
  });

  return Math.max(0, score);
}

/**
 * Create a timeout wrapper for async operations
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName = 'Operation'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${operationName} timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    ),
  ]);
}

/**
 * Create a safe async executor with automatic cleanup
 */
export function createSafeExecutor(abortSignal?: AbortSignal) {
  let isCancelled = false;

  if (abortSignal) {
    abortSignal.addEventListener('abort', () => {
      isCancelled = true;
    });
  }

  return {
    isCancelled: () => isCancelled,
    cancel: () => { isCancelled = true; },
    execute: async <T>(
      fn: () => Promise<T>,
      options?: { onError?: (e: Error) => void }
    ): Promise<T | null> => {
      if (isCancelled) return null;

      try {
        const result = await fn();
        if (isCancelled) return null;
        return result;
      } catch (error) {
        if (isCancelled) return null;
        if (error instanceof Error && error.name === 'AbortError') return null;
        
        if (options?.onError) {
          options.onError(error as Error);
        }
        return null;
      }
    },
  };
}

/**
 * Defensive state updater - only updates if mounted
 */
export function createDefensiveUpdater<T>(
  setState: React.Dispatch<React.SetStateAction<T>>,
  isMountedRef: React.MutableRefObject<boolean>
) {
  return (value: React.SetStateAction<T>) => {
    if (isMountedRef.current) {
      setState(value);
    }
  };
}

// Export singleton for global access
export const stabilityMonitor = {
  classify: classifyError,
  log: logStabilityEvent,
  handle: handleStabilityError,
  getEvents: getRecentEvents,
  getHealth: getHealthScore,
  withTimeout,
  createSafeExecutor,
  createDefensiveUpdater,
};
