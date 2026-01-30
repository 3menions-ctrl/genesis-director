import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AvatarTemplate, AvatarTemplateFilter } from '@/types/avatar-templates';

export function useAvatarTemplates(filter?: AvatarTemplateFilter) {
  const { isSessionVerified, session } = useAuth();
  const [templates, setTemplates] = useState<AvatarTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Don't fetch until session is verified
    if (!isSessionVerified) {
      return;
    }

    async function fetchTemplates() {
      setIsLoading(true);
      setError(null);

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

        if (result.error) {
          // Handle timeout gracefully
          if (result.error.message === 'timeout') {
            console.warn('[useAvatarTemplates] Request timed out');
            setTemplates([]);
            return;
          }
          throw result.error;
        }

        setTemplates((result.data as unknown as AvatarTemplate[]) || []);
      } catch (err) {
        console.error('Failed to fetch avatar templates:', err);
        setError(err instanceof Error ? err.message : 'Failed to load avatars');
        // Set empty array instead of leaving stale data
        setTemplates([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchTemplates();
  }, [isSessionVerified, session?.user?.id]);

  // Apply client-side filtering
  const filteredTemplates = useMemo(() => {
    if (!filter) return templates;

    return templates.filter(template => {
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
      setTemplates([]);
      setIsLoading(true);
    },
  };
}
