/**
 * Standardized error formatters & telemetry sinks.
 *
 * Every async boundary in the app — Supabase queries, edge function invokes,
 * fetch wrappers, hook side-effects — should route through these.
 *
 * Design rules:
 *  - Messages stay direct. No "Oops!". No "Something went wrong" without context.
 *  - The fallback string the caller passes IS the surfaceable user message when
 *    we cannot extract anything better from the error.
 *  - `surfaceError` is the single entry point for toast + telemetry. Components
 *    never call `toast.error` directly for unrecoverable async failures.
 *  - `reportClientError` is a fire-and-forget, non-blocking sink. It MUST NOT
 *    throw, MUST NOT await callers, and MUST handle network failure silently.
 */

import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = (import.meta.env?.VITE_SUPABASE_URL as string | undefined) ?? '';

// Endpoint we POST to from `reportClientError`. Resolved lazily so tests can
// stub the env.
function reportEndpoint(): string {
  if (!SUPABASE_URL) return '';
  return `${SUPABASE_URL.replace(/\/+$/, '')}/functions/v1/report-client-error`;
}

// ---------- internal helpers --------------------------------------------------

interface MaybeErrorContext {
  body?: unknown;
}

interface MaybeError {
  message?: unknown;
  error?: unknown;
  context?: MaybeErrorContext;
  details?: unknown;
  hint?: unknown;
  msg?: unknown;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function tryParseJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return null; }
}

function readMessage(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

/**
 * Pull the most useful human-readable message out of an arbitrary value.
 * Used as the inner core of every formatter.
 */
function extractAnyMessage(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return readMessage(value);
  if (value instanceof Error) return readMessage(value.message);
  if (!isPlainObject(value)) return null;

  const candidate =
    readMessage((value as MaybeError).message) ??
    readMessage((value as MaybeError).msg) ??
    readMessage((value as MaybeError).hint) ??
    readMessage((value as MaybeError).details);
  if (candidate) return candidate;

  // Nested .error in some Supabase responses.
  const nested = (value as MaybeError).error;
  if (nested) {
    const fromNested = extractAnyMessage(nested);
    if (fromNested) return fromNested;
  }
  return null;
}

/**
 * Some Supabase errors expose the real body inside `error.context.body`,
 * which is either a JSON string or a plain string. This unwraps that case.
 */
function readContextBody(err: unknown): string | null {
  if (!isPlainObject(err)) return null;
  const ctx = (err as MaybeError).context;
  if (!isPlainObject(ctx)) return null;
  const body = ctx.body;
  if (body == null) return null;

  if (typeof body === 'string') {
    const parsed = tryParseJson(body);
    if (parsed !== null) {
      const extracted = extractAnyMessage(parsed);
      if (extracted) return extracted;
    }
    return readMessage(body);
  }
  return extractAnyMessage(body);
}

// ---------- public formatters -------------------------------------------------

/**
 * Format a Supabase-style error (queries, RPC, storage) into a single string.
 *
 * Lookup order:
 *   1. `error.context.body` (JSON-parsed message / details / hint)
 *   2. `error.message`
 *   3. `"Unknown error"`
 */
export function formatSupabaseError(err: unknown): string {
  const fromContext = readContextBody(err);
  if (fromContext) return fromContext;
  const any = extractAnyMessage(err);
  if (any) return any;
  return 'Unknown error';
}

/**
 * Format an error returned from `supabase.functions.invoke`. Same lookup as
 * `formatSupabaseError` but tuned for the `FunctionsHttpError` shape (which
 * wraps the JSON response in `error.context.body` as a string).
 */
export function formatEdgeFunctionError(err: unknown): string {
  // FunctionsHttpError nests the response object in `.context` (a Response).
  // When we have a Response, we cannot read it synchronously — fall back to
  // the standard extraction chain.
  const fromContext = readContextBody(err);
  if (fromContext) return fromContext;
  const any = extractAnyMessage(err);
  if (any) return any;
  return 'Unknown error';
}

// ---------- telemetry sink ----------------------------------------------------

export interface ReportErrorContext {
  /** Logical surface the error occurred in, e.g. `editor.save`. */
  surface: string;
  /** Specific action attempted, e.g. `persist-project`. */
  action: string;
  /** Optional structured extras. Keep small + PII-free. */
  extra?: Record<string, unknown>;
}

interface ClientErrorPayload {
  surface: string;
  action: string;
  message: string;
  stack: string | null;
  user_agent: string | null;
  page_url: string | null;
  extra: Record<string, unknown> | null;
}

function buildPayload(err: unknown, ctx: ReportErrorContext): ClientErrorPayload {
  const message = formatSupabaseError(err);
  const stack = err instanceof Error && typeof err.stack === 'string'
    ? err.stack.slice(0, 8000)
    : null;
  return {
    surface: String(ctx.surface).slice(0, 120),
    action: String(ctx.action).slice(0, 120),
    message: message.slice(0, 2000),
    stack,
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 500) : null,
    page_url: typeof window !== 'undefined' ? window.location.href.slice(0, 1000) : null,
    extra: ctx.extra ? sanitizeExtra(ctx.extra) : null,
  };
}

