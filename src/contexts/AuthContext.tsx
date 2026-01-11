import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

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
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  getValidSession: () => Promise<Session | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSessionVerified, setIsSessionVerified] = useState(false);

  const fetchProfile = async (userId: string) => {
    // Always verify session before profile fetch to avoid RLS issues
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession) {
      console.warn('[AuthContext] fetchProfile: No valid session');
      return null;
    }
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
    return data as UserProfile;
  };

  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
    }
  };

  useEffect(() => {
    let mounted = true;
    let refreshInterval: NodeJS.Timeout | null = null;
    
    // Critical: Set loading to true at start
    setLoading(true);
    
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!mounted) return;
        
        console.log('[AuthContext] Auth state change:', event, newSession ? 'has session' : 'no session');
        
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setIsSessionVerified(true);

        // Defer profile fetch with setTimeout to avoid deadlock
        if (newSession?.user) {
          setTimeout(() => {
            if (mounted) {
              fetchProfile(newSession.user.id).then((p) => {
                if (mounted) setProfile(p);
              });
            }
          }, 0);
        } else {
          setProfile(null);
        }
      }
    );

    // THEN check for existing session
    const initSession = async () => {
      const { data: { session: existingSession } } = await supabase.auth.getSession();
      
      if (!mounted) return;
      
      console.log('[AuthContext] Initial session check:', existingSession ? 'has session' : 'no session');
      
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      setIsSessionVerified(true);
      
      if (existingSession?.user) {
        const profileData = await fetchProfile(existingSession.user.id);
        if (mounted) {
          setProfile(profileData);
          setLoading(false);
        }
      } else {
        setLoading(false);
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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  /**
   * Get a verified valid session directly from Supabase.
   * Use this before any critical operation to avoid stale React state.
   */
  const getValidSession = async (): Promise<Session | null> => {
    const { data: { session: freshSession } } = await supabase.auth.getSession();
    return freshSession;
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      loading,
      isSessionVerified,
      signIn,
      signUp,
      signOut,
      refreshProfile,
      getValidSession,
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
