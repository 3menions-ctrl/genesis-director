import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AvatarTemplate, AvatarTemplateFilter } from '@/types/avatar-templates';

export function useAvatarTemplates(filter?: AvatarTemplateFilter) {
  const [templates, setTemplates] = useState<AvatarTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const fetchAttemptedRef = useRef(false);
  // CRITICAL: Prevent double-fetching with a fetch-in-progress lock
  const isFetchingRef = useRef(false);

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
    
    if (isMountedRef.current) {
      setIsLoading(true);
      setError(null);
    }

    try {
      // Simple timeout wrapper - avatar_templates has public RLS so no auth needed
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      // CRITICAL: Removed any limit() to fetch ALL active avatars
      // Previous bug may have been caused by a pagination issue
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
      setTemplates((data as unknown as AvatarTemplate[]) || []);
      setError(null);
    } catch (err) {
      if (!isMountedRef.current) {
        isFetchingRef.current = false;
        return;
      }
      
      const errorMessage = err instanceof Error ? err.message : 'Failed to load avatars';
      console.error('[useAvatarTemplates] Failed to fetch:', errorMessage);
      
      // Only set error if not aborted
      if (errorMessage !== 'AbortError') {
        setError(errorMessage);
      }
      setTemplates([]);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
      isFetchingRef.current = false;
    }
  }, []);

  // Fetch immediately on mount - avatar_templates is public readable
  // CRITICAL: Only run ONCE on mount using empty dependency array
  useEffect(() => {
    isMountedRef.current = true;
    fetchAttemptedRef.current = false;
    isFetchingRef.current = false;
    
    // Small delay to let Lovable preview environment initialize (500ms)
    // This prevents session handshake issues during initial load
    const initTimer = setTimeout(() => {
      if (isMountedRef.current) {
        fetchTemplates();
      }
    }, 100); // Reduced from potential race condition window
    
    return () => {
      isMountedRef.current = false;
      clearTimeout(initTimer);
    };
  }, []); // Empty deps = run once on mount only

  // Apply client-side filtering
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

  return {
    templates: filteredTemplates,
    allTemplates: templates,
    isLoading,
    error,
    refetch: () => {
      if (isMountedRef.current && !isFetchingRef.current) {
        fetchAttemptedRef.current = false;
        isFetchingRef.current = false; // Reset the lock
        setTemplates([]);
        setIsLoading(true);
        fetchTemplates();
      }
    },
  };
}
