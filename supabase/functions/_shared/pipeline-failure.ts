/**
 * pipeline-failure.ts — Standardized terminal-failure handler.
 *
 * Every pipeline (Hollywood / Seedance / Watchdog / Webhook) MUST call
 * `markProjectFailedAndRefund` on terminal failure so the user:
 *
 *   1. sees a human-readable `last_error` on their project card,
 *   2. gets credits refunded for undelivered work (idempotently),
 *   3. retains resumable pipeline_state for "Resume" flows.
 *
 * Idempotency key is derived from projectId + stage so retries never
 * double-refund.
 */

// deno-lint-ignore-file no-explicit-any

const MAX_ERROR_LEN = 500;

/** Sanitize an error message: strip stack traces, secrets, and clip length. */
export function sanitizeError(err: unknown): string {
  let msg = '';
  if (err instanceof Error) msg = err.message || err.name || 'Pipeline failure';
  else if (typeof err === 'string') msg = err;
  else if (err && typeof err === 'object') {
    msg = (err as any).message || (err as any).error || JSON.stringify(err).slice(0, MAX_ERROR_LEN);
  } else msg = 'Unknown pipeline failure';

  // Strip common secret patterns
  msg = msg
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
    .replace(/sk-[A-Za-z0-9_-]{16,}/g, '[redacted]')
    .replace(/r8_[A-Za-z0-9]{16,}/g, '[redacted]')
    .replace(/eyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[jwt]');

  // First line only, capped
  msg = msg.split('\n')[0].trim();
  return msg.length > MAX_ERROR_LEN ? msg.slice(0, MAX_ERROR_LEN - 1) + '…' : msg;
}

export interface FailureContext {
  projectId: string;
  userId?: string | null;
  stage?: string;                 // e.g. 'preproduction' | 'production' | 'postproduction'
  reason: unknown;                // error or message
  /** Total credits originally deducted for this project (state.totalCredits). */
  totalCredits?: number | null;
  /** Clips originally planned. */
  expectedClipCount?: number | null;
  /** Clips that successfully completed before the failure. */
  completedClipCount?: number | null;
  /** Optional override status (e.g. 'payment_failed'). Default 'failed'. */
  status?: string;
  /** Skip credit refund (e.g. resume flows where credits already returned). */
  skipRefund?: boolean;
  /** Source label, e.g. 'hollywood' | 'seedance' | 'watchdog'. */
  source?: string;
}

export interface FailureOutcome {
  errorMessage: string;
  refundAmount: number;
  refunded: boolean;
}

/**
 * Persist failure state to `movie_projects` and refund unused credits.
 * Safe to call multiple times — refund is idempotent on the project+stage key.
 */
export async function markProjectFailedAndRefund(
  supabase: any,
  ctx: FailureContext,
): Promise<FailureOutcome> {
  const errorMessage = sanitizeError(ctx.reason);
  const stage = ctx.stage || 'unknown';
  const source = ctx.source || 'pipeline';
  const status = ctx.status || 'failed';

  // 1) Compute refund amount: (planned − delivered) × per-clip credits
  let refundAmount = 0;
  if (
    !ctx.skipRefund &&
    ctx.userId &&
    typeof ctx.totalCredits === 'number' &&
    ctx.totalCredits > 0 &&
    typeof ctx.expectedClipCount === 'number' &&
    ctx.expectedClipCount > 0
  ) {
    const completed = Math.max(0, ctx.completedClipCount ?? 0);
    const missing = Math.max(0, ctx.expectedClipCount - completed);
    if (missing > 0) {
      // Proportional refund, computed in ONE step and rounded UP. The
      // previous `floor(total/expected) * missing` floored the per-clip
      // value first, compounding the rounding loss across every missing
      // clip and systematically short-changing the user on OUR failure.
      // Single-step + ceil favors the user; we cap at totalCredits so a
      // rounding-up can never refund more than was charged.
      refundAmount = Math.min(
        ctx.totalCredits,
        Math.ceil((ctx.totalCredits * missing) / ctx.expectedClipCount),
      );
    }
  }

  // 2) Persist failure to project row (status + last_error + resumable hint)
  try {
    // Read current pipeline_state to merge instead of clobber
    const { data: cur } = await supabase
      .from('movie_projects')
      .select('pipeline_state')
      .eq('id', ctx.projectId)
      .maybeSingle();

    const prevState = (cur?.pipeline_state ?? {}) as Record<string, unknown>;
    const nextState = {
      ...prevState,
      error: errorMessage,
      errorStage: stage,
      errorSource: source,
      failedAt: new Date().toISOString(),
      refundAmount,
    };

    await supabase
      .from('movie_projects')
      .update({
        status,
        last_error: errorMessage,
        pipeline_state: nextState,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ctx.projectId);
  } catch (e) {
    console.error('[pipeline-failure] Failed to persist failure row:', e);
  }

  // 3) Idempotent refund via SECURITY DEFINER RPC
  let refunded = false;
  if (refundAmount > 0 && ctx.userId) {
    try {
      const { error } = await supabase.rpc('refund_credits', {
        p_user_id: ctx.userId,
        p_amount: refundAmount,
        p_description: `Auto-refund (${source}, ${stage}): ${errorMessage.slice(0, 120)}`,
        p_project_id: ctx.projectId,
        p_idempotency_key: `failure:${ctx.projectId}:${stage}`,
      });
      if (error) {
        console.error('[pipeline-failure] refund_credits RPC error:', error);
      } else {
        refunded = true;
        console.log(`[pipeline-failure] ✓ refunded ${refundAmount} credits (${source}/${stage})`);

        // Tell the user, in-app. Best-effort — failure here doesn't undo
        // the refund. The notification row is keyed on idempotency
        // shape (project_id + refunded_at) so retries don't double-notify.
        try {
          const { data: existing } = await supabase
            .from('notifications')
            .select('id')
            .eq('user_id', ctx.userId)
            .eq('type', 'video_complete')
            .contains('data', { project_id: ctx.projectId, kind: 'refund' })
            .limit(1)
            .maybeSingle();
          if (!existing) {
            await supabase.from('notifications').insert({
              user_id: ctx.userId,
              type: 'video_complete',
              title: `Refunded ${refundAmount} credit${refundAmount === 1 ? '' : 's'}`,
              body: `Your render hit a snag at "${stage}" — we credited you back. Try again from your library.`,
              data: {
                project_id: ctx.projectId,
                kind: 'refund',
                amount: refundAmount,
                action_url: `/production/${ctx.projectId}`,
              },
            });
          }
        } catch (notifErr) {
          console.warn('[pipeline-failure] refund notification insert failed:', notifErr);
        }
      }
    } catch (e) {
      console.error('[pipeline-failure] refund_credits threw:', e);
    }
  }

  // 4) Release any active credit hold attached to this project (idempotent).
  //    Pipelines using the new reserve/hold pattern attach `credit_hold_id`
  //    on the project row; release_credit_hold is a no-op when the hold is
  //    already consumed/released, so this is always safe to call.
  try {
    const { releasePipelineCredits } = await import('./pipeline-credits.ts');
    const released = await releasePipelineCredits({
      supabase,
      projectId: ctx.projectId,
      reason: `Pipeline ${source}/${stage} failed: ${errorMessage.slice(0, 120)}`,
    });
    if (released.success) {
      console.log(`[pipeline-failure] ✓ credit hold released (${source}/${stage})`);
    }
  } catch (e) {
    console.warn('[pipeline-failure] release_credit_hold threw (non-fatal):', e);
  }

  return { errorMessage, refundAmount, refunded };
}