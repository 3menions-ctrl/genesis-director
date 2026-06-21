/**
 * report-client-error — public sink for `client_errors`.
 *
 * - No auth required. The reporting client may be unauthenticated, mid-crash,
 *   or running with an expired JWT.
 * - Validates the payload shape. Drops anything malformed silently with 204.
 * - Uses the service role to INSERT so we bypass RLS on a hot-path. RLS on the
 *   table is still defined for defense-in-depth if the JS client ever writes.
 * - Hard caps on every text column so a hostile payload cannot bloat the table.
 * - Best-effort user attribution: if the request includes an authorization
 *   bearer JWT, we resolve the user with the anon client.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_SURFACE_LEN = 120;
const MAX_ACTION_LEN  = 120;
const MAX_MESSAGE_LEN = 2_000;
const MAX_STACK_LEN   = 8_000;
const MAX_UA_LEN      = 500;
const MAX_URL_LEN     = 1_000;
const MAX_EXTRA_BYTES = 4_096;

function clampStr(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed.length) return null;
  return trimmed.slice(0, max);
}

function clampOptStr(value: unknown, max: number): string | null {
  const s = clampStr(value, max);
  return s ?? null;
}

function sanitizeExtra(value: unknown): unknown {
  if (value == null) return null;
  try {
    const json = JSON.stringify(value);
    if (json.length > MAX_EXTRA_BYTES) return null;
    return JSON.parse(json);
  } catch { return null; }
}

interface ParsedRow {
  user_id: string | null;
  surface: string;
  action: string;
  message: string;
  stack: string | null;
  user_agent: string | null;
  page_url: string | null;
  extra: unknown;
}

function parsePayload(body: unknown): ParsedRow | null {
  if (!body || typeof body !== 'object') return null;
  const obj = body as Record<string, unknown>;
  const surface = clampStr(obj.surface, MAX_SURFACE_LEN);
  const action  = clampStr(obj.action,  MAX_ACTION_LEN);
  const message = clampStr(obj.message, MAX_MESSAGE_LEN);
  if (!surface || !action || !message) return null;
  return {
    user_id:    typeof obj.user_id === 'string' && /^[0-9a-f-]{36}$/i.test(obj.user_id) ? obj.user_id : null,
    surface,
    action,
    message,
    stack:      clampOptStr(obj.stack,      MAX_STACK_LEN),
    user_agent: clampOptStr(obj.user_agent, MAX_UA_LEN),
    page_url:   clampOptStr(obj.page_url,   MAX_URL_LEN),
    extra:      sanitizeExtra(obj.extra),
  };
}

async function resolveUserFromAuth(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) return null;
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) return null;
  try {
    const client = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data } = await client.auth.getUser();
    return data?.user?.id ?? null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: unknown;
  try { body = await req.json(); }
  catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const row = parsePayload(body);
  if (!row) {
    return new Response(JSON.stringify({ error: 'Invalid payload' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Best-effort attribution from JWT (overrides any client-supplied user_id
  // unless the client explicitly passed one and the JWT lookup failed).
  const resolvedUserId = await resolveUserFromAuth(req);
  if (resolvedUserId) row.user_id = resolvedUserId;

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    // Misconfigured deployment — fail closed but don't leak details.
    return new Response(JSON.stringify({ error: 'Reporter unavailable' }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey);
  try {
    const { error } = await admin.from('client_errors').insert([row]);
    if (error) {
      // Don't echo the database error back — a client in crash state cannot
      // act on it. Log instead.
      console.warn('[report-client-error] insert failed:', error.message);
      return new Response(JSON.stringify({ ok: false }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (e) {
    console.warn('[report-client-error] insert threw:', e instanceof Error ? e.message : String(e));
    return new Response(JSON.stringify({ ok: false }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
