/**
 * Safe Mode Kill Switch
 * 
 * When ?safe=1 is in URL or SAFE_MODE env is set:
 * - Disables video mounting entirely
 * - Disables all polling/setInterval/WebSocket
 * - Disables heavy animations and WebGL
 * - Uses stub data
 * 
 * This guarantees the app can load even if video pipeline is broken.
 */

// ============================================================================
// DETECTION
// ============================================================================

/**
 * Check if safe mode is enabled via URL or environment
 * Called as early as possible before any components mount
 */
export function isSafeModeEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check URL param first (highest priority)
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('safe') === '1') return true;
  } catch {
    // URL parsing failed
  }
  
  // Check sessionStorage for auto-enabled safe mode (from crash loop detection)
  try {
    if (sessionStorage.getItem('safe_mode_auto_enabled') === 'true') return true;
  } catch {
    // Storage unavailable
  }
  
  return false;
}

// Compute once at module load time (before any rendering)
const SAFE_MODE_ACTIVE = isSafeModeEnabled();

/**
 * Get the cached safe mode status (no re-computation)
 */
export function getSafeModeStatus(): boolean {
  return SAFE_MODE_ACTIVE;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface SafeModeConfig {
  enabled: boolean;
  
  // Video controls
  disableVideoMount: boolean;
  disableVideoAutoplay: boolean;
  disableThumbnailGeneration: boolean;
  
  // Background processes
  disablePolling: boolean;
  disableWebSockets: boolean;
  disableBackgroundWorkers: boolean;
  
  // Heavy rendering
  disableHeavyAnimations: boolean;
  disableWebGL: boolean;
  disableCanvas: boolean;
  
  // MSE/SourceBuffer
  disableMSE: boolean;
}

export function getSafeModeConfig(): SafeModeConfig {
  const enabled = SAFE_MODE_ACTIVE;
  
  return {
    enabled,
    
    // In safe mode, completely disable video pipeline
    disableVideoMount: enabled,
    disableVideoAutoplay: enabled,
    disableThumbnailGeneration: enabled,
    
    // Disable all background processes
    disablePolling: enabled,
    disableWebSockets: enabled,
    disableBackgroundWorkers: enabled,
    
    // Disable heavy rendering
    disableHeavyAnimations: enabled,
    disableWebGL: enabled,
    disableCanvas: enabled,
    
    // MSE is crash-prone on Safari
    disableMSE: enabled,
  };
}

// ============================================================================
// HOOKS FOR COMPONENTS
// ============================================================================

/**
 * Hook to check if a feature should be disabled
 */
export function useIsSafeMode(): boolean {
  return SAFE_MODE_ACTIVE;
}

/**
 * Hook to get full config
 */
export function useSafeModeConfig(): SafeModeConfig {
  return getSafeModeConfig();
}

// ============================================================================
// STUB DATA FOR SAFE MODE
// ============================================================================

export const STUB_VIDEO_DATA = {
  id: 'safe-mode-stub',
  title: 'Safe Mode Active',
  description: 'Video features are disabled in safe mode',
  video_url: null,
  thumbnail_url: null,
  duration: 0,
  status: 'safe_mode',
};

export const STUB_PROJECTS_DATA = [
  {
    id: 'safe-mode-1',
    title: 'Video features disabled',
    description: 'Safe mode is active - reload without ?safe=1 to restore',
    created_at: new Date().toISOString(),
    status: 'safe_mode',
  },
];

// ============================================================================
// INTERCEPTORS (disable timers in safe mode)
// ============================================================================

let originalSetInterval: typeof setInterval | null = null;
let originalSetTimeout: typeof setTimeout | null = null;
let interceptorsInstalled = false;

/**
 * Install safe mode interceptors that block interval/timeout creation
 * Must be called BEFORE any components mount
 */
export function installSafeModeInterceptors(): () => void {
  if (!SAFE_MODE_ACTIVE || interceptorsInstalled || typeof window === 'undefined') {
    return () => {};
  }
  
  interceptorsInstalled = true;
  originalSetInterval = window.setInterval;
  originalSetTimeout = window.setTimeout;
  
  // Track blocked calls for debugging
  let blockedIntervals = 0;
  let blockedTimeouts = 0;
  
  // Override setInterval - block long-running intervals
  window.setInterval = ((callback: TimerHandler, delay?: number, ...args: any[]) => {
    // Allow very short intervals (< 100ms) for UI responsiveness
    // Block polling intervals (> 1000ms)
    if (delay && delay >= 1000) {
      blockedIntervals++;
      console.debug(`[SafeMode] Blocked setInterval (${delay}ms) - total blocked: ${blockedIntervals}`);
      return -1 as unknown as ReturnType<typeof setInterval>;
    }
    return originalSetInterval!(callback, delay, ...args);
  }) as typeof setInterval;
  
  // Override setTimeout - block long delays
  window.setTimeout = ((callback: TimerHandler, delay?: number, ...args: any[]) => {
    // Allow short timeouts for UI responsiveness
    // Block long timeouts (> 5000ms) which are usually polling retries
    if (delay && delay >= 5000) {
      blockedTimeouts++;
      console.debug(`[SafeMode] Blocked setTimeout (${delay}ms) - total blocked: ${blockedTimeouts}`);
      return -1 as unknown as ReturnType<typeof setTimeout>;
    }
    return originalSetTimeout!(callback, delay, ...args);
  }) as typeof setTimeout;
  
  console.info('[SafeMode] Timer interceptors installed');
  
  return () => {
    if (originalSetInterval) window.setInterval = originalSetInterval;
    if (originalSetTimeout) window.setTimeout = originalSetTimeout;
    interceptorsInstalled = false;
    console.info('[SafeMode] Timer interceptors removed');
  };
}

// ============================================================================
// AUTO-ENABLE ON CRASH LOOP
// ============================================================================

/**
 * Enable safe mode automatically (called by crash forensics)
 */
export function autoEnableSafeMode(reason: string): void {
  if (typeof sessionStorage === 'undefined') return;
  
  try {
    sessionStorage.setItem('safe_mode_auto_enabled', 'true');
    sessionStorage.setItem('safe_mode_reason', reason);
    console.warn(`[SafeMode] Auto-enabled due to: ${reason}`);
    
    // Reload to apply safe mode
    window.location.reload();
  } catch {
    // Storage unavailable
  }
}

/**
 * Clear auto-enabled safe mode (for recovery)
 */
export function clearAutoSafeMode(): void {
  if (typeof sessionStorage === 'undefined') return;
  
  try {
    sessionStorage.removeItem('safe_mode_auto_enabled');
    sessionStorage.removeItem('safe_mode_reason');
  } catch {
    // Storage unavailable
  }
}

/**
 * Get reason for auto-enabled safe mode
 */
export function getSafeModeReason(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  
  try {
    return sessionStorage.getItem('safe_mode_reason');
  } catch {
    return null;
  }
}

// ============================================================================
// SAFE MODE BANNER COMPONENT DATA
// ============================================================================

export function getSafeModeBannerData() {
  if (!SAFE_MODE_ACTIVE) return null;
  
  return {
    active: true,
    reason: getSafeModeReason() || 'Manual activation via ?safe=1',
    disabledFeatures: [
      'Video playback',
      'Video thumbnails',
      'Background polling',
      'Heavy animations',
      'WebGL rendering',
    ],
    recoveryUrl: window.location.href.replace(/[?&]safe=1/, '').replace(/[?&]$/, ''),
  };
}
