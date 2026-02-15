/**
 * useZombieWatcher Hook
 * 
 * Real-time monitoring for stuck "zombie" processes.
 * Automatically detects and can clean up stuck tasks.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ZombieTask,
  ZombieCleanupResult,
  ZOMBIE_CONFIG,
  detectZombieProjects,
  detectZombieClips,
  batchCleanupZombies,
} from '@/lib/zombieProcessWatcher';

interface UseZombieWatcherReturn {
  /** Currently detected zombie tasks */
  zombies: ZombieTask[];
  /** Whether initial check is loading */
  isLoading: boolean;
  /** Total estimated refund available */
  totalRefund: number;
  /** Clean up all zombies */
  cleanupAll: () => Promise<ZombieCleanupResult>;
  /** Manual refresh */
  refresh: () => Promise<void>;
  /** Cleanup result from last operation */
  lastCleanupResult: ZombieCleanupResult | null;
}

export function useZombieWatcher(
  userId: string | undefined,
  options?: {
    enabled?: boolean;
    autoCheck?: boolean;
    checkInterval?: number;
  }
): UseZombieWatcherReturn {
  const { 
    enabled = true, 
    autoCheck = true, 
    checkInterval = ZOMBIE_CONFIG.CHECK_INTERVAL_MS 
  } = options ?? {};
  
  const [zombies, setZombies] = useState<ZombieTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastCleanupResult, setLastCleanupResult] = useState<ZombieCleanupResult | null>(null);
  const isMountedRef = useRef(true);
  
  // Calculate total refund
  const totalRefund = zombies.reduce((sum, z) => sum + z.estimatedRefund, 0);
  
  // Refresh zombie detection
  const refresh = useCallback(async () => {
    if (!userId || !enabled) return;
    
    setIsLoading(true);
    
    try {
      const [projects, clips] = await Promise.all([
        detectZombieProjects(userId),
        detectZombieClips(userId),
      ]);
      
      if (isMountedRef.current) {
        setZombies([...projects, ...clips]);
      }
    } catch (err) {
      console.error('[useZombieWatcher] Detection failed:', err);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [userId, enabled]);
  
  // Cleanup all zombies
  const cleanupAll = useCallback(async (): Promise<ZombieCleanupResult> => {
    if (!userId) {
      return { zombiesFound: 0, zombiesCleaned: 0, creditsRefunded: 0, errors: ['No user ID'] };
    }
    
    const result = await batchCleanupZombies(userId);
    
    if (isMountedRef.current) {
      setLastCleanupResult(result);
      // Refresh after cleanup
      await refresh();
    }
    
    return result;
  }, [userId, refresh]);
  
  // Stable ref for refresh to break the effect→callback→effect loop
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  // Initial check on mount
  useEffect(() => {
    isMountedRef.current = true;
    
    if (enabled && userId) {
      refreshRef.current();
    }
    
    return () => {
      isMountedRef.current = false;
    };
  }, [enabled, userId]);
  
  // Periodic auto-check — use ref to avoid interval churn
  useEffect(() => {
    if (!autoCheck || !enabled || !userId) return;
    
    const interval = setInterval(() => refreshRef.current(), checkInterval);
    return () => clearInterval(interval);
  }, [autoCheck, enabled, userId, checkInterval]);
  
  return {
    zombies,
    isLoading,
    totalRefund,
    cleanupAll,
    refresh,
    lastCleanupResult,
  };
}

export default useZombieWatcher;
