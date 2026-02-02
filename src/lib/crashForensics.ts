/**
 * Crash Forensics Mode - Comprehensive crash detection and isolation
 * 
 * Provides:
 * - Boot checkpoints (A0-A3)
 * - Route change logging
 * - Retry loop detection
 * - Memory pressure signals
 * - Safe mode for crash isolation
 */

// ============================================================================
// TYPES
// ============================================================================

export interface Checkpoint {
  id: 'A0' | 'A1' | 'A2' | 'A3';
  name: string;
  timestamp: number;
  passed: boolean;
}

export interface CrashLoopEvent {
  type: 'reload' | 'navigation' | 'retry' | 'error';
  path?: string;
  count: number;
  timestamp: number;
  message?: string;
}

export interface MemorySignal {
  timestamp: number;
  domNodes: number;
  intervals: number;
  timeouts: number;
  blobUrls: number;
  videoElements: number;
}

export interface ForensicsState {
  checkpoints: Checkpoint[];
  crashLoops: CrashLoopEvent[];
  memorySignals: MemorySignal[];
  errors: Array<{ timestamp: number; message: string; stack?: string }>;
  routeChanges: Array<{ from: string; to: string; timestamp: number }>;
  safeMode: boolean;
  sessionId: string;
}

// ============================================================================
// STATE
// ============================================================================

