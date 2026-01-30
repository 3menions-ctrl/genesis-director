import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AvatarTemplate, AvatarTemplateFilter } from '@/types/avatar-templates';

export function useAvatarTemplates(filter?: AvatarTemplateFilter) {
  const { isSessionVerified } = useAuth();
  const [templates, setTemplates] = useState<AvatarTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const hasFetchedRef = useRef(false);

  const fetchTemplates = useCallback(async () => {
    // Prevent duplicate fetches
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    
    console.log('[useAvatarTemplates] Starting fetch...');
    
    if (isMountedRef.current) {
      setIsLoading(true);
      setError(null);
    }

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((resolve) => {
        setTimeout(() => resolve({ data: null, error: { message: 'timeout' } }), 10000);
      });
      
      // Query avatar_templates table
      const fetchPromise = supabase
        .from('avatar_templates')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      
      const result = await Promise.race([fetchPromise, timeoutPromise]);

      if (!isMountedRef.current) return;

      if (result.error) {
        // Handle timeout gracefully
        if (result.error.message === 'timeout') {
          console.warn('[useAvatarTemplates] Request timed out');
          setTemplates([]);
          return;
        }
        throw result.error;
      }

      console.log('[useAvatarTemplates] Fetched', result.data?.length || 0, 'templates');
      setTemplates((result.data as unknown as AvatarTemplate[]) || []);
    } catch (err) {
      if (!isMountedRef.current) return;
      console.error('[useAvatarTemplates] Failed to fetch:', err);
      setError(err instanceof Error ? err.message : 'Failed to load avatars');
      setTemplates([]);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    hasFetchedRef.current = false;
    
    console.log('[useAvatarTemplates] Effect running, isSessionVerified:', isSessionVerified);
    
    // Fetch when session is verified
    if (isSessionVerified) {
      fetchTemplates();
    } else {
      // Set a timeout to fetch anyway if session takes too long
      const timeout = setTimeout(() => {
        if (isMountedRef.current && !hasFetchedRef.current) {
          console.warn('[useAvatarTemplates] Session verification timeout, fetching anyway');
          fetchTemplates();
        }
      }, 3000);
      return () => clearTimeout(timeout);
    }
    
    return () => {
      isMountedRef.current = false;
    };
  }, [isSessionVerified, fetchTemplates]);

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
      if (isMountedRef.current) {
        hasFetchedRef.current = false;
        setTemplates([]);
        setIsLoading(true);
        fetchTemplates();
      }
    },
  };
}
