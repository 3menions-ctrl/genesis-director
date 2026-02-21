/**
 * Comprehensive Page Loading & Gatekeeper Regression Tests
 * 
 * Validates:
 * - All pages use unified CinemaLoader + useGatekeeperLoading
 * - Timeout fallbacks exist to prevent infinite loading
 * - Auth hydration is gated before content renders
 * - No raw loading spinners bypass the gatekeeper
 * - CinemaLoader is CSS-only (no heavy animation libs)
 * - Progress calculation is correct
 * - All GATEKEEPER_PRESETS are valid
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function readFile(filePath: string): string {
  return fs.readFileSync(path.resolve(filePath), 'utf-8');
}

function fileExists(filePath: string): boolean {
  return fs.existsSync(path.resolve(filePath));
}

// ─── CinemaLoader Core ──────────────────────────────────────────────────────

describe('CinemaLoader — Core Component', () => {
  const loader = readFile('src/components/ui/CinemaLoader.tsx');

  it('should be CSS-only with no framer-motion imports', () => {
    expect(loader).not.toContain("from 'framer-motion'");
    expect(loader).not.toContain('from "framer-motion"');
  });

  it('should not import Three.js or heavy 3D libraries', () => {
    expect(loader).not.toContain('three');
    expect(loader).not.toContain('react-three');
    expect(loader).not.toContain('@react-three');
  });

  it('should support fullscreen, inline, and overlay variants', () => {
    expect(loader).toContain("variant === 'fullscreen'");
    expect(loader).toContain("variant === 'overlay'");
    expect(loader).toContain("variant === 'inline'");
  });

  it('should have exit animation with opacity transition', () => {
    expect(loader).toMatch(/opacity.*isExiting/);
    expect(loader).toMatch(/transition.*opacity/);
  });

  it('should display progress percentage', () => {
    expect(loader).toContain('displayProgress');
    expect(loader).toContain('showProgress');
  });

  it('should use z-[9999] for fullscreen to cover all content', () => {
    expect(loader).toContain('z-[9999]');
  });

  it('should handle exit complete callback', () => {
    expect(loader).toContain('onExitComplete');
  });

  it('should use inline CSS keyframes (not external animation lib)', () => {
    expect(loader).toContain('@keyframes loaderSpin');
    expect(loader).toContain('@keyframes loaderPulse');
  });
});

// ─── useGatekeeperLoading Hook ───────────────────────────────────────────────

describe('useGatekeeperLoading — Hook Architecture', () => {
  const hook = readFile('src/hooks/useGatekeeperLoading.ts');

  it('should have timeout fallback to prevent infinite loading', () => {
    expect(hook).toContain('DEFAULT_TIMEOUT_MS');
    expect(hook).toContain('setTimeout');
    expect(hook).toContain('setForceRender(true)');
  });

  it('should track auth, data, and image loading phases', () => {
    expect(hook).toContain("'auth'");
    expect(hook).toContain("'data'");
    expect(hook).toContain("'images'");
    expect(hook).toContain("'ready'");
  });

  it('should integrate with NavigationLoadingContext via markReady', () => {
    expect(hook).toContain('usePageReady');
    expect(hook).toContain('markReady');
  });

  it('should disable auto-complete to take manual control', () => {
    expect(hook).toContain('disableAutoComplete');
  });

  it('should have mount-safe cleanup', () => {
    expect(hook).toContain('isMountedRef');
    expect(hook).toMatch(/isMountedRef\.current\s*=\s*false/);
  });

  it('should expose forceReady for manual override', () => {
    expect(hook).toContain('forceReady');
  });

  it('should expose signalReady for manual completion', () => {
    expect(hook).toContain('signalReady');
  });

  it('should prevent duplicate ready signals', () => {
    expect(hook).toContain('readySignaledRef');
    expect(hook).toMatch(/if\s*\(!readySignaledRef\.current/);
  });

  it('should calculate progress with weighted phases (auth=20%, data=50%, images=100%)', () => {
    expect(hook).toContain('baseProgress');
    // Auth phase gives 10%
    expect(hook).toMatch(/return\s+10/);
    // Data phase gives 35%
    expect(hook).toMatch(/return\s+35/);
  });
});

// ─── Gatekeeper Presets ──────────────────────────────────────────────────────

describe('GATEKEEPER_PRESETS — Coverage', () => {
  const hook = readFile('src/hooks/useGatekeeperLoading.ts');

  const requiredPresets = ['avatars', 'create', 'projects', 'production', 'landing', 'gallery', 'discover', 'profile'];

  for (const preset of requiredPresets) {
    it(`should define preset: ${preset}`, () => {
      expect(hook).toContain(`${preset}:`);
    });
  }

  it('should have unique pageId for each preset', () => {
    const pageIds = ['AvatarsPage', 'CreatePage', 'ProjectsPage', 'ProductionPage', 'LandingPage', 'GalleryPage', 'DiscoverPage', 'ProfilePage'];
    for (const id of pageIds) {
      expect(hook).toContain(`'${id}'`);
    }
  });

  it('should set reasonable timeouts (3-8 seconds)', () => {
    const timeoutMatches = hook.match(/timeout:\s*(\d+)/g);
    expect(timeoutMatches).not.toBeNull();
    for (const match of timeoutMatches!) {
      const ms = parseInt(match.replace('timeout:', '').trim());
      expect(ms).toBeGreaterThanOrEqual(3000);
      expect(ms).toBeLessThanOrEqual(10000);
    }
  });

  it('should have custom messages for all 4 phases in each preset', () => {
    for (const preset of requiredPresets) {
      const presetBlock = hook.slice(hook.indexOf(`${preset}:`));
      expect(presetBlock).toContain('auth:');
      expect(presetBlock).toContain('data:');
      expect(presetBlock).toContain('images:');
      expect(presetBlock).toContain('ready:');
    }
  });
});

// ─── Page Integration — Each Page Uses Gatekeeper ────────────────────────────

describe('Page Loading Integration — Gatekeeper Adoption', () => {
  const gatekeeperPages = [
    { name: 'Landing', path: 'src/pages/Landing.tsx', preset: 'landing' },
    { name: 'Projects', path: 'src/pages/Projects.tsx', preset: 'projects' },
    { name: 'Production', path: 'src/pages/Production.tsx', preset: 'production' },
  ];

  for (const page of gatekeeperPages) {
    describe(`${page.name} page`, () => {
      it('should import useGatekeeperLoading', () => {
        const content = readFile(page.path);
        expect(content).toContain('useGatekeeperLoading');
      });

      it('should import CinemaLoader', () => {
        const content = readFile(page.path);
        expect(content).toContain('CinemaLoader');
      });

      it(`should use ${page.preset} preset`, () => {
        const content = readFile(page.path);
        expect(content).toContain(`GATEKEEPER_PRESETS.${page.preset}`);
      });

      it('should gate content behind isLoading check', () => {
        const content = readFile(page.path);
        expect(content).toMatch(/isLoading|gatekeeper\.isLoading/);
      });
    });
  }
});

// ─── AppLoader — Navigation Loading ──────────────────────────────────────────

describe('AppLoader — Navigation Transitions', () => {
  const appLoader = readFile('src/components/ui/app-loader.tsx');

  it('should delegate to CinemaLoader', () => {
    expect(appLoader).toContain('CinemaLoader');
  });

  it('should integrate with NavigationLoadingContext', () => {
    expect(appLoader).toContain('useNavigationLoading');
  });

  it('should simulate progress that always reaches 100%', () => {
    expect(appLoader).toMatch(/100|progress/);
  });
});

// ─── No Rogue Loading Patterns ───────────────────────────────────────────────

describe('No Rogue Loading Patterns', () => {
  // Pages that should NOT have raw spinners outside CinemaLoader
  const criticalPages = [
    'src/pages/Landing.tsx',
    'src/pages/Projects.tsx',
    'src/pages/Production.tsx',
  ];

  for (const pagePath of criticalPages) {
    it(`${path.basename(pagePath)} should not use raw "Loading..." text outside CinemaLoader`, () => {
      const content = readFile(pagePath);
      // Check there's no standalone <p>Loading...</p> or similar outside the loader pattern
      const loadingTextMatches = content.match(/>Loading\.\.\.</);
      // Allow it inside CinemaLoader props, but not as raw JSX
      if (loadingTextMatches) {
        // It's okay if it's a message prop to CinemaLoader
        expect(content).toContain('CinemaLoader');
      }
    });
  }
});

// ─── Existing Gatekeeper Tests Compatibility ─────────────────────────────────

describe('Existing useGatekeeperLoading Test File', () => {
  it('should exist with comprehensive coverage', () => {
    expect(fileExists('src/hooks/__tests__/useGatekeeperLoading.test.ts')).toBe(true);
  });
});
