import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

/**
 * Returns CSV for one of: usage_summary, member_burn, project_ledger, spend_events.
 * Body: { organization_id, report, start (YYYY-MM-DD), end (YYYY-MM-DD) }
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization');
    if (!auth) return json({ error: 'unauthorized' }, 401);

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: u } = await sb.auth.getUser();
    if (!u?.user) return json({ error: 'unauthorized' }, 401);

    const { organization_id, report, start, end } = await req.json();
    if (!organization_id || !report || !start || !end) return json({ error: 'missing params' }, 400);
    const startISO = `${start}T00:00:00Z`;
    const endISO = `${end}T23:59:59Z`;

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: roleOk } = await admin.rpc('fn_org_has_min_role', {
      _org_id: organization_id, _user_id: u.user.id, _min: 'admin',
    });
    if (!roleOk) return json({ error: 'forbidden' }, 403);

    let csv = '';
    if (report === 'spend_events') {
      const { data } = await admin
        .from('org_spend_events')
        .select('occurred_at, user_id, credits, reason')
        .eq('organization_id', organization_id)
        .gte('occurred_at', startISO).lte('occurred_at', endISO)
        .order('occurred_at', { ascending: false }).limit(10000);
      csv = toCSV(['timestamp', 'user_id', 'credits', 'reason'],
        (data || []).map((r: any) => [r.occurred_at, r.user_id || '', r.credits, r.reason || '']));
    } else if (report === 'member_burn') {
      const { data } = await admin
        .from('org_spend_events')
        .select('user_id, credits')
        .eq('organization_id', organization_id)
        .gte('occurred_at', startISO).lte('occurred_at', endISO).limit(50000);
      const totals = new Map<string, number>();
      (data || []).forEach((r: any) => totals.set(r.user_id || 'system', (totals.get(r.user_id || 'system') || 0) + (r.credits || 0)));
      const ids = [...totals.keys()].filter((x) => x !== 'system');
      const { data: profs } = await admin.from('profiles').select('id, email, full_name').in('id', ids);
      const map = new Map((profs || []).map((p: any) => [p.id, p]));
      csv = toCSV(['user_id', 'email', 'name', 'credits_used'],
        [...totals.entries()].map(([id, c]) => [id, map.get(id)?.email || '', map.get(id)?.full_name || '', c]));
    } else if (report === 'project_ledger') {
      const { data } = await admin
        .from('movie_projects')
        .select('id, title, status, created_at, user_id')
        .eq('organization_id', organization_id)
        .gte('created_at', startISO).lte('created_at', endISO).limit(10000);
      csv = toCSV(['id', 'title', 'status', 'created_at', 'user_id'],
        (data || []).map((r: any) => [r.id, r.title || '', r.status || '', r.created_at, r.user_id || '']));
    } else if (report === 'usage_summary') {
      const { data: spend } = await admin
        .from('org_spend_events').select('credits')
        .eq('organization_id', organization_id)
        .gte('occurred_at', startISO).lte('occurred_at', endISO).limit(50000);
      const { count: projectCount } = await admin
        .from('movie_projects').select('*', { count: 'exact', head: true })
        .eq('organization_id', organization_id)
        .gte('created_at', startISO).lte('created_at', endISO);
      const { count: memberCount } = await admin
        .from('organization_members').select('*', { count: 'exact', head: true })
        .eq('organization_id', organization_id);
      const totalCredits = (spend || []).reduce((s: number, r: any) => s + (r.credits || 0), 0);
      csv = toCSV(['metric', 'value'], [
        ['period_start', start], ['period_end', end],
        ['active_members', memberCount ?? 0],
        ['projects_created', projectCount ?? 0],
        ['credits_consumed', totalCredits],
        ['estimated_spend_usd', (totalCredits * 0.10).toFixed(2)],
      ]);
    } else {
      return json({ error: 'unknown report' }, 400);
    }

    return json({ csv, rows: csv.split('\n').length - 1 });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function escape(v: unknown): string {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function toCSV(header: string[], rows: unknown[][]): string {
  return [header.join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}