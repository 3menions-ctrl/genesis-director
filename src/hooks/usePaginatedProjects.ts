/**
 * usePaginatedProjects - Server-side paginated project fetching
 * 
 * Replaces the "fetch all 196 projects" pattern that crashes Safari.
 * Implements cursor-based pagination with lazy loading.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Project } from '@/types/studio';
import { useAuth } from '@/contexts/AuthContext';

const PAGE_SIZE = 5; // Load 5 projects per page to prevent memory exhaustion

export interface PaginatedProjectsResult {
  projects: Project[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  totalCount: number;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

interface ProjectRow {
  id: string;
  user_id: string;
  title: string;
  status: string;
  mode: string | null;
  genre: string;
  video_url: string | null;
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
  return {
    id: row.id,
    studio_id: row.user_id, // Maps to studio_id in Project type
    name: row.title,
    status: row.status as any,
    genre: row.genre as any,
    video_url: row.video_url || undefined,
    thumbnail_url: row.thumbnail_url || undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
    is_public: row.is_public,
    // These are lazy-loaded, not fetched upfront
    video_clips: undefined,
  };
}

export function usePaginatedProjects(
  sortBy: 'updated' | 'created' | 'name' = 'updated',
  sortOrder: 'asc' | 'desc' = 'desc',
  statusFilter: 'all' | 'completed' | 'processing' | 'failed' = 'all',
  searchQuery: string = ''
): PaginatedProjectsResult {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);
  
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  // Build query based on filters
  const buildQuery = useCallback((currentOffset: number) => {
    let query = supabase
      .from('movie_projects')
      .select('id, user_id, title, status, mode, genre, video_url, thumbnail_url, created_at, updated_at, likes_count, is_public, aspect_ratio, pipeline_state, source_image_url, avatar_voice_id, pending_video_tasks', { count: 'exact' })
      .eq('user_id', user?.id)
      .range(currentOffset, currentOffset + PAGE_SIZE - 1);
    
    // Apply status filter
    if (statusFilter === 'completed') {
      query = query.eq('status', 'completed');
    } else if (statusFilter === 'processing') {
      query = query.in('status', ['generating', 'stitching', 'pending', 'awaiting_approval']);
    } else if (statusFilter === 'failed') {
      query = query.eq('status', 'failed');
    }
    
    // Apply search
    if (searchQuery.trim()) {
      query = query.ilike('title', `%${searchQuery.trim()}%`);
    }
    
    // Apply sort
    const sortColumn = sortBy === 'updated' ? 'updated_at' : sortBy === 'created' ? 'created_at' : 'title';
    query = query.order(sortColumn, { ascending: sortOrder === 'asc' });
    
    return query;
  }, [user?.id, statusFilter, searchQuery, sortBy, sortOrder]);

  // Initial fetch
  const fetchProjects = useCallback(async (isRefresh = false) => {
    if (!user?.id) {
      setProjects([]);
      setIsLoading(false);
      return;
    }
    
    // Cancel previous request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    
    if (isRefresh) {
      setOffset(0);
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
      
      console.log(`[usePaginatedProjects] Loaded ${mappedProjects.length} of ${count} projects`);
    } catch (err: any) {
      if (err.name !== 'AbortError' && isMountedRef.current) {
        setError(err.message || 'Failed to load projects');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [user?.id, buildQuery]);

  // Load more (pagination)
  const loadMore = useCallback(async () => {
    if (!user?.id || isLoadingMore || !hasMore) return;
    
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
      
      console.log(`[usePaginatedProjects] Loaded ${newProjects.length} more projects`);
    } catch (err) {
      console.error('[usePaginatedProjects] LoadMore failed:', err);
    } finally {
      if (isMountedRef.current) {
        setIsLoadingMore(false);
      }
    }
  }, [user?.id, offset, isLoadingMore, hasMore, buildQuery]);

  // Refresh (reset pagination)
  const refresh = useCallback(async () => {
    await fetchProjects(true);
  }, [fetchProjects]);

  // Re-fetch when filters/sort change
  useEffect(() => {
    fetchProjects(true);
  }, [sortBy, sortOrder, statusFilter, searchQuery, user?.id]);

  return {
    projects,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    totalCount,
    loadMore,
    refresh,
  };
}
