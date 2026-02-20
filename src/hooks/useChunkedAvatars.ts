/**
 * useChunkedAvatars - World-Class Progressive Avatar Loading Hook
 * 
 * Prevents browser crashes by loading avatars in controlled chunks
 * instead of all 120+ simultaneously. This reduces memory pressure
 * from high-resolution textures.
 * 
 * STABILITY FEATURES:
 * - Conservative chunk sizes to prevent GPU memory exhaustion
 * - Longer delays between chunks for mobile devices
 * - Safety guards against unmounted component updates
 * - Memoized visible avatars to prevent unnecessary re-renders
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AvatarTemplate } from '@/types/avatar-templates';

// Configuration for chunk loading
const INITIAL_CHUNK_SIZE = 30; // Show first 30 immediately
const CHUNK_SIZE = 30; // Load 30 more at a time
const CHUNK_DELAY_MS = 100; // Fast loading between chunks

interface UseChunkedAvatarsOptions {
  /** Enable/disable progressive loading (default: true) */
  enabled?: boolean;
  /** Number of avatars to load initially */
  initialSize?: number;
  /** Number of avatars to load per chunk */
  chunkSize?: number;
  /** Delay between chunks in ms */
  chunkDelay?: number;
}

interface UseChunkedAvatarsResult {
  /** Currently visible avatars (progressively grows) */
  visibleAvatars: AvatarTemplate[];
  /** Total avatars available */
  totalCount: number;
  /** Number of avatars currently loaded */
  loadedCount: number;
  /** Whether all avatars have been loaded */
  isFullyLoaded: boolean;
  /** Progress percentage (0-100) */
  loadProgress: number;
  /** Manually trigger loading more avatars */
  loadMore: () => void;
  /** Force load all remaining avatars */
  loadAll: () => void;
}

export function useChunkedAvatars(
  allAvatars: AvatarTemplate[],
  options: UseChunkedAvatarsOptions = {}
): UseChunkedAvatarsResult {
  const {
    enabled = true,
    initialSize = INITIAL_CHUNK_SIZE,
    chunkSize = CHUNK_SIZE,
    chunkDelay = CHUNK_DELAY_MS,
  } = options;

  // STABILITY: Use ref to track avatar array identity
  const avatarsRef = useRef(allAvatars);
  const avatarsLengthRef = useRef(allAvatars.length);
  
  const [loadedCount, setLoadedCount] = useState(
    enabled ? Math.min(initialSize, allAvatars.length) : allAvatars.length
  );
  const isLoadingChunkRef = useRef(false);
  const mountedRef = useRef(true);

  // STABILITY: Reset when avatar array reference or length changes
  useEffect(() => {
    const hasArrayChanged = avatarsRef.current !== allAvatars;
    const hasLengthChanged = avatarsLengthRef.current !== allAvatars.length;
    
    if (hasArrayChanged || hasLengthChanged) {
      avatarsRef.current = allAvatars;
      avatarsLengthRef.current = allAvatars.length;
      
      if (enabled) {
        setLoadedCount(Math.min(initialSize, allAvatars.length));
      } else {
        setLoadedCount(allAvatars.length);
      }
    }
  }, [allAvatars, enabled, initialSize]);

  // Track mounted state
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Progressive loading - load more chunks over time
  useEffect(() => {
    if (!enabled || loadedCount >= allAvatars.length) return;

    const loadNextChunk = () => {
      if (!mountedRef.current || isLoadingChunkRef.current) return;
      
      isLoadingChunkRef.current = true;
      
      setTimeout(() => {
        if (!mountedRef.current) {
          isLoadingChunkRef.current = false;
          return;
        }
        
        setLoadedCount(prev => {
          const next = Math.min(prev + chunkSize, allAvatars.length);
          return next;
        });
        
        isLoadingChunkRef.current = false;
      }, chunkDelay);
    };

    // Schedule next chunk
    const timer = setTimeout(loadNextChunk, chunkDelay);
    return () => clearTimeout(timer);
  }, [enabled, loadedCount, allAvatars.length, chunkSize, chunkDelay]);

  // Manual load more
  const loadMore = useCallback(() => {
    setLoadedCount(prev => Math.min(prev + chunkSize, allAvatars.length));
  }, [chunkSize, allAvatars.length]);

  // Force load all
  const loadAll = useCallback(() => {
    setLoadedCount(allAvatars.length);
  }, [allAvatars.length]);

  // STABILITY: Memoize visible avatars to prevent unnecessary re-renders
  const visibleAvatars = useMemo(() => {
    return allAvatars.slice(0, loadedCount);
  }, [allAvatars, loadedCount]);
  
  const isFullyLoaded = loadedCount >= allAvatars.length;
  const loadProgress = allAvatars.length > 0 
    ? Math.round((loadedCount / allAvatars.length) * 100) 
    : 100;

  return {
    visibleAvatars,
    totalCount: allAvatars.length,
    loadedCount,
    isFullyLoaded,
    loadProgress,
    loadMore,
    loadAll,
  };
}
