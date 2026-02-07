/**
 * User-Friendly Error Messages
 * 
 * Transforms technical API errors into clear, actionable messages for consumers.
 * Provides consistent error handling across the application.
 * 
 * PRINCIPLE: Only show FATAL errors to users. Non-fatal errors are logged but suppressed.
 */

import { toast } from 'sonner';
import { FunctionsHttpError } from '@supabase/supabase-js';

// ============= Non-Fatal Error Patterns =============
// These errors should be logged but NOT displayed to users

const NON_FATAL_ERROR_PATTERNS = [
  // Network/connectivity issues - transient, will resolve
  /failed to fetch/i,
  /network.?error/i,
  /net::ERR/i,
  /load failed/i,
  /connection.?reset/i,
  /ECONNREFUSED/i,
  
  // Abort/cancel errors - expected during navigation
  /abort/i,
  /cancelled/i,
  /canceled/i,
  /signal is aborted/i,
  
  // Rate limiting - temporary
  /rate.?limit/i,
  /too many requests/i,
  /429/,
  
  // Transient server issues
  /502/,
  /503/,
  /504/,
  /service.?unavailable/i,
  /gateway.?timeout/i,
  
  // Video/media playback - handled by player
  /play\(\).*interrupted/i,
  /NotAllowedError.*play/i,
  /PIPELINE_ERROR/i,
  /MediaError/i,
  
  // Browser quirks
  /ResizeObserver/i,
  /ChunkLoadError/i,
  /Loading chunk/i,
  /dynamically imported module/i,
  
  // React lifecycle warnings
  /unmounted component/i,
  /state update on an unmounted/i,
  /Cannot read properties of null/i,
  
  // External service hiccups - we have recovery
  /replicate/i,
  /tts.?generation.?failed/i,
  /master.?tts/i,
  /external.?service/i,
  
  // Timeout - has built-in retry
  /timeout/i,
  /timed out/i,
  
  // Generation issues - auto-refunded
  /generation.?failed/i,
  /generation.?hiccup/i,
  
  // DOM errors - never user-actionable
  /removeChild/i,
  /insertBefore/i,
  /appendChild/i,
  /HierarchyRequestError/i,
  
  // Empty or undefined errors
  /^undefined$/i,
  /^null$/i,
  /^\s*$/,
];

/**
 * Check if an error is non-fatal and should NOT be shown to users
 */
export function isNonFatalError(error: unknown): boolean {
  if (!error) return true;
  
  const errorMessage = error instanceof Error 
    ? error.message 
    : typeof error === 'string' 
      ? error 
      : JSON.stringify(error);
  
  if (!errorMessage || errorMessage.trim() === '') return true;
  
  return NON_FATAL_ERROR_PATTERNS.some(pattern => pattern.test(errorMessage));
}

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
  isFatal: boolean; // NEW: Only fatal errors are shown to users
}

export interface ParsedApiError {
  code: string;
  originalError: unknown;
  userError: UserFriendlyError;
}

// ============= Error Mappings =============

/**
 * Maps API error codes/patterns to user-friendly messages
 * isFatal determines if error is shown to users
 */
