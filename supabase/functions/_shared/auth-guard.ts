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
