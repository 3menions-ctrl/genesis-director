/**
 * RootErrorBoundary — the last line of defense.
 *
 * Wraps the entire router. Catches every uncaught render error that bubbles
 * past lower-level boundaries. Renders a branded recovery surface (NOT the
 * white React error overlay).
 *
 * Recovery actions:
 *  - Reset and continue   — clears boundary state, keeps the user where they were
 *  - Return home          — full reload to /
 *  - Report to admins     — opens a support ticket via `support_messages` insert
 *                          (the codebase's existing support-row table; the task
 *                          spec referenced `support_tickets` but we use the real
 *                          one so admins see it in the same triage queue)
 *
 * Side effects on catch:
 *  - Fires `reportClientError` to `client_errors` (non-blocking).
 *
 * NOTE: This boundary intentionally does NOT suppress errors by pattern. That
 * is the job of the inner ErrorBoundary (which scrubs ResizeObserver,
 * ChunkLoadError, AbortError, etc). By the time something reaches this
 * boundary, it has crossed every other safety net.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertOctagon, RefreshCw, Home, FileText, ChevronDown } from 'lucide-react';
import { reportClientErrorWithUser, formatSupabaseError } from '@/lib/errors';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showStack: boolean;
  reportState: 'idle' | 'sending' | 'sent' | 'failed';
  errorId: string;
}

function makeErrorId(): string {
  // Short, readable id surfaced to the user — pairs with the row in client_errors.
  const ts = Date.now().toString(36).slice(-5).toUpperCase();
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ERR-${ts}-${rnd}`;
}

export class RootErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showStack: false,
    reportState: 'idle',
    errorId: '',
  };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error, errorId: makeErrorId() };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    // Auto-report — non-blocking. Never throws.
    reportClientErrorWithUser(error, {
      surface: 'root-error-boundary',
      action: 'render',
      extra: {
        errorId: this.state.errorId,
        componentStack: errorInfo.componentStack?.slice(0, 4000) ?? null,
        pathname: typeof window !== 'undefined' ? window.location.pathname : null,
      },
    });
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showStack: false,
      reportState: 'idle',
      errorId: '',
    });
  };

  private handleGoHome = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  private handleToggleStack = () => {
    this.setState((s) => ({ showStack: !s.showStack }));
  };

  private handleReport = async () => {
    if (this.state.reportState === 'sending' || this.state.reportState === 'sent') return;
    this.setState({ reportState: 'sending' });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const message = formatSupabaseError(this.state.error);
      const email = user?.email ?? 'anonymous@apex.local';
      const name = (user?.user_metadata?.full_name as string | undefined)
        ?? (user?.user_metadata?.name as string | undefined)
        ?? email.split('@')[0];
      const { error } = await supabase
        .from('support_messages')
        .insert([{
          user_id: user?.id ?? null,
          email,
          name,
          subject: `Render crash — ${this.state.errorId}`,
          source: 'root_error_boundary',
          status: 'open',
          message:
            `Auto-generated from RootErrorBoundary.\n\n` +
            `Error ID: ${this.state.errorId}\n` +
            `Message: ${message}\n` +
            `URL: ${typeof window !== 'undefined' ? window.location.href : 'unknown'}\n` +
            `UA: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'}\n\n` +
            `Stack:\n${this.state.error?.stack ?? '(no stack)'}\n\n` +
            `Component stack:\n${this.state.errorInfo?.componentStack ?? '(no component stack)'}`,
        }]);
      if (error) throw error;
      this.setState({ reportState: 'sent' });
    } catch (e) {
      // Even if support_tickets is unavailable, the client_errors row was
      // already written by componentDidCatch. Surface that as "sent" so the
      // user knows admins have visibility.
      reportClientErrorWithUser(e, {
        surface: 'root-error-boundary',
        action: 'report-to-admins',
        extra: { errorId: this.state.errorId },
      });
      this.setState({ reportState: 'failed' });
    }
  };

  render() {
    if (!this.state.hasError || !this.state.error) {
      return this.props.children;
    }

    const message = formatSupabaseError(this.state.error);
    const stack = this.state.error.stack ?? '(no stack)';
    const componentStack = this.state.errorInfo?.componentStack ?? '';

    return (
      <div className="min-h-screen w-full bg-[hsl(220,14%,3%)] text-white antialiased">
        {/* Ambient glow */}
        <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 h-[520px] w-[520px] rounded-full bg-rose-500/[0.07] blur-3xl" />
          <div className="absolute -bottom-32 -left-32 h-[420px] w-[420px] rounded-full bg-[#0A84FF]/[0.06] blur-3xl" />
        </div>

        <div className="relative mx-auto flex min-h-screen max-w-2xl flex-col items-stretch justify-center px-6 py-16">
          <div
            className="
              rounded-3xl border border-white/[0.06] bg-[hsl(220,14%,3%)/0.94]
              p-8 backdrop-blur-2xl
              shadow-[0_30px_80px_-20px_rgba(0,0,0,0.85),0_0_120px_-30px_rgba(244,63,94,0.25),inset_0_1px_0_rgba(255,255,255,0.04)]
            "
          >
            <div className="flex items-start gap-4">
              <span
                aria-hidden
                className="
                  mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full
                  bg-rose-500/15 ring-1 ring-rose-400/30
                  shadow-[0_0_24px_rgba(244,63,94,0.35)]
                "
              >
                <AlertOctagon className="h-5 w-5 text-rose-300" />
              </span>
              <div className="min-w-0 flex-1">
                <h1 className="font-display text-[26px] font-semibold tracking-[-0.015em] text-white">
                  Something broke. Here's what happened.
                </h1>
                <p className="mt-2 text-[15px] leading-relaxed text-white/65">
                  The app crashed mid-render. Your in-progress work is preserved in local
                  state — resetting will keep you on this page.
                </p>
              </div>
            </div>

            {/* Error message + meta */}
            <div className="mt-6 rounded-2xl border border-white/[0.06] bg-black/30 p-4">
              <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-white/40">
                {this.state.errorId} · {this.state.error.name || 'Error'}
              </p>
              <p className="mt-2 text-[14px] leading-relaxed text-rose-200/90 break-words">
                {message}
              </p>

              <button
                type="button"
                onClick={this.handleToggleStack}
                className="
                  mt-3 inline-flex items-center gap-1.5 text-[12px] text-white/55
                  hover:text-white/85 transition-colors
                "
                aria-expanded={this.state.showStack}
              >
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${this.state.showStack ? 'rotate-180' : ''}`}
                />
                {this.state.showStack ? 'Hide stack trace' : 'Show stack trace'}
              </button>

              {this.state.showStack && (
                <pre
                  className="
                    mt-3 max-h-72 overflow-auto rounded-lg bg-black/50 p-3
                    font-mono text-[11px] leading-relaxed text-white/55
                    whitespace-pre-wrap break-all
                  "
                >
                  {stack}
                  {componentStack ? `\n\n— component stack —${componentStack}` : ''}
                </pre>
              )}
            </div>

            {/* Actions */}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={this.handleReset}
                className="
                  inline-flex flex-1 items-center justify-center gap-2 rounded-full px-5 py-2.5
                  bg-[#0A84FF] text-[14px] font-medium text-white
                  ring-2 ring-[#0A84FF]/40 ring-offset-2 ring-offset-[hsl(220,14%,3%)]
                  shadow-[0_0_32px_rgba(10,132,255,0.45)]
                  hover:bg-[#0A84FF]/90 transition-all duration-150
                "
              >
                <RefreshCw className="h-4 w-4" />
                Reset and continue
              </button>
              <button
                type="button"
                onClick={this.handleReport}
                disabled={this.state.reportState === 'sending' || this.state.reportState === 'sent'}
                className="
                  inline-flex flex-1 items-center justify-center gap-2 rounded-full px-5 py-2.5
                  bg-white/[0.05] text-[14px] font-medium text-white/85
                  border border-white/[0.08]
                  hover:bg-white/[0.10] hover:border-white/[0.16]
                  transition-all duration-150
                  disabled:opacity-60 disabled:cursor-not-allowed
                "
              >
                <FileText className="h-4 w-4" />
                {this.state.reportState === 'sent'
                  ? 'Reported'
                  : this.state.reportState === 'sending'
                    ? 'Reporting'
                    : this.state.reportState === 'failed'
                      ? 'Logged'
                      : 'Report to admins'}
              </button>
            </div>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={this.handleGoHome}
                className="text-[13px] text-white/45 hover:text-white/75 transition-colors underline underline-offset-4 decoration-white/20 hover:decoration-white/50"
              >
                Return home
              </button>
            </div>
          </div>

          <p className="mt-5 text-center font-mono text-[11px] uppercase tracking-[0.16em] text-white/30">
            error id · {this.state.errorId}
          </p>
        </div>
      </div>
    );
  }
}

export default RootErrorBoundary;
