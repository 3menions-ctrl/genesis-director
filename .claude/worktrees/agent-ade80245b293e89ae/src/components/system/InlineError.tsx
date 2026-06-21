/**
 * InlineError — standardized in-context error chip.
 *
 * Use this instead of a toast when the error belongs next to the action that
 * triggered it: forms, panels, long-form editors. Toasts disappear; inline
 * errors persist until the user retries or dismisses.
 *
 * Design:
 *  - Dark surface, restrained rose accent ring.
 *  - Monospace meta line for the error code / id.
 *  - Direct copy. No "Oops!".
 *  - Retry is the primary CTA when the caller provides `onRetry`.
 */

import { useCallback, useState } from 'react';
import { AlertCircle, RefreshCw, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatSupabaseError, reportClientError } from '@/lib/errors';

export interface InlineErrorProps {
  /** Error object or message. If an object, we extract via `formatSupabaseError`. */
  error: unknown;
  /** Headline. Direct. e.g. "Couldn't save". Defaults to "Action failed". */
  title?: string;
  /** Override the message. Defaults to the extracted error message. */
  message?: string;
  /** Optional machine code shown in the monospace meta line. */
  code?: string;
  /** Called when the user clicks Retry. Hides the button if omitted. */
  onRetry?: () => void | Promise<void>;
  /** Called when the user dismisses. Hides the X button if omitted. */
  onDismiss?: () => void;
  /** Auto-report telemetry context. Strongly encouraged. */
  reportContext?: { surface: string; action: string; extra?: Record<string, unknown> };
  /** Tailwind class overrides. */
  className?: string;
  /** Visual density. `compact` removes the meta line. */
  density?: 'default' | 'compact';
}

export function InlineError({
  error,
  title = 'Action failed',
  message,
  code,
  onRetry,
  onDismiss,
  reportContext,
  className,
  density = 'default',
}: InlineErrorProps) {
  const [retrying, setRetrying] = useState(false);
  const [reported, setReported] = useState(false);
  const resolvedMessage = message ?? formatSupabaseError(error);

  // Telemetry — fire once per mount.
  if (reportContext && !reported) {
    setReported(true);
    reportClientError(error, reportContext);
  }

  const handleRetry = useCallback(async () => {
    if (!onRetry || retrying) return;
    setRetrying(true);
    try { await onRetry(); }
    finally { setRetrying(false); }
  }, [onRetry, retrying]);

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        'relative flex items-start gap-3 rounded-xl border px-4 py-3',
        'border-rose-400/25 bg-rose-500/[0.06]',
        'shadow-[0_0_40px_-8px_rgba(244,63,94,0.18),inset_0_1px_0_rgba(244,63,94,0.08)]',
        className,
      )}
    >
      <span
        aria-hidden
        className="mt-[2px] flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-500/15"
      >
        <AlertCircle className="h-3.5 w-3.5 text-rose-300" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-display text-[14px] font-semibold leading-snug text-white">
            {title}
          </p>
        </div>
        <p className="mt-0.5 text-[13px] leading-relaxed text-white/65">
          {resolvedMessage}
        </p>
        {density === 'default' && code ? (
          <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-white/35">
            {code}
          </p>
        ) : null}

        {(onRetry || onDismiss) && (
          <div className="mt-3 flex items-center gap-2">
            {onRetry && (
              <button
                type="button"
                onClick={handleRetry}
                disabled={retrying}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium',
                  'bg-white/[0.06] text-white/85 ring-1 ring-rose-300/30',
                  'hover:bg-white/[0.10] hover:ring-rose-300/55',
                  'transition-all duration-150',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
              >
                <RefreshCw className={cn('h-3 w-3', retrying && 'animate-spin')} />
                {retrying ? 'Retrying' : 'Retry'}
              </button>
            )}
          </div>
        )}
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className={cn(
            'absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-md',
            'text-white/35 hover:text-white/80 hover:bg-white/[0.06] transition-colors',
          )}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export default InlineError;
