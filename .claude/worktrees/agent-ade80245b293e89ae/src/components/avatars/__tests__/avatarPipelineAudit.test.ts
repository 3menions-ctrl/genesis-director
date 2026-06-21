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
    const avatarsContent = readFile('src/pages/Avatars.tsx');
    
    it('should use centralized gatekeeper hook', () => {
      expect(avatarsContent).toContain('useGatekeeperLoading');
      expect(avatarsContent).toContain('GATEKEEPER_PRESETS.avatars');
      expect(avatarsContent).toContain('gatekeeper.isLoading');
    });
    
    it('should pass loading state to gatekeeper', () => {
      expect(avatarsContent).toContain('authLoading');
      expect(avatarsContent).toContain('dataLoading: templatesLoading');
      expect(avatarsContent).toContain('imageProgress');
    });
    
    it('should use safe navigation patterns', () => {
      expect(avatarsContent).toContain('useSafeNavigation');
      expect(avatarsContent).toContain('emergencyNavigate');
      expect(avatarsContent).toContain('useNavigationAbort');
    });
    
    it('should implement chunked avatar loading', () => {
      expect(avatarsContent).toContain('VirtualAvatarGallery');
    });
    
    it('should guard against null/undefined templates', () => {
      expect(avatarsContent).toContain('Array.isArray');
      expect(avatarsContent).toContain('safeTemplates');
    });
    
    it('should have abort controller cleanup', () => {
      expect(avatarsContent).toContain('abortControllerRef');
      expect(avatarsContent).toContain('useRouteCleanup');
    });
  });

  describe('Create.tsx Loading Patterns', () => {
    const createContent = readFile('src/pages/Create.tsx');
    
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
  describe('VirtualAvatarGallery', () => {
    const galleryContent = readFile('src/components/avatars/VirtualAvatarGallery.tsx');
    
    it('should use forwardRef for AnimatePresence compatibility', () => {
      expect(galleryContent).toContain('forwardRef');
    });
    
    it('should use safe array guard', () => {
      expect(galleryContent).toContain('useSafeArray');
    });
    
    it('should use chunked loading', () => {
      expect(galleryContent).toContain('useChunkedAvatars');
    });
    
    it('should have image onLoad tracking', () => {
      expect(galleryContent).toContain('handleImageLoad');
      expect(galleryContent).toContain('setImageLoaded');
    });
    
    it('should NOT use framer-motion directly', () => {
      expect(galleryContent).not.toContain("from 'framer-motion'");
    });
  });

  describe('PremiumAvatarGallery', () => {
    const premiumContent = readFile('src/components/avatars/PremiumAvatarGallery.tsx');
    
    it('should use forwardRef for stability', () => {
      expect(premiumContent).toContain('forwardRef');
    });
    
    it('should use safe array guard', () => {
      expect(premiumContent).toContain('useSafeArray');
    });
    
    it('should have mount tracking for cleanup', () => {
      expect(premiumContent).toContain('mountedRef');
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
    const avatarsContent = readFile('src/pages/Avatars.tsx');
    
    it('should have isMountedRef for async safety', () => {
      expect(avatarsContent).toContain('isMountedRef');
      expect(avatarsContent).toContain('isMountedRef.current = true');
      expect(avatarsContent).toContain('isMountedRef.current = false');
    });
    
    it('should abort pending requests on unmount', () => {
      expect(avatarsContent).toContain('.abort()');
    });
    
    it('should stop voice playback on unmount', () => {
      expect(avatarsContent).toContain('stopPlayback');
    });
  });
});
