import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session } from '@supabase/supabase-js';

/**
 * Hook that provides a guaranteed valid session before allowing data operations.
 * This solves the race condition where React state (user/session) may not be synced
 * with the actual Supabase client session, causing RLS to block queries.
 * 
 * USAGE:
 * const { session, isReady, waitForSession } = useSessionGuard();
 * 
 * // Option 1: Wait for isReady before rendering data-dependent components
 * if (!isReady) return <Loading />;
 * 
 * // Option 2: Use waitForSession() before any Supabase query
 * const data = await waitForSession(async (session) => {
 *   return supabase.from('table').select('*').eq('user_id', session.user.id);
 * });
 */
export function useSessionGuard() {
  const [session, setSession] = useState<Session | null>(null);
  const [isReady, setIsReady] = useState(false);
  const sessionRef = useRef<Session | null>(null);

  useEffect(() => {
    let mounted = true;

    // Get the actual session from Supabase client
    const initSession = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (mounted) {
        sessionRef.current = currentSession;
        setSession(currentSession);
        setIsReady(true);
      }
    };

    initSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (mounted) {
          sessionRef.current = newSession;
          setSession(newSession);
          setIsReady(true);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  /**
   * Wrapper that ensures a valid session exists before executing a callback.
   * Returns null if no session, otherwise executes the callback with the session.
   */
  const waitForSession = useCallback(async <T>(
    callback: (session: Session) => Promise<T>
  ): Promise<T | null> => {
    // Always get fresh session from Supabase to avoid stale React state
    const { data: { session: freshSession } } = await supabase.auth.getSession();
    
    if (!freshSession) {
      console.warn('[useSessionGuard] No valid session for operation');
      return null;
    }
    
    return callback(freshSession);
  }, []);

  /**
   * Get the current session synchronously (may be stale, use waitForSession for critical operations)
   */
  const getSession = useCallback((): Session | null => {
    return sessionRef.current;
  }, []);

  return {
    session,
    isReady,
    waitForSession,
    getSession,
    userId: session?.user?.id || null,
  };
}
