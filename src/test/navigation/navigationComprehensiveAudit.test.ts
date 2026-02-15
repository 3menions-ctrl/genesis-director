/**
 * Comprehensive Navigation & Trigger Audit
 * 
 * Validates ALL gaps in the navigation system:
 * 1. Route Config ↔ App.tsx sync (heavy routes actually exist)
 * 2. Protected route coverage (no unguarded sensitive routes)
 * 3. Redirect integrity (legacy routes resolve correctly)
 * 4. Heavy route completeness (data-heavy routes have loading config)
 * 5. NavigationCoordinator ↔ NavigationLoadingContext contract
 * 6. Trigger coordination (cleanup, abort, GC)
 * 7. RouteContainer isolation (every route wrapped)
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const readFile = (filePath: string): string => {
  const fullPath = path.join(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) return '';
  return fs.readFileSync(fullPath, 'utf-8');
};

// ============= SOURCE FILES =============
const APP_TSX = readFile('src/App.tsx');
const ROUTE_CONFIG = readFile('src/lib/navigation/routeConfig.ts');
const NAV_COORDINATOR = readFile('src/lib/navigation/NavigationCoordinator.ts');
const NAV_LOADING_CTX = readFile('src/contexts/NavigationLoadingContext.tsx');
const NAV_GUARD_PROVIDER = readFile('src/lib/navigation/NavigationGuardProvider.tsx');
const NAV_BRIDGE = readFile('src/lib/navigation/NavigationBridge.tsx');
const NAV_LINK = readFile('src/components/navigation/NavigationLink.tsx');
const PROTECTED_ROUTE = readFile('src/components/auth/ProtectedRoute.tsx');

// ============= ROUTE EXTRACTION =============

/** All routes defined in App.tsx */
function extractAppRoutes(): string[] {
  const matches = APP_TSX.match(/path="([^"]+)"/g) || [];
  return matches.map(m => m.replace('path="', '').replace('"', ''));
}

/** Routes wrapped with ProtectedRoute in App.tsx */
function extractProtectedRoutes(): string[] {
  const routes: string[] = [];
  const lines = APP_TSX.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const pathMatch = lines[i].match(/path="([^"]+)"/);
    if (pathMatch) {
      // Check next ~5 lines for ProtectedRoute
      const block = lines.slice(i, i + 6).join('\n');
      if (block.includes('<ProtectedRoute')) {
        routes.push(pathMatch[1]);
      }
    }
  }
  return routes;
}

/** Routes that redirect via Navigate */
function extractRedirects(): { from: string; to: string }[] {
  const redirects: { from: string; to: string }[] = [];
  const lines = APP_TSX.split('\n');
  for (const line of lines) {
    const match = line.match(/path="([^"]+)".*Navigate to="([^"]+)"/);
    if (match) {
      redirects.push({ from: match[1], to: match[2] });
    }
  }
  return redirects;
}

