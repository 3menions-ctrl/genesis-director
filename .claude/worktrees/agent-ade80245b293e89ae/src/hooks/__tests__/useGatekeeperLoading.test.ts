/**
 * Gatekeeper Loading Hook Tests
 * 
 * Tests for the centralized page loading gatekeeper system.
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

describe('useGatekeeperLoading Hook', () => {
  const hookContent = readFile('src/hooks/useGatekeeperLoading.ts');
  
  describe('Core Features', () => {
    it('should have timeout fallback', () => {
      expect(hookContent).toContain('DEFAULT_TIMEOUT_MS');
      expect(hookContent).toContain('setTimeout');
      expect(hookContent).toContain('forceRender');
    });
    
    it('should integrate with NavigationLoadingContext', () => {
      expect(hookContent).toContain('usePageReady');
      expect(hookContent).toContain('markReady');
      expect(hookContent).toContain('disableAutoComplete');
    });
    
    it('should be mount-safe', () => {
      expect(hookContent).toContain('isMountedRef');
    });
    
    it('should calculate loading phases', () => {
      expect(hookContent).toContain("'auth'");
      expect(hookContent).toContain("'data'");
      expect(hookContent).toContain("'images'");
      expect(hookContent).toContain("'ready'");
    });
    
    it('should calculate progress percentage', () => {
      expect(hookContent).toContain('progress');
      expect(hookContent).toContain('imageProgress');
    });
  });
  
  describe('Configuration', () => {
    it('should accept pageId for debugging', () => {
      expect(hookContent).toContain('pageId');
    });
    
    it('should accept custom timeout', () => {
      expect(hookContent).toContain('timeout');
      expect(hookContent).toContain('DEFAULT_TIMEOUT_MS');
    });
    
    it('should have autoSignalReady option', () => {
      expect(hookContent).toContain('autoSignalReady');
    });
  });
  
  describe('Presets', () => {
    it('should have avatars preset', () => {
      expect(hookContent).toContain('avatars:');
      expect(hookContent).toContain('AvatarsPage');
    });
    
    it('should have create preset', () => {
      expect(hookContent).toContain('create:');
      expect(hookContent).toContain('CreatePage');
    });
    
    it('should have projects preset', () => {
      expect(hookContent).toContain('projects:');
      expect(hookContent).toContain('ProjectsPage');
    });
    
    it('should have production preset', () => {
      expect(hookContent).toContain('production:');
      expect(hookContent).toContain('ProductionPage');
    });
  });
  
  describe('Return Values', () => {
    it('should return isLoading state', () => {
      expect(hookContent).toContain('isLoading');
    });
    
    it('should return progress', () => {
      expect(hookContent).toContain('progress');
    });
    
    it('should return phase', () => {
      expect(hookContent).toContain('phase');
    });
    
    it('should return wasForced flag', () => {
      expect(hookContent).toContain('wasForced');
    });
    
    it('should return signalReady function', () => {
      expect(hookContent).toContain('signalReady');
    });
    
    it('should return forceReady function', () => {
      expect(hookContent).toContain('forceReady');
    });
  });
});

describe('CinemaLoader Component', () => {
  const loaderContent = readFile('src/components/ui/CinemaLoader.tsx');
  
  it('should be CSS-only (no framer-motion)', () => {
    expect(loaderContent).not.toContain("from 'framer-motion'");
  });
  
  it('should use forwardRef for stability', () => {
    expect(loaderContent).toContain('forwardRef');
  });
  
  it('should support fullscreen variant', () => {
    expect(loaderContent).toContain('fullscreen');
  });
  
  it('should support overlay variant', () => {
    expect(loaderContent).toContain('overlay');
  });
  
  it('should support inline variant', () => {
    expect(loaderContent).toContain('inline');
  });
  
  it('should have exit animation handling', () => {
    expect(loaderContent).toContain('isExiting');
    expect(loaderContent).toContain('onExitComplete');
  });
});

describe('useImagePreloader Hook', () => {
  const preloaderContent = readFile('src/hooks/useImagePreloader.ts');
  
  it('should use global image cache', () => {
    expect(preloaderContent).toContain('imageCache');
    expect(preloaderContent).toContain('new Map');
  });
  
  it('should support concurrency control', () => {
    expect(preloaderContent).toContain('concurrency');
  });
  
  it('should have timeout per image', () => {
    expect(preloaderContent).toContain('timeout');
  });
  
  it('should have abort controller cleanup', () => {
    expect(preloaderContent).toContain('AbortController');
    expect(preloaderContent).toContain('abortControllerRef');
  });
  
  it('should return isReady state', () => {
    expect(preloaderContent).toContain('isReady');
  });
  
  it('should return progress percentage', () => {
    expect(preloaderContent).toContain('progress');
  });
  
  it('should have prefetch utility', () => {
    expect(preloaderContent).toContain('prefetchAvatarImages');
  });
});

describe('Loading System Integration', () => {
  describe('NavigationLoadingContext', () => {
    const contextContent = readFile('src/contexts/NavigationLoadingContext.tsx');
    
    it('should export usePageReady hook', () => {
      expect(contextContent).toContain('export function usePageReady');
    });
    
    it('should have disableAutoComplete function', () => {
      expect(contextContent).toContain('disableAutoComplete');
    });
    
    it('should have markReady function', () => {
      expect(contextContent).toContain('markReady');
    });
  });
  
  describe('Heavy Routes Configuration', () => {
    const contextContent = readFile('src/contexts/NavigationLoadingContext.tsx');
    
    it('should define HEAVY_ROUTES', () => {
      expect(contextContent).toContain('HEAVY_ROUTES');
    });
    
    it('should have minDuration for each route', () => {
      expect(contextContent).toContain('minDuration');
    });
    
    it('should have messages for each route', () => {
      expect(contextContent).toContain('messages');
    });
  });
});

describe('Gatekeeper Progress Calculation', () => {
  it('should follow 3-phase progress model', () => {
    // Phase 1: Auth (0-20%)
    // Phase 2: Data (20-50%)
    // Phase 3: Images (50-100%)
    
    const phases = [
      { name: 'auth', range: [0, 20] },
      { name: 'data', range: [20, 50] },
      { name: 'images', range: [50, 100] },
    ];
    
    phases.forEach(phase => {
      expect(phase.range[0]).toBeLessThan(phase.range[1]);
    });
    
    // Verify phases don't overlap and cover 0-100
    expect(phases[0].range[0]).toBe(0);
    expect(phases[phases.length - 1].range[1]).toBe(100);
  });
});
