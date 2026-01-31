/**
 * useAdminAccess - Hook to check and enforce admin access
 * 
 * Provides server-side verified admin status check with enhanced security.
 * NEVER rely on client-side storage for admin verification.
 * 
 * Security Features:
 * - Fresh session validation on each check
 * - Server-side role verification via RLS-protected query
 * - Session expiration detection
 * - Rate limiting protection via database
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UseAdminAccessResult {
  isAdmin: boolean;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  lastVerified: Date | null;
}

// Re-verify admin status every 5 minutes for long-lived sessions
const REVERIFICATION_INTERVAL_MS = 5 * 60 * 1000;

export function useAdminAccess(): UseAdminAccessResult {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastVerified, setLastVerified] = useState<Date | null>(null);
  const mountedRef = useRef(true);
  const verificationInProgress = useRef(false);

  const checkAdminStatus = useCallback(async () => {
    // Prevent concurrent verification requests
    if (verificationInProgress.current) return;
    
    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      setLastVerified(null);
      return;
    }

    try {
      verificationInProgress.current = true;
      setLoading(true);
      setError(null);

      // Step 1: Verify we have a valid, fresh session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !sessionData?.session) {
        console.warn('[useAdminAccess] No valid session found');
        if (mountedRef.current) {
          setIsAdmin(false);
          setError('Session expired');
        }
        return;
      }

      // Step 2: Verify the session user matches our expected user
      if (sessionData.session.user.id !== user.id) {
        console.error('[useAdminAccess] Session user mismatch - potential security issue');
        if (mountedRef.current) {
          setIsAdmin(false);
          setError('Session verification failed');
        }
        return;
      }

      // Step 3: Server-side admin role verification
      // This query is protected by RLS - users can only read their own roles
      const { data, error: rpcError } = await supabase
        .from('user_roles')
        .select('role, created_at')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (!mountedRef.current) return;

      if (rpcError) {
        console.error('[useAdminAccess] Error checking admin role:', rpcError);
        setError('Failed to verify admin status');
        setIsAdmin(false);
      } else {
        const verified = !!data;
        setIsAdmin(verified);
        setLastVerified(new Date());
        
        if (verified) {
          console.info('[useAdminAccess] Admin status verified for user:', user.id.slice(0, 8));
        }
      }
    } catch (err) {
      console.error('[useAdminAccess] Admin check failed:', err);
      if (mountedRef.current) {
        setError('Admin verification failed');
        setIsAdmin(false);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
      verificationInProgress.current = false;
    }
  }, [user]);

  // Initial verification and re-verify on user change
  useEffect(() => {
    mountedRef.current = true;
    checkAdminStatus();
    
    return () => {
      mountedRef.current = false;
    };
  }, [checkAdminStatus]);

  // Periodic re-verification for long-lived admin sessions
  useEffect(() => {
    if (!isAdmin || !user) return;

    const interval = setInterval(() => {
      console.info('[useAdminAccess] Periodic admin status re-verification');
      checkAdminStatus();
    }, REVERIFICATION_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isAdmin, user, checkAdminStatus]);

  return {
    isAdmin,
    loading,
    error,
    refetch: checkAdminStatus,
    lastVerified,
  };
}