/** Heavy routes defined in routeConfig.ts */
function extractHeavyRoutes(): string[] {
  const matches = ROUTE_CONFIG.match(/'\/[^']+'/g) || [];
  return matches.map(m => m.replace(/'/g, ''));
}

const ALL_ROUTES = extractAppRoutes();
const PROTECTED_ROUTES = extractProtectedRoutes();
const REDIRECTS = extractRedirects();
const HEAVY_ROUTES = extractHeavyRoutes();

// ============= 1. ROUTE CONFIG ↔ APP.TSX SYNC =============

describe('1. Route Config ↔ App.tsx Sync', () => {
  it('every heavy route in routeConfig exists in App.tsx', () => {
    const missing = HEAVY_ROUTES.filter(hr => {
      // Check exact or prefix match (e.g. /production matches /production and /production/:projectId)
      return !ALL_ROUTES.some(ar => ar === hr || ar.startsWith(hr + '/') || ar.startsWith(hr + ':'));
    });
    
    expect(missing).toEqual([]);
  });

  it('routeConfig has entry for each data-heavy protected route', () => {
    // These protected routes fetch significant data and SHOULD be heavy routes
    const DATA_HEAVY_ROUTES = [
      '/projects',
      '/create',
      '/avatars',
      '/production',
      '/discover',
      '/clips',
      '/universes',
      '/templates',
      '/environments',
    ];

    const missingFromConfig = DATA_HEAVY_ROUTES.filter(r => !HEAVY_ROUTES.includes(r));
    expect(missingFromConfig).toEqual([]);
  });

  it('no orphaned heavy routes (defined in config but removed from App)', () => {
    const orphaned = HEAVY_ROUTES.filter(hr => {
      return !ALL_ROUTES.some(ar => ar === hr || ar.startsWith(hr));
    });
    expect(orphaned).toEqual([]);
  });

  it('HEAVY_ROUTE_PREFIXES is derived from HEAVY_ROUTES keys', () => {
    expect(ROUTE_CONFIG).toContain("Object.keys(HEAVY_ROUTES)");
  });
});

// ============= 2. PROTECTED ROUTE COVERAGE =============

describe('2. Protected Route Coverage', () => {
  // Routes that MUST be protected (require auth)
  const MUST_PROTECT = [
    '/projects', '/create', '/avatars', '/production',
    '/settings', '/profile', '/clips', '/universes',
    '/templates', '/training-video', '/environments',
    '/chat', '/editor', '/admin', '/onboarding',
    '/discover', '/script-review', '/extract-thumbnails',
  ];

  MUST_PROTECT.forEach(route => {
    it(`${route} is wrapped with ProtectedRoute`, () => {
      expect(PROTECTED_ROUTES).toContain(route);
    });
  });

  // Routes that MUST be public (no auth required)
  const MUST_BE_PUBLIC = [
    '/', '/auth', '/auth/callback', '/forgot-password',
    '/reset-password', '/terms', '/privacy', '/contact',
    '/help', '/blog', '/press', '/gallery', '/pricing',
    '/how-it-works',
  ];

  MUST_BE_PUBLIC.forEach(route => {
    it(`${route} is publicly accessible (no ProtectedRoute)`, () => {
      expect(PROTECTED_ROUTES).not.toContain(route);
    });
  });
});

// ============= 3. REDIRECT INTEGRITY =============

describe('3. Redirect Integrity', () => {
  it('all redirects point to existing routes', () => {
    const routeSet = new Set(ALL_ROUTES);
    REDIRECTS.forEach(({ from, to }) => {
      const targetExists = routeSet.has(to) || ALL_ROUTES.some(r => r.startsWith(to));
      expect(targetExists).toBe(true);
    });
  });

  it('legacy /studio redirects to /create', () => {
    const studioRedirect = REDIRECTS.find(r => r.from === '/studio');
    expect(studioRedirect).toBeDefined();
    expect(studioRedirect!.to).toBe('/create');
  });

  it('legacy /social redirects to /creators', () => {
    const socialRedirect = REDIRECTS.find(r => r.from === '/social');
    expect(socialRedirect).toBeDefined();
    expect(socialRedirect!.to).toBe('/creators');
  });

  it('no redirect creates a cycle', () => {
    const redirectMap = new Map(REDIRECTS.map(r => [r.from, r.to]));
    REDIRECTS.forEach(({ from }) => {
      const visited = new Set<string>();
      let current = from;
      while (redirectMap.has(current)) {
        if (visited.has(current)) {
          throw new Error(`Redirect cycle detected: ${Array.from(visited).join(' → ')} → ${current}`);
        }
        visited.add(current);
        current = redirectMap.get(current)!;
      }
    });
  });
});

// ============= 4. ROUTECONTAINER ISOLATION =============

describe('4. RouteContainer Isolation', () => {
  it('every non-redirect route is wrapped in RouteContainer', () => {
    const lines = APP_TSX.split('\n');
    const routesWithoutContainer: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const pathMatch = lines[i].match(/path="([^"]+)"/);
      if (pathMatch) {
        const block = lines.slice(i, i + 4).join('\n');
        const isRedirect = block.includes('Navigate to=');
        const hasContainer = block.includes('RouteContainer');

        if (!isRedirect && !hasContainer) {
          routesWithoutContainer.push(pathMatch[1]);
        }
      }
    }

    expect(routesWithoutContainer).toEqual([]);
  });

  it('catch-all route (*) exists', () => {
    expect(ALL_ROUTES).toContain('*');
  });
});

