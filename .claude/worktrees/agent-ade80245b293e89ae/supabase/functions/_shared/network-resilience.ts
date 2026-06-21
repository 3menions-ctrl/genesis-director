/**
 * NETWORK RESILIENCE MODULE - World-Class Error Handling
 * 
 * Provides bulletproof network operations with:
 * 1. Exponential backoff with jitter
 * 2. Connection reset recovery
 * 3. Rate limit detection and smart waiting
 * 4. Timeout handling with graceful degradation
 * 5. Pre-flight URL validation
 */

// =====================================================
// CONFIGURATION
// =====================================================
export const RESILIENCE_CONFIG = {
  // Retry settings
  MAX_RETRIES: 4,
  BASE_DELAY_MS: 1000,
  MAX_DELAY_MS: 30000,
  JITTER_FACTOR: 0.3,
  
  // Timeout settings
  DEFAULT_TIMEOUT_MS: 60000,
  LONG_TIMEOUT_MS: 120000,
  
  // Rate limit settings
  RATE_LIMIT_WAIT_MS: 15000,
  RATE_LIMIT_MAX_WAITS: 3,
  
  // Pre-flight validation
  HEAD_REQUEST_TIMEOUT_MS: 10000,
};

// Retryable error patterns
const RETRYABLE_ERRORS = [
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'EPIPE',
  'ENOTFOUND',
  'EAI_AGAIN',
  'socket hang up',
  'network error',
  'fetch failed',
  'connection reset',
  'Connection reset',
  'aborted',
];

const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];

// =====================================================
// CORE TYPES
// =====================================================
export interface ResilientFetchOptions extends RequestInit {
  maxRetries?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
  validateResponse?: (response: Response) => boolean | Promise<boolean>;
}

export interface FetchResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  attempts: number;
  totalTimeMs: number;
  wasRateLimited?: boolean;
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Calculate exponential backoff delay with jitter
 */
export function calculateBackoff(attempt: number, baseDelay: number = RESILIENCE_CONFIG.BASE_DELAY_MS): number {
  const exponentialDelay = Math.min(
    baseDelay * Math.pow(2, attempt),
    RESILIENCE_CONFIG.MAX_DELAY_MS
  );
  
  // Add jitter (±30%)
  const jitter = exponentialDelay * RESILIENCE_CONFIG.JITTER_FACTOR * (Math.random() * 2 - 1);
  return Math.round(exponentialDelay + jitter);
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: Error | string): boolean {
  const errorMessage = typeof error === 'string' ? error : error.message;
  return RETRYABLE_ERRORS.some(pattern => 
    errorMessage.toLowerCase().includes(pattern.toLowerCase())
  );
}

/**
 * Check if a status code is retryable
 */
export function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUS_CODES.includes(status);
}

/**
 * Sleep with optional abort signal
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timeout);
      reject(new Error('Sleep aborted'));
    });
  });
}

// =====================================================
// URL VALIDATION
// =====================================================

/**
 * Validate a URL is accessible before using it (HEAD request)
 * Returns the valid URL or null if inaccessible
 */
export async function validateUrl(url: string, options?: {
  timeoutMs?: number;
  requireContentType?: string;
}): Promise<{ valid: boolean; status?: number; contentType?: string; error?: string }> {
  const timeout = options?.timeoutMs ?? RESILIENCE_CONFIG.HEAD_REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    const contentType = response.headers.get('content-type') || undefined;
    
    if (!response.ok) {
      return { 
        valid: false, 
        status: response.status, 
        error: `HTTP ${response.status}` 
      };
    }
    
    // Check content type if required
    if (options?.requireContentType && contentType) {
      if (!contentType.includes(options.requireContentType)) {
        return {
          valid: false,
          status: response.status,
          contentType,
          error: `Expected ${options.requireContentType}, got ${contentType}`,
        };
      }
    }
    
    return { valid: true, status: response.status, contentType };
  } catch (error) {
    clearTimeout(timeoutId);
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Validate an image URL is accessible and returns an image
 */
export async function validateImageUrl(url: string): Promise<{ valid: boolean; error?: string }> {
  if (!url) {
    return { valid: false, error: 'URL is empty' };
  }
  
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return { valid: false, error: 'Invalid URL protocol' };
  }
  
  const result = await validateUrl(url);
  
  if (!result.valid) {
    return { valid: false, error: result.error };
  }
  
  // Check content type is image (if provided)
  if (result.contentType && !result.contentType.includes('image')) {
    // Some CDNs don't return proper content-type headers, so just warn
    console.warn(`[NetworkResilience] URL might not be an image: ${result.contentType}`);
  }
  
  return { valid: true };
}

