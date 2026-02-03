/**
 * useGatekeeperLoading - Centralized Page Loading Gatekeeper
 * 
 * SINGLE SOURCE OF TRUTH for page loading states across the application.
 * Consolidates the gatekeeper pattern used by heavy pages like Avatars, Create, Projects.
 * 
 * Features:
 * - Unified timeout fallback to prevent infinite loading
 * - Integration with NavigationLoadingContext
 * - Auth loading awareness
 * - Data loading coordination
 * - Progress calculation
 * - Mount-safe state management
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { usePageReady } from '@/contexts/NavigationLoadingContext';

// Default timeout to force render (prevents infinite loading)
const DEFAULT_TIMEOUT_MS = 5000;

interface GatekeeperConfig {
  /** Page identifier for debugging */
  pageId: string;
  /** Whether auth is still loading */
  authLoading?: boolean;
  /** Whether primary data is loading */
  dataLoading?: boolean;
  /** Whether data fetch was successful (from React Query) */
  dataSuccess?: boolean;
  /** Image preload progress 0-100 */
  imageProgress?: number;
  /** Custom timeout in ms (default: 5000) */
  timeout?: number;
  /** Whether to auto-signal readiness to NavigationLoadingContext */
  autoSignalReady?: boolean;
}

interface GatekeeperState {
  /** Whether page should show loading state */
  isLoading: boolean;
  /** Progress percentage 0-100 */
  progress: number;
  /** Current loading phase message */
  phase: 'auth' | 'data' | 'images' | 'ready';
  /** Whether timeout forced the render */
  wasForced: boolean;
}

interface UseGatekeeperLoadingReturn extends GatekeeperState {
  /** Manually signal that loading is complete */
  signalReady: () => void;
  /** Force show content immediately */
  forceReady: () => void;
}

export function useGatekeeperLoading(config: GatekeeperConfig): UseGatekeeperLoadingReturn {
  const {
    pageId,
    authLoading = false,
    dataLoading = false,
    dataSuccess = false,
    imageProgress = 0,
    timeout = DEFAULT_TIMEOUT_MS,
    autoSignalReady = true,
  } = config;

  const [forceRender, setForceRender] = useState(false);
  const [manualReady, setManualReady] = useState(false);
  const isMountedRef = useRef(true);
  const readySignaledRef = useRef(false);
  const { markReady, disableAutoComplete } = usePageReady();

  // Disable auto-complete immediately - this page manages its own readiness
  useEffect(() => {
    disableAutoComplete();
  }, [disableAutoComplete]);

  // Timeout fallback to prevent infinite loading
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (isMountedRef.current && !readySignaledRef.current) {
        console.warn(`[Gatekeeper:${pageId}] Timeout reached after ${timeout}ms, forcing render`);
        setForceRender(true);
      }
    }, timeout);

    return () => clearTimeout(timeoutId);
  }, [pageId, timeout]);

  // Mount tracking
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Calculate loading state
  const isLoading = useMemo(() => {
    // Manual ready or forced render bypasses everything
    if (manualReady || forceRender) return false;
    
    // Auth must complete
    if (authLoading) return true;
    
    // Data must be loading AND not already successful (cached)
    if (dataLoading && !dataSuccess) return true;
    
    return false;
  }, [manualReady, forceRender, authLoading, dataLoading, dataSuccess]);

  // Determine current phase
  const phase = useMemo(() => {
    if (!isLoading) return 'ready';
    if (authLoading) return 'auth';
    if (dataLoading) return 'data';
    return 'images';
  }, [isLoading, authLoading, dataLoading]);

  // Calculate progress
  const progress = useMemo(() => {
    if (!isLoading) return 100;
    
    let baseProgress = 0;
    
    // Auth phase: 0-20%
    if (authLoading) {
      return 10;
    }
    baseProgress = 20;
    
    // Data phase: 20-50%
    if (dataLoading && !dataSuccess) {
      return 35;
    }
    baseProgress = 50;
    
    // Image phase: 50-100%
    return Math.min(baseProgress + (imageProgress * 0.5), 100);
  }, [isLoading, authLoading, dataLoading, dataSuccess, imageProgress]);

  // Signal readiness to NavigationLoadingContext
  useEffect(() => {
    if (!isLoading && !readySignaledRef.current && autoSignalReady) {
      readySignaledRef.current = true;
      markReady(pageId);
      console.debug(`[Gatekeeper:${pageId}] Ready signaled`);
    }
  }, [isLoading, pageId, markReady, autoSignalReady]);

  // Manual ready signal
  const signalReady = useCallback(() => {
    if (!readySignaledRef.current) {
      readySignaledRef.current = true;
      setManualReady(true);
      markReady(pageId);
      console.debug(`[Gatekeeper:${pageId}] Manual ready signaled`);
    }
  }, [pageId, markReady]);

  // Force ready (skip all loading)
  const forceReady = useCallback(() => {
    setForceRender(true);
    console.debug(`[Gatekeeper:${pageId}] Force ready triggered`);
  }, [pageId]);

  return {
    isLoading,
    progress,
    phase,
    wasForced: forceRender,
    signalReady,
    forceReady,
  };
}

/**
 * Get loading message for current phase
 */
export function getGatekeeperMessage(phase: GatekeeperState['phase'], customMessages?: Partial<Record<GatekeeperState['phase'], string>>): string {
  const defaults: Record<GatekeeperState['phase'], string> = {
    auth: 'Authenticating...',
    data: 'Loading data...',
    images: 'Preparing assets...',
    ready: 'Ready',
  };
  
  return customMessages?.[phase] ?? defaults[phase];
}

/**
 * Preset configurations for common page types
 */
export const GATEKEEPER_PRESETS = {
  avatars: {
    pageId: 'AvatarsPage',
    timeout: 5000,
    messages: {
      auth: 'Authenticating...',
      data: 'Loading avatar library...',
      images: 'Preparing previews...',
      ready: 'Ready',
    },
  },
  create: {
    pageId: 'CreatePage',
    timeout: 5000,
    messages: {
      auth: 'Authenticating...',
      data: 'Loading creation tools...',
      images: 'Preparing studio...',
      ready: 'Ready',
    },
  },
  projects: {
    pageId: 'ProjectsPage',
    timeout: 5000,
    messages: {
      auth: 'Authenticating...',
      data: 'Loading your projects...',
      images: 'Preparing thumbnails...',
      ready: 'Ready',
    },
  },
  production: {
    pageId: 'ProductionPage',
    timeout: 8000, // Longer for production page
    messages: {
      auth: 'Authenticating...',
      data: 'Loading production data...',
      images: 'Preparing pipeline...',
      ready: 'Ready',
    },
  },
} as const;

export type GatekeeperPreset = keyof typeof GATEKEEPER_PRESETS;
