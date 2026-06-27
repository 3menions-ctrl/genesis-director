// ai-credit-gate.ts — rate-limit + credit gate for synchronous AI generation
// endpoints (text / single-image) that call a paid provider (OpenAI, Replicate).
//
// These endpoints were previously ungated: any authenticated caller could invoke
// them unlimited times at zero cost to themselves and direct cost to the company
// provider bill (launch blocker: unbounded spend). This adds two call sites:
//
//   const blocked = await preflightAiGate(ctx);   // AFTER auth/body-parse, BEFORE the provider call
//   if (blocked) return blocked;                   // 429 (rate limit) or 402 (insufficient credits)
//   ... call the provider, build the result ...
//   await chargeAiGate(ctx);                       // AFTER a SUCCESSFUL generation, before returning
//
// Routing: org-scoped generations (ctx.orgId set) charge the ORG POOL via
// consume_org_credits; everything else charges the user via deduct_credits
// (which itself routes to the org pool when ctx.projectId belongs to an org).
// Internal service-role callers are exempt (ctx.isServiceRole).
//
// Charge-on-success means a failed generation is not charged. The atomic charge
// RPCs are the authoritative enforcement; the pre-flight balance read only
// produces a clean 402 before spending the provider call and fails open if it
// can't read (the post-success charge still enforces).

import { checkRateLimitDb } from "./rate-limiter.ts";

export interface AiGateCtx {
  supabase: any;
  /** stable function name — used for the rate-limit key + charge description */
  fnName: string;
  userId: string | null;
  isServiceRole?: boolean;
  /** when set, charges the ORG pool (consume_org_credits) */
  orgId?: string | null;
  /** when set (and no orgId), deduct_credits routes org-via-project or personal */
  projectId?: string | null;
  /** credits to charge per successful generation */
  cost: number;
  /** per-user requests allowed per 24h */
  dailyCap: number;
  corsHeaders: Record<string, string>;
}

function json(status: number, body: unknown, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Per-user daily rate limit only (no credit check). Returns a 429 Response or
 * null. Use on success paths that do NOT call a paid provider and must not be
 * charged (e.g. a "user supplied their own content" passthrough) so they still
 * count against the abuse cap. A request must hit the limiter on exactly ONE
 * path — do not combine with preflightAiGate on the same request.
 */
export async function aiRateLimit(ctx: AiGateCtx): Promise<Response | null> {
  if (ctx.isServiceRole || !ctx.userId) return null; // internal/system calls exempt
  const allowed = await checkRateLimitDb(
    ctx.supabase,
    `${ctx.fnName}:${ctx.userId}`,
    ctx.dailyCap,
    86400,
  );
  if (!allowed) {
    return json(429, {
      error: "rate_limited",
      message: `Daily limit reached for this tool. Try again tomorrow or upgrade.`,
    }, ctx.corsHeaders);
  }
  return null;
}

/**
 * Gate BEFORE the provider call. Returns a Response (429 or 402) to return
 * immediately, or null to proceed. Service-role callers always proceed.
 */
export async function preflightAiGate(ctx: AiGateCtx): Promise<Response | null> {
  if (ctx.isServiceRole || !ctx.userId) return null; // internal/system calls exempt

  // 1) Per-user daily rate limit (fail-closed inside checkRateLimitDb).
  const limited = await aiRateLimit(ctx);
  if (limited) return limited;

  // 2) Best-effort balance pre-check for a clean 402 before spending the
  //    provider call. Fails OPEN — the atomic charge on success still enforces.
  try {
    let available: number | null = null;
    if (ctx.orgId) {
      const { data } = await ctx.supabase.rpc("get_org_credit_state", { p_org_id: ctx.orgId });
      if (data && data.success !== false) available = Number(data.available ?? data.balance ?? 0);
    } else {
      const { data } = await ctx.supabase.rpc("get_credit_state", { p_user_id: ctx.userId });
      if (data && data.success !== false) available = Number(data.available ?? 0);
    }
    if (available !== null && available < ctx.cost) {
      return json(402, {
        error: "insufficient_credits",
        message: "You don't have enough credits for this action.",
        required: ctx.cost,
        available,
      }, ctx.corsHeaders);
    }
  } catch (e) {
    console.warn(`[ai-credit-gate] balance pre-check failed for ${ctx.fnName} (failing open):`, e);
  }

  return null;
}

/**
 * Charge AFTER a successful generation. Atomic; best-effort (logs on failure so
 * a charge hiccup never fails an already-delivered generation). Returns the
 * charged amount (0 if exempt/failed).
 */
export async function chargeAiGate(ctx: AiGateCtx): Promise<number> {
  if (ctx.isServiceRole || !ctx.userId) return 0;
  try {
    if (ctx.orgId) {
      const { data, error } = await ctx.supabase.rpc("consume_org_credits", {
        p_org_id: ctx.orgId,
        p_amount: ctx.cost,
        p_reason: ctx.fnName,
        p_metadata: { fn: ctx.fnName },
      });
      if (error || data?.success === false) {
        console.error(`[ai-credit-gate] consume_org_credits failed for ${ctx.fnName}:`, error || data);
        return 0;
      }
    } else {
      const { data, error } = await ctx.supabase.rpc("deduct_credits", {
        p_user_id: ctx.userId,
        p_amount: ctx.cost,
        p_description: `${ctx.fnName} generation`,
        p_project_id: ctx.projectId ?? null,
      });
      // deduct_credits returns boolean false (or {success:false}) on insufficient.
      if (error || data === false || data?.success === false) {
        console.error(`[ai-credit-gate] deduct_credits failed for ${ctx.fnName}:`, error || data);
        return 0;
      }
    }
    return ctx.cost;
  } catch (e) {
    console.error(`[ai-credit-gate] charge threw for ${ctx.fnName}:`, e);
    return 0;
  }
}