// =====================================================
// RESILIENT FETCH
// =====================================================

/**
 * Fetch with automatic retry, exponential backoff, and rate limit handling
 */
export async function resilientFetch(
  url: string,
  options: ResilientFetchOptions = {}
): Promise<Response> {
  const {
    maxRetries = RESILIENCE_CONFIG.MAX_RETRIES,
    baseDelayMs = RESILIENCE_CONFIG.BASE_DELAY_MS,
    timeoutMs = RESILIENCE_CONFIG.DEFAULT_TIMEOUT_MS,
    onRetry,
    validateResponse,
    ...fetchOptions
  } = options;
  
  let lastError: Error | null = null;
  let rateLimitWaits = 0;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      // Handle rate limiting specially
      if (response.status === 429) {
        rateLimitWaits++;
        if (rateLimitWaits <= RESILIENCE_CONFIG.RATE_LIMIT_MAX_WAITS && attempt < maxRetries) {
          const retryAfter = response.headers.get('Retry-After');
          const waitMs = retryAfter 
            ? parseInt(retryAfter, 10) * 1000 
            : RESILIENCE_CONFIG.RATE_LIMIT_WAIT_MS;
          
          console.log(`[NetworkResilience] Rate limited (429), waiting ${waitMs}ms before retry...`);
          onRetry?.(attempt, new Error('Rate limited'), waitMs);
          await sleep(waitMs);
          continue;
        }
      }
      
      // Check if response should trigger retry
      if (isRetryableStatus(response.status) && attempt < maxRetries) {
        const delayMs = calculateBackoff(attempt, baseDelayMs);
        console.log(`[NetworkResilience] HTTP ${response.status}, retry ${attempt + 1}/${maxRetries} in ${delayMs}ms`);
        onRetry?.(attempt, new Error(`HTTP ${response.status}`), delayMs);
        await sleep(delayMs);
        continue;
      }
      
      // Custom validation
      if (validateResponse) {
        const isValid = await validateResponse(response);
        if (!isValid && attempt < maxRetries) {
          const delayMs = calculateBackoff(attempt, baseDelayMs);
          console.log(`[NetworkResilience] Response validation failed, retry ${attempt + 1}/${maxRetries}`);
          await sleep(delayMs);
          continue;
        }
      }
      
      return response;
      
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check if error is retryable
      if (isRetryableError(lastError) && attempt < maxRetries) {
        const delayMs = calculateBackoff(attempt, baseDelayMs);
        console.log(`[NetworkResilience] ${lastError.message}, retry ${attempt + 1}/${maxRetries} in ${delayMs}ms`);
        onRetry?.(attempt, lastError, delayMs);
        await sleep(delayMs);
        continue;
      }
      
      // Abort error (timeout) is retryable
      if (lastError.name === 'AbortError' && attempt < maxRetries) {
        const delayMs = calculateBackoff(attempt, baseDelayMs);
        console.log(`[NetworkResilience] Request timeout, retry ${attempt + 1}/${maxRetries} in ${delayMs}ms`);
        onRetry?.(attempt, lastError, delayMs);
        await sleep(delayMs);
        continue;
      }
      
      throw lastError;
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

/**
 * Fetch JSON with automatic retry and parsing
 */
export async function resilientFetchJson<T>(
  url: string,
  options: ResilientFetchOptions = {}
): Promise<FetchResult<T>> {
  const startTime = Date.now();
  let attempts = 0;
  let wasRateLimited = false;
  
  const originalOnRetry = options.onRetry;
  options.onRetry = (attempt, error, delayMs) => {
    attempts = attempt + 1;
    if (error.message.includes('429') || error.message.includes('Rate limit')) {
      wasRateLimited = true;
    }
    originalOnRetry?.(attempt, error, delayMs);
  };
  
  try {
    const response = await resilientFetch(url, options);
    attempts++;
    
    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText.substring(0, 200)}`,
        attempts,
        totalTimeMs: Date.now() - startTime,
        wasRateLimited,
      };
    }
    
    const data = await response.json() as T;
    
    return {
      success: true,
      data,
      attempts,
      totalTimeMs: Date.now() - startTime,
      wasRateLimited,
    };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      attempts: attempts + 1,
      totalTimeMs: Date.now() - startTime,
      wasRateLimited,
    };
  }
}

// =====================================================
// REPLICATE-SPECIFIC HELPERS
// =====================================================

/**
 * Create a Replicate prediction with resilient handling
 */
export async function createReplicatePrediction(
  modelEndpoint: string,
  input: Record<string, unknown>,
  apiKey: string,
  options?: { waitForResult?: boolean; maxRetries?: number }
): Promise<FetchResult<{ id: string; status: string; output?: unknown }>> {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  
  // Add Prefer header for sync wait if requested
  if (options?.waitForResult) {
    headers['Prefer'] = 'wait=60';
  }
  
  return resilientFetchJson(modelEndpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ input }),
    maxRetries: options?.maxRetries ?? 3,
    timeoutMs: options?.waitForResult ? RESILIENCE_CONFIG.LONG_TIMEOUT_MS : RESILIENCE_CONFIG.DEFAULT_TIMEOUT_MS,
  });
}

/**
 * Poll a Replicate prediction with resilient handling
 */
export async function pollReplicatePrediction(
  predictionId: string,
  apiKey: string,
  options?: { 
    maxPollTimeMs?: number; 
    pollIntervalMs?: number;
    onPoll?: (status: string, elapsed: number) => void;
  }
): Promise<FetchResult<{ status: string; output?: unknown; error?: string }>> {
  const startTime = Date.now();
  const maxPollTime = options?.maxPollTimeMs ?? 300000; // 5 minutes default
  const pollInterval = options?.pollIntervalMs ?? 3000;
  
  while (Date.now() - startTime < maxPollTime) {
    const result = await resilientFetchJson<{ status: string; output?: unknown; error?: string }>(
      `https://api.replicate.com/v1/predictions/${predictionId}`,
      {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        maxRetries: 2,
      }
    );
    
    if (!result.success) {
      // Retry on failure
      await sleep(pollInterval);
      continue;
    }
    
    const status = result.data!.status;
    options?.onPoll?.(status, Date.now() - startTime);
    
    if (status === 'succeeded') {
      return result;
    }
    
    if (status === 'failed' || status === 'canceled') {
      return {
        success: false,
        data: result.data,
        error: result.data!.error || `Prediction ${status}`,
        attempts: result.attempts,
        totalTimeMs: Date.now() - startTime,
      };
    }
    
    await sleep(pollInterval);
  }
  
  return {
    success: false,
    error: `Polling timeout after ${maxPollTime}ms`,
    attempts: Math.ceil(maxPollTime / pollInterval),
    totalTimeMs: Date.now() - startTime,
  };
}

// =====================================================
// SUPABASE EDGE FUNCTION HELPERS
// =====================================================

/**
 * Call a Supabase Edge Function with resilient handling
 */
export async function callEdgeFunction<T>(
  supabaseUrl: string,
  functionName: string,
  body: unknown,
  serviceKey: string,
  options?: { maxRetries?: number; timeoutMs?: number }
): Promise<FetchResult<T>> {
  return resilientFetchJson<T>(
    `${supabaseUrl}/functions/v1/${functionName}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify(body),
      maxRetries: options?.maxRetries ?? 3,
      timeoutMs: options?.timeoutMs ?? RESILIENCE_CONFIG.DEFAULT_TIMEOUT_MS,
    }
  );
}
