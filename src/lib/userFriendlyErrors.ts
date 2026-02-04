/**
 * User-Friendly Error Messages
 * 
 * Transforms technical API errors into clear, actionable messages for consumers.
 * Provides consistent error handling across the application.
 */

import { toast } from 'sonner';

// ============= Error Types =============

export interface UserFriendlyError {
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  severity: 'info' | 'warning' | 'error';
  duration?: number;
}

export interface ParsedApiError {
  code: string;
  originalError: unknown;
  userError: UserFriendlyError;
}

// ============= Error Mappings =============

/**
 * Maps API error codes/patterns to user-friendly messages
 */
const ERROR_MAPPINGS: Record<string, (data?: Record<string, unknown>) => UserFriendlyError> = {
  // Active project conflict
  active_project_exists: (data) => ({
    title: 'Project in Progress',
    message: data?.existingProjectTitle 
      ? `Your project "${data.existingProjectTitle}" is still being created. Please wait for it to complete or cancel it first.`
      : 'You have a project in progress. Please wait for it to complete or cancel it first.',
    severity: 'warning',
    duration: 8000,
  }),
  
  // Credit/payment issues
  insufficient_credits: () => ({
    title: 'Not Enough Credits',
    message: 'You need more credits to create this video. Visit your settings to purchase more.',
    severity: 'warning',
    duration: 6000,
  }),
  
  // Rate limiting
  rate_limited: () => ({
    title: 'Too Many Requests',
    message: 'Please wait a moment before trying again. Our servers are processing your previous requests.',
    severity: 'info',
    duration: 5000,
  }),
  
  // Authentication
  unauthorized: () => ({
    title: 'Session Expired',
    message: 'Please sign in again to continue.',
    severity: 'warning',
    duration: 5000,
  }),
  
  // Server errors
  server_error: () => ({
    title: 'Something Went Wrong',
    message: 'We encountered a temporary issue. Please try again in a moment. If this continues, contact support.',
    severity: 'error',
    duration: 6000,
  }),
  
  // Network errors
  network_error: () => ({
    title: 'Connection Issue',
    message: 'Please check your internet connection and try again.',
    severity: 'warning',
    duration: 5000,
  }),
  
  // Generation failures
  generation_failed: () => ({
    title: 'Generation Failed',
    message: 'We couldn\'t complete your video. Your credits will be refunded automatically. Please try again.',
    severity: 'error',
    duration: 6000,
  }),
  
  // Timeout
  timeout: () => ({
    title: 'Request Timed Out',
    message: 'This is taking longer than expected. Please try again.',
    severity: 'warning',
    duration: 5000,
  }),
  
  // API key/external service issues (internal - show generic message)
  external_service_error: () => ({
    title: 'Service Temporarily Unavailable',
    message: 'Our video generation service is experiencing issues. Please try again in a few minutes.',
    severity: 'error',
    duration: 6000,
  }),
};

// ============= Error Detection Patterns =============

interface ErrorPattern {
  pattern: RegExp | string;
  code: string;
}

const ERROR_PATTERNS: ErrorPattern[] = [
  { pattern: 'active_project_exists', code: 'active_project_exists' },
  { pattern: /insufficient.?credit/i, code: 'insufficient_credits' },
  { pattern: '402', code: 'insufficient_credits' },
  { pattern: /rate.?limit/i, code: 'rate_limited' },
  { pattern: '429', code: 'rate_limited' },
  { pattern: '401', code: 'unauthorized' },
  { pattern: '403', code: 'unauthorized' },
  { pattern: /unauthorized/i, code: 'unauthorized' },
  { pattern: '500', code: 'server_error' },
  { pattern: '502', code: 'server_error' },
  { pattern: '503', code: 'server_error' },
  { pattern: /network.?error/i, code: 'network_error' },
  { pattern: /failed to fetch/i, code: 'network_error' },
  { pattern: /generation.?failed/i, code: 'generation_failed' },
  { pattern: /tts.?generation.?failed/i, code: 'external_service_error' },
  { pattern: /master.?tts/i, code: 'external_service_error' },
  { pattern: /replicate/i, code: 'external_service_error' },
  { pattern: /timeout/i, code: 'timeout' },
  { pattern: /abort/i, code: 'timeout' },
];

