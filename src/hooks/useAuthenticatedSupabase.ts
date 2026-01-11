import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session } from '@supabase/supabase-js';

/**
 * Hook that ensures Supabase client has a valid authenticated session
 * before allowing any database operations.
 * 
 * This solves the race condition where React state has `user` but 
 * the Supabase HTTP client hasn't synced its session token yet.
 */
export function useAuthenticatedSupabase() {
  const [session, setSession] = useState<Session | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // First, get the current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsReady(true);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setIsReady(true);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  /**
   * Execute a Supabase query only when session is valid.
   * Returns null if no valid session.
   */
  const withAuth = useCallback(async <T>(
    queryFn: () => Promise<T>
  ): Promise<T | null> => {
    // Verify we have a valid session before executing
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    
    if (!currentSession) {
      console.warn('No valid session for authenticated query');
      return null;
    }
    
    return queryFn();
  }, []);

  /**
   * Get the current authenticated user ID from the actual session,
   * not from React state.
   */
  const getAuthUserId = useCallback(async (): Promise<string | null> => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    return currentSession?.user?.id ?? null;
  }, []);

  return {
    session,
    isReady,
    isAuthenticated: !!session,
    userId: session?.user?.id ?? null,
    withAuth,
    getAuthUserId,
  };
}
