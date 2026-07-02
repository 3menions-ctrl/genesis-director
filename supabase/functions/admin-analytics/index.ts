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
import { publicErrorMessage } from '../_shared/safe-error.ts';

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
    const mode = url.searchParams.get('mode') || 'summary';

    // ── Drill-down mode: return filtered detail rows for one dataset/day ──
    if (mode === 'detail') {
      const dataset = url.searchParams.get('dataset') || '';
      const dateStr = url.searchParams.get('date') || '';
      const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit') || 200)));
      const offset = Math.max(0, Number(url.searchParams.get('offset') || 0));
      const rangeFrom = offset;
      const rangeTo = offset + limit - 1;
      if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return new Response(JSON.stringify({ error: 'Invalid or missing date (YYYY-MM-DD)' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const dayStart = new Date(`${dateStr}T00:00:00.000Z`).toISOString();
      const dayEnd = new Date(`${dateStr}T23:59:59.999Z`).toISOString();

      let rows: unknown[] = [];
      let columns: { key: string; label: string }[] = [];
      let title = '';

      if (dataset === 'signups') {
        const [profiles, signupGeo] = await Promise.all([
          admin.from('profiles')
            .select('id, email, display_name, account_tier, country, created_at')
            .gte('created_at', dayStart).lte('created_at', dayEnd)
            .order('created_at', { ascending: false }).range(rangeFrom, rangeTo),
          admin.from('signup_analytics')
            .select('user_id, country, utm_source, referrer')
            .gte('created_at', dayStart).lte('created_at', dayEnd),
        ]);
        const sourceByUser = new Map<string, { utm_source?: string; referrer?: string; country?: string }>();
        for (const s of (signupGeo.data ?? []) as Array<{ user_id: string; utm_source?: string; referrer?: string; country?: string }>) {
          sourceByUser.set(s.user_id, s);
        }
        rows = (profiles.data ?? []).map((p: any) => ({
          ...p,
          utm_source: sourceByUser.get(p.id)?.utm_source ?? null,
          referrer: sourceByUser.get(p.id)?.referrer ?? null,
          country: p.country ?? sourceByUser.get(p.id)?.country ?? null,
        }));
        columns = [
          { key: 'created_at', label: 'Joined' },
          { key: 'email', label: 'Email' },
          { key: 'display_name', label: 'Name' },
          { key: 'account_tier', label: 'Tier' },
          { key: 'country', label: 'Country' },
          { key: 'utm_source', label: 'Source' },
          { key: 'referrer', label: 'Referrer' },
        ];
        title = `Signups · ${dateStr}`;
      } else if (dataset === 'projects') {
        const r = await admin.from('movie_projects')
          .select('id, user_id, title, genre, target_duration_minutes, created_at')
          .gte('created_at', dayStart).lte('created_at', dayEnd)
          .order('created_at', { ascending: false }).range(rangeFrom, rangeTo);
        rows = r.data ?? [];
        columns = [
          { key: 'created_at', label: 'Created' },
          { key: 'title', label: 'Title' },
          { key: 'genre', label: 'Genre' },
          { key: 'target_duration_minutes', label: 'Min' },
          { key: 'user_id', label: 'User' },
        ];
        title = `Projects · ${dateStr}`;
      } else if (dataset === 'clips') {
        const r = await admin.from('video_clips')
          .select('id, project_id, user_id, status, duration_seconds, error_message, created_at, completed_at')
          .gte('created_at', dayStart).lte('created_at', dayEnd)
          .order('created_at', { ascending: false }).range(rangeFrom, rangeTo);
        rows = r.data ?? [];
        columns = [
          { key: 'created_at', label: 'Created' },
          { key: 'status', label: 'Status' },
          { key: 'duration_seconds', label: 'Sec' },
          { key: 'project_id', label: 'Project' },
          { key: 'user_id', label: 'User' },
          { key: 'error_message', label: 'Error' },
        ];
        title = `Clips · ${dateStr}`;
      } else if (dataset === 'credits' || dataset === 'creditsSpent' || dataset === 'creditsPurchased') {
        let q = admin.from('credit_transactions')
          .select('id, user_id, amount, transaction_type, description, project_id, created_at')
          .gte('created_at', dayStart).lte('created_at', dayEnd)
          .order('created_at', { ascending: false }).range(rangeFrom, rangeTo);
        if (dataset === 'creditsSpent') q = q.in('transaction_type', ['usage', 'refund_negative', 'spend']).neq('amount', 0);
        if (dataset === 'creditsPurchased') q = q.eq('transaction_type', 'purchase');
        const r = await q;
        rows = r.data ?? [];
        columns = [
          { key: 'created_at', label: 'Time' },
          { key: 'transaction_type', label: 'Type' },
          { key: 'amount', label: 'Amount' },
          { key: 'description', label: 'Description' },
          { key: 'user_id', label: 'User' },
        ];
        title = `Credit transactions · ${dateStr}`;
      } else {
        return new Response(JSON.stringify({ error: `Unknown dataset: ${dataset}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const hasMore = rows.length >= limit;
      return new Response(JSON.stringify({
          dataset, date: dateStr, title, columns, rows,
          offset, limit,
          nextOffset: hasMore ? offset + rows.length : null,
          hasMore,
          truncated: hasMore && offset === 0,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const windowDays = Math.max(7, Math.min(180, Number(url.searchParams.get('windowDays') || 30)));
    const now = Date.now();
    const since = (days: number) => new Date(now - days * DAY_MS).toISOString();
    const sinceWindow = since(windowDays);
    const sincePrev = new Date(now - 2 * windowDays * DAY_MS).toISOString();
    const startOfWindow = sinceWindow;

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
      // Previous-window comparisons (period-over-period)
      profilesPrev,
      projectsPrev,
      clipsPrev,
      creditsPrev,
      // Cohort retention base (last 8 weekly cohorts)
      cohortBase,
      // Failure breakdown
      failedClipsBreakdown,
      // Top users (by credit spend in window)
      topSpendersRaw,
      // Onboarding-completed count for funnel
      onboardedCount,
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
      admin.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', sincePrev).lt('created_at', startOfWindow),
      admin.from('movie_projects').select('id', { count: 'exact', head: true }).gte('created_at', sincePrev).lt('created_at', startOfWindow),
      admin.from('video_clips').select('id, status', { count: 'exact' }).gte('created_at', sincePrev).lt('created_at', startOfWindow),
      admin.from('credit_transactions').select('id, amount, transaction_type').gte('created_at', sincePrev).lt('created_at', startOfWindow),
      // 8-week cohort retention base — signups in last 8 weeks
      admin.from('profiles').select('id, created_at').gte('created_at', new Date(now - 8 * 7 * DAY_MS).toISOString()),
      admin.from('video_clips').select('last_error_category').eq('status', 'failed').gte('created_at', sinceWindow),
      admin.from('credit_transactions').select('user_id, amount, transaction_type').gte('created_at', sinceWindow).in('transaction_type', ['usage', 'spend', 'refund_negative']),
      admin.from('profiles').select('id', { count: 'exact', head: true }).eq('onboarding_completed', true),
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

    // ── Period-over-period deltas ─────────────────────────────────────
    const prevSignups = profilesPrev.count ?? 0;
    const prevProjects = projectsPrev.count ?? 0;
    const prevClips = (clipsPrev.data ?? []).length;
    const prevCompleted = (clipsPrev.data ?? []).filter((c: any) => c.status === 'completed').length;
    const prevCompletionRate = prevClips > 0 ? +((prevCompleted / prevClips) * 100).toFixed(1) : 0;
    const prevCreditsSpent = (creditsPrev.data ?? [])
      .filter((t: any) => t.transaction_type === 'usage' || t.amount < 0)
      .reduce((s: number, t: any) => s + Math.abs(t.amount), 0);
    const prevCreditsPurchased = (creditsPrev.data ?? [])
      .filter((t: any) => t.transaction_type === 'purchase')
      .reduce((s: number, t: any) => s + Math.max(0, t.amount), 0);
    const pct = (cur: number, prev: number) =>
      prev === 0 ? (cur === 0 ? 0 : 100) : +(((cur - prev) / prev) * 100).toFixed(1);
    const deltas = {
      signups: pct(signupsAll.length, prevSignups),
      projects: pct(projects.length, prevProjects),
      completionRate: +(completionRate - prevCompletionRate).toFixed(1),
      creditsSpent: pct(creditsSpent, prevCreditsSpent),
      creditsPurchased: pct(creditsPurchased, prevCreditsPurchased),
      revenue: pct(creditsPurchased, prevCreditsPurchased),
    };

    // ── Funnel (in window) ────────────────────────────────────────────
    const userIdsInWindow = new Set(signupsAll.map((p: any) => p.id));
    const usersWithProject = new Set(projects.map((p: any) => p.user_id).filter(Boolean));
    const usersWithProjectInCohort = [...usersWithProject].filter((u) => userIdsInWindow.has(u)).length;
    // Users with completed clips & purchases in window — fetch user_ids
    const [{ data: cohortClipUsers }, { data: cohortPurchaseUsers }] = await Promise.all([
      admin.from('video_clips').select('user_id').eq('status', 'completed').gte('created_at', sinceWindow),
      admin.from('credit_transactions').select('user_id').eq('transaction_type', 'purchase').gte('created_at', sinceWindow),
    ]);
    const usersWithCompletedClip = new Set(((cohortClipUsers ?? []) as { user_id: string }[]).map((r) => r.user_id));
    const usersWithPurchase = new Set(((cohortPurchaseUsers ?? []) as { user_id: string }[]).map((r) => r.user_id));
    const cohortIds = [...userIdsInWindow];
    const onboardedInCohort = cohortIds.length; // proxy until we track step-completion in window
    const funnel = [
      { step: 'Signed up', users: cohortIds.length },
      { step: 'Created project', users: usersWithProjectInCohort },
      { step: 'Generated clip', users: cohortIds.filter((u) => usersWithCompletedClip.has(u)).length },
      { step: 'Purchased credits', users: cohortIds.filter((u) => usersWithPurchase.has(u)).length },
    ];

    // ── Cohort retention (8 weekly cohorts × week 0..7) ───────────────
    // Active proxy: any movie_projects or credit_transactions row in week N.
    const cohortBaseRows = (cohortBase.data ?? []) as { id: string; created_at: string }[];
    const weekStart = (d: Date) => {
      const x = new Date(d);
      const day = x.getUTCDay();
      x.setUTCHours(0, 0, 0, 0);
      x.setUTCDate(x.getUTCDate() - day);
      return x;
    };
    const eightWeeksAgo = weekStart(new Date(now - 7 * 7 * DAY_MS));
    const cohortMap = new Map<string, string[]>(); // weekStartISO → userIds
    for (const p of cohortBaseRows) {
      const ws = weekStart(new Date(p.created_at));
      if (ws < eightWeeksAgo) continue;
      const key = ws.toISOString().slice(0, 10);
      if (!cohortMap.has(key)) cohortMap.set(key, []);
      cohortMap.get(key)!.push(p.id);
    }
    // Activity events for cohort users (single fetch)
    const cohortUserIds = [...new Set(cohortBaseRows.map((r) => r.id))];
    let activityEvents: { user_id: string; created_at: string }[] = [];
    if (cohortUserIds.length) {
      const [aw, bw] = await Promise.all([
        admin.from('movie_projects').select('user_id, created_at').in('user_id', cohortUserIds.slice(0, 1000)).gte('created_at', eightWeeksAgo.toISOString()),
        admin.from('credit_transactions').select('user_id, created_at').in('user_id', cohortUserIds.slice(0, 1000)).gte('created_at', eightWeeksAgo.toISOString()),
      ]);
      activityEvents = [...((aw.data ?? []) as any[]), ...((bw.data ?? []) as any[])];
    }
    const eventsByUser = new Map<string, Date[]>();
    for (const e of activityEvents) {
      if (!eventsByUser.has(e.user_id)) eventsByUser.set(e.user_id, []);
      eventsByUser.get(e.user_id)!.push(new Date(e.created_at));
    }
    const cohortKeys = [...cohortMap.keys()].sort();
    const cohorts = cohortKeys.map((cKey) => {
      const users = cohortMap.get(cKey)!;
      const cohortStart = new Date(`${cKey}T00:00:00.000Z`);
      const weeks: number[] = [];
      const weekDelta = (n: number) =>
        new Date(cohortStart.getTime() + n * 7 * DAY_MS);
      for (let w = 0; w < 8; w++) {
        const wStart = weekDelta(w);
        const wEnd = weekDelta(w + 1);
        if (wStart > new Date()) { weeks.push(-1); continue; }
        let active = 0;
        for (const u of users) {
          const evs = eventsByUser.get(u);
          if (!evs) continue;
          if (evs.some((d) => d >= wStart && d < wEnd)) active++;
        }
        weeks.push(users.length > 0 ? +((active / users.length) * 100).toFixed(0) : 0);
      }
      return { cohort: cKey, size: users.length, weeks };
    });

    // ── Failure category breakdown ────────────────────────────────────
    const failureCounts = new Map<string, number>();
    for (const r of (failedClipsBreakdown.data ?? []) as { last_error_category: string | null }[]) {
      const k = r.last_error_category || 'unknown';
      failureCounts.set(k, (failureCounts.get(k) ?? 0) + 1);
    }
    const failureBreakdown = [...failureCounts.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // ── Top spenders / power users ────────────────────────────────────
    const spendByUser = new Map<string, number>();
    for (const t of (topSpendersRaw.data ?? []) as { user_id: string; amount: number }[]) {
      spendByUser.set(t.user_id, (spendByUser.get(t.user_id) ?? 0) + Math.abs(t.amount));
    }
    const projectsByUser = new Map<string, number>();
    for (const p of projects as { user_id: string }[]) {
      projectsByUser.set(p.user_id, (projectsByUser.get(p.user_id) ?? 0) + 1);
    }
    const topUserIds = [...new Set([...spendByUser.keys(), ...projectsByUser.keys()])]
      .map((id) => ({
        id,
        spend: spendByUser.get(id) ?? 0,
        projects: projectsByUser.get(id) ?? 0,
        score: (spendByUser.get(id) ?? 0) + (projectsByUser.get(id) ?? 0) * 5,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    let topUsers: any[] = [];
    if (topUserIds.length) {
      const { data: profileRows } = await admin
        .from('profiles')
        .select('id, email, display_name, account_tier, country')
        .in('id', topUserIds.map((u) => u.id));
      const byId = new Map((profileRows ?? []).map((p: any) => [p.id, p]));
      topUsers = topUserIds.map((u) => ({
        ...u,
        profile: byId.get(u.id) ?? null,
      }));
    }

    // ── Hourly heatmap (DOW × hour) — clip generations in window ──────
    const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const c of clips as { created_at: string }[]) {
      const d = new Date(c.created_at);
      heatmap[d.getUTCDay()][d.getUTCHours()] += 1;
    }
    let heatmapMax = 0;
    for (const row of heatmap) for (const v of row) if (v > heatmapMax) heatmapMax = v;

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
        onboardedTotal: onboardedCount.count ?? 0,
      },
      deltas,
      funnel,
      cohorts,
      failureBreakdown,
      topUsers,
      heatmap: { matrix: heatmap, max: heatmapMax },
      series,
      tierBreakdown,
      topCountries,
      topSources,
      topReferrers,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[admin-analytics] error:', err);
    return new Response(JSON.stringify({ error: publicErrorMessage(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});