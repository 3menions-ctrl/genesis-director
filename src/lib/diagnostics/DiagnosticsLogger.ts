/**
 * DiagnosticsLogger - Centralized Logger Utility
 * 
 * Intercepts all console.error and window.onerror events,
 * providing formatted output for the Debug Overlay.
 * Only active in development mode.
 */

export type DiagnosticSeverity = 'error' | 'warning' | 'info' | 'debug';

export interface DiagnosticEntry {
  id: string;
  timestamp: number;
  severity: DiagnosticSeverity;
  message: string;
  source: 'console' | 'window' | 'unhandled_rejection' | 'supabase' | 'navigation' | 'auth' | 'component';
  stack?: string;
  metadata?: Record<string, unknown>;
  stateSnapshot?: StateSnapshot;
}

export interface StateSnapshot {
  auth?: {
    user: boolean;
    session: boolean;
    isSessionVerified: boolean;
    loading: boolean;
    isAdmin: boolean;
    profileLoaded: boolean;
  };
  navigation?: {
    currentRoute: string;
    isLoading: boolean;
    targetRoute: string | null;
  };
  timestamp: number;
}

// Maximum entries to keep in memory
const MAX_ENTRIES = 100;
const entries: DiagnosticEntry[] = [];

// Listeners for real-time updates
type DiagnosticsListener = (entries: DiagnosticEntry[]) => void;
const listeners: Set<DiagnosticsListener> = new Set();

// Original console methods (stored for restoration)
let originalConsoleError: typeof console.error | null = null;
let originalConsoleWarn: typeof console.warn | null = null;

// Current state snapshot provider
let stateSnapshotProvider: (() => StateSnapshot) | null = null;

/**
 * Generate unique ID
 */
