/**
 * Network Resilience Layer v2.0
 * 
 * Global interceptors with exponential backoff retry mechanism
 * for all Supabase function calls. Handles jitter, 504 timeouts,
 * and safe JSON parsing to prevent crashes from HTML error responses.
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
  // HTML error response patterns (should retry)
  'Expected JSON but got',
  'API returned HTML',
  'Unexpected response format',
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
 * Safely fetch JSON with Content-Type validation
 * Prevents crashes when APIs return HTML instead of JSON
 */
export async function fetchJsonSafely<T>(
  url: string, 
  options?: RequestInit
): Promise<{ data: T | null; error: Error | null }> {
  try {
    const response = await fetch(url, options);
    const contentType = response.headers.get("content-type");

    // Check if response is JSON
    if (!contentType?.includes("application/json")) {
      const textResponse = await response.text();
      console.error("[NetworkResilience] Expected JSON but got:", contentType);
      console.debug("[NetworkResilience] Response preview:", textResponse.substring(0, 200));

      // Detect HTML responses (common for auth redirects, server errors, rate limiting)
      if (textResponse.trim().startsWith("<!") || textResponse.includes("<html")) {
        const error = new Error(
          `API returned HTML instead of JSON. Status: ${response.status}. ` +
          `This usually indicates: auth redirect, server error, or rate limiting.`
        );
        return { data: null, error };
      }
      
      return { 
        data: null, 
        error: new Error(`Unexpected response format: ${contentType}`) 
      };
    }
    
    // Safely parse JSON
    const text = await response.text();
    if (!text || text.trim() === '') {
      return { data: null, error: null }; // Empty response is valid
    }
    
    try {
      const data = JSON.parse(text) as T;
      return { data, error: null };
    } catch (parseError) {
      console.error("[NetworkResilience] JSON parse error:", parseError);
      return { 
        data: null, 
        error: new Error(`Failed to parse JSON response: ${parseError}`) 
      };
    }
  } catch (fetchError) {
    return { 
      data: null, 
      error: fetchError instanceof Error ? fetchError : new Error(String(fetchError)) 
    };
  }
}

/**
 * Safe JSON parse that never throws
 */
export function safeJsonParse<T>(text: string): { data: T | null; error: Error | null } {
  try {
    // Handle empty/whitespace strings
    if (!text || text.trim() === '') {
      return { data: null, error: null };
    }
    
    // Quick check for HTML before attempting parse
    const trimmed = text.trim();
    if (trimmed.startsWith('<!') || trimmed.toLowerCase().startsWith('<html')) {
      return { 
        data: null, 
        error: new Error('Received HTML instead of JSON') 
      };
    }
    
    const data = JSON.parse(text) as T;
    return { data, error: null };
  } catch (err) {
    return { 
      data: null, 
      error: err instanceof Error ? err : new Error('JSON parse failed') 
    };
  }
}

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
 * With automatic JSON validation and HTML detection
 */
export async function fetchWithRetry(
  url: string,
  options?: RequestInit & {
    maxRetries?: number;
    baseDelay?: number;
    onRetry?: (attempt: number, error: unknown) => void;
    expectJson?: boolean;
  }
): Promise<Response> {
  const { 
    maxRetries = DEFAULT_MAX_RETRIES, 
    baseDelay = BASE_DELAY_MS, 
    onRetry, 
    expectJson = false,
    ...fetchOptions 
  } = options || {};
  
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
      
      // If expecting JSON, validate content-type
      if (expectJson) {
        const contentType = response.headers.get("content-type");
        if (!contentType?.includes("application/json")) {
          // Clone response to check body without consuming it
          const clonedResponse = response.clone();
          const text = await clonedResponse.text();
          
          // If it's HTML, treat as retryable error (server might be temporarily down)
          if (text.trim().startsWith("<!") || text.toLowerCase().includes("<html")) {
            if (attempt < maxRetries) {
              const delay = calculateDelay(attempt, baseDelay);
              console.log(`[NetworkResilience] HTML response, retrying ${attempt + 1}/${maxRetries} for ${url}`);
              onRetry?.(attempt + 1, new Error("Received HTML instead of JSON"));
              await sleep(delay);
              continue;
            }
            throw new Error(`API returned HTML instead of JSON (status ${response.status})`);
          }
        }
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
