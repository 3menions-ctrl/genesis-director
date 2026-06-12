import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

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

    const { domain_id } = await req.json();
    if (!domain_id) return json({ error: 'domain_id required' }, 400);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: row } = await admin
      .from('org_domains')
      .select('id, organization_id, domain, verification_token, verified_at')
      .eq('id', domain_id)
      .maybeSingle();
    if (!row) return json({ error: 'domain not found' }, 404);

    // Check caller is admin of the org
    const { data: roleOk } = await admin.rpc('fn_org_has_min_role', {
      _org_id: row.organization_id, _user_id: u.user.id, _min: 'admin',
    });
    if (!roleOk) return json({ error: 'forbidden' }, 403);

    if (row.verified_at) return json({ ok: true, already: true });

    // DNS-over-HTTPS lookup against Cloudflare for TXT records.
    const expected = `smallbridges-verify=${row.verification_token}`;
    const dnsRes = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(row.domain)}&type=TXT`,
      { headers: { accept: 'application/dns-json' } },
    );
    if (!dnsRes.ok) return json({ error: 'DNS lookup failed' }, 502);
    const dns = await dnsRes.json();
    const records: string[] = (dns.Answer || [])
      .map((a: any) => String(a.data || '').replace(/^"|"$/g, '').replace(/" "/g, ''));
    const found = records.some((r) => r.includes(expected));
    if (!found) {
      return json({
        error: `TXT record not found. Add a TXT record for ${row.domain} with value: ${expected}`,
        records,
      }, 400);
    }

    await admin.from('org_domains').update({ verified_at: new Date().toISOString() }).eq('id', row.id);
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