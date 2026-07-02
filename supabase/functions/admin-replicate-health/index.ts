/**
 * admin-replicate-health — ADMIN-ONLY render-credit health for the Replicate
 * account that powers all video generation + stitching.
 *
 * Replicate does NOT expose an account balance via API (verified: /v1/account
 * has no balance field; /v1/billing etc. 404). So this reports the signal that
 * actually matters operationally:
 *   • token validity / reachability (live /v1/account probe)
 *   • OUT-OF-CREDIT status, derived from projects the pipeline flagged with
 *     pending_video_tasks.billingBlocked=true when Replicate returned 402
 *   • render volume (predictions dispatched) as a burn proxy
 *
 * Auth: requires `admin` role (or service-role for internal calls). The
 * REPLICATE_API_TOKEN is a server-side secret and is NEVER returned.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { validateAuth, unauthorizedResponse } from '../_shared/auth-guard.ts';
import { logAndSanitize } from '../_shared/safe-error.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const auth = await validateAuth(req);
    if (!auth.authenticated) return unauthorizedResponse(corsHeaders, auth.error || 'Unauthorized');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    // ── ADMIN GATE ──
    if (!auth.isServiceRole) {
      const { data: roles } = await admin
        .from('user_roles').select('role').eq('user_id', auth.userId!);
      if (!roles?.some((r) => r.role === 'admin')) {
        return new Response(JSON.stringify({ error: 'Admin access required' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const now = Date.now();
    const since24h = new Date(now - 24 * 3600_000).toISOString();
    const since7d = new Date(now - 7 * 86400_000).toISOString();

    // ── 1. Token validity / reachability ──
    const token = Deno.env.get('REPLICATE_API_TOKEN');
    let tokenValid = false;
    let username: string | null = null;
    if (token) {
      try {
        const r = await fetch('https://api.replicate.com/v1/account', {
          headers: { Authorization: `Bearer ${token}` },
        });
        tokenValid = r.ok;
        if (r.ok) username = (await r.json())?.username ?? null;
      } catch { /* unreachable → tokenValid stays false */ }
    }

    // ── 2. Out-of-credit signal (pipeline flags billingBlocked on 402) ──
    const { data: blockedRows } = await admin
      .from('movie_projects')
      .select('id, updated_at')
      .eq('pending_video_tasks->>billingBlocked', 'true')
      .gte('updated_at', since7d)
      .order('updated_at', { ascending: false })
      .limit(500);
    const blocked7d = blockedRows?.length ?? 0;
    const blocked24h = (blockedRows ?? []).filter((r) => r.updated_at >= since24h).length;
    const lastBlockedAt = blockedRows?.[0]?.updated_at ?? null;
    const status: 'ok' | 'blocked' = blocked24h > 0 ? 'blocked' : 'ok';

    // ── 3. Render volume (burn proxy) — predictions dispatched ──
    const countSince = async (col: string, since: string) => {
      const { count } = await admin
        .from('video_clips')
        .select('id', { count: 'exact', head: true })
        .not('replicate_prediction_id', 'is', null)
        .gte(col, since);
      return count ?? 0;
    };
    const renders24h = await countSince('created_at', since24h);
    const renders7d = await countSince('created_at', since7d);

    return new Response(
      JSON.stringify({
        provider: 'replicate',
        // Replicate exposes no balance API — this is explicit so the UI doesn't
        // imply a dollar figure it cannot have.
        balanceAvailable: false,
        balanceNote: 'Replicate provides no balance API; status is derived from 402 signals + the billing page is the only source of the dollar figure.',
        tokenValid,
        username,
        status,                 // 'ok' | 'blocked'
        lastBlockedAt,
        blocked24h,
        blocked7d,
        renders24h,
        renders7d,
        billingUrl: 'https://replicate.com/account/billing#billing',
        checkedAt: new Date(now).toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: logAndSanitize('admin-replicate-health', e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