const SESSION_ID = `cf_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

const forensicsState: ForensicsState = {
  checkpoints: [
    { id: 'A0', name: 'app boot', timestamp: 0, passed: false },
    { id: 'A1', name: 'router ready', timestamp: 0, passed: false },
    { id: 'A2', name: 'first render', timestamp: 0, passed: false },
    { id: 'A3', name: 'hydration complete', timestamp: 0, passed: false },
  ],
  crashLoops: [],
  memorySignals: [],
  errors: [],
  routeChanges: [],
  safeMode: false,
  sessionId: SESSION_ID,
};

// Track pending intervals/timeouts for memory signals
const trackedTimers = {
  intervals: new Set<number>(),
  timeouts: new Set<number>(),
};

// ============================================================================
// SAFE MODE DETECTION
// ============================================================================

export function isSafeMode(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('safe') === '1';
}

export function getSafeModeConfig() {
  const safeMode = isSafeMode();
  return {
    enabled: safeMode,
    disableVideoAutoplay: safeMode,
    disablePolling: safeMode,
    disableBackgroundWorkers: safeMode,
    disableHeavyAnimations: safeMode,
    disableWebGL: safeMode,
  };
}

// Initialize safe mode state
forensicsState.safeMode = typeof window !== 'undefined' && isSafeMode();

// ============================================================================
// CHECKPOINTS
// ============================================================================

export function markCheckpoint(id: 'A0' | 'A1' | 'A2' | 'A3'): void {
  const checkpoint = forensicsState.checkpoints.find(c => c.id === id);
  if (checkpoint && !checkpoint.passed) {
    checkpoint.passed = true;
    checkpoint.timestamp = Date.now();
    logForensic(`[Checkpoint ${id}] ${checkpoint.name} ✓`);
    
    // Persist to sessionStorage for reload detection
    persistState();
  }
}

export function getCheckpoints(): Checkpoint[] {
  return [...forensicsState.checkpoints];
}

export function allCheckpointsPassed(): boolean {
  return forensicsState.checkpoints.every(c => c.passed);
}

// ============================================================================
// CRASH LOOP DETECTION
// ============================================================================

const CRASH_LOOP_THRESHOLD = 3;
const CRASH_LOOP_WINDOW_MS = 10000;

export function recordCrashEvent(type: CrashLoopEvent['type'], details?: { path?: string; message?: string }): void {
  const now = Date.now();
  
  // Clean old events outside window
  forensicsState.crashLoops = forensicsState.crashLoops.filter(
    e => now - e.timestamp < CRASH_LOOP_WINDOW_MS
  );
  
  // Find existing event of same type/path
  const existing = forensicsState.crashLoops.find(
    e => e.type === type && e.path === details?.path
  );
  
  if (existing) {
    existing.count++;
    existing.timestamp = now;
  } else {
    forensicsState.crashLoops.push({
      type,
      path: details?.path,
      message: details?.message,
      count: 1,
      timestamp: now,
    });
  }
  
  persistState();
  
  // Check for crash loop
  const event = forensicsState.crashLoops.find(
    e => e.type === type && e.path === details?.path
  );
  
  if (event && event.count >= CRASH_LOOP_THRESHOLD) {
    logForensic(`[CRASH LOOP DETECTED] ${type} on ${details?.path || 'unknown'} (${event.count} times)`, 'error');
    
    // Trigger safe mode if not already enabled
    if (!forensicsState.safeMode && typeof window !== 'undefined') {
      logForensic('[AUTO-RECOVERY] Activating safe mode due to crash loop', 'warn');
      // Don't actually redirect - just log it
    }
  }
}

export function isCrashLoopDetected(): boolean {
  const now = Date.now();
  return forensicsState.crashLoops.some(
    e => e.count >= CRASH_LOOP_THRESHOLD && now - e.timestamp < CRASH_LOOP_WINDOW_MS
  );
}

// ============================================================================
// ROUTE TRACKING
// ============================================================================

let lastRoute = typeof window !== 'undefined' ? window.location.pathname : '/';

export function recordRouteChange(to: string): void {
  const from = lastRoute;
  if (from === to) return; // No actual change
  
  forensicsState.routeChanges.push({
    from,
    to,
    timestamp: Date.now(),
  });
  
  // Keep only last 50 route changes
  if (forensicsState.routeChanges.length > 50) {
    forensicsState.routeChanges.shift();
  }
  
  lastRoute = to;
  logForensic(`[Route] ${from} → ${to}`);
  
  // Check for navigation loop (same route 3+ times in quick succession)
  const recentRoutes = forensicsState.routeChanges.slice(-5);
  const toSameRoute = recentRoutes.filter(r => r.to === to);
  
  if (toSameRoute.length >= 3) {
    const timeDiff = Date.now() - toSameRoute[0].timestamp;
    if (timeDiff < 5000) {
      recordCrashEvent('navigation', { path: to, message: 'Navigation loop detected' });
    }
  }
  
  persistState();
}

// ============================================================================
// ERROR TRACKING
// ============================================================================

export function recordError(message: string, stack?: string): void {
  forensicsState.errors.push({
    timestamp: Date.now(),
    message,
    stack,
  });
  
  // Keep only last 100 errors
  if (forensicsState.errors.length > 100) {
    forensicsState.errors.shift();
  }
  
  recordCrashEvent('error', { message });
  persistState();
}

// ============================================================================
// MEMORY SIGNALS
// ============================================================================

export function captureMemorySignal(): MemorySignal {
  const signal: MemorySignal = {
    timestamp: Date.now(),
    domNodes: document.querySelectorAll('*').length,
    intervals: trackedTimers.intervals.size,
    timeouts: trackedTimers.timeouts.size,
    blobUrls: 0, // Would need access to blobUrlTracker
    videoElements: document.querySelectorAll('video').length,
  };
  
  forensicsState.memorySignals.push(signal);
  
  // Keep only last 100 signals
  if (forensicsState.memorySignals.length > 100) {
    forensicsState.memorySignals.shift();
  }
  
  return signal;
}

// Check for memory growth (DOM nodes growing rapidly)
export function detectMemoryGrowth(): { detected: boolean; rate?: number } {
  if (forensicsState.memorySignals.length < 5) {
    return { detected: false };
  }
  
  const recent = forensicsState.memorySignals.slice(-5);
  const first = recent[0];
  const last = recent[recent.length - 1];
  const timeDiff = last.timestamp - first.timestamp;
  
  if (timeDiff < 1000) return { detected: false }; // Not enough time
  
  const nodeGrowth = last.domNodes - first.domNodes;
  const growthRate = nodeGrowth / (timeDiff / 1000); // nodes per second
  
  if (growthRate > 100) {
    logForensic(`[Memory] DOM node growth: ${growthRate.toFixed(1)}/sec`, 'warn');
    return { detected: true, rate: growthRate };
  }
  
  return { detected: false, rate: growthRate };
}

// ============================================================================
// PERSISTENCE
// ============================================================================

const STORAGE_KEY = 'crash_forensics_state';

function persistState(): void {
  if (typeof sessionStorage === 'undefined') return;
  
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      sessionId: forensicsState.sessionId,
      checkpoints: forensicsState.checkpoints,
      crashLoops: forensicsState.crashLoops,
      errors: forensicsState.errors.slice(-10),
      routeChanges: forensicsState.routeChanges.slice(-10),
    }));
  } catch {
    // Storage full or unavailable
  }
}

function loadPersistedState(): void {
  if (typeof sessionStorage === 'undefined') return;
  
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    
    const parsed = JSON.parse(stored);
    
    // Different session = reload occurred
    if (parsed.sessionId !== forensicsState.sessionId) {
      const previousCheckpoints = parsed.checkpoints || [];
      const hadAllCheckpoints = previousCheckpoints.every((c: Checkpoint) => c.passed);
      
      if (!hadAllCheckpoints) {
        logForensic('[RELOAD DETECTED] App crashed before all checkpoints passed', 'error');
        recordCrashEvent('reload', { 
          message: `Previous session failed at checkpoint: ${
            previousCheckpoints.find((c: Checkpoint) => !c.passed)?.id || 'unknown'
          }` 
        });
      }
    }
  } catch {
    // Invalid stored data
  }
}

// ============================================================================
// LOGGING
// ============================================================================

type LogLevel = 'info' | 'warn' | 'error';

const forensicsLog: Array<{ timestamp: number; level: LogLevel; message: string }> = [];

function logForensic(message: string, level: LogLevel = 'info'): void {
  const entry = { timestamp: Date.now(), level, message };
  forensicsLog.push(entry);
  
  // Keep log bounded
  if (forensicsLog.length > 500) {
    forensicsLog.shift();
  }
  
  // Console output in development
  if (process.env.NODE_ENV === 'development') {
    const prefix = `[CrashForensics ${new Date().toISOString().substr(11, 12)}]`;
    switch (level) {
      case 'error':
        console.error(prefix, message);
        break;
      case 'warn':
        console.warn(prefix, message);
        break;
      default:
        console.log(prefix, message);
    }
  }
}

export function getForensicsLog(): typeof forensicsLog {
  return [...forensicsLog];
}

// ============================================================================
// OVERLAY DATA
// ============================================================================

export function getOverlayData(): ForensicsState & { log: typeof forensicsLog } {
  return {
    ...forensicsState,
    log: getForensicsLog(),
  };
}

// ============================================================================
// TIMER INTERCEPTION (for tracking)
// ============================================================================

let originalSetInterval: typeof setInterval | null = null;
let originalClearInterval: typeof clearInterval | null = null;
let originalSetTimeout: typeof setTimeout | null = null;
let originalClearTimeout: typeof clearTimeout | null = null;

export function interceptTimers(): () => void {
  if (typeof window === 'undefined') return () => {};
  
  originalSetInterval = window.setInterval;
  originalClearInterval = window.clearInterval;
  originalSetTimeout = window.setTimeout;
  originalClearTimeout = window.clearTimeout;
  
  window.setInterval = ((callback: TimerHandler, delay?: number, ...args: any[]) => {
    const id = originalSetInterval!(callback, delay, ...args);
    trackedTimers.intervals.add(id as unknown as number);
    return id;
  }) as typeof setInterval;
  
  window.clearInterval = ((id: number | undefined) => {
    if (id !== undefined) {
      trackedTimers.intervals.delete(id);
    }
    return originalClearInterval!(id);
  }) as typeof clearInterval;
  
  window.setTimeout = ((callback: TimerHandler, delay?: number, ...args: any[]) => {
    const id = originalSetTimeout!(callback, delay, ...args);
    trackedTimers.timeouts.add(id as unknown as number);
    // Auto-remove after it fires
    originalSetTimeout!(() => {
      trackedTimers.timeouts.delete(id as unknown as number);
    }, (delay || 0) + 100);
    return id;
  }) as typeof setTimeout;
  
  window.clearTimeout = ((id: number | undefined) => {
    if (id !== undefined) {
      trackedTimers.timeouts.delete(id);
    }
    return originalClearTimeout!(id);
  }) as typeof clearTimeout;
  
  return () => {
    if (originalSetInterval) window.setInterval = originalSetInterval;
    if (originalClearInterval) window.clearInterval = originalClearInterval;
    if (originalSetTimeout) window.setTimeout = originalSetTimeout;
    if (originalClearTimeout) window.clearTimeout = originalClearTimeout;
  };
}

// ============================================================================
// INITIALIZATION
// ============================================================================

let initialized = false;
let cleanupInterceptors: (() => void) | null = null;

export function initializeCrashForensics(): () => void {
  if (initialized || typeof window === 'undefined') {
    return () => {};
  }
  
  initialized = true;
  logForensic('Crash Forensics Mode initialized');
  
  // Check for persisted state (detect reloads)
  loadPersistedState();
  
  // Mark A0 checkpoint
  markCheckpoint('A0');
  
  // Intercept timers for memory tracking
  cleanupInterceptors = interceptTimers();
  
  // Set up periodic memory signals
  const memoryInterval = setInterval(() => {
    captureMemorySignal();
    detectMemoryGrowth();
  }, 5000);
  
  // Global error handler integration
  const errorHandler = (event: ErrorEvent) => {
    recordError(event.message, event.error?.stack);
  };
  
  const rejectionHandler = (event: PromiseRejectionEvent) => {
    const message = event.reason instanceof Error ? event.reason.message : String(event.reason);
    recordError(`Unhandled rejection: ${message}`, event.reason?.stack);
  };
  
  window.addEventListener('error', errorHandler);
  window.addEventListener('unhandledrejection', rejectionHandler);
  
  // Log safe mode status
  if (forensicsState.safeMode) {
    logForensic('[SAFE MODE] Active - heavy features disabled', 'warn');
  }
  
  return () => {
    clearInterval(memoryInterval);
    window.removeEventListener('error', errorHandler);
    window.removeEventListener('unhandledrejection', rejectionHandler);
    if (cleanupInterceptors) cleanupInterceptors();
    initialized = false;
  };
}

// Export state for external use
export const crashForensics = {
  init: initializeCrashForensics,
  checkpoint: markCheckpoint,
  getCheckpoints,
  allCheckpointsPassed,
  recordRoute: recordRouteChange,
  recordError,
  isCrashLoop: isCrashLoopDetected,
  getOverlayData,
  isSafeMode,
  getSafeModeConfig,
  captureMemory: captureMemorySignal,
  detectMemoryGrowth,
};
