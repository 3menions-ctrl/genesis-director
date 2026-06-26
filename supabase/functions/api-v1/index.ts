import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { checkRateLimitDb, hasScope, requiredScopeForRequest } from '../_shared/rate-limiter.ts';

// @public-endpoint
// Public Small Bridges API. Authentication is performed via `x-api-key`
// (apx_live_...) which is sha256-hashed and looked up in api_keys; an
// invalid key yields 401. Supabase-JWT auth is intentionally disabled
// because this endpoint is consumed by third-party servers without a JWT.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-api-key, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

/**
 * Public Small Bridges API gateway.
 *
 *   POST /api-v1/videos       — generate a clip   (10 credits)
 *   POST /api-v1/avatars      — generate an avatar image (5 credits)
 *   POST /api-v1/photo-edit   — edit a photo      (2 credits)
 *   GET  /api-v1/projects     — list projects
 *   GET  /api-v1/clips        — list completed clips
 *
 * Auth: header `x-api-key: apx_live_...` (or Authorization: Bearer apx_live_...).
 * Pricing: deducted from the user's existing credit balance ($0.10/credit).
 */

const PRICING: Record<string, number> = {
  '/videos': 10,
  '/avatars': 5,
  '/photo-edit': 2,
};

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function extractApiKey(req: Request): string | null {
  const xKey = req.headers.get('x-api-key');
  if (xKey?.startsWith('apx_')) return xKey.trim();
  const auth = req.headers.get('authorization');
  if (auth?.toLowerCase().startsWith('bearer apx_')) {
    return auth.slice(7).trim();
  }
  return null;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  // path inside the function, e.g. /videos
  const subPath =
    '/' + url.pathname.replace(/^\/+/, '').split('/').slice(1).join('/');
  const requestId = crypto.randomUUID();

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // ── 1. Authenticate the API key ──────────────────────────────────────────
  const rawKey = extractApiKey(req);
  if (!rawKey) {
    return jsonResponse(
      { error: 'Missing API key. Send `x-api-key: apx_live_...` header.' },
      401
    );
  }
  const keyHash = await sha256Hex(rawKey);
  const { data: ownerRow, error: ownerErr } = await admin.rpc('find_api_key_owner', {
    p_key_hash: keyHash,
  });
  if (ownerErr || !ownerRow || ownerRow.length === 0) {
    return jsonResponse({ error: 'Invalid or revoked API key.' }, 401);
  }
  const apiKeyId = ownerRow[0].api_key_id as string;
  const userId = ownerRow[0].owner_user_id as string;

  // Resolve the key's scopes. find_api_key_owner returns them (see migration
  // 20260705000400_api_key_scopes.sql); fall back to a follow-up select for
  // older deployments where the RPC hasn't been updated yet.
  let scopes = (ownerRow[0] as { scopes?: string[] }).scopes;
  if (!Array.isArray(scopes)) {
    const { data: keyRow } = await admin
      .from('api_keys')
      .select('scopes')
      .eq('id', apiKeyId)
      .maybeSingle();
    scopes = (keyRow as { scopes?: string[] } | null)?.scopes ?? ['read', 'generate'];
  }

  // ── 1a. Per-key rate limit (120 req/min, DB-backed & cross-isolate) ──────
  // Fail CLOSED on RPC error — this gateway spends credits.
  const rateOk = await checkRateLimitDb(admin, `api-v1:${apiKeyId}`, 120, 60);
  if (!rateOk) {
    return jsonResponse(
      { error: 'Rate limit exceeded. Max 120 requests/minute per API key.' },
      429,
    );
  }

  // ── 1b. Scope enforcement ────────────────────────────────────────────────
  const neededScope = requiredScopeForRequest(req.method);
  if (!hasScope(scopes, neededScope)) {
    return jsonResponse(
      { error: `API key is missing the '${neededScope}' scope required for this endpoint.` },
      403,
    );
  }

  // touch last_used_at (fire & forget)
  admin
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', apiKeyId)
    .then(() => {});

  const log = async (statusCode: number, creditsCharged: number, errorMsg?: string) => {
    await admin.from('api_usage_logs').insert({
      user_id: userId,
      api_key_id: apiKeyId,
      endpoint: subPath,
      status_code: statusCode,
      credits_charged: creditsCharged,
      request_id: requestId,
      error_message: errorMsg ?? null,
    });
  };

  try {
    // ── 2. GET endpoints (read-only, no credits) ───────────────────────────
    if (req.method === 'GET' && subPath === '/projects') {
      const { data, error } = await admin
        .from('projects')
        .select('id, title, status, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      await log(200, 0);
      return jsonResponse({ request_id: requestId, projects: data });
    }

    if (req.method === 'GET' && subPath === '/clips') {
      const { data, error } = await admin
        .from('video_clips')
        .select('id, project_id, shot_index, video_url, duration_seconds, prompt, created_at')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      await log(200, 0);
      return jsonResponse({ request_id: requestId, clips: data });
    }

    if (req.method === 'GET' && subPath === '/me') {
      const { data: profile } = await admin
        .from('profiles')
        .select('credits_balance, display_name, email')
        .eq('id', userId)
        .maybeSingle();
      await log(200, 0);
      return jsonResponse({
        request_id: requestId,
        user: profile,
        pricing: { credit_usd: 0.1, endpoints: PRICING },
      });
    }

    // ── 3. POST endpoints (credit-gated) ───────────────────────────────────
    if (req.method !== 'POST') {
      await log(405, 0, 'method not allowed');
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    const cost = PRICING[subPath];
    if (cost === undefined) {
      await log(404, 0, 'unknown endpoint');
      return jsonResponse({ error: `Unknown endpoint: ${subPath}` }, 404);
    }

    // Parse the body BEFORE charging so we can derive an idempotency key
    // and (optionally) the project context for the deduction.
    const body = await req.json().catch(() => ({}));

    // L13: idempotency for the charge. A client may supply `idempotencyKey`
    // to make retries safe; otherwise we hash the request shape. Note:
    // deduct_credits only dedupes when BOTH idempotency_key AND project_id
    // are present, so pass project_id through when the caller provides one.
    const projectId =
      typeof body.project_id === 'string' && body.project_id
        ? body.project_id
        : null;
    const idempotencyKey =
      typeof body.idempotencyKey === 'string' && body.idempotencyKey
        ? body.idempotencyKey
        : await sha256Hex(`${req.method}:${subPath}:${userId}:${JSON.stringify(body)}`);

    // credit check + deduct
    const { data: profile } = await admin
      .from('profiles')
      .select('credits_balance')
      .eq('id', userId)
      .maybeSingle();
    const balance = profile?.credits_balance ?? 0;
    if (balance < cost) {
      await log(402, 0, 'insufficient credits');
      return jsonResponse(
        {
          error: 'Insufficient credits',
          required: cost,
          available: balance,
          purchase_url: 'https://smallbridges.co/pricing',
        },
        402
      );
    }

    const { data: deductOk, error: deductErr } = await admin.rpc('deduct_credits', {
      p_user_id: userId,
      p_amount: cost,
      p_description: `api-v1 ${subPath}`,
      p_project_id: projectId,
      p_idempotency_key: idempotencyKey,
    });
    if (deductErr || deductOk !== true) {
      await log(402, 0, deductErr?.message || 'deduct failed');
      return jsonResponse({ error: 'Could not reserve credits' }, 402);
    }

    const refund = async (reason: string) => {
      // refund_credits' parameter is p_description, not p_reason (audit D15) —
      // the wrong name made every API-user refund a no-op (function-not-found,
      // error swallowed), so callers were charged for failed generations and
      // never refunded.
      const { error } = await admin.rpc('refund_credits', {
        p_user_id: userId,
        p_amount: cost,
        p_description: `api-v1 ${subPath} failed: ${reason}`,
      });
      if (error) console.error('[api-v1] refund failed', error);
    };

    // dispatch
    let upstreamResp: Response;
    if (subPath === '/videos') {
      const prompt = String(body.prompt || '').trim();
      if (!prompt) {
        await refund('missing prompt');
        await log(400, 0, 'missing prompt');
        return jsonResponse({ error: '`prompt` is required' }, 400);
      }
      upstreamResp = await admin.functions.invoke('generate-single-clip', {
        body: {
          prompt,
          duration: Number(body.duration) || 5,
          aspect_ratio: body.aspect_ratio || '16:9',
          start_image: body.start_image || null,
          user_id: userId,
          source: 'api-v1',
          skip_credit_deduction: false, // already deducted here; downstream must respect this
        },
      }) as unknown as Response;
    } else if (subPath === '/avatars') {
      const prompt = String(body.prompt || '').trim();
      if (!prompt) {
        await refund('missing prompt');
        await log(400, 0, 'missing prompt');
        return jsonResponse({ error: '`prompt` is required' }, 400);
      }
      upstreamResp = await admin.functions.invoke('generate-avatar-image', {
        body: { prompt, user_id: userId, source: 'api-v1' },
      }) as unknown as Response;
    } else {
      // /photo-edit
      const imageUrl = String(body.image_url || '');
      const instruction = String(body.instruction || '');
      if (!imageUrl || !instruction) {
        await refund('missing image_url or instruction');
        await log(400, 0, 'missing fields');
        return jsonResponse(
          { error: '`image_url` and `instruction` are required' },
          400
        );
      }
      upstreamResp = await admin.functions.invoke('edit-photo', {
        body: { imageUrl, instruction, user_id: userId, source: 'api-v1' },
      }) as unknown as Response;
    }

    // Supabase functions.invoke returns { data, error }
    const inv = upstreamResp as unknown as { data: unknown; error: { message: string } | null };
    if (inv.error) {
      await refund(inv.error.message);
      await log(502, 0, inv.error.message);
      return jsonResponse({ error: "upstream_failed", message: "The generation service is temporarily unavailable. Please try again.", request_id: requestId }, 502);
    }

    await log(200, cost);
    return jsonResponse({
      request_id: requestId,
      credits_charged: cost,
      result: inv.data,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[api-v1] error:', msg);
    await log(500, 0, msg);
    return jsonResponse({ error: "internal_error", message: "Something went wrong processing your request.", request_id: requestId }, 500);
  }
});