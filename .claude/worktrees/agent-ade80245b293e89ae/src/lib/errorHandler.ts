import { toast } from 'sonner';

/**
 * Standard error codes and their user-friendly messages
 */
const ERROR_MESSAGES: Record<string, string> = {
  // Network errors
  'NetworkError': 'Connection failed. Please check your internet.',
  'TimeoutError': 'Request timed out. Please try again.',
  'AbortError': 'Request was cancelled.',
  
  // Auth errors
  'AuthSessionMissingError': 'Session expired. Please sign in again.',
  'AuthApiError': 'Authentication failed. Please try again.',
  'invalid_grant': 'Session expired. Please sign in again.',
  
  // Database errors
  'PGRST': 'Database error. Please try again.',
  '23505': 'This item already exists.',
  '23503': 'Cannot delete - item is in use.',
  '42501': 'Permission denied.',
  
  // Rate limiting
  '429': 'Too many requests. Please wait a moment.',
  'rate_limit': 'Rate limit exceeded. Please wait.',
  
  // Payment
  '402': 'Payment required. Please add credits.',
  'insufficient_credits': 'Not enough credits for this action.',
  
  // AI/Video generation
  'content_policy': 'Content was flagged. Please revise your prompt.',
  'generation_failed': 'Generation failed. Please try a different prompt.',
  'kling_error': 'Video service error. Please try again.',
};

/**
 * Parse error to extract meaningful information
 */
export function parseError(error: unknown): {
  code: string;
  message: string;
  isRetryable: boolean;
  originalError: unknown;
} {
  let code = 'unknown';
  let message = 'Something went wrong. Please try again.';
  let isRetryable = true;

  if (error instanceof Error) {
    // Check for specific error types
    if (error.name === 'AbortError') {
      code = 'AbortError';
      isRetryable = false;
    } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      code = 'NetworkError';
    } else if (error.message.includes('timeout')) {
      code = 'TimeoutError';
    } else if (error.message.includes('rate') || error.message.includes('429')) {
      code = '429';
      isRetryable = true;
    } else if (error.message.includes('402') || error.message.includes('credits')) {
      code = '402';
      isRetryable = false;
    }
    
    // Check for Supabase errors
    if ('code' in error && typeof (error as any).code === 'string') {
      code = (error as any).code;
    }
    
    // Use error message if we don't have a better one
    if (!ERROR_MESSAGES[code]) {
      message = error.message;
    }
  }
  
  // Handle response-like errors
  if (error && typeof error === 'object') {
    if ('status' in error && typeof (error as any).status === 'number') {
      const status = (error as any).status;
      if (status === 429) code = '429';
      if (status === 402) code = '402';
      if (status === 401 || status === 403) {
        code = 'AuthApiError';
        isRetryable = false;
      }
    }
    if ('message' in error && typeof (error as any).message === 'string') {
      message = (error as any).message;
    }
  }
  
  // Get user-friendly message
  const userMessage = ERROR_MESSAGES[code] || message;

  return {
    code,
    message: userMessage,
    isRetryable,
    originalError: error,
  };
}

/**
 * Handle error with toast notification
 */
export function handleError(
  error: unknown,
  context?: string,
  options?: {
    showToast?: boolean;
    onRetry?: () => void;
  }
): ReturnType<typeof parseError> {
  const parsed = parseError(error);
  const { showToast = true, onRetry } = options || {};

  // Log for debugging
  console.error(`[Error${context ? ` - ${context}` : ''}]`, {
    code: parsed.code,
    message: parsed.message,
    isRetryable: parsed.isRetryable,
    originalError: parsed.originalError,
  });

  // Show toast
  if (showToast) {
    const toastMessage = context 
      ? `${context}: ${parsed.message}` 
      : parsed.message;

    if (parsed.isRetryable && onRetry) {
      toast.error(toastMessage, {
        action: {
          label: 'Retry',
          onClick: onRetry,
        },
      });
    } else {
      toast.error(toastMessage);
    }
  }

  return parsed;
}

/**
 * Wrap async function with error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: string
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T> | null> => {
    try {
      return await fn(...args);
    } catch (error) {
      handleError(error, context);
      return null;
    }
  }) as T;
}

/**
 * Check if error indicates session expiry
 */
export function isSessionError(error: unknown): boolean {
  const parsed = parseError(error);
  return ['AuthSessionMissingError', 'AuthApiError', 'invalid_grant'].includes(parsed.code);
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  return parseError(error).isRetryable;
}

/**
 * Create a retry wrapper with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    onRetry?: (attempt: number, error: unknown) => void;
  }
): Promise<T> {
  const { 
    maxRetries = 3, 
    baseDelayMs = 1000, 
    maxDelayMs = 10000,
    onRetry 
  } = options || {};

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry non-retryable errors
      if (!isRetryableError(error)) {
        throw error;
      }
      
      // Don't retry on last attempt
      if (attempt === maxRetries) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
      
      if (onRetry) {
        onRetry(attempt + 1, error);
      }

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
