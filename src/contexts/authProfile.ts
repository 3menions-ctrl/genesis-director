/**
 * authProfile — pure, side-effect-free profile helpers for AuthContext.
 *
 * Kept separate from AuthContext.tsx (which pulls in the Supabase client and
 * other side-effectful modules) so the security-critical reconciliation logic
 * can be unit-tested in isolation, with no mocking.
 */

export interface UserProfile {
  id: string;
  email: string | null;
  display_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  credits_balance: number;
  total_credits_purchased: number;
  total_credits_used: number;
  role: string | null;
  use_case: string | null;
  company: string | null;
  country: string | null;
  onboarding_completed: boolean;
  created_at: string;
  preferences: Record<string, unknown> | null;
  notification_settings: Record<string, unknown> | null;
  auto_recharge_enabled: boolean | null;
  has_seen_welcome_video: boolean | null;
  has_seen_welcome_offer: boolean | null;
  security_version: number | null;
  account_type: 'personal' | 'business' | 'enterprise' | 'admin' | null;
  account_tier: string | null;
}

/**
 * A minimal, NON-AUTHORITATIVE profile used only when the real row cannot be
 * read (timeout / network error / row-not-found). It intentionally claims the
 * LEAST privilege — account_type 'personal', tier 'free', 0 credits,
 * onboarding_completed=false. It must NEVER be allowed to replace a known-good
 * profile for the same user; see reconcileProfile.
 */
export function buildFallbackProfile(userId: string, email: string | null): UserProfile {
  return {
    id: userId,
    email,
    display_name: email?.split('@')[0] || 'User',
    full_name: null,
    avatar_url: null,
    credits_balance: 0,
    total_credits_purchased: 0,
    total_credits_used: 0,
    role: null,
    use_case: null,
    company: null,
    country: null,
    onboarding_completed: false, // MUST be false — forces onboarding for new OAuth users
    created_at: new Date().toISOString(),
    preferences: null,
    notification_settings: null,
    auto_recharge_enabled: false,
    has_seen_welcome_video: false,
    has_seen_welcome_offer: false,
    security_version: null,
    account_type: 'personal',
    account_tier: 'free',
  };
}

/**
 * Decide which profile to commit after a fetch.
 *
 * THE INVARIANT (security-critical): a non-authoritative (fallback) result must
 * never DOWNGRADE an already-established profile for the same user. This is what
 * stops a slow or RLS-denied profile refetch — fired on navigation to heavy
 * pages and on tab focus via TOKEN_REFRESHED — from silently flipping a
 * business/enterprise account to 'personal' and bouncing it out of its module.
 *
 *  - An authoritative result (a real DB read) always wins, even if it changes
 *    account_type — that reflects a genuine server-side change.
 *  - A fallback applies only when there is no prior profile for this user
 *    (genuine first load / brand-new user); otherwise the prior profile is kept.
 */
export function reconcileProfile(
  prev: UserProfile | null,
  fetched: UserProfile | null,
  authoritative: boolean,
): UserProfile | null {
  if (authoritative) return fetched;
  if (prev && fetched && prev.id === fetched.id) return prev;
  return fetched ?? prev;
}
