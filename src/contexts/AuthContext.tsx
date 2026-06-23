import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { safeLocalStorage } from '@/lib/safeStorage';
import { stabilityMonitor } from '@/lib/stabilityMonitor';
import { updateAuthState } from '@/lib/diagnostics/StateSnapshotMonitor';
import { identifyUser as identifyPostHog, resetAnalytics } from '@/admin/analytics/posthog';
import { identify as trackIdentify, resetTracking } from '@/lib/analytics/track';
import { trackEvent, EVENTS } from '@/lib/analytics/events';
import { resetQueryCache } from '@/lib/queryClient';
import { identifyUser, resetIdentity } from '@/lib/observability';
import { type UserProfile, buildFallbackProfile, reconcileProfile } from './authProfile';

export type { UserProfile };

// Storage key for the security version stamp
const SECURITY_VERSION_KEY = 'app_security_version';
const MAX_LOGIN_ATTEMPTS = 10;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  isSessionVerified: boolean;
  profileError: string | null;
  isAdmin: boolean;
  /** True once the admin-role check for the current user has resolved (or there
   *  is no user). Lets post-login routing wait for admin status before picking a
   *  destination, so an admin isn't briefly sent to /library then bounced. */
  adminChecked: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithMagicLink: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  retryProfileFetch: () => Promise<void>;
  getValidSession: () => Promise<Session | null>;
  waitForSession: <T>(callback: (session: Session) => Promise<T>) => Promise<T | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Profile fetch timeout in milliseconds
