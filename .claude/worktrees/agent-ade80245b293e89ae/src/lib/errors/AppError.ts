/**
 * Typed application error taxonomy.
 *
 * Every `catch` block that crosses a system boundary (network, DB, AI gateway,
 * Stripe, pipeline dispatch, auth) should call `toAppError(unknown, context)`
 * and then `reportError(appError)`. This replaces the pattern of
 * `catch (e) { console.error(e); }` that hides failures and produces 993 silent
 * sinks across the codebase.
 *
 * Categories are deliberately narrow — adding a new one requires updating the
 * `error_reports.category` CHECK constraint in the DB migration too.
 */

export type ErrorCategory =
  | 'auth'         // session/JWT/role failures
  | 'validation'   // user input failed schema/business rules
  | 'network'      // fetch/timeout/CORS/abort
  | 'pipeline'     // video production / Replicate / Kling / Seedance failures
  | 'billing'      // Stripe / credits / refunds
  | 'permission'   // RLS / 403 / forbidden / privilege escalation attempts
  | 'unknown';     // unclassified — review before shipping

export type ErrorSeverity = 'debug' | 'info' | 'warning' | 'error' | 'fatal';

export interface AppErrorContext {
  readonly [key: string]: unknown;
}

export interface AppError {
  readonly __appError: true;
  readonly category: ErrorCategory;
  readonly severity: ErrorSeverity;
  /** Stable machine-readable code, e.g. `pipeline.replicate.timeout`. */
  readonly code: string;
  /** Short, safe message a user can see. NEVER include stack/internal details. */
  readonly userMessage: string;
  /** Full technical message for logs. May include internal details. */
  readonly technicalMessage: string;
  /** Whether the caller can retry without user intervention. */
  readonly retryable: boolean;
  /** Structured context (component, action, ids). Never include PII / secrets. */
  readonly context: AppErrorContext;
  /** Original thrown value, preserved for the reporter. Never serialize to user. */
  readonly cause: unknown;
  /** Captured stack at conversion time. */
  readonly stack?: string;
}

export function isAppError(value: unknown): value is AppError {
  return !!value && typeof value === 'object' && (value as { __appError?: unknown }).__appError === true;
}

const HTTP_STATUS_TO_CATEGORY: Record<number, ErrorCategory> = {
  400: 'validation',
  401: 'auth',
  402: 'billing',
  403: 'permission',
  404: 'validation',
  408: 'network',
  409: 'validation',
  422: 'validation',
  429: 'network',
  500: 'unknown',
  502: 'network',
  503: 'network',
  504: 'network',
};

function extractStatus(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const e = err as { status?: unknown; statusCode?: unknown; code?: unknown };
  if (typeof e.status === 'number') return e.status;
  if (typeof e.statusCode === 'number') return e.statusCode;
  if (typeof e.code === 'string' && /^\d{3}$/.test(e.code)) return Number(e.code);
  return undefined;
}

function extractMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  try { return JSON.stringify(err); } catch { return String(err); }
}

function inferCategory(err: unknown, message: string, status?: number): ErrorCategory {
  if (status && HTTP_STATUS_TO_CATEGORY[status]) return HTTP_STATUS_TO_CATEGORY[status];
  const lower = message.toLowerCase();
  if (err && typeof err === 'object' && 'name' in err) {
    const name = String((err as { name?: unknown }).name);
    if (name === 'AbortError' || name === 'TimeoutError') return 'network';
    if (name.startsWith('Auth')) return 'auth';
  }
  if (/jwt|session|unauthor|expired/i.test(lower)) return 'auth';
  if (/forbidden|permission|rls|policy/i.test(lower)) return 'permission';
  if (/insufficient.*credit|payment|stripe|invoice/i.test(lower)) return 'billing';
  if (/replicate|kling|seedance|pipeline|stitch|continuity/i.test(lower)) return 'pipeline';
  if (/fetch|network|connection|timeout|ECONNRESET|ENOTFOUND/i.test(lower)) return 'network';
  if (/required|invalid|must be|schema/i.test(lower)) return 'validation';
  return 'unknown';
}

function inferSeverity(category: ErrorCategory, retryable: boolean): ErrorSeverity {
  if (category === 'permission') return 'fatal';
  if (category === 'auth') return 'error';
  if (category === 'billing') return 'error';
  if (retryable) return 'warning';
  return 'error';
}

function defaultUserMessage(category: ErrorCategory): string {
  switch (category) {
    case 'auth':       return 'Your session expired. Please sign in again.';
    case 'validation': return 'That input could not be processed. Please review and try again.';
    case 'network':    return 'Network error. Please check your connection and retry.';
    case 'pipeline':   return 'Generation hit a snag. We will recover automatically — please wait or retry.';
    case 'billing':    return 'There was a problem with your billing. Please refresh and try again.';
    case 'permission': return 'You do not have permission to perform this action.';
    default:           return 'Something went wrong. Please try again.';
  }
}

export interface ToAppErrorOptions {
  /** Component / file that caught the error, e.g. `useScenePipeline.generate`. */
  readonly source?: string;
  /** Free-form structured context. NO PII, NO secrets. */
  readonly context?: AppErrorContext;
  /** Override category if inference would be wrong. */
  readonly category?: ErrorCategory;
  /** Override severity. */
  readonly severity?: ErrorSeverity;
  /** Override the safe user-facing message. */
  readonly userMessage?: string;
  /** Override the machine-readable code. */
  readonly code?: string;
  /** Force retryable flag. */
  readonly retryable?: boolean;
}

export function toAppError(err: unknown, opts: ToAppErrorOptions = {}): AppError {
  if (isAppError(err)) {
    if (!opts.context && !opts.userMessage && !opts.category) return err;
    return { ...err, context: { ...err.context, ...(opts.context ?? {}) } };
  }
  const status = extractStatus(err);
  const technicalMessage = extractMessage(err);
  const category = opts.category ?? inferCategory(err, technicalMessage, status);
  const retryable = opts.retryable
    ?? (category === 'network' || (status !== undefined && status >= 500));
  const severity = opts.severity ?? inferSeverity(category, retryable);
  const code = opts.code
    ?? (status ? `${category}.http.${status}` : `${category}.${(opts.source ?? 'unknown').replace(/[^a-z0-9.]/gi, '_')}`);
  const stack = err instanceof Error ? err.stack : undefined;

  return {
    __appError: true,
    category,
    severity,
    code,
    userMessage: opts.userMessage ?? defaultUserMessage(category),
    technicalMessage,
    retryable,
    context: { source: opts.source, status, ...(opts.context ?? {}) },
    cause: err,
    stack,
  };
}

/** Construct an AppError directly without an underlying thrown value. */
export function makeAppError(opts: Required<Pick<ToAppErrorOptions, 'category' | 'code' | 'userMessage'>> & Partial<ToAppErrorOptions> & { technicalMessage?: string }): AppError {
  const category = opts.category;
  const retryable = opts.retryable ?? false;
  return {
    __appError: true,
    category,
    severity: opts.severity ?? inferSeverity(category, retryable),
    code: opts.code,
    userMessage: opts.userMessage,
    technicalMessage: opts.technicalMessage ?? opts.userMessage,
    retryable,
    context: opts.context ?? {},
    cause: undefined,
    stack: new Error().stack,
  };
}