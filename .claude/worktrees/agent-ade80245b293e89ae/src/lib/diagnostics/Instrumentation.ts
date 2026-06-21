/**
 * Global Diagnostics Instrumentation
 * 
 * Provides comprehensive logging and tracing for runtime verification.
 * Enable via VITE_DIAGNOSTICS_MODE=true environment variable.
 */

export interface DiagnosticEvent {
  timestamp: number;
  correlationId: string;
  category: 'navigation' | 'auth' | 'api' | 'state' | 'error' | 'user_action';
  action: string;
  data?: Record<string, unknown>;
  duration?: number;
}

// In-memory event buffer for diagnostics
const eventBuffer: DiagnosticEvent[] = [];
const MAX_BUFFER_SIZE = 500;

// Correlation ID for tracing requests
let globalCorrelationId = generateCorrelationId();

function generateCorrelationId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
}

export function getCorrelationId(): string {
  return globalCorrelationId;
}

export function newCorrelation(): string {
  globalCorrelationId = generateCorrelationId();
  return globalCorrelationId;
}

// Check if diagnostics mode is enabled
export function isDiagnosticsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return import.meta.env.VITE_DIAGNOSTICS_MODE === 'true' || 
         localStorage.getItem('diagnostics_mode') === 'true';
}

// Core logging function
export function logDiagnostic(
  category: DiagnosticEvent['category'],
  action: string,
  data?: Record<string, unknown>,
  duration?: number
): void {
  if (!isDiagnosticsEnabled()) return;

  const event: DiagnosticEvent = {
    timestamp: Date.now(),
    correlationId: globalCorrelationId,
    category,
    action,
    data,
    duration,
  };

  eventBuffer.push(event);
  if (eventBuffer.length > MAX_BUFFER_SIZE) {
    eventBuffer.shift();
  }

  // Console output with correlation ID
  const prefix = `[${category.toUpperCase()}:${globalCorrelationId.slice(-6)}]`;
  console.debug(prefix, action, data || '', duration ? `(${duration}ms)` : '');
}

// Navigation instrumentation
export function logNavigation(from: string, to: string, trigger: string): void {
  logDiagnostic('navigation', 'route_change', { from, to, trigger });
}

// Auth instrumentation
export function logAuthEvent(action: string, data?: Record<string, unknown>): void {
  logDiagnostic('auth', action, data);
}

// API instrumentation
export function logApiCall(
  method: string,
  endpoint: string,
  status: number,
  duration: number,
  error?: string
): void {
  logDiagnostic('api', `${method} ${endpoint}`, { status, error }, duration);
}

// State instrumentation
export function logStateChange(component: string, state: string, value?: unknown): void {
  logDiagnostic('state', `${component}.${state}`, { value });
}

// Error instrumentation
export function logError(
  source: string,
  error: Error | string,
  context?: Record<string, unknown>
): void {
  logDiagnostic('error', source, {
    message: typeof error === 'string' ? error : error.message,
    stack: typeof error === 'object' ? error.stack : undefined,
    ...context,
  });
}

// User action instrumentation
export function logUserAction(action: string, target: string, data?: Record<string, unknown>): void {
  logDiagnostic('user_action', action, { target, ...data });
}

// Get buffered events for analysis
export function getDiagnosticEvents(): DiagnosticEvent[] {
  return [...eventBuffer];
}

// Clear buffer
export function clearDiagnosticEvents(): void {
  eventBuffer.length = 0;
}

// Export events as JSON for debugging
export function exportDiagnostics(): string {
  return JSON.stringify(eventBuffer, null, 2);
}

// API request wrapper with automatic instrumentation
export async function instrumentedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const startTime = Date.now();
  const correlationId = getCorrelationId();
  const url = typeof input === 'string' ? input : input.toString();
  const method = init?.method || 'GET';

  try {
    const response = await fetch(input, {
      ...init,
      headers: {
        ...init?.headers,
        'X-Correlation-ID': correlationId,
      },
    });

    const duration = Date.now() - startTime;
    logApiCall(method, url, response.status, duration);

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    logApiCall(method, url, 0, duration, String(error));
    throw error;
  }
}

// React hook for component-level diagnostics
export function useComponentDiagnostics(componentName: string) {
  return {
    logMount: () => logStateChange(componentName, 'mounted'),
    logUnmount: () => logStateChange(componentName, 'unmounted'),
    logRender: (reason?: string) => logStateChange(componentName, 'render', { reason }),
    logAction: (action: string, data?: Record<string, unknown>) => 
      logUserAction(action, componentName, data),
    logError: (error: Error, context?: Record<string, unknown>) =>
      logError(componentName, error, context),
  };
}

// Performance measurement helper
export function measurePerformance<T>(
  name: string,
  fn: () => T | Promise<T>
): T | Promise<T> {
  const startTime = performance.now();
  
  const result = fn();
  
  if (result instanceof Promise) {
    return result.finally(() => {
      const duration = performance.now() - startTime;
      logDiagnostic('state', `perf:${name}`, undefined, Math.round(duration));
    });
  }
  
  const duration = performance.now() - startTime;
  logDiagnostic('state', `perf:${name}`, undefined, Math.round(duration));
  return result;
}
