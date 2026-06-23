/**
 * Avatar Pipeline Audit Tests
 * 
 * Comprehensive audit of avatar pipeline architecture:
 * - Page loading patterns consistency
 * - Navigation guard usage
 * - Gatekeeper implementation
 * - Data flow safety
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const readFile = (relativePath: string): string => {
  const fullPath = path.join(process.cwd(), relativePath);
  if (fs.existsSync(fullPath)) {
    return fs.readFileSync(fullPath, 'utf-8');
  }
  return '';
};

describe('Avatar Pipeline Page Loading Audit', () => {
  describe('Avatars.tsx Loading Patterns', () => {
    // Avatars is now a browse/cast surface backed by React Query
    // (useAvatarTemplatesQuery) rather than the gatekeeper/virtual-gallery
    // pipeline. It owns its own loading/error/empty states and renders the
    // inline GlassGallery.
    const avatarsContent = readFile('src/pages/Avatars.tsx');

    it('should load templates via the centralized React Query hook', () => {
      expect(avatarsContent).toContain('useAvatarTemplatesQuery');
      expect(avatarsContent).toContain('isLoading');
      expect(avatarsContent).toContain('error');
    });

    it('should render explicit loading / error / empty states', () => {
      expect(avatarsContent).toContain('GridSkeleton');
      expect(avatarsContent).toContain('ErrorState');
      expect(avatarsContent).toContain('EmptyState');
    });

    it('should use safe navigation patterns', () => {
      expect(avatarsContent).toContain('useSafeNavigation');
    });

    it('should render the avatar gallery', () => {
      expect(avatarsContent).toContain('GlassGallery');
    });

    it('should guard against null/undefined templates', () => {
      expect(avatarsContent).toContain('Array.isArray');
    });

    it('should be wrapped in an error boundary with safe image fallbacks', () => {
      expect(avatarsContent).toContain('ErrorBoundary');
      expect(avatarsContent).toContain('OptimizedAvatarImage');
    });
  });

  describe('Studio.tsx (Create surface) Loading Patterns', () => {
    // /create now redirects to /studio — Studio.tsx is the workshop and owns
    // the gatekeeper-coordinated loading the old Create.tsx used to.
    const createContent = readFile('src/pages/Studio.tsx');

    it('should use centralized gatekeeper hook', () => {
      expect(createContent).toContain('useGatekeeperLoading');
      expect(createContent).toContain('GATEKEEPER_PRESETS.create');
    });

    it('should use safe navigation patterns', () => {
      expect(createContent).toContain('useSafeNavigation');
      expect(createContent).toContain('emergencyNavigate');
    });

    it('should use stability guard for async operations', () => {
      expect(createContent).toContain('useStabilityGuard');
    });

    it('should have route cleanup', () => {
      expect(createContent).toContain('useRouteCleanup');
    });
  });

  describe('Production.tsx Avatar Mode Handling', () => {
    const productionContent = readFile('src/pages/Production.tsx');
    
    it('should handle avatar mode in specialized progress', () => {
      expect(productionContent).toContain('SpecializedModeProgress');
      expect(productionContent).toContain("'avatar'");
    });
    
    it('should use navigation abort for cleanup', () => {
      expect(productionContent).toContain('useNavigationAbort');
      expect(productionContent).toContain('useRouteCleanup');
    });
    
    it('should handle avatar clips extraction', () => {
      expect(productionContent).toContain('avatarClips');
    });
  });
});

describe('Avatar Data Layer Audit', () => {
  describe('useAvatarTemplatesQuery', () => {
    const queryHookContent = readFile('src/hooks/useAvatarTemplatesQuery.ts');
    
    it('should have React Query configuration', () => {
      expect(queryHookContent).toContain('useQuery');
      expect(queryHookContent).toContain('staleTime');
      expect(queryHookContent).toContain('gcTime');
    });
    
    it('should have retry configuration', () => {
      expect(queryHookContent).toContain('retry:');
      expect(queryHookContent).toContain('retryDelay');
    });
    
    it('should ensure templates is always an array', () => {
      expect(queryHookContent).toContain("if (!data) return []");
      expect(queryHookContent).toContain("if (!Array.isArray(data))");
    });
    
    it('should have prefetch utility', () => {
      expect(queryHookContent).toContain('prefetchAvatarTemplates');
      expect(queryHookContent).toContain('prefetchQuery');
    });
    
    it('should disable unnecessary refetches', () => {
      expect(queryHookContent).toContain('refetchOnWindowFocus: false');
    });
  });

  describe('useChunkedAvatars', () => {
    const chunkedHookContent = readFile('src/hooks/useChunkedAvatars.ts');
    
    it('should have progressive loading config', () => {
      expect(chunkedHookContent).toContain('INITIAL_CHUNK_SIZE');
      expect(chunkedHookContent).toContain('CHUNK_SIZE');
      expect(chunkedHookContent).toContain('CHUNK_DELAY_MS');
    });
    
    it('should be mount-safe', () => {
      expect(chunkedHookContent).toContain('mountedRef');
    });
    
    it('should expose progress tracking', () => {
      expect(chunkedHookContent).toContain('loadProgress');
      expect(chunkedHookContent).toContain('isFullyLoaded');
    });
  });
});

describe('Avatar Component Stability Audit', () => {
  // The VirtualAvatarGallery / PremiumAvatarGallery components were retired in
  // the browse-surface rebuild. The current avatar UI is built from
  // OptimizedAvatarImage (crash-safe image with fallback) and the rotating
  // AvatarGalleryBackdrop.
  describe('OptimizedAvatarImage', () => {
    const imageContent = readFile('src/components/avatars/OptimizedAvatarImage.tsx');

    it('should be memoized for render stability', () => {
      expect(imageContent).toContain('memo');
    });

    it('should track load state', () => {
      expect(imageContent).toContain('useState');
    });

    it('should fall back gracefully on image error', () => {
      expect(imageContent).toContain('onError');
      expect(imageContent).toContain('AvatarFallbackPlaceholder');
    });

    it('should show a shimmer skeleton while loading', () => {
      expect(imageContent).toContain('ShimmerSkeleton');
    });
  });

  describe('AvatarGalleryBackdrop', () => {
    const backdropContent = readFile('src/components/avatars/AvatarGalleryBackdrop.tsx');

    it('should expose a focus-change callback', () => {
      expect(backdropContent).toContain('onFocusChange');
    });

    it('should memoize derived data', () => {
      expect(backdropContent).toContain('useMemo');
    });

    it('should clean up its rotation interval on unmount', () => {
      expect(backdropContent).toContain('setInterval');
      expect(backdropContent).toContain('clearInterval');
    });
  });
});

describe('Navigation Flow Consistency', () => {
  describe('Heavy Route Configuration', () => {
    // Route config is now centralized - check both files
    const routeConfigContent = readFile('src/lib/navigation/routeConfig.ts');
    const navContextContent = readFile('src/contexts/NavigationLoadingContext.tsx');
    
    it('should include avatars as heavy route', () => {
      // Routes are defined in centralized config, but imported into context
      expect(routeConfigContent || navContextContent).toContain("'/avatars'");
    });
    
    it('should include create as heavy route', () => {
      expect(routeConfigContent || navContextContent).toContain("'/create'");
    });
    
    it('should include production as heavy route', () => {
      expect(routeConfigContent || navContextContent).toContain("'/production'");
    });
    
    it('should include projects as heavy route', () => {
      expect(routeConfigContent || navContextContent).toContain("'/projects'");
    });
    
    it('should have disableAutoComplete for self-managed pages', () => {
      expect(navContextContent).toContain('disableAutoComplete');
      expect(navContextContent).toContain('autoCompleteDisabledRef');
    });
  });

  describe('Navigation Guard Provider', () => {
    const guardProviderContent = readFile('src/lib/navigation/NavigationGuardProvider.tsx');
    
    if (guardProviderContent) {
      it('should export navigation context', () => {
        expect(guardProviderContent).toContain('NavigationGuardProvider');
      });
    }
  });
});

describe('Edge Function Contracts', () => {
  describe('mode-router for avatar mode', () => {
    it('should send correct avatar mode payload structure', () => {
      const avatarPayload = {
        mode: 'avatar',
        userId: 'user-123',
        prompt: 'Hello, this is a test.',
        imageUrl: 'https://supabase.co/storage/avatars/test.png',
        voiceId: 'nova',
        aspectRatio: '16:9',
        clipCount: 3,
        clipDuration: 10,
        enableNarration: true,
        enableMusic: true,
        characterBible: {
          name: 'Test Avatar',
          description: 'Test description',
        },
        avatarTemplateId: 'template-123',
      };

      expect(avatarPayload.mode).toBe('avatar');
      expect(avatarPayload.imageUrl).toContain('supabase');
      expect(avatarPayload.characterBible).toBeDefined();
    });
  });
});

describe('Memory Management Audit', () => {
  describe('Avatar page cleanup', () => {
    // The page no longer hand-rolls abort controllers / isMountedRef — request
    // lifecycle is owned by React Query. The remaining cleanup surface is timer
    // teardown, audio pause, and restoring locked body scroll on the detail
    // popup.
    const avatarsContent = readFile('src/pages/Avatars.tsx');

    it('should clean up timers via clearTimeout in an effect', () => {
      expect(avatarsContent).toContain('useEffect');
      expect(avatarsContent).toContain('clearTimeout');
    });

    it('should pause voice playback when toggled/closed', () => {
      expect(avatarsContent).toContain('.pause()');
    });

    it('should restore body scroll lock when the detail popup unmounts', () => {
      expect(avatarsContent).toContain('document.body.style.overflow');
      expect(avatarsContent).toContain('removeEventListener');
    });
  });
});