function sanitizeExtra(extra: Record<string, unknown>): Record<string, unknown> | null {
  try {
    // Round-trip through JSON to drop functions / cyclic refs.
    return JSON.parse(JSON.stringify(extra));
  } catch {
    return null;
  }
}

// Dedupe so a render-loop bug cannot flood the table.
const REPORT_DEDUP_WINDOW_MS = 5_000;
const recentReports = new Map<string, number>();

function dedupKey(payload: ClientErrorPayload): string {
  return `${payload.surface}|${payload.action}|${payload.message}`;
}

/**
 * Non-blocking client error report. Never throws, never awaits the caller.
 * Posts to the public `report-client-error` edge function which inserts a row
 * into `client_errors`. Used by both `surfaceError` and `RootErrorBoundary`.
 */
export function reportClientError(err: unknown, ctx: ReportErrorContext): void {
  if (typeof window === 'undefined') return;
  const endpoint = reportEndpoint();
  if (!endpoint) return;

  let payload: ClientErrorPayload;
  try { payload = buildPayload(err, ctx); }
  catch { return; }

  const key = dedupKey(payload);
  const now = Date.now();
  const last = recentReports.get(key) ?? 0;
  if (now - last < REPORT_DEDUP_WINDOW_MS) return;
  recentReports.set(key, now);

  // Fire-and-forget. `keepalive` lets the request survive a page unload during
  // crash recovery. Errors during reporting are swallowed by design.
  try {
    void fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
      credentials: 'omit',
    }).catch(() => { /* silent */ });
  } catch {
    // Swallow synchronous fetch construction errors (legacy browsers).
  }
}

// Bind the current auth user_id when available so the row can be attributed.
async function attachUserId(payload: ClientErrorPayload & { user_id?: string }): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    if (data?.user?.id) payload.user_id = data.user.id;
  } catch { /* anonymous report */ }
}

/**
 * Authenticated variant of `reportClientError` — best-effort attribution. Use
 * from contexts where we want the report tied to the current user.
 */
export function reportClientErrorWithUser(err: unknown, ctx: ReportErrorContext): void {
  if (typeof window === 'undefined') return;
  const endpoint = reportEndpoint();
  if (!endpoint) return;

  let payload: (ClientErrorPayload & { user_id?: string });
  try { payload = buildPayload(err, ctx); }
  catch { return; }

  const key = dedupKey(payload);
  const now = Date.now();
  const last = recentReports.get(key) ?? 0;
  if (now - last < REPORT_DEDUP_WINDOW_MS) return;
  recentReports.set(key, now);

  void (async () => {
    await attachUserId(payload);
    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
        credentials: 'omit',
      });
    } catch { /* silent */ }
  })();
}

// ---------- toast wrapper -----------------------------------------------------

export interface SurfaceErrorOptions {
  /** Override the toast description (defaults to extracted error message). */
  description?: string;
  /** If false, suppresses the toast (telemetry still fires). Default true. */
  toast?: boolean;
  /** Telemetry context — if omitted we still log to console but skip the POST. */
  context?: ReportErrorContext;
}

/**
 * The canonical "an async thing failed" handler. Wraps the formatter, fires a
 * branded toast, and reports the error to telemetry. Returns the surfaced
 * message string for callers that want it (e.g. inline UI).
 *
 * @example
 * try { await supabase.functions.invoke('save-project', ...); }
 * catch (e) { surfaceError(e, "Couldn't save — try again.", { surface: 'editor', action: 'save' }); }
 */
export function surfaceError(
  err: unknown,
  fallback: string,
  options: SurfaceErrorOptions | ReportErrorContext = {},
): string {
  // Accept either a full options object or a bare context for ergonomic call sites.
  const opts: SurfaceErrorOptions = (() => {
    if (!options || typeof options !== 'object') return {};
    const rec = options as Record<string, unknown>;
    if ('surface' in rec && 'action' in rec) {
      return { context: options as ReportErrorContext };
    }
    return options as SurfaceErrorOptions;
  })();

  const extracted = extractAnyMessage(err) ?? readContextBody(err);
  const message = extracted && extracted.toLowerCase() !== 'unknown error'
    ? `${fallback} — ${extracted}`
    : fallback;

  if (opts.toast !== false) {
    toast.error(fallback, {
      description: opts.description ?? extracted ?? undefined,
    });
  }

  if (opts.context) {
    reportClientError(err, opts.context);
  } else if (import.meta.env?.DEV) {
    // Dev-only nudge so devs notice when surfaceError lacks telemetry context.
    console.warn('[surfaceError] no context provided:', fallback, err);
  }

  return message;
}