// ============= Main Functions =============

/**
 * Parse an error and return a user-friendly error object
 */
export function parseApiError(
  error: unknown,
  additionalData?: Record<string, unknown>
): ParsedApiError {
  // Extract error message
  let errorMessage = '';
  let errorData: Record<string, unknown> = { ...additionalData };
  
  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    errorMessage = error;
  } else if (error && typeof error === 'object') {
    const errObj = error as Record<string, unknown>;
    errorMessage = (errObj.message || errObj.error || errObj.detail || JSON.stringify(error)) as string;
    errorData = { ...errorData, ...errObj };
  }
  
  // Find matching error code
  let matchedCode = 'server_error'; // default
  
  for (const { pattern, code } of ERROR_PATTERNS) {
    const matches = typeof pattern === 'string' 
      ? errorMessage.includes(pattern) || errorData.error === pattern
      : pattern.test(errorMessage);
    
    if (matches) {
      matchedCode = code;
      break;
    }
  }
  
  // Get user-friendly error
  const errorFactory = ERROR_MAPPINGS[matchedCode] || ERROR_MAPPINGS.server_error;
  const userError = errorFactory(errorData);
  
  return {
    code: matchedCode,
    originalError: error,
    userError,
  };
}

/**
 * Show a user-friendly toast for an API error
 */
export function showUserFriendlyError(
  error: unknown,
  options?: {
    additionalData?: Record<string, unknown>;
    onAction?: () => void;
    actionLabel?: string;
    navigate?: (path: string) => void;
  }
): ParsedApiError {
  const parsed = parseApiError(error, options?.additionalData);
  const { userError } = parsed;
  
  // Build action if applicable
  let action = userError.action;
  if (options?.onAction && options?.actionLabel) {
    action = {
      label: options.actionLabel,
      onClick: options.onAction,
    };
  }
  
  // Special actions based on error type
  if (!action && options?.navigate) {
    if (parsed.code === 'insufficient_credits') {
      action = {
        label: 'Buy Credits',
        onClick: () => options.navigate?.('/settings?tab=billing'),
      };
    } else if (parsed.code === 'unauthorized') {
      action = {
        label: 'Sign In',
        onClick: () => options.navigate?.('/auth'),
      };
    }
  }
  
  // Show toast
  const toastFn = userError.severity === 'error' ? toast.error 
    : userError.severity === 'warning' ? toast.warning 
    : toast.info;
  
  toastFn(userError.message, {
    duration: userError.duration || 5000,
    action: action ? {
      label: action.label,
      onClick: action.onClick,
    } : undefined,
  });
  
  return parsed;
}

/**
 * Handle edge function errors with user-friendly messages
 */
export function handleEdgeFunctionError(
  error: unknown,
  data: Record<string, unknown> | null,
  navigate?: (path: string) => void
): { handled: boolean; parsed: ParsedApiError | null } {
  // Check for specific error codes in data
  if (data?.error === 'active_project_exists') {
    const parsed = parseApiError(data, data);
    toast.warning(parsed.userError.message, {
      duration: 8000,
      action: data.existingProjectId ? {
        label: 'View Project',
        onClick: () => navigate?.(`/production/${data.existingProjectId}`),
      } : undefined,
    });
    return { handled: true, parsed };
  }
  
  // Handle general errors
  if (error) {
    const parsed = showUserFriendlyError(error, { navigate });
    return { handled: true, parsed };
  }
  
  return { handled: false, parsed: null };
}

/**
 * Get a simple message for display (no toast)
 */
export function getErrorMessage(error: unknown): string {
  const parsed = parseApiError(error);
  return parsed.userError.message;
}

/**
 * Check if an error should trigger a redirect
 */
export function shouldRedirectOnError(error: unknown): { redirect: boolean; path?: string } {
  const parsed = parseApiError(error);
  
  switch (parsed.code) {
    case 'unauthorized':
      return { redirect: true, path: '/auth' };
    case 'insufficient_credits':
      return { redirect: false }; // Show toast with action instead
    default:
      return { redirect: false };
  }
}
