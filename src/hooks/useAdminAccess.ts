/**
 * useAdminAccess - Hook to check and enforce admin access
 * 
 * Provides server-side verified admin status check.
 * NEVER rely on client-side storage for admin verification.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UseAdminAccessResult {
  isAdmin: boolean;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useAdminAccess(): UseAdminAccessResult {
  const { user, isAdmin: contextIsAdmin } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkAdminStatus = useCallback(async () => {
    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Always verify server-side - never trust client state alone
      const { data, error: rpcError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (rpcError) {
        console.error('[useAdminAccess] Error checking admin role:', rpcError);
        setError('Failed to verify admin status');
        setIsAdmin(false);
      } else {
        setIsAdmin(!!data);
      }
    } catch (err) {
      console.error('[useAdminAccess] Admin check failed:', err);
      setError('Admin verification failed');
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    checkAdminStatus();
  }, [checkAdminStatus]);

  return {
    isAdmin,
    loading,
    error,
    refetch: checkAdminStatus,
  };
}

// AdminOnly component moved to separate file to avoid JSX in non-tsx file