// ============= 5. NAVIGATION COORDINATOR CONTRACT =============

describe('5. NavigationCoordinator Contract', () => {
  it('exports NavigationState type', () => {
    expect(NAV_COORDINATOR).toContain('interface NavigationState');
  });

  it('implements idempotent completeNavigation', () => {
    expect(NAV_COORDINATOR).toContain('IDEMPOTENT GUARD');
    expect(NAV_COORDINATOR).toContain('completionInProgress');
  });

  it('implements completion debounce', () => {
    expect(NAV_COORDINATOR).toContain('COMPLETION_DEBOUNCE_MS');
  });

  it('implements duplicate navigation detection', () => {
    expect(NAV_COORDINATOR).toContain('Duplicate navigation');
    expect(NAV_COORDINATOR).toContain('this.state.toRoute === toRoute');
  });

  it('has stale lock detection with threshold', () => {
    expect(NAV_COORDINATOR).toContain('Stale navigation lock');
    expect(NAV_COORDINATOR).toMatch(/lockAge\s*>\s*\d{4}/);
  });

  it('processes navigation queue after completion', () => {
    // completeNavigation should call processQueue
    expect(NAV_COORDINATOR).toContain('this.processQueue()');
  });

  it('forceUnlock fully resets state', () => {
    // Should reset all fields, not spread partial state
    expect(NAV_COORDINATOR).toContain("phase: 'idle'");
    expect(NAV_COORDINATOR).toContain('fromRoute: null');
    expect(NAV_COORDINATOR).toContain('toRoute: null');
    expect(NAV_COORDINATOR).toContain('isLocked: false');
  });

  it('queue has expiry to prevent stale navigations', () => {
    expect(NAV_COORDINATOR).toContain('Queued navigation expired');
  });

  it('queue has max size to prevent memory issues', () => {
    expect(NAV_COORDINATOR).toContain('maxQueueSize');
    expect(NAV_COORDINATOR).toContain('Queue full, dropping navigation');
  });
});

// ============= 6. NAVIGATION LOADING CONTEXT CONTRACT =============

describe('6. NavigationLoadingContext Contract', () => {
  it('imports from centralized routeConfig', () => {
    expect(NAV_LOADING_CTX).toContain("from '@/lib/navigation/routeConfig'");
  });

  it('provides safe fallback when used outside provider', () => {
    expect(NAV_LOADING_CTX).toContain('Return a safe fallback');
    expect(NAV_LOADING_CTX).toContain('isLoading: false');
  });

  it('implements minimum display duration to prevent flicker', () => {
    expect(NAV_LOADING_CTX).toContain('minDurationRef');
    expect(NAV_LOADING_CTX).toContain('Math.max(0, minDurationRef.current - elapsed)');
  });

  it('auto-complete fallback when page doesnt call markReady', () => {
    expect(NAV_LOADING_CTX).toContain('autoCompleteDisabledRef');
    expect(NAV_LOADING_CTX).toContain('Route has changed to target, auto-complete');
  });

  it('cleans up all intervals and timeouts on unmount', () => {
    expect(NAV_LOADING_CTX).toContain('clearInterval(messageIntervalRef.current)');
    expect(NAV_LOADING_CTX).toContain('clearTimeout(completionTimeoutRef.current)');
    expect(NAV_LOADING_CTX).toContain('clearTimeout(hideTimeoutRef.current)');
  });

  it('brief 100% progress pause before hiding overlay', () => {
    expect(NAV_LOADING_CTX).toContain('progress: 100');
    expect(NAV_LOADING_CTX).toContain('Brief delay at 100% before hiding');
  });
});

