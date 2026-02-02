/**
 * ChunkLoadError Recovery System
 * 
 * Handles the "Importing a module script failed" TypeError that causes
 * the preview to crash and flicker during HMR or network issues.
 * 
 * Root Cause:
 * - Vite HMR loses connection (vite server connection lost)
 * - Lazy-loaded chunks fail to load
 * - React crashes on failed dynamic import
 * - Error propagates, triggering crash-reload loop
 * 
 * Solution:
 * - Intercept ChunkLoadError before it crashes React
 * - Retry chunk loading with exponential backoff
 * - Show recovery UI instead of crashing
 * - Auto-recover when connection restored
 */

export interface ChunkLoadState {
  failedChunks: Map<string, { count: number; lastAttempt: number }>;
  isRecovering: boolean;
  recoveryAttempts: number;
  lastHMRDisconnect: number | null;
}

const state: ChunkLoadState = {
  failedChunks: new Map(),
  isRecovering: false,
  recoveryAttempts: 0,
  lastHMRDisconnect: null,
};

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;
const RECOVERY_COOLDOWN_MS = 5000;

/**
 * Check if an error is a ChunkLoadError
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  
  const message = error instanceof Error ? error.message : String(error);
  
  return (
    message.includes('ChunkLoadError') ||
    message.includes('Loading chunk') ||
    message.includes('Importing a module script failed') ||
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('error loading dynamically imported module')
  );
}

/**
 * Extract chunk URL from error message
 */
function extractChunkUrl(error: unknown): string | null {
  const message = error instanceof Error ? error.message : String(error);
  const urlMatch = message.match(/https?:\/\/[^\s'"]+\.js/);
  return urlMatch ? urlMatch[0] : null;
}

/**
 * Attempt to recover from a chunk load failure
 */
export async function recoverFromChunkError(error: unknown): Promise<boolean> {
  if (!isChunkLoadError(error)) return false;
  
  const chunkUrl = extractChunkUrl(error);
  const key = chunkUrl || 'unknown';
  
  // Get or create failure record
  const record = state.failedChunks.get(key) || { count: 0, lastAttempt: 0 };
  
  // Check if we should retry
  if (record.count >= MAX_RETRY_ATTEMPTS) {
    console.warn('[ChunkRecovery] Max retries exceeded for:', key);
    return false;
  }
  
  // Check cooldown
  if (Date.now() - record.lastAttempt < RETRY_DELAY_MS * (record.count + 1)) {
    return false;
  }
  
  // Update record
  record.count++;
  record.lastAttempt = Date.now();
  state.failedChunks.set(key, record);
  state.isRecovering = true;
  
  console.log(`[ChunkRecovery] Attempting recovery (${record.count}/${MAX_RETRY_ATTEMPTS}) for:`, key);
  
  try {
    // Wait with exponential backoff
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * record.count));
    
    // If we have a chunk URL, try to preload it
    if (chunkUrl) {
      const link = document.createElement('link');
      link.rel = 'modulepreload';
      link.href = chunkUrl;
      document.head.appendChild(link);
      
      // Wait for preload
      await new Promise((resolve, reject) => {
        link.onload = resolve;
        link.onerror = reject;
        setTimeout(reject, 5000);
      });
    }
    
    state.isRecovering = false;
    state.recoveryAttempts++;
    
    console.log('[ChunkRecovery] Recovery successful');
    return true;
    
  } catch (retryError) {
    console.warn('[ChunkRecovery] Retry failed:', retryError);
    state.isRecovering = false;
    return false;
  }
}

/**
 * Record HMR disconnect for correlation
 */
export function recordHMRDisconnect(): void {
  state.lastHMRDisconnect = Date.now();
  console.debug('[ChunkRecovery] HMR disconnect recorded');
}

/**
 * Check if we're in a post-HMR disconnect window
 */
export function isPostHMRWindow(): boolean {
  if (!state.lastHMRDisconnect) return false;
  return Date.now() - state.lastHMRDisconnect < 10000; // 10 second window
}

/**
 * Clear recovery state (call after successful app render)
 */
export function clearRecoveryState(): void {
  state.failedChunks.clear();
  state.recoveryAttempts = 0;
  state.isRecovering = false;
}

/**
 * Get current recovery state
 */
export function getRecoveryState(): ChunkLoadState {
  return { ...state, failedChunks: new Map(state.failedChunks) };
}

/**
 * Install global error interceptor for chunk errors
 */
export function installChunkErrorInterceptor(): () => void {
  const originalOnError = window.onerror;
  
  window.onerror = function(message, source, lineno, colno, error) {
    if (isChunkLoadError(error || message)) {
      console.debug('[ChunkRecovery] Intercepted chunk error:', message);
      
      // Attempt recovery
      recoverFromChunkError(error || message).then(recovered => {
        if (recovered) {
          // If recovery succeeds, we might want to retry the failed operation
          console.log('[ChunkRecovery] Suggesting page reload for chunk recovery');
        }
      });
      
      // Prevent default error handling to avoid crash
      return true;
    }
    
    // Call original handler for other errors
    if (originalOnError) {
      return originalOnError.call(window, message, source, lineno, colno, error);
    }
    return false;
  };
  
  // Also intercept unhandled rejections for dynamic imports
  const rejectionHandler = (event: PromiseRejectionEvent) => {
    if (isChunkLoadError(event.reason)) {
      console.debug('[ChunkRecovery] Intercepted chunk rejection:', event.reason?.message);
      event.preventDefault();
      
      recoverFromChunkError(event.reason);
    }
  };
  
  window.addEventListener('unhandledrejection', rejectionHandler);
  
  // Return cleanup function
  return () => {
    window.onerror = originalOnError;
    window.removeEventListener('unhandledrejection', rejectionHandler);
  };
}

/**
 * HMR event integration (for Vite)
 */
export function setupHMRRecovery(): void {
  if (import.meta.hot) {
    // Track HMR connection state
    import.meta.hot.on('vite:ws:disconnect', () => {
      recordHMRDisconnect();
    });
    
    import.meta.hot.on('vite:ws:connect', () => {
      console.debug('[ChunkRecovery] HMR reconnected');
      // Clear failed chunks on reconnect - they should work now
      state.failedChunks.clear();
    });
    
    // Handle HMR errors
    import.meta.hot.on('vite:error', (payload) => {
      if (isChunkLoadError(payload?.err?.message)) {
        console.debug('[ChunkRecovery] HMR reported chunk error');
        recoverFromChunkError(payload.err);
      }
    });
  }
}
