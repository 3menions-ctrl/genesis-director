export type { AppError, AppErrorContext, ErrorCategory, ErrorSeverity, ToAppErrorOptions } from './AppError';
export { toAppError, makeAppError, isAppError } from './AppError';
export { reportError, reportUnknown, resetErrorReporter } from './reporter';

// Standardized formatters + sinks (used by every async boundary, the root
// error boundary, and the InlineError component).
export {
  formatSupabaseError,
  formatEdgeFunctionError,
  surfaceError,
  reportClientError,
  reportClientErrorWithUser,
} from './format';
export type { SurfaceErrorOptions, ReportErrorContext } from './format';
