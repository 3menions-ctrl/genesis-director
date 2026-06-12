/**
 * useAccessTokenClaims — read the custom claims injected by the
 * `custom_access_token_hook` Postgres function on every access token.
 *
 * The hook adds:
 *   - role          ('admin' | 'user' | …)
 *   - is_admin      (boolean)
 *   - account_type  ('personal' | 'business' | 'enterprise')
 *   - account_tier  ('free' | 'pro' | 'enterprise')
 *   - current_org_id (uuid | null)
 *
 * They live under `app_metadata` in the JWT, not in any DB row — so this
 * hook returns them without a DB round-trip and they refresh automatically
 * every time Supabase rotates the access token (every hour by default,
 * or immediately after sign-out / sign-in).
 *
 * If the hook isn't enabled in the Dashboard yet, the values fall back
 * to sane defaults so the rest of the app keeps working.
 *
 * Usage:
 *   const { isAdmin, role, accountTier, currentOrgId } = useAccessTokenClaims();
 *   if (isAdmin) ...
 */
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export interface AccessTokenClaims {
  /** role string from public.user_roles, falls back to 'user'. */
  role: string;
  /** Convenience boolean. True iff role === 'admin'. */
  isAdmin: boolean;
  /** personal | business | enterprise — from profiles.account_type. */
  accountType: 'personal' | 'business' | 'enterprise';
  /** free | pro | enterprise — from profiles.account_tier. */
  accountTier: 'free' | 'pro' | 'enterprise';
  /** Last-used workspace id, if any. */
  currentOrgId: string | null;
  /** True until the first JWT lands. Useful for guard rendering. */
  loading: boolean;
}

const DEFAULT_CLAIMS: AccessTokenClaims = {
  role: 'user',
  isAdmin: false,
  accountType: 'personal',
  accountTier: 'free',
  currentOrgId: null,
  loading: true,
};

/**
 * Decode a JWT without verifying the signature. We don't care about
 * authenticity here — Supabase already verified it on the way in; we
 * just need to read the public payload.
 */
function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    // base64url → base64
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(payload.length + ((4 - payload.length % 4) % 4), '=');
    return JSON.parse(atob(b64)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function useAccessTokenClaims(): AccessTokenClaims {
  const { session } = useAuth();
  const [claims, setClaims] = useState<AccessTokenClaims>(DEFAULT_CLAIMS);

  useEffect(() => {
    const token = session?.access_token;
    if (!token) {
      setClaims({ ...DEFAULT_CLAIMS, loading: false });
      return;
    }
    const decoded = decodeJwt(token);
    const app = (decoded?.app_metadata ?? {}) as Record<string, unknown>;
    setClaims({
      role:         (app.role as string) ?? 'user',
      isAdmin:      Boolean(app.is_admin),
      accountType:  ((app.account_type as AccessTokenClaims['accountType']) ?? 'personal'),
      accountTier:  ((app.account_tier as AccessTokenClaims['accountTier']) ?? 'free'),
      currentOrgId: (app.current_org_id as string | null) ?? null,
      loading:      false,
    });
  }, [session?.access_token]);

  return claims;
}