const ERROR_MAPPINGS: Record<string, (data?: Record<string, unknown>) => UserFriendlyError> = {
  // Active project conflict - friendly, reassuring message (SHOW - actionable)
  active_project_exists: (data) => ({
    title: '🎬 Your Video is Generating',
    message: data?.existingProjectTitle 
      ? `"${data.existingProjectTitle}" is currently being created. You can only have one video generating at a time - we'll notify you when it's ready!`
      : 'You already have a video being created. We only allow one at a time to ensure the best quality. Check your project to see the progress!',
    severity: 'info',
    duration: 10000,
    isFatal: true, // User needs to take action
  }),
  
  // Credit/payment issues (SHOW - actionable)
  insufficient_credits: () => ({
    title: '💳 Need More Credits',
    message: 'Top up your credits to continue creating amazing videos. Quick and easy!',
    severity: 'warning',
    duration: 8000,
    isFatal: true, // User needs to buy credits
  }),
  
  // Rate limiting - HIDE (will resolve on its own)
  rate_limited: () => ({
    title: '⏳ Just a Moment',
    message: 'We\'re processing your requests. Give us a few seconds and try again!',
    severity: 'info',
    duration: 5000,
    isFatal: false, // Transient, will resolve
  }),
  
  // Authentication (SHOW - actionable)
  unauthorized: () => ({
    title: '🔐 Session Expired',
    message: 'For your security, please sign in again to continue.',
    severity: 'warning',
    duration: 5000,
    isFatal: true, // User needs to sign in
  }),
  
  // Server errors - HIDE (transient)
  server_error: () => ({
    title: '🔧 Quick Hiccup',
    message: 'Something unexpected happened on our end. Try again in a moment - we\'re on it!',
    severity: 'warning',
    duration: 6000,
    isFatal: false, // Transient, has auto-recovery
  }),
  
  // Network errors - HIDE (transient)
  network_error: () => ({
    title: '📶 Connection Lost',
    message: 'Check your internet connection and try again. Your work is safe!',
    severity: 'warning',
    duration: 5000,
    isFatal: false, // Transient, will resolve
  }),
  
  // Generation failures - HIDE (auto-refunded)
  generation_failed: () => ({
    title: '🎬 Generation Hiccup',
    message: 'This video didn\'t complete, but don\'t worry - your credits are automatically refunded. Try again!',
    severity: 'info',
    duration: 8000,
    isFatal: false, // Auto-refunded, no user action needed
  }),
  
  // Timeout - HIDE (has retry)
  timeout: () => ({
    title: '⏱️ Taking Too Long',
    message: 'This is taking longer than expected. Please refresh and try again.',
    severity: 'warning',
    duration: 5000,
    isFatal: false, // Has built-in retry logic
  }),
  
  // API key/external service issues - HIDE (internal)
  external_service_error: () => ({
    title: '🌐 Service Busy',
    message: 'Our video engine is temporarily busy. Please try again in a few minutes - quality takes time!',
    severity: 'info',
    duration: 6000,
    isFatal: false, // Internal issue, has recovery
  }),
};

// ============= Error Detection Patterns =============

interface ErrorPattern {
  pattern: RegExp | string;
  code: string;
}