function generateId(): string {
  return `diag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Classify error severity based on content
 */
function classifySeverity(message: string): DiagnosticSeverity {
  const lowered = message.toLowerCase();
  
  if (lowered.includes('error') || lowered.includes('failed') || lowered.includes('exception')) {
    return 'error';
  }
  if (lowered.includes('warning') || lowered.includes('warn') || lowered.includes('deprecated')) {
    return 'warning';
  }
  return 'info';
}

/**
 * Extract source from error message
 */
function extractSource(message: string, stack?: string): DiagnosticEntry['source'] {
  const lowered = message.toLowerCase();
  
  if (lowered.includes('supabase') || lowered.includes('postgrest') || lowered.includes('auth.')) {
    return 'supabase';
  }
  if (lowered.includes('navigation') || lowered.includes('route')) {
    return 'navigation';
  }
  if (lowered.includes('session') || lowered.includes('auth') || lowered.includes('user')) {
    return 'auth';
  }
  if (stack?.includes('Component') || lowered.includes('ref') || lowered.includes('render')) {
    return 'component';
  }
  return 'console';
}

/**
 * Add a diagnostic entry
 */
export function addDiagnosticEntry(entry: Omit<DiagnosticEntry, 'id' | 'timestamp'>): DiagnosticEntry {
  const fullEntry: DiagnosticEntry = {
    ...entry,
    id: generateId(),
    timestamp: Date.now(),
    stateSnapshot: stateSnapshotProvider?.(),
  };
  
  entries.push(fullEntry);
  
  // Cap entries
  while (entries.length > MAX_ENTRIES) {
    entries.shift();
  }
  
  // Notify listeners
  listeners.forEach(listener => listener([...entries]));
  
  return fullEntry;
}

/**
 * Log an error to diagnostics
 */
export function logDiagnosticError(
  message: string,
  options?: {
    source?: DiagnosticEntry['source'];
    stack?: string;
    metadata?: Record<string, unknown>;
    severity?: DiagnosticSeverity;
  }
): DiagnosticEntry {
  return addDiagnosticEntry({
    severity: options?.severity || 'error',
    message,
    source: options?.source || extractSource(message, options?.stack),
    stack: options?.stack,
    metadata: options?.metadata,
  });
}

/**
 * Get all diagnostic entries
 */
export function getDiagnosticEntries(): DiagnosticEntry[] {
  return [...entries];
}

/**
 * Get entries filtered by severity
 */
export function getEntriesBySeverity(severity: DiagnosticSeverity): DiagnosticEntry[] {
  return entries.filter(e => e.severity === severity);
}

/**
 * Get entries filtered by source
 */
export function getEntriesBySource(source: DiagnosticEntry['source']): DiagnosticEntry[] {
  return entries.filter(e => e.source === source);
}

/**
 * Clear all diagnostic entries
 */
export function clearDiagnostics(): void {
  entries.length = 0;
  listeners.forEach(listener => listener([]));
}

/**
 * Subscribe to diagnostic updates
 */
export function subscribeToDiagnostics(listener: DiagnosticsListener): () => void {
  listeners.add(listener);
  // Immediately call with current entries
  listener([...entries]);
  
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Set state snapshot provider
 */
export function setStateSnapshotProvider(provider: () => StateSnapshot): void {
  stateSnapshotProvider = provider;
}

/**
 * Initialize diagnostics interceptors
 * Call this once at app startup (development only)
 */
export function initializeDiagnostics(): () => void {
  if (typeof window === 'undefined') return () => {};
  
  // Only run in development
  if (process.env.NODE_ENV !== 'development') {
    return () => {};
  }
  
  // Intercept console.error
  originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    
    const stack = args.find(arg => arg instanceof Error)?.stack;
    
    addDiagnosticEntry({
      severity: 'error',
      message,
      source: 'console',
      stack: stack as string | undefined,
    });
    
    // Call original
    originalConsoleError?.apply(console, args);
  };
  
  // Intercept console.warn
  originalConsoleWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    
    addDiagnosticEntry({
      severity: 'warning',
      message,
      source: 'console',
    });
    
    originalConsoleWarn?.apply(console, args);
  };
  
  // Intercept window.onerror
  const originalOnError = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    addDiagnosticEntry({
      severity: 'error',
      message: String(message),
      source: 'window',
      stack: error?.stack,
      metadata: { source, lineno, colno },
    });
    
    if (typeof originalOnError === 'function') {
      return originalOnError(message, source, lineno, colno, error);
    }
    return false;
  };
  
  // Intercept unhandled rejections
  const handleRejection = (event: PromiseRejectionEvent) => {
    const error = event.reason;
    addDiagnosticEntry({
      severity: 'error',
      message: error instanceof Error ? error.message : String(error),
      source: 'unhandled_rejection',
      stack: error instanceof Error ? error.stack : undefined,
    });
  };
  
  window.addEventListener('unhandledrejection', handleRejection);
  
  // Return cleanup function
  return () => {
    if (originalConsoleError) {
      console.error = originalConsoleError;
    }
    if (originalConsoleWarn) {
      console.warn = originalConsoleWarn;
    }
    window.onerror = originalOnError;
    window.removeEventListener('unhandledrejection', handleRejection);
  };
}

/**
 * Format entry for display
 */
export function formatDiagnosticEntry(entry: DiagnosticEntry): string {
  const time = new Date(entry.timestamp).toLocaleTimeString();
  const severity = entry.severity.toUpperCase().padEnd(7);
  const source = `[${entry.source}]`.padEnd(20);
  
  let formatted = `${time} ${severity} ${source} ${entry.message}`;
  
  if (entry.stateSnapshot) {
    formatted += `\n  State: ${JSON.stringify(entry.stateSnapshot, null, 2)}`;
  }
  
  if (entry.stack) {
    formatted += `\n  Stack: ${entry.stack.split('\n').slice(0, 3).join('\n        ')}`;
  }
  
  return formatted;
}

export const diagnosticsLogger = {
  log: logDiagnosticError,
  getEntries: getDiagnosticEntries,
  getBySeverity: getEntriesBySeverity,
  getBySource: getEntriesBySource,
  clear: clearDiagnostics,
  subscribe: subscribeToDiagnostics,
  setStateProvider: setStateSnapshotProvider,
  initialize: initializeDiagnostics,
  format: formatDiagnosticEntry,
};
