/**
 * admin-analytics — Aggregated platform analytics for the admin console.
 *
 * Returns:
 *   - kpis: counts of users, signups (1d/7d/30d), active users (1d/7d/30d),
 *           projects, completed clips, credit revenue + spend, completion rate
 *   - timeseries: per-day signups / projects / credits-spent / credits-purchased
 *                 over a configurable window (default 30 days)
 *   - tierMix: account-tier distribution
 *   - topCountries: top signup countries
 *   - topSources: top utm_source / referrer
 *   - timeToValue: median minutes from signup to first project (cohort sample)
 *
 * Auth: requires user with `admin` role (or service-role for internal calls).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { validateAuth, unauthorizedResponse } from '../_shared/auth-guard.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DAY_MS = 86_400_000;
const dayKey = (d: Date | string) => new Date(d).toISOString().slice(0, 10);

function bucketByDay<T extends { created_at: string }>(
  rows: T[],
  windowDays: number,
  valueOf: (row: T) => number = () => 1,
): { date: string; value: number }[] {
  const out = new Map<string, number>();
  const today = new Date();
  for (let i = windowDays - 1; i >= 0; i--) {
    out.set(dayKey(new Date(today.getTime() - i * DAY_MS)), 0);
  }
  for (const r of rows) {
    const k = dayKey(r.created_at);
    if (out.has(k)) out.set(k, out.get(k)! + valueOf(r));
  }
  return [...out.entries()].map(([date, value]) => ({ date, value }));
}

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const auth = await validateAuth(req);
    if (!auth.authenticated) return unauthorizedResponse(corsHeaders, auth.error || 'Unauthorized');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    if (!auth.isServiceRole) {
      const { data: roles } = await admin
        .from('user_roles').select('role').eq('user_id', auth.userId!);
      if (!roles?.some((r) => r.role === 'admin')) {
        return new Response(JSON.stringify({ error: 'Admin access required' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const url = new URL(req.url);
    const windowDays = Math.max(7, Math.min(180, Number(url.searchParams.get('windowDays') || 30)));
    const now = Date.now();
    const since = (days: number) => new Date(now - days * DAY_MS).toISOString();
    const sinceWindow = since(windowDays);

    // ── Parallel fetches ────────────────────────────────────────────────
    const [
      profilesAll,
      profilesWindow,
      activeWindow,
      projectsWindow,
      clipsWindow,
      creditsWindow,
      signupGeoWindow,
      tierMix,
      ttvSample,
    ] = await Promise.all([
      admin.from('profiles').select('id', { count: 'exact', head: true }),
      admin.from('profiles').select('id, created_at, account_tier').gte('created_at', sinceWindow).order('created_at', { ascending: true }),
      // "Active" proxy: profiles with updated_at in window (touched by app)
      admin.from('profiles').select('id, updated_at').gte('updated_at', sinceWindow),
      admin.from('movie_projects').select('id, user_id, created_at').gte('created_at', sinceWindow).order('created_at', { ascending: true }),
      admin.from('video_clips').select('id, status, created_at, completed_at').gte('created_at', sinceWindow),
      admin.from('credit_transactions').select('id, amount, transaction_type, created_at').gte('created_at', sinceWindow),
      admin.from('signup_analytics').select('country, utm_source, referrer, created_at').gte('created_at', sinceWindow),
      admin.from('profiles').select('account_tier'),
      // Sample for TTV: most recent ~500 signups in window with at least one project
      admin.from('profiles').select('id, created_at').gte('created_at', sinceWindow).order('created_at', { ascending: false }).limit(500),
    ]);

    const totalUsers = profilesAll.count ?? 0;

    // ── KPIs ────────────────────────────────────────────────────────────
    const since1d = since(1), since7d = since(7), since30d = since(30);
    const signupsAll = profilesWindow.data ?? [];
    const signups1d = signupsAll.filter((p) => p.created_at >= since1d).length;
    const signups7d = signupsAll.filter((p) => p.created_at >= since7d).length;
    const signups30d = signupsAll.filter((p) => p.created_at >= since30d).length;

    const activeRows = (activeWindow.data ?? []) as { id: string; updated_at: string }[];
    const active1d = new Set(activeRows.filter((r) => r.updated_at >= since1d).map((r) => r.id)).size;
    const active7d = new Set(activeRows.filter((r) => r.updated_at >= since7d).map((r) => r.id)).size;
    const active30d = new Set(activeRows.filter((r) => r.updated_at >= since30d).map((r) => r.id)).size;
    const stickiness = active30d > 0 ? +((active1d / active30d) * 100).toFixed(1) : 0;

    const projects = projectsWindow.data ?? [];
    const clips = clipsWindow.data ?? [];
    const completedClips = clips.filter((c) => c.status === 'completed').length;
    const failedClips = clips.filter((c) => c.status === 'failed').length;
    const completionRate = clips.length > 0
      ? +((completedClips / clips.length) * 100).toFixed(1) : 0;

    const credits = creditsWindow.data ?? [];
    const creditsPurchased = credits.filter((t) => t.transaction_type === 'purchase')
      .reduce((s, t) => s + Math.max(0, t.amount), 0);
    const creditsSpent = credits.filter((t) => t.transaction_type === 'usage' || t.amount < 0)
      .reduce((s, t) => s + Math.abs(Math.min(0, t.amount)) + (t.transaction_type === 'usage' ? Math.max(0, t.amount) : 0), 0);
    const grossRevenue = +((creditsPurchased * 0.10).toFixed(2)); // $0.10/credit

    // ── Time series (windowDays) ────────────────────────────────────────
    const series = {
      signups: bucketByDay(signupsAll as { created_at: string }[], windowDays),
      projects: bucketByDay(projects as { created_at: string }[], windowDays),
      creditsSpent: bucketByDay(
        credits.filter((t) => t.transaction_type === 'usage' || t.amount < 0) as { created_at: string; amount: number }[],
        windowDays,
        (r) => Math.abs(r.amount),
      ),
      creditsPurchased: bucketByDay(
        credits.filter((t) => t.transaction_type === 'purchase') as { created_at: string; amount: number }[],
        windowDays,
        (r) => Math.max(0, r.amount),
      ),
    };

    // ── Tier mix (all-time) ─────────────────────────────────────────────
    const tierCounts = new Map<string, number>();
    for (const row of (tierMix.data ?? []) as { account_tier: string | null }[]) {
      const k = row.account_tier || 'free';
      tierCounts.set(k, (tierCounts.get(k) ?? 0) + 1);
    }
    const tierBreakdown = [...tierCounts.entries()]
      .map(([tier, count]) => ({ tier, count }))
      .sort((a, b) => b.count - a.count);

    // ── Geo + source (window) ───────────────────────────────────────────
    const geo = signupGeoWindow.data ?? [];
    const countCol = (rows: typeof geo, col: 'country' | 'utm_source' | 'referrer') => {
      const m = new Map<string, number>();
      for (const r of rows) {
        const v = (r[col] || '').trim();
        if (!v) continue;
        m.set(v, (m.get(v) ?? 0) + 1);
      }
      return [...m.entries()]
        .map(([key, count]) => ({ key, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    };
    const topCountries = countCol(geo, 'country');
    const topSources = countCol(geo, 'utm_source');
    const topReferrers = countCol(geo, 'referrer');

    // ── Time-to-Value (signup → first project, minutes) ────────────────
    const ttvSampleIds = (ttvSample.data ?? []) as { id: string; created_at: string }[];
    let ttvMedianMinutes: number | null = null;
    let ttvActivated = 0;
    if (ttvSampleIds.length) {
      const ids = ttvSampleIds.map((p) => p.id);
      const { data: firstProjects } = await admin
        .from('movie_projects')
        .select('user_id, created_at')
        .in('user_id', ids);
      const firstByUser = new Map<string, string>();
      for (const p of (firstProjects ?? []) as { user_id: string; created_at: string }[]) {
        const cur = firstByUser.get(p.user_id);
        if (!cur || p.created_at < cur) firstByUser.set(p.user_id, p.created_at);
      }
      const deltas: number[] = [];
      for (const u of ttvSampleIds) {
        const fp = firstByUser.get(u.id);
        if (!fp) continue;
        const mins = (new Date(fp).getTime() - new Date(u.created_at).getTime()) / 60_000;
        if (mins >= 0) deltas.push(mins);
      }
      ttvActivated = deltas.length;
      ttvMedianMinutes = median(deltas);
    }
    const activationRate = ttvSampleIds.length > 0
      ? +((ttvActivated / ttvSampleIds.length) * 100).toFixed(1) : 0;

    return new Response(JSON.stringify({
      generatedAt: new Date().toISOString(),
      windowDays,
      kpis: {
        totalUsers,
        signups1d, signups7d, signups30d,
        active1d, active7d, active30d, stickiness,
        projects: projects.length,
        clipsTotal: clips.length, completedClips, failedClips, completionRate,
        creditsPurchased, creditsSpent, grossRevenue,
        ttvMedianMinutes, activationRate,
      },
      series,
      tierBreakdown,
      topCountries,
      topSources,
      topReferrers,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[admin-analytics] error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});