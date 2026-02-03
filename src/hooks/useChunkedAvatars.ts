/**
 * useChunkedAvatars - Progressive Avatar Loading Hook
 * 
 * Prevents browser crashes by loading avatars in controlled chunks
 * instead of all 120+ simultaneously. This reduces memory pressure
 * from high-resolution textures.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AvatarTemplate } from '@/types/avatar-templates';

// Configuration for chunk loading
const INITIAL_CHUNK_SIZE = 12; // Load first 12 immediately
const CHUNK_SIZE = 8; // Load 8 more at a time
const CHUNK_DELAY_MS = 150; // Delay between chunks to prevent memory spikes

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

  const [loadedCount, setLoadedCount] = useState(enabled ? initialSize : allAvatars.length);
  const isLoadingChunkRef = useRef(false);
  const mountedRef = useRef(true);

  // Reset when avatars change
  useEffect(() => {
    if (enabled) {
      setLoadedCount(Math.min(initialSize, allAvatars.length));
    } else {
      setLoadedCount(allAvatars.length);
    }
  }, [allAvatars.length, enabled, initialSize]);

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
        if (!mountedRef.current) return;
        
        setLoadedCount(prev => {
          const next = Math.min(prev + chunkSize, allAvatars.length);
          console.log(`[useChunkedAvatars] Loaded chunk: ${prev} → ${next} of ${allAvatars.length}`);
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

  // Compute visible avatars
  const visibleAvatars = allAvatars.slice(0, loadedCount);
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
