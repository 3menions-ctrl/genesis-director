// ============================================================================
// pipeline-credits.ts — Server-side idempotent credit hold/consume/release for
// every pipeline run.
//
// Pattern (replaces the old "deduct upfront → refund partial" flow):
//
//   START   → holdCreditsForPipeline()      // RPC reserve_credits()
//   SUCCESS → consumePipelineCredits()      // RPC consume_credit_hold()
//   FAILURE → releasePipelineCredits()      // RPC release_credit_hold()
//   CRON    → reconcile_pipeline_credit_holds() (in DB, every few minutes)
//
// All operations are idempotent:
//   * reserve_credits keys on `pipeline:{pipeline}:{projectId}` so retries
//     return the same holdId without double-charging.
//   * consume_credit_hold returns {reused:true} if the hold was already
//     consumed.
//   * release_credit_hold returns {alreadyReleased:true} if already released.
//
// The hold id is persisted on `movie_projects.credit_hold_id` so any later
// process (watchdog, webhook, reconciler, support tooling) can find and
// reconcile it.
// ============================================================================

// deno-lint-ignore-file no-explicit-any

const DEFAULT_TTL_SECONDS = 60 * 60; // 1h — long enough for slow Kling runs

export interface HoldArgs {
  supabase: any;
  userId: string;
  projectId: string | null | undefined;
  amount: number;
  pipeline: string;               // 'hollywood' | 'seedance' | 'avatar' | etc.
  description?: string;
  ttlSeconds?: number;
}

export interface HoldResult {
  success: boolean;
  holdId: string | null;
  amount: number;
  reused: boolean;
  error?: string;
  detail?: any;
}

/**
 * Reserve credits for a pipeline run. Persists the resulting holdId on the
 * project row (`credit_hold_id`) when projectId is known.
 *
 * Idempotency key: `pipeline:{pipeline}:{projectId}`. If the same pipeline
 * is dispatched twice for the same projectId, the same hold is returned —
 * never a second charge.
 */
export async function holdCreditsForPipeline(args: HoldArgs): Promise<HoldResult> {
  const { supabase, userId, projectId, amount, pipeline } = args;
  if (!userId)  return { success: false, holdId: null, amount: 0, reused: false, error: 'userId_required' };
  if (!amount || amount <= 0) {
    return { success: true, holdId: null, amount: 0, reused: false };
  }

  const idempotencyKey = projectId ? `pipeline:${pipeline}:${projectId}` : null;

  const { data, error } = await supabase.rpc('reserve_credits', {
    p_user_id:         userId,
    p_amount:          amount,
    p_project_id:      projectId ?? null,
    p_description:     args.description ?? `${pipeline} pipeline reservation`,
    p_idempotency_key: idempotencyKey,
    p_ttl_seconds:     args.ttlSeconds ?? DEFAULT_TTL_SECONDS,
  });

  if (error) {
    console.error('[pipeline-credits] reserve_credits error:', error);
    return { success: false, holdId: null, amount, reused: false, error: 'rpc_failed', detail: error.message };
  }

  const payload = (data || {}) as any;
  if (payload.success !== true) {
    return {
      success: false,
      holdId: null,
      amount,
      reused: false,
      error: payload.error || 'reserve_failed',
      detail: payload,
    };
  }

  const holdId: string | null = payload.holdId || payload.hold_id || null;
  const reused: boolean = payload.reused === true;

  // Persist the holdId on the project so later success/failure handlers
  // (and the reconciler) can always find it.
  if (holdId && projectId) {
    try {
      await supabase
        .from('movie_projects')
        .update({ credit_hold_id: holdId, updated_at: new Date().toISOString() })
        .eq('id', projectId);
    } catch (e) {
      console.warn('[pipeline-credits] failed to persist credit_hold_id (non-fatal):', e);
    }
  }

  return { success: true, holdId, amount, reused };
}

/**
 * Consume the credit hold attached to a project. Safe to call multiple times.
 * Looks up the holdId from `movie_projects.credit_hold_id` if not provided.
 */
export async function consumePipelineCredits(args: {
  supabase: any;
  projectId: string;
  holdId?: string | null;
  description?: string;
  clipDuration?: number | null;
}): Promise<{ success: boolean; reused?: boolean; amount?: number; error?: string }> {
  const { supabase, projectId } = args;
  let holdId = args.holdId ?? null;

  if (!holdId) {
    const { data: proj } = await supabase
      .from('movie_projects')
      .select('credit_hold_id')
      .eq('id', projectId)
      .maybeSingle();
    holdId = proj?.credit_hold_id ?? null;
  }

  if (!holdId) {
    // Nothing to do — pipeline likely used legacy deduct flow.
    return { success: true, reused: true };
  }

  const { data, error } = await supabase.rpc('consume_credit_hold', {
    p_hold_id:       holdId,
    p_description:   args.description ?? 'Pipeline completed',
    p_clip_duration: args.clipDuration ?? null,
  });

  if (error) {
    console.error('[pipeline-credits] consume_credit_hold error:', error);
    return { success: false, error: error.message };
  }
  const payload = (data || {}) as any;
  return {
    success: payload.success === true,
    reused: payload.reused === true,
    amount: payload.amount,
    error: payload.success === true ? undefined : payload.error,
  };
}

/**
 * Release the credit hold attached to a project. Safe to call multiple times.
 */
export async function releasePipelineCredits(args: {
  supabase: any;
  projectId: string;
  holdId?: string | null;
  reason?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { supabase, projectId } = args;
  let holdId = args.holdId ?? null;

  if (!holdId) {
    const { data: proj } = await supabase
      .from('movie_projects')
      .select('credit_hold_id')
      .eq('id', projectId)
      .maybeSingle();
    holdId = proj?.credit_hold_id ?? null;
  }

  if (!holdId) return { success: true };

  const { data, error } = await supabase.rpc('release_credit_hold', {
    p_hold_id: holdId,
    p_reason:  args.reason ?? 'Pipeline failed',
  });

  if (error) {
    console.error('[pipeline-credits] release_credit_hold error:', error);
    return { success: false, error: error.message };
  }
  const payload = (data || {}) as any;
  return { success: payload.success !== false };
}
