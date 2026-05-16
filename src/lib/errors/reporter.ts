/**
 * Single sink for typed application errors.
 *
 * Routes:
 *   - dev:  console + (optional) toast
 *   - prod: console-shielded + persist to `error_reports` + toast for severity >= error
 *
 * Persistence is best-effort and non-blocking. Reporter failures are silently
 * dropped to avoid recursive error loops.
 */

import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { AppError, ErrorSeverity } from './AppError';
import { toAppError } from './AppError';

const DEV = import.meta.env?.DEV ?? false;
const APP_VERSION = (import.meta.env?.VITE_APP_VERSION as string | undefined) ?? 'dev';

// Deduplicate identical errors within a short window so a render-loop bug
// cannot flood the table.
const DEDUP_WINDOW_MS = 5000;
const recent = new Map<string, number>();

function shouldToast(severity: ErrorSeverity): boolean {
  return severity === 'error' || severity === 'fatal';
}

function dedupKey(err: AppError): string {
  return `${err.category}|${err.code}|${err.technicalMessage}`;
}

function getSessionId(): string {
  try {
    const k = '__lov_session_id';
    const existing = sessionStorage.getItem(k);
    if (existing) return existing;
    const id = crypto.randomUUID();
    sessionStorage.setItem(k, id);
    return id;
  } catch { return 'no-session'; }
}

async function persist(err: AppError): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('error_reports').insert([{
      user_id: user?.id ?? null,
      category: err.category,
      severity: err.severity,
      code: err.code,
      user_message: err.userMessage,
      technical_message: err.technicalMessage.slice(0, 4000),
      stack: err.stack?.slice(0, 8000),
      context: JSON.parse(JSON.stringify(err.context ?? {})),
      page_url: typeof window !== 'undefined' ? window.location.href.slice(0, 1000) : null,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 500) : null,
      session_id: getSessionId(),
      app_version: APP_VERSION,
      retryable: err.retryable,
    }]);
  } catch {
    // Silent — reporter must never throw.
  }
}

/**
 * Report an `AppError`. Side-effects: console, optional toast, optional persistence.
 * Returns the same AppError for fluent use: `throw reportError(toAppError(e))`.
 */
export function reportError(err: AppError, opts: { silent?: boolean } = {}): AppError {
  const key = dedupKey(err);
  const now = Date.now();
  const last = recent.get(key) ?? 0;
  const isDup = now - last < DEDUP_WINDOW_MS;
  recent.set(key, now);

  if (!isDup) {
    if (DEV) {
      // Use console.error so devtools highlights it.
      console.error(`[AppError:${err.category}/${err.code}]`, err.technicalMessage, err.context, err.cause);
    } else if (err.severity === 'fatal' || err.severity === 'error') {
      console.warn(`[AppError:${err.category}/${err.code}]`);
    }
    if (!opts.silent && shouldToast(err.severity)) {
      toast.error(err.userMessage);
    }
    // Fire-and-forget persistence — never await.
    void persist(err);
  }
  return err;
}

/** Convenience: convert + report in one call. */
export function reportUnknown(err: unknown, source: string, context?: Record<string, unknown>): AppError {
  return reportError(toAppError(err, { source, context }));
}

/** Reset dedup cache on identity transitions so a fresh user gets fresh errors. */
export function resetErrorReporter(): void {
  recent.clear();
}