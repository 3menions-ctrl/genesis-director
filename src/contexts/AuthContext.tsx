import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { stabilityMonitor } from '@/lib/stabilityMonitor';

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
  onboarding_completed: boolean;
  created_at: string;
  preferences: Record<string, unknown> | null;
  notification_settings: Record<string, unknown> | null;
  auto_recharge_enabled: boolean | null;
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
      onboarding_completed: true, // Assume completed to prevent redirect loops
      created_at: new Date().toISOString(),
      preferences: null,
      notification_settings: null,
      auto_recharge_enabled: false,
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
          console.warn('[AuthContext] Profile fetch timed out, using fallback');
          setProfileError(null); // Don't show error for timeout - we have fallback
          return createFallbackProfile();
        }
        console.error('Error fetching profile:', result.error);
        setProfileError('Failed to load profile');
        return null;
      }
      
      setProfileError(null);
      return result.data as UserProfile;
    } catch (err) {
      console.error('Profile fetch failed:', err);
      // Return fallback instead of null to prevent UI blocking
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
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();
      
      if (error) {
        console.error('Error checking admin role:', error);
        return false;
      }
      
      return !!data;
    } catch (err) {
      console.error('Admin check failed:', err);
      return false;
    }
  };

  useEffect(() => {
    let mounted = true;
    let refreshInterval: NodeJS.Timeout | null = null;
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
            onboarding_completed: true,
            created_at: new Date().toISOString(),
            preferences: null,
            notification_settings: null,
            auto_recharge_enabled: false,
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;
        
        console.log('[AuthContext] Auth state change:', event, newSession ? 'has session' : 'no session');
        
        sessionRef.current = newSession;
        setSession(newSession);
        setUser(newSession?.user ?? null);
        
        // CRITICAL: Only mark session as verified after we've processed the change
        // This prevents race conditions where components check session before it's ready
        if (!isInitializing) {
          setIsSessionVerified(true);
        }

        // Skip if this is during initialization - initSession will handle it
        if (isInitializing) return;

        // Handle auth state changes AFTER initialization
        if (newSession?.user) {
          // Fetch profile and admin status before setting loading to false
          await completeAuthInit(newSession.user.id);
        } else {
          setProfile(null);
          setProfileError(null);
          setIsAdmin(false);
          setLoading(false);
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
        
        if (existingSession?.user) {
          await completeAuthInit(existingSession.user.id);
        } else {
          setIsAdmin(false);
          setLoading(false);
        }
        
        // CRITICAL: Mark session as verified AFTER all initialization is complete
        // This ensures ProtectedRoute won't redirect prematurely
        setIsSessionVerified(true);
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

    // Also refresh on window focus (user returns to tab)
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && mounted) {
        console.log('[AuthContext] Tab became visible, checking session...');
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (currentSession) {
          const expiresAt = currentSession.expires_at;
          const now = Math.floor(Date.now() / 1000);
          const timeUntilExpiry = expiresAt ? expiresAt - now : 0;
          
          // If less than 30 minutes until expiry, refresh
          if (timeUntilExpiry < 30 * 60) {
            console.log('[AuthContext] Refreshing session on tab focus');
            await supabase.auth.refreshSession();
          }
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      if (refreshInterval) clearInterval(refreshInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    // CRITICAL: Wait for session to be persisted to localStorage before returning
    // This prevents redirect loops where the app navigates before session is saved
    if (!error && data?.session) {
      // Wait for the session to propagate through the auth state listener
      // This ensures sessionRef and state are updated before navigation
      await new Promise<void>((resolve) => {
        const checkSession = () => {
          if (sessionRef.current?.access_token === data.session?.access_token) {
            resolve();
          } else {
            setTimeout(checkSession, 50);
          }
        };
        // Give a small initial delay for the listener to fire
        setTimeout(checkSession, 100);
        // Failsafe: resolve after 2 seconds regardless
        setTimeout(resolve, 2000);
      });
    }
    
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string) => {
    // Standardized redirect URL - let ProtectedRoute handle onboarding redirect
    const redirectUrl = `${window.location.origin}/`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });
    
    // Wait for session persistence if signup auto-confirms
    if (!error && data?.session) {
      await new Promise<void>((resolve) => {
        const checkSession = () => {
          if (sessionRef.current?.access_token === data.session?.access_token) {
            resolve();
          } else {
            setTimeout(checkSession, 50);
          }
        };
        setTimeout(checkSession, 100);
        setTimeout(resolve, 2000);
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
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