const ERROR_PATTERNS: ErrorPattern[] = [
  // Active project conflict - check first (highest priority for user experience)
  { pattern: 'active_project_exists', code: 'active_project_exists' },
  { pattern: /project.*in progress/i, code: 'active_project_exists' },
  { pattern: '409', code: 'active_project_exists' },
  
  // Credit/payment issues
  { pattern: /insufficient.?credit/i, code: 'insufficient_credits' },
  { pattern: '402', code: 'insufficient_credits' },
  
  // Rate limiting
  { pattern: /rate.?limit/i, code: 'rate_limited' },
  { pattern: '429', code: 'rate_limited' },
  
  // Authentication
  { pattern: '401', code: 'unauthorized' },
  { pattern: '403', code: 'unauthorized' },
  { pattern: /unauthorized/i, code: 'unauthorized' },
  
  // Server errors (lower priority - check after specific errors)
  { pattern: '502', code: 'server_error' },
  { pattern: '503', code: 'server_error' },
  
  // Network errors
  { pattern: /network.?error/i, code: 'network_error' },
  { pattern: /failed to fetch/i, code: 'network_error' },
  
  // Generation failures
  { pattern: /generation.?failed/i, code: 'generation_failed' },
  { pattern: /tts.?generation.?failed/i, code: 'external_service_error' },
  { pattern: /master.?tts/i, code: 'external_service_error' },
  { pattern: /replicate/i, code: 'external_service_error' },
  
  // Timeout
  { pattern: /timeout/i, code: 'timeout' },
  { pattern: /abort/i, code: 'timeout' },
  
  // Generic 500 - check LAST (after all specific patterns)
  { pattern: '500', code: 'server_error' },
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
 * IMPORTANT: Only FATAL errors are shown to users
 * Non-fatal errors are logged but suppressed from UI
 */
export function showUserFriendlyError(
  error: unknown,
  options?: {
    additionalData?: Record<string, unknown>;
    onAction?: () => void;
    actionLabel?: string;
    navigate?: (path: string) => void;
    forceFatal?: boolean; // Override to force showing error
  }
): ParsedApiError {
  const parsed = parseApiError(error, options?.additionalData);
  const { userError } = parsed;
  
  // CRITICAL: Check if this is a non-fatal error that should be suppressed
  // Non-fatal errors are logged but NOT shown to users
  if (!userError.isFatal && !options?.forceFatal) {
    console.debug('[UserFriendlyErrors] Suppressed non-fatal error:', parsed.code, error);
    return parsed; // Return parsed but don't show toast
  }
  
  // Also check against our pattern list for extra safety
  if (isNonFatalError(error) && !options?.forceFatal) {
    console.debug('[UserFriendlyErrors] Suppressed by pattern:', error);
    return parsed;
  }
  
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
  
  // Show toast - only for FATAL errors
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
 * Now handles nested error data and extracts project info from various response formats
 * Supports FunctionsHttpError which contains the response body in error.context
 * 
 * IMPORTANT: Only FATAL errors are shown to users
 */
export async function handleEdgeFunctionError(
  error: unknown,
  data: Record<string, unknown> | null,
  navigate?: (path: string) => void
): Promise<{ handled: boolean; parsed: ParsedApiError | null }> {
  // First check: Is this a non-fatal error we should suppress entirely?
  if (isNonFatalError(error) && !data?.existingProjectId) {
    console.debug('[UserFriendlyErrors] Edge function error suppressed (non-fatal):', error);
    return { handled: true, parsed: null };
  }
  
  // Extract error info - could be in data directly, nested in error message, or in error.context
  let errorData = data;
  let existingProjectId = data?.existingProjectId as string | undefined;
  let existingProjectTitle = data?.existingProjectTitle as string | undefined;
  
  // Handle FunctionsHttpError - the response body is in error.context
  if (error instanceof FunctionsHttpError) {
    try {
      const contextData = await error.context.json();
      console.log('[UserFriendlyErrors] Extracted context from FunctionsHttpError:', contextData);
      if (contextData) {
        errorData = contextData;
        existingProjectId = contextData.existingProjectId;
        existingProjectTitle = contextData.existingProjectTitle;
      }
    } catch {
      // Context parsing failed, continue with other methods
    }
  }
  
  // Check if error contains JSON with project info (for 500 wrapping 409)
  if (!existingProjectId && error instanceof Error && error.message) {
    try {
      // Try to parse JSON from error message (e.g., "500: {json}")
      const jsonMatch = error.message.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.error === 'active_project_exists' || parsed.existingProjectId) {
          errorData = parsed;
          existingProjectId = parsed.existingProjectId;
          existingProjectTitle = parsed.existingProjectTitle;
        }
      }
    } catch {
      // Not JSON, continue with normal flow
    }
  }
  
  // Check for specific error codes in data (these ARE fatal - user needs to act)
  if (errorData?.error === 'active_project_exists' || existingProjectId) {
    const parsed = parseApiError(errorData, errorData as Record<string, unknown>);
    
    // Use the improved info-style toast for active projects
    toast.info(parsed.userError.message, {
      duration: 10000,
      action: existingProjectId ? {
        label: '👀 View Progress',
        onClick: () => navigate?.(`/production/${existingProjectId}`),
      } : undefined,
    });
    return { handled: true, parsed };
  }
  
  // Handle general errors - showUserFriendlyError will filter non-fatal
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
