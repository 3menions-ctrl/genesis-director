import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { checkAbuse, abuseBlockedResponse } from '../_shared/abuse-guard.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateRawKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const b64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `apx_live_${b64}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = claims.claims.sub as string;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');

    if (action === 'list') {
      const { data, error } = await admin
        .from('api_keys')
        .select('id, name, key_prefix, last_used_at, revoked_at, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify({ keys: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'create') {
      // M3: enforce admin-configured ip/email blocks at request time.
      const verdict = await checkAbuse(admin, req, (claims.claims.email as string) ?? null);
      if (verdict.blocked) return abuseBlockedResponse(corsHeaders, verdict);

      // H3: API access is a subscription-gated entitlement. Block minting new
      // keys without an active subscription (active/trialing, or past_due/
      // canceled still within the paid period — see has_active_subscription).
      const { data: entitled } = await admin.rpc('has_active_subscription', { p_user_id: userId });
      if (entitled !== true) {
        return new Response(JSON.stringify({
          error: 'subscription_required',
          message: 'An active subscription is required to create API keys.',
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const name = String(body.name || '').trim().slice(0, 60) || 'Untitled key';
      const { count } = await admin
        .from('api_keys')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('revoked_at', null);
      if ((count ?? 0) >= 10) {
        return new Response(JSON.stringify({ error: 'Key limit reached (10 active keys)' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const raw = generateRawKey();
      const hash = await sha256Hex(raw);
      const prefix = raw.slice(0, 12);
      const { data, error } = await admin
        .from('api_keys')
        .insert({ user_id: userId, name, key_hash: hash, key_prefix: prefix })
        .select('id, name, key_prefix, created_at')
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ key: data, raw_key: raw }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'revoke') {
      const id = String(body.id || '');
      if (!id) {
        return new Response(JSON.stringify({ error: 'id required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { error } = await admin
        .from('api_keys')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'usage') {
      const days = Math.min(90, Math.max(1, Number(body.days) || 30));
      const since = new Date(Date.now() - days * 86400_000).toISOString();
      const { data, error } = await admin
        .from('api_usage_logs')
        .select('endpoint, status_code, credits_charged, created_at')
        .eq('user_id', userId)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      const totalCredits = (data || []).reduce((s, r) => s + (r.credits_charged || 0), 0);
      const totalCalls = (data || []).length;
      return new Response(
        JSON.stringify({ logs: data, totals: { credits: totalCredits, calls: totalCalls } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[api-keys-manage] error:', msg);
    return new Response(JSON.stringify({ error: 'internal_error', message: 'Something went wrong. Please try again.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});