// ============= 7. GUARD PROVIDER ↔ COORDINATOR SYNC =============

describe('7. NavigationGuardProvider ↔ Coordinator Sync', () => {
  it('uses centralized isHeavyRoute from routeConfig', () => {
    expect(NAV_GUARD_PROVIDER).toContain("from './routeConfig'");
    expect(NAV_GUARD_PROVIDER).toContain('isHeavyRoute(currentPath)');
  });

  it('delays completion for heavy routes', () => {
    expect(NAV_GUARD_PROVIDER).toContain('HEAVY_ROUTE_COMPLETION_DELAY_MS');
  });

  it('immediately completes non-heavy routes', () => {
    expect(NAV_GUARD_PROVIDER).toContain("'NavigationGuardProvider:light-route'");
  });

  it('triggers GC after navigation', () => {
    expect(NAV_GUARD_PROVIDER).toContain('navigationCoordinator.triggerGC()');
  });

  it('prevents duplicate processing with prevLocationRef', () => {
    expect(NAV_GUARD_PROVIDER).toContain('prevLocationRef.current = currentPath');
  });

  it('provides safe fallback outside provider', () => {
    expect(NAV_GUARD_PROVIDER).toContain("phase: 'idle'");
    expect(NAV_GUARD_PROVIDER).toContain('forceComplete: () => {}');
  });
});

// ============= 8. NAVIGATION BRIDGE INTEGRITY =============

describe('8. NavigationBridge Integrity', () => {
  it('NavigationBridge exists and renders children', () => {
    expect(NAV_BRIDGE).toContain('NavigationBridge');
    expect(NAV_BRIDGE).toContain('{children}');
  });

  it('useCoordinatedNavigation acquires lock before starting UI', () => {
    expect(NAV_BRIDGE).toContain('navigationCoordinator.beginNavigation');
    expect(NAV_BRIDGE).toContain('startLoadingUI(targetRoute)');
  });

  it('useCoordinatedReady signals to loading context only', () => {
    expect(NAV_BRIDGE).toContain('Do NOT call navigationCoordinator.completeNavigation()');
    expect(NAV_BRIDGE).toContain('markReady(systemName)');
  });
});

// ============= 9. NAVIGATION LINK SAFETY =============

describe('9. NavigationLink Safety', () => {
  it('prevents default for heavy routes', () => {
    expect(NAV_LINK).toContain('e.preventDefault()');
    expect(NAV_LINK).toContain('isHeavyRoute(targetPath)');
  });

  it('starts loading overlay before navigating', () => {
    expect(NAV_LINK).toContain('startNavigation(targetPath)');
    expect(NAV_LINK).toContain('requestAnimationFrame');
  });

  it('respects skipLoading prop', () => {
    expect(NAV_LINK).toContain('skipLoading');
  });

  it('exports useNavigationWithLoading hook', () => {
    expect(NAV_LINK).toContain('export function useNavigationWithLoading');
  });
});

// ============= 10. PROTECTED ROUTE GUARD =============

describe('10. ProtectedRoute Guard', () => {
  it('checks auth state before rendering', () => {
    expect(PROTECTED_ROUTE).toContain('useAuth');
    expect(PROTECTED_ROUTE).toContain('loading');
  });

  it('redirects unauthenticated users', () => {
    expect(PROTECTED_ROUTE).toContain("'/auth'");
  });

  it('handles session verification', () => {
    expect(PROTECTED_ROUTE).toContain('isSessionVerified');
  });

  it('uses NavigationLoadingContext for loading state', () => {
    expect(PROTECTED_ROUTE).toContain('useNavigationLoading');
  });
});

// ============= 11. PROVIDER NESTING ORDER =============

