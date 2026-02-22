/**
 * usePaginatedProjects - Server-side paginated project fetching
 * 
 * Replaces the "fetch all 196 projects" pattern that crashes Safari.
 * Implements cursor-based pagination with lazy loading.
 * 
 * STABILITY: Uses stable refs for filter state to prevent cascading re-renders.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Project } from '@/types/studio';
import { useAuth } from '@/contexts/AuthContext';

const PAGE_SIZE = 25;

export interface PaginatedProjectsResult {
  projects: Project[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  totalCount: number;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  optimisticRemove: (projectId: string) => void;
}

interface ProjectRow {
  id: string;
  user_id: string;
  title: string;
  status: string;
  mode: string | null;
  genre: string;
  video_url: string | null;
  video_clips: string[] | null;
  voice_audio_url: string | null;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
  likes_count: number;
  is_public: boolean;
  aspect_ratio: string | null;
  pipeline_state: any;
  source_image_url: string | null;
  avatar_voice_id: string | null;
  pending_video_tasks: any;
}

function mapDbProjectToProject(row: ProjectRow): Project {
  const pendingTasks = row.pending_video_tasks as Record<string, unknown> | null;
  
  let effectiveVideoUrl = row.video_url || undefined;
  
  if (!effectiveVideoUrl && pendingTasks) {
    if (pendingTasks.hlsPlaylistUrl) {
      effectiveVideoUrl = pendingTasks.hlsPlaylistUrl as string;
    } else if (pendingTasks.manifestUrl) {
      effectiveVideoUrl = pendingTasks.manifestUrl as string;
    }
  }
  
  let effectiveVideoClips = row.video_clips || undefined;
  if (!effectiveVideoClips?.length && pendingTasks?.predictions) {
    const predictions = pendingTasks.predictions as Array<{ videoUrl?: string; status?: string }>;
    const completedUrls = predictions
      .filter(p => p.videoUrl && p.status === 'completed')
      .map(p => p.videoUrl as string);
    if (completedUrls.length > 0) {
      effectiveVideoClips = completedUrls;
    }
  }
  
  return {
    id: row.id,
    studio_id: row.user_id,
    name: row.title,
    status: row.status as any,
    genre: row.genre as any,
    video_url: effectiveVideoUrl,
    thumbnail_url: row.thumbnail_url || undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
    is_public: row.is_public,
    mode: row.mode || undefined,
    source_image_url: row.source_image_url || undefined,
    avatar_voice_id: row.avatar_voice_id || undefined,
    video_clips: effectiveVideoClips,
    voice_audio_url: row.voice_audio_url || undefined,
    pending_video_tasks: pendingTasks || undefined,
  };
}

export function usePaginatedProjects(
  sortBy: 'updated' | 'created' | 'name' = 'updated',
  sortOrder: 'asc' | 'desc' = 'desc',
  statusFilter: 'all' | 'completed' | 'processing' | 'failed' = 'all',
  searchQuery: string = ''
): PaginatedProjectsResult {
  const { user, isAdmin } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const hasLoadedOnceRef = useRef(false);
  
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // STABILITY FIX: Store filter state in refs to prevent callback identity changes
  const filtersRef = useRef({ sortBy, sortOrder, statusFilter, searchQuery });
  filtersRef.current = { sortBy, sortOrder, statusFilter, searchQuery };
  
  const userIdRef = useRef(user?.id);
  userIdRef.current = user?.id;
  
  const isAdminRef = useRef(isAdmin);
  isAdminRef.current = isAdmin;
  
  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  // Build query using current ref values (no deps that change identity)
  const buildQuery = useCallback((currentOffset: number) => {
    const { sortBy: sb, sortOrder: so, statusFilter: sf, searchQuery: sq } = filtersRef.current;
    
    let query = supabase
      .from('movie_projects')
      .select('id, user_id, title, status, mode, genre, video_url, video_clips, voice_audio_url, thumbnail_url, created_at, updated_at, likes_count, is_public, aspect_ratio, pipeline_state, source_image_url, avatar_voice_id, pending_video_tasks', { count: 'exact' });
    
    if (!isAdminRef.current) {
      query = query.eq('user_id', userIdRef.current);
    }
    
    query = query
      .neq('status', 'draft')
      .range(currentOffset, currentOffset + PAGE_SIZE - 1);
    
    if (sf === 'completed') {
      query = query.eq('status', 'completed');
    } else if (sf === 'processing') {
      query = query.in('status', ['generating', 'stitching', 'pending', 'awaiting_approval']);
    } else if (sf === 'failed') {
      query = query.eq('status', 'failed');
    }
    
    if (sq.trim()) {
      query = query.ilike('title', `%${sq.trim()}%`);
    }
    
    const sortColumn = sb === 'updated' ? 'updated_at' : sb === 'created' ? 'created_at' : 'title';
    query = query.order(sortColumn, { ascending: so === 'asc' });
    
    return query;
  }, []); // Stable - reads from refs

  // Core fetch - stable callback identity
  const fetchProjects = useCallback(async () => {
    if (!userIdRef.current) {
      setProjects([]);
      setIsLoading(false);
      return;
    }
    
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    
    // Only show full loading on first load
    if (!hasLoadedOnceRef.current) {
      setIsLoading(true);
    }
    
    try {
      const query = buildQuery(0);
      const { data, error: queryError, count } = await query;
      
      if (!isMountedRef.current) return;
      
      if (queryError) {
        setError(queryError.message);
        console.error('[usePaginatedProjects] Fetch error:', queryError);
        return;
      }
      
      const mappedProjects = (data || []).map(mapDbProjectToProject);
      setProjects(mappedProjects);
      setTotalCount(count || 0);
      setHasMore((data?.length || 0) === PAGE_SIZE);
      setOffset(PAGE_SIZE);
      setError(null);
    } catch (err: any) {
      if (err.name !== 'AbortError' && isMountedRef.current) {
        console.debug('[usePaginatedProjects] Fetch error:', err.message);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
        hasLoadedOnceRef.current = true;
      }
    }
  }, [buildQuery]); // Stable - buildQuery is stable

  // Load more (pagination)
  const loadMore = useCallback(async () => {
    if (!userIdRef.current || isLoadingMore || !hasMore) return;
    
    setIsLoadingMore(true);
    
    try {
      const query = buildQuery(offset);
      const { data, error: queryError } = await query;
      
      if (!isMountedRef.current) return;
      
      if (queryError) {
        console.error('[usePaginatedProjects] LoadMore error:', queryError);
        return;
      }
      
      const newProjects = (data || []).map(mapDbProjectToProject);
      setProjects(prev => [...prev, ...newProjects]);
      setHasMore(newProjects.length === PAGE_SIZE);
      setOffset(prev => prev + PAGE_SIZE);
    } catch (err) {
      console.error('[usePaginatedProjects] LoadMore failed:', err);
    } finally {
      if (isMountedRef.current) {
        setIsLoadingMore(false);
      }
    }
  }, [offset, isLoadingMore, hasMore, buildQuery]);

  // Stable refresh - always uses latest filters via refs
  const refresh = useCallback(async () => {
    fetchProjects();
  }, [fetchProjects]);

  // Initial fetch on mount
  useEffect(() => {
    if (user?.id) {
      fetchProjects();
    }
  }, [user?.id]); // Only re-fetch when user changes, NOT on filter changes

  // Re-fetch when filters change (debounced via timeout)
  useEffect(() => {
    // Skip first render (handled by mount effect above)
    if (!hasLoadedOnceRef.current) return;
    
    const timer = setTimeout(() => {
      fetchProjects();
    }, 200); // Small debounce to batch rapid filter changes
    
    return () => clearTimeout(timer);
  }, [sortBy, sortOrder, statusFilter, searchQuery]); // Intentionally uses values, not fetchProjects

  // Optimistically remove a project from the list
  const optimisticRemove = useCallback((projectId: string) => {
    setProjects(prev => prev.filter(p => p.id !== projectId));
    setTotalCount(prev => Math.max(0, prev - 1));
  }, []);

  return {
    projects,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    totalCount,
    loadMore,
    refresh,
    optimisticRemove,
  };
}
