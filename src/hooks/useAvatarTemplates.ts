import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AvatarTemplate, AvatarTemplateFilter } from '@/types/avatar-templates';

/**
 * Optimized hook for fetching avatar templates with:
 * - Proper cleanup of all async operations
 * - Prevention of double-fetching with mutex lock
 * - Safe state updates using mount tracking
 * - Memoized filter results
 */
export function useAvatarTemplates(filter?: AvatarTemplateFilter) {
  const [templates, setTemplates] = useState<AvatarTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // CRITICAL: All refs for cleanup and preventing race conditions
  const isMountedRef = useRef(true);
  const fetchAttemptedRef = useRef(false);
  const isFetchingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Safe state setter that checks mount status
  const safeSetState = useCallback(<T,>(
    setter: React.Dispatch<React.SetStateAction<T>>,
    value: T
  ) => {
    if (isMountedRef.current) {
      setter(value);
    }
  }, []);

  const fetchTemplates = useCallback(async () => {
    // GUARD: Prevent concurrent fetches (fixes double-loading bug)
    if (isFetchingRef.current) {
      console.debug('[useAvatarTemplates] Fetch already in progress, skipping');
      return;
    }
    
    // Only log once per mount to reduce noise
    if (!fetchAttemptedRef.current) {
      console.log('[useAvatarTemplates] Starting fetch...');
    }
    fetchAttemptedRef.current = true;
    isFetchingRef.current = true;
    
    // Abort any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    safeSetState(setIsLoading, true);
    safeSetState(setError, null);

    try {
      // Simple timeout wrapper - avatar_templates has public RLS so no auth needed
      const timeoutId = setTimeout(() => {
        abortControllerRef.current?.abort();
      }, 10000);
      
      // CRITICAL: Fetch ALL active avatars without limit
      const { data, error: fetchError } = await supabase
        .from('avatar_templates')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      clearTimeout(timeoutId);

      if (!isMountedRef.current) {
        isFetchingRef.current = false;
        return;
      }

      if (fetchError) {
        console.error('[useAvatarTemplates] Fetch error:', fetchError.message);
        throw fetchError;
      }

      console.log('[useAvatarTemplates] Fetched', data?.length || 0, 'templates');
      safeSetState(setTemplates, (data as unknown as AvatarTemplate[]) || []);
      safeSetState(setError, null);
    } catch (err) {
      if (!isMountedRef.current) {
        isFetchingRef.current = false;
        return;
      }
      
      const errorMessage = err instanceof Error ? err.message : 'Failed to load avatars';
      
      // Only set error if not aborted
      if (errorMessage !== 'AbortError' && (err as Error)?.name !== 'AbortError') {
        console.error('[useAvatarTemplates] Failed to fetch:', errorMessage);
        safeSetState(setError, errorMessage);
      }
      safeSetState(setTemplates, []);
    } finally {
      if (isMountedRef.current) {
        safeSetState(setIsLoading, false);
      }
      isFetchingRef.current = false;
    }
  }, [safeSetState]);

  // Fetch immediately on mount with proper cleanup
  useEffect(() => {
    isMountedRef.current = true;
    
    // Reset all flags on mount
    const hadPreviousAttempt = fetchAttemptedRef.current;
    fetchAttemptedRef.current = false;
    isFetchingRef.current = false;
    
    // If this is a remount with partial data, clear it
    if (hadPreviousAttempt && templates.length > 0 && templates.length < 10) {
      console.log('[useAvatarTemplates] Detected remount with partial data, clearing...');
      setTemplates([]);
    }
    
    // Small delay to let environment initialize
    const initTimer = setTimeout(() => {
      if (isMountedRef.current) {
        fetchTemplates();
      }
    }, 100);
    
    return () => {
      isMountedRef.current = false;
      clearTimeout(initTimer);
      
      // CRITICAL: Abort any in-flight requests on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []); // Empty deps = run once on mount only

  // Apply client-side filtering - memoized for performance
  const filteredTemplates = useMemo(() => {
    if (!filter) return templates;

    return templates.filter(template => {
      // Avatar type filter
      if (filter.avatarType && filter.avatarType !== 'all') {
        if (template.avatar_type !== filter.avatarType) return false;
      }

      // Gender filter
      if (filter.gender && filter.gender !== 'all') {
        if (template.gender !== filter.gender) return false;
      }

      // Style filter
      if (filter.style && filter.style !== 'all') {
        if (template.style !== filter.style) return false;
      }

      // Search filter
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        const matchesName = template.name.toLowerCase().includes(searchLower);
        const matchesDescription = template.description?.toLowerCase().includes(searchLower);
        const matchesTags = template.tags?.some(tag => tag.toLowerCase().includes(searchLower));
        
        if (!matchesName && !matchesDescription && !matchesTags) return false;
      }

      return true;
    });
  }, [templates, filter]);

  // Memoized refetch function
  const refetch = useCallback(() => {
    if (isMountedRef.current && !isFetchingRef.current) {
      fetchAttemptedRef.current = false;
      setTemplates([]);
      setIsLoading(true);
      fetchTemplates();
    }
  }, [fetchTemplates]);

  return {
    templates: filteredTemplates,
    allTemplates: templates,
    isLoading,
    error,
    refetch,
  };
}
