import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AvatarTemplate, AvatarTemplateFilter } from '@/types/avatar-templates';
import { useMemo, useEffect } from 'react';

// Cache key for avatar templates
const AVATAR_TEMPLATES_KEY = ['avatar-templates'] as const;

// Stale time: 5 minutes (avatars don't change often)
const STALE_TIME = 5 * 60 * 1000;

// Cache time: 30 minutes (keep in memory for navigation)
const GC_TIME = 30 * 60 * 1000;

/**
 * Fetch avatar templates from database with safety guards
 * Separated for reuse and testing
 */
async function fetchAvatarTemplates(): Promise<AvatarTemplate[]> {
  console.log('[useAvatarTemplatesQuery] Fetching templates...');
  
  try {
    const { data, error } = await supabase
      .from('avatar_templates')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('[useAvatarTemplatesQuery] Fetch error:', error.message);
      throw error;
    }

    // GUARD: Ensure we always return an array, never null/undefined
    const templates = (data as unknown as AvatarTemplate[]) ?? [];
    console.log('[useAvatarTemplatesQuery] Fetched', templates.length, 'templates');
    return templates;
  } catch (error) {
    console.error('[useAvatarTemplatesQuery] Exception during fetch:', error);
    // Return empty array instead of throwing to prevent crash
    // The error state will still be set by React Query
    throw error;
  }
}

/**
 * React Query hook for avatar templates with:
 * - Automatic caching across navigation
 * - Stale-while-revalidate pattern
 * - Deduplication of concurrent requests
 * - Background refetching
 */
export function useAvatarTemplatesQuery(filter?: AvatarTemplateFilter) {
  const queryClient = useQueryClient();

  const {
    data: templates = [],
    isLoading,
    error,
    refetch,
    isFetching,
    isSuccess,
    isError,
  } = useQuery({
    queryKey: AVATAR_TEMPLATES_KEY,
    queryFn: fetchAvatarTemplates,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    refetchOnWindowFocus: false, // Don't refetch on tab focus (avatars are static)
    refetchOnMount: 'always', // Always check cache on mount to ensure data is fresh
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
  
  // Debug logging for navigation issues
  useEffect(() => {
    console.log('[useAvatarTemplatesQuery] State update:', { 
      count: templates.length, 
      isLoading, 
      isFetching,
      isSuccess,
      isError,
      error: error?.message || null
    });
  }, [templates.length, isLoading, isFetching, isSuccess, isError, error]);

  // Apply client-side filtering (memoized for performance)
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

  // Prefetch function for eager loading
  const prefetchTemplates = () => {
    queryClient.prefetchQuery({
      queryKey: AVATAR_TEMPLATES_KEY,
      queryFn: fetchAvatarTemplates,
      staleTime: STALE_TIME,
    });
  };

  // Invalidate cache (force fresh fetch)
  const invalidateCache = () => {
    queryClient.invalidateQueries({ queryKey: AVATAR_TEMPLATES_KEY });
  };

  return {
    templates: filteredTemplates,
    allTemplates: templates,
    isLoading: isLoading && !isFetching, // Only true on initial load
    isFetching, // True during background refetch
    error: error ? (error as Error).message : null,
    refetch,
    prefetchTemplates,
    invalidateCache,
  };
}

/**
 * Utility to prefetch avatar templates before navigation
 * Call this on hover/focus of avatar page link
 */
export function prefetchAvatarTemplates(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.prefetchQuery({
    queryKey: AVATAR_TEMPLATES_KEY,
    queryFn: fetchAvatarTemplates,
    staleTime: STALE_TIME,
  });
}
