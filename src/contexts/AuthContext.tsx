import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { stabilityMonitor } from '@/lib/stabilityMonitor';
import { updateAuthState } from '@/lib/diagnostics/StateSnapshotMonitor';

interface UserProfile {
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
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  isSessionVerified: boolean;
  profileError: string | null;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
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
  
  // Ref to track current session for synchronous access
  const sessionRef = useRef<Session | null>(null);

  const fetchProfile = async (userId: string): Promise<UserProfile | null> => {
    // Always verify session before profile fetch to avoid RLS issues
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession) {
      console.warn('[AuthContext] fetchProfile: No valid session');
      return null;
    }

    // Create a minimal fallback profile for timeout scenarios
    const createFallbackProfile = (): UserProfile => ({
      id: userId,
      email: currentSession.user.email || null,
      display_name: currentSession.user.email?.split('@')[0] || 'User',
      full_name: null,
      avatar_url: null,
      credits_balance: 60,
      total_credits_purchased: 0,
      total_credits_used: 0,
      role: null,
      use_case: null,
      company: null,
      country: null,
      onboarding_completed: true, // Assume completed to prevent redirect loops
      created_at: new Date().toISOString(),
      preferences: null,
      notification_settings: null,
      auto_recharge_enabled: false,
      has_seen_welcome_video: false,
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
        .single();

      // Race between fetch and timeout
      const result = await Promise.race([fetchPromise, timeoutPromise]);
      
      if (result.error) {
        if (result.error.message === 'timeout') {
          console.debug('[AuthContext] Profile fetch timed out, using fallback');
          setProfileError(null); // Don't show error for timeout - we have fallback
          return createFallbackProfile();
        }
        // CRITICAL: For network errors, use fallback silently instead of showing error UI
        const isNetworkError = result.error.message?.includes('Load failed') || 
                               result.error.message?.includes('fetch') ||
                               result.error.message?.includes('network');
        if (isNetworkError) {
          console.debug('[AuthContext] Network error, using fallback profile');
          setProfileError(null);
          return createFallbackProfile();
        }
        console.debug('[AuthContext] Profile fetch error:', result.error.message?.substring(0, 50));
        setProfileError('Failed to load profile');
        return null;
      }
      
      setProfileError(null);
      return result.data as UserProfile;
    } catch {
      // Silent catch with fallback - prevents crash cascade
      console.debug('[AuthContext] Profile fetch exception, using fallback');
      return createFallbackProfile();
    }
  };

  const refreshProfile = async () => {
    if (user) {
      setProfileError(null);
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
    }
  };

  const retryProfileFetch = async () => {
    if (user) {
      setProfileError(null);
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
    }
  };

  const checkAdminRole = async (userId: string): Promise<boolean> => {
    try {
      // Use Promise.race with timeout to prevent hanging on network issues
      const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((resolve) => {
        setTimeout(() => resolve({ data: null, error: { message: 'timeout' } }), 5000);
      });
      
      const fetchPromise = supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();
      
      const result = await Promise.race([fetchPromise, timeoutPromise]);
      
      if (result.error) {
        // Silent fail for network errors - don't log noise, just return false
        if (result.error.message !== 'timeout') {
          console.debug('[AuthContext] Admin check skipped:', result.error.message?.substring(0, 50));
        }
        return false;
      }
      
      return !!result.data;
    } catch {
      // Silent catch - network failures shouldn't log errors
      return false;
    }
  };

  useEffect(() => {
    let mounted = true;
    let refreshInterval: ReturnType<typeof setInterval> | null = null;
    let isInitializing = true;
    
    // Critical: Set loading to true at start
    setLoading(true);

    // Helper to complete auth initialization with profile/admin data
    const completeAuthInit = async (userId: string) => {
      try {
        const [profileData, adminStatus] = await Promise.all([
          fetchProfile(userId),
          checkAdminRole(userId)
        ]);
        if (mounted) {
          setProfile(profileData);
          setIsAdmin(adminStatus);
        }
      } catch (err) {
        console.error('[AuthContext] Failed to complete auth init:', err);
        // CRITICAL: Even on error, set a fallback profile to prevent UI blocking
        if (mounted) {
          setProfile({
            id: userId,
            email: null,
            display_name: 'User',
            full_name: null,
            avatar_url: null,
            credits_balance: 60,
            total_credits_purchased: 0,
            total_credits_used: 0,
            role: null,
            use_case: null,
            company: null,
            country: null,
            onboarding_completed: true,
            created_at: new Date().toISOString(),
            preferences: null,
            notification_settings: null,
            auto_recharge_enabled: false,
            has_seen_welcome_video: false,
          });
          setIsAdmin(false);
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
        
        console.log('[AuthContext] Auth state change:', event, newSession ? 'has session' : 'no session');
        
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
          // Fire and forget - update profile/admin in background
          fetchProfile(newSession.user.id).then(profileData => {
            if (mounted) setProfile(profileData);
          }).catch(console.error);
          
          checkAdminRole(newSession.user.id).then(isAdminResult => {
            if (mounted) setIsAdmin(isAdminResult);
          }).catch(console.error);
        } else {
          // Logged out
          setProfile(null);
          setProfileError(null);
          setIsAdmin(false);
        }
      }
    );

    // THEN check for existing session
    const initSession = async () => {
      try {
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        
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
      subscription.unsubscribe();
      if (refreshInterval) clearInterval(refreshInterval);
      if (visibilityDebounceTimer) clearTimeout(visibilityDebounceTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    // CRITICAL: Wait for session to be persisted to localStorage before returning
    // This prevents redirect loops where the app navigates before session is saved
    // FIX: Added max iteration guard to prevent stack overflow on slow networks
    if (!error && data?.session) {
      // Wait for the session to propagate through the auth state listener
      // This ensures sessionRef and state are updated before navigation
      await new Promise<void>((resolve) => {
        let iterations = 0;
        const MAX_ITERATIONS = 40; // 40 * 50ms = 2 seconds max
        
        const checkSession = () => {
          iterations++;
          if (sessionRef.current?.access_token === data.session?.access_token) {
            resolve();
          } else if (iterations >= MAX_ITERATIONS) {
            // Failsafe: resolve after max iterations to prevent infinite loop
            console.warn('[AuthContext] Session sync timed out after max iterations');
            resolve();
          } else {
            setTimeout(checkSession, 50);
          }
        };
        // Give a small initial delay for the listener to fire
        setTimeout(checkSession, 100);
      });
    }
    
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string) => {
    // Redirect to auth callback page to handle email confirmation token
    const redirectUrl = `${window.location.origin}/auth/callback`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
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

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    sessionRef.current = null;
    setProfile(null);
    setProfileError(null);
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
      signIn,
      signUp,
      signInWithGoogle,
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
      signIn: async () => ({ error: new Error('Auth not initialized') }),
      signUp: async () => ({ error: new Error('Auth not initialized') }),
      signInWithGoogle: async () => ({ error: new Error('Auth not initialized') }),
      signOut: async () => {},
      refreshProfile: async () => {},
      retryProfileFetch: async () => {},
      getValidSession: async () => null,
      waitForSession: async () => null,
    } as AuthContextType;
  }
  return context;
}
