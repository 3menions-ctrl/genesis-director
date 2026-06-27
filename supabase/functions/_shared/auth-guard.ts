/**
 * Shared Authentication Guard for Edge Functions
 * 
 * Validates JWT tokens and extracts user identity.
 * Accepts both user JWTs and service-role keys for internal function-to-function calls.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

export interface AuthResult {
  authenticated: boolean;
  userId: string | null;
  isServiceRole: boolean;
  error?: string;
}

/**
 * Validate the Authorization header and extract user identity.
 * 
 * - User JWTs: Validates via getUser(token) 
 * - Service role key: Allows internal function-to-function calls
 * - No auth: Returns authenticated=false
 */
export async function validateAuth(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    return { authenticated: false, userId: null, isServiceRole: false, error: 'Missing authorization header' };
  }

  const token = authHeader.replace('Bearer ', '');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Allow service-role calls (internal function-to-function)
  if (token === serviceRoleKey) {
    return { authenticated: true, userId: null, isServiceRole: true };
  }

  // Validate user JWT via getUser(token) — always reliable
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Pass the token explicitly to getUser for reliable validation
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user?.id) {
      console.error('[auth-guard] getUser failed:', userError?.message);
      return { authenticated: false, userId: null, isServiceRole: false, error: userError?.message || 'Invalid or expired token' };
    }

    return { 
      authenticated: true, 
      userId: user.id, 
      isServiceRole: false 
    };
  } catch (err) {
    console.error('[auth-guard] Token validation exception:', err);
    return { authenticated: false, userId: null, isServiceRole: false, error: 'Token validation failed' };
  }
}

/**
 * Returns a 401 Response with CORS headers for unauthenticated requests.
 */
export function unauthorizedResponse(corsHeaders: Record<string, string>, message = 'Unauthorized'): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Resolve the effective user id for a request, preventing privilege escalation.
 *
 * Rule:
 *   - End-user JWT: ALWAYS return the JWT's user id. Any `userId` in the body is ignored.
 *   - Service-role caller (internal function-to-function): trust the body-supplied `userId`.
 *
 * Throws if the request is end-user-authenticated but the body's `userId` does not match the JWT
 * (so the function can return a clear 403 instead of silently swapping ids).
 */
export function resolveEffectiveUserId(
  auth: AuthResult,
  bodyUserId: string | null | undefined
): string {
  if (!auth.authenticated) {
    throw new Error('UNAUTHENTICATED');
  }
  if (auth.isServiceRole) {
    if (!bodyUserId) throw new Error('SERVICE_ROLE_REQUIRES_USER_ID');
    return bodyUserId;
  }
  // End-user JWT: trust ONLY the JWT, never the body.
  if (bodyUserId && bodyUserId !== auth.userId) {
    throw new Error('USER_ID_MISMATCH');
  }
  return auth.userId!;
}

/**
 * Returns a 403 Response for privilege-escalation attempts (body userId ≠ JWT userId).
 */
export function forbiddenResponse(
  corsHeaders: Record<string, string>,
  message = 'Forbidden: user id does not match authenticated session'
): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Project-ownership IDOR guard.
 *
 * Many functions build a SERVICE_ROLE client (RLS bypassed) and then key reads/
 * writes on a body-supplied projectId. validateAuth only proves the caller is
 * *some* authenticated user, so without this check any logged-in user can pass a
 * victim's projectId. Service-role callers (internal pipelines) bypass.
 *
 * Returns a 403 Response to return early, or null when the caller is allowed to
 * proceed. Pass a `select`-capable supabase client.
 */
export async function assertProjectOwnership(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  auth: AuthResult,
  projectId: string | null | undefined,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  if (auth.isServiceRole) return null;          // internal/service-role bypass
  if (!projectId) return null;                  // nothing to verify
  const { data } = await supabase
    .from('movie_projects')
    .select('user_id')
    .eq('id', projectId)
    .maybeSingle();
  if (!data || data.user_id !== auth.userId) {
    return forbiddenResponse(corsHeaders, 'forbidden: not your project');
  }
  return null;
}

// =========================================================================
// Cron / service-role / webhook trust boundaries
// =========================================================================

/**
 * Constant-time string comparison (avoid timing attacks on secret compare).
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Cron trust boundary.
 *
 * The function MUST be called with `x-cron-secret: <CRON_SHARED_SECRET>` OR
 * with `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` (for ad-hoc internal
 * triggers). Anything else returns `false`.
 *
 * pg_cron jobs should set the `x-cron-secret` header so the anon `apikey`
 * header alone does not constitute auth.
 */
export function requireCronSecret(req: Request): boolean {
  const cronSecret = Deno.env.get('CRON_SHARED_SECRET');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  const provided = req.headers.get('x-cron-secret');
  if (cronSecret && provided && timingSafeEqual(provided, cronSecret)) return true;

  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Bearer ') && serviceRole) {
    const token = auth.slice('Bearer '.length).trim();
    if (timingSafeEqual(token, serviceRole)) return true;
  }
  return false;
}

/**
 * Internal/service-role trust boundary.
 *
 * Requires `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`. Used by
 * function-to-function calls that must NOT be reachable from end-user JWTs.
 */
export function requireServiceRole(req: Request): boolean {
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceRole) return false;
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return false;
  const token = auth.slice('Bearer '.length).trim();
  return timingSafeEqual(token, serviceRole);
}

/**
 * Replicate webhook signature verification.
 *
 * Replicate signs webhooks per the standard webhooks spec:
 *   webhook-id        — unique event id
 *   webhook-timestamp — unix seconds
 *   webhook-signature — space-separated list of `v1,<base64-hmac>` entries
 *
 * HMAC-SHA256 over `${id}.${timestamp}.${body}` using REPLICATE_WEBHOOK_SECRET
 * (the `whsec_<base64>` value Replicate gave us, base64-decoded). 5-minute
 * timestamp tolerance. Constant-time compare against every accepted v1 sig.
 */
export async function verifyReplicateSignature(req: Request, rawBody: string): Promise<boolean> {
  const secret = Deno.env.get('REPLICATE_WEBHOOK_SECRET');
  if (!secret) {
    console.error('[auth-guard] REPLICATE_WEBHOOK_SECRET not configured');
    return false;
  }
  const id = req.headers.get('webhook-id');
  const timestamp = req.headers.get('webhook-timestamp');
  const sigHeader = req.headers.get('webhook-signature');
  if (!id || !timestamp || !sigHeader) return false;

  const ageSec = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(ageSec) || ageSec > 300) return false;

  const secretB64 = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
  let secretBytes: Uint8Array;
  try {
    const bin = atob(secretB64);
    secretBytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) secretBytes[i] = bin.charCodeAt(i);
  } catch {
    // Fall back to raw secret if it isn't base64 (some setups store plain text).
    secretBytes = new TextEncoder().encode(secret);
  }

  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${id}.${timestamp}.${rawBody}`),
  );
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));

  for (const part of sigHeader.split(' ')) {
    const [, value] = part.split(',', 2);
    if (value && timingSafeEqual(value, expected)) return true;
  }
  return false;
}
