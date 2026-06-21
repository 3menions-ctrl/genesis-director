/**
 * Error handling types - Strongly typed error handling utilities
 */

/**
 * Standard error shape for API responses and catch blocks
 */
export interface AppError {
  message: string;
  code?: string;
  status?: number;
  details?: unknown;
}

/**
 * Type guard to check if an unknown value is an Error-like object
 */
export function isErrorLike(value: unknown): value is { message: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    typeof (value as Record<string, unknown>).message === 'string'
  );
}

/**
 * Extract error message from unknown catch value
 * 
 * Usage:
 * ```ts
 * try {
 *   await riskyOperation();
 * } catch (err) {
 *   const message = getErrorMessage(err);
 *   toast.error(message);
 * }
 * ```
 */
export function getErrorMessage(error: unknown, fallback = 'An unexpected error occurred'): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (isErrorLike(error)) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return fallback;
}

/**
 * Safely parse API error responses
 */
export function parseApiError(response: unknown): AppError {
  if (isErrorLike(response)) {
    return {
      message: response.message,
      code: (response as Record<string, unknown>).code as string | undefined,
      status: (response as Record<string, unknown>).status as number | undefined,
      details: (response as Record<string, unknown>).details,
    };
  }
  return {
    message: 'Unknown error occurred',
  };
}

/**
 * Type-safe error assertion for exhaustive switch statements
 */
export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${value}`);
}