const PROFILE_FETCH_TIMEOUT = 10000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSessionVerified, setIsSessionVerified] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);

  // Ref to track current session for synchronous access
  const sessionRef = useRef<Session | null>(null);
  // Mirror of the latest committed profile, read synchronously by fetch
  // reconciliation so a transient/fallback refetch can never downgrade an
  // established account_type. See reconcileProfile.
  const profileRef = useRef<UserProfile | null>(null);
  useEffect(() => { profileRef.current = profile; }, [profile]);

  /**
   * Fetch the profile row. Returns `{ profile, authoritative }`:
   *  - authoritative=true  → a real DB read (or confirmed row). Safe to commit.
   *  - authoritative=false → a fallback (timeout/network/missing). The caller
   *    MUST funnel this through reconcileProfile so it cannot downgrade an
   *    already-established profile for the same user.
   */
  const fetchProfile = async (
    userId: string,
  ): Promise<{ profile: UserProfile | null; authoritative: boolean }> => {
    // Always verify session before profile fetch to avoid RLS issues
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession) {
      console.warn('[AuthContext] fetchProfile: No valid session');
      return { profile: null, authoritative: false };
    }

    const fallback = (): { profile: UserProfile; authoritative: false } => ({
      profile: buildFallbackProfile(userId, currentSession.user.email ?? null),
      authoritative: false,
    });

    try {
      // Create a timeout promise
      const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((resolve) => {
        setTimeout(() => resolve({ data: null, error: { message: 'timeout' } }), PROFILE_FETCH_TIMEOUT);
      });

      // Create the fetch promise
      const fetchPromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      // Race between fetch and timeout
      const result = await Promise.race([fetchPromise, timeoutPromise]);

      if (result.error) {
        if (result.error.message === 'timeout') {
          console.debug('[AuthContext] Profile fetch timed out, using fallback');
          setProfileError(null); // Don't show error for timeout - we have fallback
          return fallback();
        }
        // CRITICAL: For network errors, use fallback silently instead of showing error UI
        const isNetworkError = result.error.message?.includes('Load failed') ||
                               result.error.message?.includes('fetch') ||
                               result.error.message?.includes('network');
        if (isNetworkError) {
          console.debug('[AuthContext] Network error, using fallback profile');
          setProfileError(null);
          return fallback();
        }
        console.debug('[AuthContext] Profile fetch error:', result.error.message?.substring(0, 50));
        setProfileError('Failed to load profile');
        // Non-authoritative null → reconcileProfile keeps any prior profile
        // rather than blanking/downgrading it.
        return { profile: null, authoritative: false };
      }

      setProfileError(null);

      // If profile not found (e.g. trigger hasn't finished for OAuth signup), retry once after delay
      if (!result.data) {
        console.debug('[AuthContext] Profile not found, retrying after delay (OAuth race condition)');
        await new Promise(r => setTimeout(r, 1500));
        const retryResult = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        if (retryResult.data) {
          return { profile: retryResult.data as UserProfile, authoritative: true };
        }
        // Still no profile — fallback (won't overwrite an established profile).
        console.debug('[AuthContext] Profile still not found after retry, using fallback');
        return fallback();
      }

      return { profile: result.data as UserProfile, authoritative: true };
    } catch {
      // Silent catch with fallback - prevents crash cascade
      console.debug('[AuthContext] Profile fetch exception, using fallback');
      return fallback();
    }
  };

  const refreshProfile = useCallback(async () => {
    if (user) {
      setProfileError(null);
      const { profile: profileData, authoritative } = await fetchProfile(user.id);
      setProfile(reconcileProfile(profileRef.current, profileData, authoritative));
    }
  }, [user]);

  // Listen for credit updates from Hoppy agent chat
  useEffect(() => {
    const handleCreditsUpdated = () => {
      refreshProfile();
    };
    window.addEventListener('credits-updated', handleCreditsUpdated);
    return () => window.removeEventListener('credits-updated', handleCreditsUpdated);
  }, [refreshProfile]);

  const retryProfileFetch = async () => {
    if (user) {
      setProfileError(null);
      const { profile: profileData, authoritative } = await fetchProfile(user.id);
      setProfile(reconcileProfile(profileRef.current, profileData, authoritative));
    }
  };

  const checkAdminRole = async (userId: string): Promise<boolean> => {
    // Admin status is authoritative server-side (is_admin RPC, SECURITY DEFINER).
    // No client-side id hardcode — trust the server so re-pointing the admin (or
    // future multi-admin) needs no client change.
    try {
      // Use Promise.race with timeout to prevent hanging on network issues
      const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((resolve) => {
        setTimeout(() => resolve({ data: null, error: { message: 'timeout' } }), 5000);
      });
      
      const fetchPromise = supabase.rpc('is_admin', { _user_id: userId });
      
      const result = await Promise.race([fetchPromise, timeoutPromise]);
      
      if (result.error) {
        // Silent fail for network errors - don't log noise, just return false
        if (result.error.message !== 'timeout') {
          console.debug('[AuthContext] Admin check skipped:', result.error.message?.substring(0, 50));
        }
        return false;
      }
      
      return result.data === true;
    } catch {
      // Silent catch - network failures shouldn't log errors
      return false;
    }
  };

  // Track intentional sign-out to prevent session resurrection
  const signedOutRef = useRef(false);
  // Track the last observed authenticated user id so we can detect identity
  // transitions (login, logout, account-switch in another tab) and hard-reset
  // the React Query cache. Without this, the previous user's profile / credits
  // / projects rows remain in cache and can be returned to the next user.
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let refreshInterval: ReturnType<typeof setInterval> | null = null;
    let isInitializing = true;
    
    // Critical: Set loading to true at start
    setLoading(true);

    // Helper to complete auth initialization with profile/admin data
    const completeAuthInit = async (userId: string) => {
      try {
        const [{ profile: profileData, authoritative }, adminStatus] = await Promise.all([
          fetchProfile(userId),
          checkAdminRole(userId)
        ]);

        if (!mounted) return;

        // ── SECURITY VERSION CHECK ──────────────────────────────────────────
        // The security_version mechanism works as follows:
        // - On login, we store the CURRENT server version in localStorage (session stamp)
        // - On subsequent loads, if the server version has INCREASED beyond the stored
        //   stamp, it means an admin invalidated sessions AFTER this session was created.
        // - A null/missing localStorage entry means fresh login — always accept and stamp.
        if (profileData?.security_version != null) {
          const storedRaw = localStorage.getItem(SECURITY_VERSION_KEY);
          
          if (storedRaw !== null) {
            // We have a previously stored stamp — check if server invalidated it
            const storedVersion = parseInt(storedRaw, 10);
            if (profileData.security_version > storedVersion) {
              console.warn('[AuthContext] Security version mismatch — forcing sign-out');
              // Update stamp BEFORE sign-out so next login succeeds
              localStorage.setItem(SECURITY_VERSION_KEY, String(profileData.security_version));
              // Clear cached queries before the forced sign-out so the
              // invalidated session cannot leak rows to whatever loads next.
              lastUserIdRef.current = null;
              resetQueryCache('security version invalidation');
              await supabase.auth.signOut({ scope: 'global' });
              if (mounted) {
                setProfile(null);
                setIsAdmin(false);
                setAdminChecked(true);
                setLoading(false);
              }
              return;
            }
          } else {
            // No stored stamp = fresh login. Just stamp the current version.
            localStorage.setItem(SECURITY_VERSION_KEY, String(profileData.security_version));
          }
        }
        // ────────────────────────────────────────────────────────────────────

        setProfile(reconcileProfile(profileRef.current, profileData, authoritative));
        setIsAdmin(adminStatus);
        setAdminChecked(true);
        // Tie product analytics to this user (no-op until VITE_POSTHOG_KEY is set).
        identifyPostHog(userId, { account_type: profileData?.account_type, is_admin: adminStatus });
        trackIdentify(userId, { account_type: profileData?.account_type, is_admin: adminStatus });
      } catch (err) {
        console.error('[AuthContext] Failed to complete auth init:', err);
        // Even on error, set a fallback profile to prevent UI blocking — but
        // NEVER clobber an already-loaded profile (functional update keeps a
        // previously-resolved business/enterprise profile intact).
        if (mounted) {
          setProfile(prev => prev ?? buildFallbackProfile(userId, sessionRef.current?.user?.email ?? null));
          setIsAdmin(false);
          setAdminChecked(true);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    
    // Set up auth state listener FIRST
    // CRITICAL FIX: Ongoing auth changes should NOT control loading state or isSessionVerified
    // Only the initial load controls these - prevents race condition crashes on navigation
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!mounted) return;
        
        // CRITICAL: If user explicitly signed out, ignore any session events
        // This prevents stale token refresh or tab-sync from resurrecting a session
        if (signedOutRef.current && event !== 'SIGNED_IN') {
          console.log('[AuthContext] Ignoring auth event after intentional sign-out:', event);
          return;
        }
        
        // Clear the sign-out flag on explicit sign-in
        if (event === 'SIGNED_IN') {
          signedOutRef.current = false;
          trackEvent(EVENTS.SIGNED_IN);
        }
        
        console.log('[AuthContext] Auth state change:', event, newSession ? 'has session' : 'no session');

        // ── CROSS-USER CACHE ISOLATION ─────────────────────────────────────
        // Detect any identity transition (login, logout, or account switch via
        // another tab broadcasting SIGNED_IN with a different user id) and
        // synchronously purge the React Query cache. Done BEFORE we update
        // session state so no consumer effect can fire a query against the
        // new identity while stale rows from the previous user are still
        // resolvable from cache.
        const previousUserId = lastUserIdRef.current;
        const incomingUserId = newSession?.user?.id ?? null;
        if (previousUserId !== incomingUserId && previousUserId !== null) {
          resetQueryCache(`auth transition (${event}): ${previousUserId} → ${incomingUserId ?? 'none'}`);
        }
        lastUserIdRef.current = incomingUserId;
        // ───────────────────────────────────────────────────────────────────

        // Update session state synchronously
        sessionRef.current = newSession;
        setSession(newSession);
        setUser(newSession?.user ?? null);

        // Skip if this is during initialization - initSession will handle it
        if (isInitializing) return;

        // CRITICAL: For ongoing auth changes (login/logout AFTER initial load),
        // fire-and-forget the profile/admin fetch - DO NOT await, DO NOT control loading
        // The isSessionVerified stays true (set during initial load), preventing redirects
        if (newSession?.user) {
          // Identify the user in observability tools (GlitchTip + PostHog).
          // PII scrubber on outbound events will strip emails/tokens from
          // breadcrumbs, but the identifier itself is intentional.
          identifyUser({ id: newSession.user.id, email: newSession.user.email });

          // SECURITY: only (re)fetch the profile when the user IDENTITY actually
          // changed (login / account switch) or we don't have one yet. A plain
          // TOKEN_REFRESHED for the SAME user — fired on navigation to heavy
          // pages (e.g. the editor) and on tab focus — must NOT refetch+clobber:
          // a slow or RLS-denied refetch returned the 'personal' fallback and
          // silently downgraded business/enterprise accounts. Even when we do
          // refetch, reconcileProfile prevents a fallback from downgrading.
          const identityChanged = previousUserId !== incomingUserId;
          if (identityChanged || !profileRef.current) {
            // A new admin check is in flight — gate post-login routing until it
            // resolves so an admin isn't briefly sent to /library then bounced.
            setAdminChecked(false);
            fetchProfile(newSession.user.id).then(({ profile: profileData, authoritative }) => {
              if (mounted) setProfile(reconcileProfile(profileRef.current, profileData, authoritative));
            }).catch(console.error);

            checkAdminRole(newSession.user.id).then(isAdminResult => {
              if (mounted) { setIsAdmin(isAdminResult); setAdminChecked(true); }
            }).catch(() => { if (mounted) setAdminChecked(true); });
          }
        } else {
          // Logged out — clear identity in observability tools.
          resetIdentity();
          setProfile(null);
          setProfileError(null);
          setIsAdmin(false);
          setAdminChecked(true);
        }
      }
    );

    // Hard safety: guarantee `loading` flips to false within 8s no matter what
    // Supabase / network / stale-token refresh does. Without this, a hung
    // getSession() would strand the UI on the Landing CinemaLoader forever.
    const AUTH_INIT_CEILING_MS = 8000;
    const initCeiling = setTimeout(() => {
      if (!mounted) return;
      console.warn('[AuthContext] Init ceiling hit — forcing loading=false');
      setIsSessionVerified(true);
      setAdminChecked(true);
      setLoading(false);
    }, AUTH_INIT_CEILING_MS);

    // THEN check for existing session
    const initSession = async () => {
      try {
        // Race getSession against a timeout so a stalled refresh can't hang init.
        // Clear the timer once the race settles — otherwise it fires its warning
        // ~5s later even when getSession already won (a misleading false alarm).
        let sessionTimer: ReturnType<typeof setTimeout> | undefined;
        const getSessionWithTimeout = Promise.race([
          supabase.auth.getSession(),
          new Promise<{ data: { session: null } }>((resolve) => {
            sessionTimer = setTimeout(() => {
              console.warn('[AuthContext] getSession() timed out — proceeding unauthenticated');
              resolve({ data: { session: null } });
            }, 5000);
          }),
        ]);
        const { data: { session: existingSession } } = await getSessionWithTimeout;
        if (sessionTimer) clearTimeout(sessionTimer);

        if (!mounted) return;
        
        console.log('[AuthContext] Initial session check:', existingSession ? 'has session' : 'no session');
        
        sessionRef.current = existingSession;
        setSession(existingSession);
        setUser(existingSession?.user ?? null);
        
        // Update diagnostics state snapshot
        updateAuthState({
          user: !!existingSession?.user,
          session: !!existingSession,
          isSessionVerified: false,
          loading: true,
          isAdmin: false,
          profileLoaded: false,
        }, 'initSession');
        
        if (existingSession?.user) {
          await completeAuthInit(existingSession.user.id);
        } else {
          setIsAdmin(false);
          setAdminChecked(true);
          setLoading(false);
        }
        
        // CRITICAL: Mark session as verified AFTER all initialization is complete
        // This ensures ProtectedRoute won't redirect prematurely
        setIsSessionVerified(true);
        
        // Update diagnostics with final state
        updateAuthState({
          user: !!existingSession?.user,
          session: !!existingSession,
          isSessionVerified: true,
          loading: false,
          isAdmin,
          profileLoaded: !!profile,
        }, 'sessionVerified');
      } catch (err) {
        console.error('[AuthContext] Session init error:', err);
        // Still mark as verified even on error to unblock UI
        if (mounted) {
          setIsSessionVerified(true);
          setLoading(false);
        }
      } finally {
        isInitializing = false;
        clearTimeout(initCeiling);
      }
    };
    
    initSession();

    // Proactive session refresh every 10 minutes to prevent timeout
    // This ensures long-running video generation doesn't get interrupted
    refreshInterval = setInterval(async () => {
      if (!mounted) return;
      
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (currentSession) {
        // Check if token expires in less than 15 minutes
        const expiresAt = currentSession.expires_at;
        const now = Math.floor(Date.now() / 1000);
        const timeUntilExpiry = expiresAt ? expiresAt - now : 0;
        
        if (timeUntilExpiry < 15 * 60) {
          console.log('[AuthContext] Proactively refreshing session (expires in', Math.round(timeUntilExpiry / 60), 'min)');
          const { data, error } = await supabase.auth.refreshSession();
          if (error) {
            console.error('[AuthContext] Session refresh failed:', error);
          } else if (data.session) {
            console.log('[AuthContext] Session refreshed successfully');
          }
        }
      }
    }, 10 * 60 * 1000); // Check every 10 minutes

    // Also refresh on window focus (user returns to tab) - with debounce
    let visibilityDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    let lastVisibilityCheck = 0;
    const VISIBILITY_DEBOUNCE_MS = 2000; // Minimum 2 seconds between checks
    
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible' || !mounted) return;
      
      const now = Date.now();
      // Skip if we checked recently (prevents rapid tab switching thrash)
      if (now - lastVisibilityCheck < VISIBILITY_DEBOUNCE_MS) {
        return;
      }
      
      // Debounce the actual check
      if (visibilityDebounceTimer) {
        clearTimeout(visibilityDebounceTimer);
      }
      
      visibilityDebounceTimer = setTimeout(async () => {
        if (!mounted) return;
        lastVisibilityCheck = Date.now();
        
        console.log('[AuthContext] Tab became visible, checking session...');
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (currentSession) {
          const expiresAt = currentSession.expires_at;
          const nowSeconds = Math.floor(Date.now() / 1000);
          const timeUntilExpiry = expiresAt ? expiresAt - nowSeconds : 0;
          
          // If less than 30 minutes until expiry, refresh
          if (timeUntilExpiry < 30 * 60) {
            console.log('[AuthContext] Refreshing session on tab focus');
            await supabase.auth.refreshSession();
          }
        }
      }, 500); // 500ms debounce delay
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      mounted = false;
      clearTimeout(initCeiling);
      subscription.unsubscribe();
      if (refreshInterval) clearInterval(refreshInterval);
      if (visibilityDebounceTimer) clearTimeout(visibilityDebounceTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    // ── BRUTE FORCE PROTECTION ─────────────────────────────────────────────
    // Check client-side lockout first (localStorage) to avoid unnecessary requests
    const lockoutKey = `login_lockout_${email.toLowerCase()}`;
    // safeLocalStorage never throws — Safari private mode would
    // otherwise make `localStorage.getItem` blow up here and block
    // login entirely.
    const lockoutData = safeLocalStorage.get(lockoutKey);
    if (lockoutData) {
      let count = 0, since = Date.now();
      try { ({ count, since } = JSON.parse(lockoutData)); } catch { /* malformed → treat as no lockout */ }
      const elapsed = Date.now() - since;
      if (count >= MAX_LOGIN_ATTEMPTS && elapsed < LOGIN_LOCKOUT_MS) {
        const remaining = Math.ceil((LOGIN_LOCKOUT_MS - elapsed) / 60000);
        return { error: new Error(`Too many failed attempts. Try again in ${remaining} minute(s).`) };
      }
      // Reset if lockout period expired
      if (elapsed >= LOGIN_LOCKOUT_MS) {
        safeLocalStorage.remove(lockoutKey);
      }
    }
    // ──────────────────────────────────────────────────────────────────────

    let data, error;
    try {
      const result = await supabase.auth.signInWithPassword({ email, password });
      data = result.data;
      error = result.error;
    } catch (err) {
      console.error('[AuthContext] signInWithPassword exception:', err);
      return { error: err instanceof Error ? err : new Error('Login failed unexpectedly') };
    }

    // Track attempt in DB (fire-and-forget, non-blocking)
    void supabase.rpc('log_login_attempt', {
      p_email: email.toLowerCase(),
      p_success: !error,
    });

    // Update client-side lockout counter
    if (error) {
      const existing = safeLocalStorage.get(lockoutKey);
      let parsed = { count: 0, since: Date.now() };
      if (existing) {
        try { parsed = JSON.parse(existing); } catch { /* malformed → reset */ }
      }
      // Reset counter if previous lockout window has expired
      const isExpired = Date.now() - parsed.since >= LOGIN_LOCKOUT_MS;
      const updated = {
        count: isExpired ? 1 : parsed.count + 1,
        since: isExpired ? Date.now() : parsed.since,
      };
      safeLocalStorage.set(lockoutKey, JSON.stringify(updated));
    } else {
      // Clear on success
      safeLocalStorage.remove(lockoutKey);
    }
    
    // CRITICAL: Wait for session to be persisted to localStorage before returning
    // This prevents redirect loops where the app navigates before session is saved
    if (!error && data?.session) {
      // Store the security version so future refreshes don't force-logout the user
      // who just successfully logged in
      const profileRes = await supabase
        .from('profiles')
        .select('security_version')
        .eq('id', data.session.user.id)
        .maybeSingle();
      if (profileRes.data?.security_version) {
        localStorage.setItem(SECURITY_VERSION_KEY, String(profileRes.data.security_version));
      }

      // Wait for the session to propagate through the auth state listener
      await new Promise<void>((resolve) => {
        let iterations = 0;
        const MAX_ITERATIONS = 40;
        
        const checkSession = () => {
          iterations++;
          if (sessionRef.current?.access_token === data.session?.access_token) {
            resolve();
          } else if (iterations >= MAX_ITERATIONS) {
            console.warn('[AuthContext] Session sync timed out after max iterations');
            resolve();
          } else {
            setTimeout(checkSession, 50);
          }
        };
        setTimeout(checkSession, 100);
      });
    }
    
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string) => {
    // Always tell Supabase where to send the email-verification link. Without
    // `emailRedirectTo` Supabase falls back to the project's Site URL — which
    // is fine in production but 404s during local dev / preview deploys. We
    // dynamically pin it to the current origin + /auth/callback (the route
    // that handles every email-confirmation URL format).
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    
    // Wait for session persistence if signup auto-confirms
    // FIX: Added max iteration guard to prevent stack overflow
    if (!error && data?.session) {
      await new Promise<void>((resolve) => {
        let iterations = 0;
        const MAX_ITERATIONS = 40; // 40 * 50ms = 2 seconds max
        
        const checkSession = () => {
          iterations++;
          if (sessionRef.current?.access_token === data.session?.access_token) {
            resolve();
          } else if (iterations >= MAX_ITERATIONS) {
            console.warn('[AuthContext] Session sync timed out after max iterations');
            resolve();
          } else {
            setTimeout(checkSession, 50);
          }
        };
        setTimeout(checkSession, 100);
      });
    }
    
    return { error: error as Error | null };
  };

  const signInWithMagicLink = async (email: string) => {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      return { error: error ? (error as Error) : null };
    } catch (err) {
      console.error('[AuthContext] Magic link send exception:', err);
      return { error: err instanceof Error ? err : new Error('Magic link send failed') };
    }
  };

  const signOut = async () => {
    // Set flag BEFORE calling signOut to prevent onAuthStateChange from resurrecting session
    signedOutRef.current = true;
    sessionRef.current = null;
    lastUserIdRef.current = null;
    setSession(null);
    setUser(null);
    setProfile(null);
    setProfileError(null);
    setIsAdmin(false);
    setAdminChecked(true);
    resetAnalytics();
    resetTracking();

    // Clear all sb.* keys from both storages so the next user on this
    // device starts clean: workspace selection, intent token, security stamp.
    // `apex.*` is the legacy prefix kept here through one rebrand cycle —
    // delete after a release window once we're sure no clients still hold them.
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('sb.') || key.startsWith('apex.') || key === SECURITY_VERSION_KEY) {
          localStorage.removeItem(key);
        }
      }
    } catch {}
    try {
      for (const key of Object.keys(sessionStorage)) {
        if (key.startsWith('sb.') || key.startsWith('apex.')) sessionStorage.removeItem(key);
      }
    } catch {}

    // Hard-reset React Query cache so no consumer can read the prior
    // user's rows (profile, credits, projects, billing) between signOut
    // and the next login. This is the primary cross-user isolation gate.
    resetQueryCache('explicit signOut');

    // Use global scope to clear session across all tabs
    await supabase.auth.signOut({ scope: 'global' });
  };

  /**
   * Get a verified valid session directly from Supabase.
   * Use this before any critical operation to avoid stale React state.
   */
  const getValidSession = async (): Promise<Session | null> => {
    const { data: { session: freshSession } } = await supabase.auth.getSession();
    return freshSession;
  };

  /**
   * Wrapper that ensures a valid session exists before executing a callback.
   * Returns null if no session, otherwise executes the callback with the session.
   * This consolidates functionality from useSessionGuard and useAuthenticatedSupabase.
   */
  const waitForSession = useCallback(
    async <T,>(callback: (session: Session) => Promise<T>): Promise<T | null> => {
      // Always get fresh session from Supabase to avoid stale React state
      const { data: { session: freshSession } } = await supabase.auth.getSession();
      
      if (!freshSession) {
        console.warn('[AuthContext] waitForSession: No valid session for operation');
        return null;
      }
      
      return callback(freshSession);
    },
    []
  );

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      loading,
      isSessionVerified,
      profileError,
      isAdmin,
      adminChecked,
      signIn,
      signUp,
      signInWithMagicLink,
      signOut,
      refreshProfile,
      retryProfileFetch,
      getValidSession,
      waitForSession,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // FIX: Return safe fallback instead of throwing to prevent cascade crashes
    // This can happen during SSR, testing, or edge cases during app initialization
    console.warn('[useAuth] AuthContext not available, returning safe fallback');
    return {
      user: null,
      session: null,
      profile: null,
      loading: true,
      isSessionVerified: false,
      profileError: null,
      isAdmin: false,
      adminChecked: true,
      signIn: async () => ({ error: new Error('Auth not initialized') }),
      signUp: async () => ({ error: new Error('Auth not initialized') }),
      signInWithMagicLink: async () => ({ error: new Error('Auth not initialized') }),
      signOut: async () => {},
      refreshProfile: async () => {},
      retryProfileFetch: async () => {},
      getValidSession: async () => null,
      waitForSession: async () => null,
    } as AuthContextType;
  }
  return context;
}
