/**
 * Network Resilience Layer v1.0
 * 
 * Global interceptors with exponential backoff retry mechanism
 * for all Supabase function calls. Handles jitter and 504 timeouts.
 */

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Retry configuration
const DEFAULT_MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 10000;
const JITTER_FACTOR = 0.3;

// Error types that should trigger retry
const RETRYABLE_ERRORS = [
  'FetchError',
  'NetworkError',
  'ECONNRESET',
  'ETIMEDOUT',
  'Failed to fetch',
  'network request failed',
  '504',
  '502',
  '503',
  'Gateway Timeout',
  'Service Unavailable',
  'Bad Gateway',
  'timeout',
  'ENOTFOUND',
];

// Error types that should NOT retry (terminal errors)
const NON_RETRYABLE_ERRORS = [
  '401',
  '403',
  '402',
  'Unauthorized',
  'Forbidden',
  'insufficient_credits',
  'Invalid JWT',
  'session expired',
];

/**
 * Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (!error) return false;
  
  const message = error instanceof Error ? error.message : String(error);
  const lowered = message.toLowerCase();
  
  // Check for non-retryable errors first
  if (NON_RETRYABLE_ERRORS.some(pattern => lowered.includes(pattern.toLowerCase()))) {
    return false;
  }
  
  // Check for retryable errors
  return RETRYABLE_ERRORS.some(pattern => lowered.includes(pattern.toLowerCase()));
}

/**
 * Calculate delay with exponential backoff and jitter
 */
export function calculateDelay(attempt: number, baseDelay = BASE_DELAY_MS): number {
  const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), MAX_DELAY_MS);
  const jitter = exponentialDelay * JITTER_FACTOR * (Math.random() * 2 - 1);
  return Math.max(0, exponentialDelay + jitter);
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Resilient Supabase function invoker with automatic retry
 */
export async function invokeWithRetry<T = unknown>(
  functionName: string,
  body: Record<string, unknown>,
  options?: {
    maxRetries?: number;
    baseDelay?: number;
    onRetry?: (attempt: number, error: unknown) => void;
    signal?: AbortSignal;
  }
): Promise<{ data: T | null; error: Error | null }> {
  const { 
    maxRetries = DEFAULT_MAX_RETRIES, 
    baseDelay = BASE_DELAY_MS,
    onRetry,
    signal,
  } = options || {};
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Check for abort signal
    if (signal?.aborted) {
      return { data: null, error: new Error('Request aborted') };
    }
    
    try {
      const { data, error } = await supabase.functions.invoke<T>(functionName, {
        body,
      });
      
      if (error) {
        throw error;
      }
      
      return { data, error: null };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry non-retryable errors
      if (!isRetryableError(error)) {
        console.log(`[NetworkResilience] Non-retryable error for ${functionName}:`, lastError.message);
        return { data: null, error: lastError };
      }
      
      // Don't retry on last attempt
      if (attempt === maxRetries) {
        console.error(`[NetworkResilience] Max retries (${maxRetries}) exceeded for ${functionName}`);
        break;
      }
      
      // Calculate delay and wait
      const delay = calculateDelay(attempt, baseDelay);
      console.log(`[NetworkResilience] Retry ${attempt + 1}/${maxRetries} for ${functionName} after ${Math.round(delay)}ms`);
      
      // Call retry callback
      onRetry?.(attempt + 1, error);
      
      // Wait before retry
      await sleep(delay);
    }
  }
  
  return { data: null, error: lastError };
}

/**
 * Create a resilient fetch wrapper for external APIs
 */
export async function fetchWithRetry(
  url: string,
  options?: RequestInit & {
    maxRetries?: number;
    baseDelay?: number;
    onRetry?: (attempt: number, error: unknown) => void;
  }
): Promise<Response> {
  const { maxRetries = DEFAULT_MAX_RETRIES, baseDelay = BASE_DELAY_MS, onRetry, ...fetchOptions } = options || {};
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, fetchOptions);
      
      // Retry on 5xx errors
      if (response.status >= 500 && response.status < 600 && attempt < maxRetries) {
        const delay = calculateDelay(attempt, baseDelay);
        console.log(`[NetworkResilience] Retry ${attempt + 1}/${maxRetries} for ${url} (status ${response.status})`);
        onRetry?.(attempt + 1, new Error(`HTTP ${response.status}`));
        await sleep(delay);
        continue;
      }
      
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (!isRetryableError(error) || attempt === maxRetries) {
        throw lastError;
      }
      
      const delay = calculateDelay(attempt, baseDelay);
      console.log(`[NetworkResilience] Retry ${attempt + 1}/${maxRetries} for ${url} after ${Math.round(delay)}ms`);
      onRetry?.(attempt + 1, error);
      await sleep(delay);
    }
  }
  
  throw lastError;
}

/**
 * Global request tracker for debugging
 */
interface RequestMetrics {
  functionName: string;
  startTime: number;
  endTime?: number;
  retries: number;
  success: boolean;
  error?: string;
}

const requestMetrics: RequestMetrics[] = [];
const MAX_METRICS = 100;

export function trackRequest(metrics: RequestMetrics): void {
  requestMetrics.push(metrics);
  if (requestMetrics.length > MAX_METRICS) {
    requestMetrics.shift();
  }
}

export function getRecentMetrics(limit = 20): RequestMetrics[] {
  return requestMetrics.slice(-limit);
}

/**
 * Get network health score based on recent requests
 */
export function getNetworkHealthScore(): number {
  const recentWindow = Date.now() - 300000; // Last 5 minutes
  const recent = requestMetrics.filter(m => m.startTime > recentWindow);
  
  if (recent.length === 0) return 100;
  
  const successCount = recent.filter(m => m.success).length;
  const successRate = successCount / recent.length;
  
  // Factor in retry counts
  const avgRetries = recent.reduce((sum, m) => sum + m.retries, 0) / recent.length;
  const retryPenalty = Math.min(avgRetries * 10, 30);
  
  return Math.max(0, Math.round(successRate * 100 - retryPenalty));
}
