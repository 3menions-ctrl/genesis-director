import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

/**
 * Sends a workspace event to the configured Slack or Zapier webhook.
 * Accepts: { kind: 'slack' | 'zapier', event: string, message?: string, payload?: any }
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

    const body = await req.json();
    const kind = String(body?.kind || '');
    const event = String(body?.event || 'event');
    const message = String(body?.message || '');
    if (!['slack', 'zapier'].includes(kind)) return json({ error: 'invalid kind' }, 400);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Find the user's current org via membership; if multiple, allow override via body.organization_id.
    let orgId = body?.organization_id as string | undefined;
    if (!orgId) {
      const { data: m } = await sb
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', u.user.id)
        .limit(1)
        .maybeSingle();
      orgId = (m as any)?.organization_id;
    }
    if (!orgId) return json({ error: 'no organization' }, 400);

    const { data: roleOk } = await admin.rpc('fn_org_has_min_role', {
      _org_id: orgId, _user_id: u.user.id, _min: 'admin',
    });
    if (!roleOk) return json({ error: 'forbidden' }, 403);

    const { data: org } = await admin
      .from('organizations')
      .select('name, slack_webhook_url, zapier_webhook_url')
      .eq('id', orgId)
      .maybeSingle();
    const url = kind === 'slack' ? (org as any)?.slack_webhook_url : (org as any)?.zapier_webhook_url;
    if (!url) return json({ error: `${kind} webhook not configured` }, 400);

    const payload = kind === 'slack'
      ? { text: `*Apex Studio · ${(org as any)?.name}* — ${event}\n${message}` }
      : { event, organization: (org as any)?.name, message, ...(body?.payload || {}) };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      return json({ error: `Webhook responded ${res.status}: ${text.slice(0, 200)}` }, 502);
    }
    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}