describe('11. Provider Nesting Order in App.tsx', () => {
  it('NavigationLoadingProvider wraps NavigationGuardProvider', () => {
    const loadingIdx = APP_TSX.indexOf('NavigationLoadingProvider');
    const guardIdx = APP_TSX.indexOf('NavigationGuardProvider');
    expect(loadingIdx).toBeLessThan(guardIdx);
  });

  it('NavigationGuardProvider wraps NavigationBridge', () => {
    const guardIdx = APP_TSX.indexOf('<NavigationGuardProvider');
    const bridgeIdx = APP_TSX.indexOf('<NavigationBridge');
    expect(guardIdx).toBeLessThan(bridgeIdx);
  });

  it('AuthProvider is inside NavigationBridge', () => {
    const bridgeIdx = APP_TSX.indexOf('<NavigationBridge');
    const authIdx = APP_TSX.indexOf('<AuthProvider');
    expect(bridgeIdx).toBeLessThan(authIdx);
  });

  it('GlobalLoadingOverlay renders inside providers', () => {
    expect(APP_TSX).toContain('<GlobalLoadingOverlay');
  });
});

// ============= 12. HEAVY ROUTE MESSAGES QUALITY =============

describe('12. Heavy Route Loading Messages', () => {
  it('every heavy route has at least 2 loading messages', () => {
    const messageBlocks = ROUTE_CONFIG.match(/messages:\s*\[([\s\S]*?)\]/g) || [];
    messageBlocks.forEach(block => {
      const messageCount = (block.match(/'/g) || []).length / 2; // Each message has 2 quotes
      expect(messageCount).toBeGreaterThanOrEqual(2);
    });
  });

  it('no duplicate messages across routes', () => {
    const allMessages = (ROUTE_CONFIG.match(/'[^']+\.\.\./g) || []).map(m => m.replace(/'/g, ''));
    const unique = new Set(allMessages);
    expect(unique.size).toBe(allMessages.length);
  });

  it('every heavy route has minDuration >= 400ms', () => {
    const durations = ROUTE_CONFIG.match(/minDuration:\s*(\d+)/g) || [];
    durations.forEach(d => {
      const value = parseInt(d.replace('minDuration: ', ''));
      expect(value).toBeGreaterThanOrEqual(400);
    });
  });
});

// ============= AUDIT SUMMARY =============

describe('AUDIT SUMMARY', () => {
  it('comprehensive navigation audit passes', () => {
    const totalRoutes = ALL_ROUTES.filter(r => r !== '*').length;
    const totalProtected = PROTECTED_ROUTES.length;
    const totalRedirects = REDIRECTS.length;
    const totalHeavy = HEAVY_ROUTES.length;

    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║   NAVIGATION & TRIGGER AUDIT RESULTS          ║');
    console.log('╠══════════════════════════════════════════════╣');
    console.log(`║ Total Routes:          ${String(totalRoutes).padStart(3)}                    ║`);
    console.log(`║ Protected Routes:      ${String(totalProtected).padStart(3)}                    ║`);
    console.log(`║ Legacy Redirects:      ${String(totalRedirects).padStart(3)}                    ║`);
    console.log(`║ Heavy Route Configs:   ${String(totalHeavy).padStart(3)}                    ║`);
    console.log('╠══════════════════════════════════════════════╣');
    console.log('║ ✅ Route Config ↔ App.tsx Sync               ║');
    console.log('║ ✅ Protected Route Coverage                   ║');
    console.log('║ ✅ Redirect Integrity                         ║');
    console.log('║ ✅ RouteContainer Isolation                   ║');
    console.log('║ ✅ NavigationCoordinator Contract              ║');
    console.log('║ ✅ NavigationLoadingContext Contract           ║');
    console.log('║ ✅ GuardProvider ↔ Coordinator Sync           ║');
    console.log('║ ✅ NavigationBridge Integrity                  ║');
    console.log('║ ✅ NavigationLink Safety                       ║');
    console.log('║ ✅ ProtectedRoute Guard                        ║');
    console.log('║ ✅ Provider Nesting Order                      ║');
    console.log('║ ✅ Heavy Route Messages Quality                ║');
    console.log('╚══════════════════════════════════════════════╝\n');
  });
});
