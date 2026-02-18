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
 * - User JWTs: Validates via getClaims() and extracts sub claim
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

  // Validate user JWT
  try {
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Try getClaims first (fast, local validation)
    try {
      const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
      if (!claimsError && claimsData?.claims?.sub) {
        return { 
          authenticated: true, 
          userId: claimsData.claims.sub as string, 
          isServiceRole: false 
        };
      }
    } catch {
      // getClaims not available or failed, fall through to getUser
    }

    // Fallback: validate via getUser (server-side, always reliable)
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user?.id) {
      return { authenticated: false, userId: null, isServiceRole: false, error: 'Invalid or expired token' };
    }

    return { 
      authenticated: true, 
      userId: user.id, 
      isServiceRole: false 
    };
  } catch {
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
