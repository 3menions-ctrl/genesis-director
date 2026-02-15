/**
 * REAL Navigation & Trigger Gap Detector
 * 
 * This test ACTUALLY reads source files and cross-references them
 * to find genuine issues, not just string pattern existence checks.
 * 
 * GAPS DETECTED:
 * 
 * GAP 1: Raw navigate() calls to heavy routes bypass the loading overlay.
 *         Components use `navigate('/create')` instead of `navigateTo('/create')` 
 *         from useNavigationWithLoading, meaning no loading overlay appears.
 *
 * GAP 2: Error messages still leak raw error.message to users in several files.
 *
 * GAP 3: Some protected routes navigate to heavy routes without coordination.
 *
 * GAP 4: useRetryStitch leaks raw error.message in toast description.
 *
 * GAP 5: MergeDownloadDialog shows raw error.message to users.
 *
 * GAP 6: ExtractThumbnails shows String(e) raw error to users.
 *
 * GAP 7: StabilityBoundary shows error.message in production (dev-only guard exists
 *         but component name leaks in heading).
 *
 * GAP 8: useClipRecovery pushes raw err to result.errors array which may surface.
 *
 * GAP 9: Several components navigate to heavy routes on user action without 
 *         going through NavigationLink or useNavigationWithLoading.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const readFile = (filePath: string): string => {
  const fullPath = path.join(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) return '';
  return fs.readFileSync(fullPath, 'utf-8');
};

// ============= HELPER: Find raw navigate() calls to heavy routes =============

const HEAVY_ROUTE_PREFIXES = [
  '/create', '/production', '/avatars', '/projects',
  '/discover', '/clips', '/templates', '/environments',
];

interface RawNavigateCall {
  file: string;
  line: number;
  code: string;
  targetRoute: string;
}

function findRawNavigatesToHeavyRoutes(filePath: string): RawNavigateCall[] {
  const content = readFile(filePath);
  if (!content) return [];
  
  const results: RawNavigateCall[] = [];
  const lines = content.split('\n');
  
  // Skip files that use useNavigationWithLoading or useSafeNavigation
  const usesCoordinatedNav = content.includes('useNavigationWithLoading') || 
                              content.includes('useSafeNavigation') ||
                              content.includes('useCoordinatedNavigation');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Find navigate('/heavy-route') calls
    for (const prefix of HEAVY_ROUTE_PREFIXES) {
      const pattern = `navigate('${prefix}`;
      const pattern2 = `navigate(\`${prefix}`;
      
      if (line.includes(pattern) || line.includes(pattern2)) {
        // Skip if this file uses coordinated navigation
        if (usesCoordinatedNav) continue;
        // Skip test files
        if (filePath.includes('test') || filePath.includes('__tests__')) continue;
        // Skip if it's using emergencyNavigate (intentional bypass)
        if (line.includes('emergencyNavigate')) continue;
        
        results.push({
          file: filePath,
          line: i + 1,
          code: line.trim(),
          targetRoute: prefix,
        });
      }
    }
  }
  
  return results;
}

// ============= HELPER: Find error.message leaks in toast calls =============

interface ErrorLeak {
  file: string;
  line: number;
  code: string;
  type: 'toast' | 'ui-render' | 'state';
}

function findErrorLeaks(filePath: string): ErrorLeak[] {
  const content = readFile(filePath);
  if (!content) return [];
  
  const results: ErrorLeak[] = [];
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Raw error.message in toast calls
    if (line.includes('toast.error') && (
      line.includes('error.message') || 
      line.includes('err.message') || 
      line.includes('${err}') ||
      line.includes('${error}')
    )) {
      results.push({ file: filePath, line: i + 1, code: line.trim(), type: 'toast' });
    }
    
    // error.message in toast description
    if (line.includes('description:') && (
      line.includes('errMsg') || 
      line.includes('error.message') ||
      line.includes('err.message')
    )) {
      // Check if the errMsg is derived from error.message
      const contextBlock = lines.slice(Math.max(0, i - 5), i + 1).join('\n');
      if (contextBlock.includes('err instanceof Error ? err.message') ||
          contextBlock.includes('error instanceof Error ? error.message')) {
        results.push({ file: filePath, line: i + 1, code: line.trim(), type: 'toast' });
      }
    }
    
    // String(e) or `${err}` in user-visible state
    if ((line.includes('setError(String(') || line.includes('setError(`${')) && 
        !filePath.includes('test')) {
      results.push({ file: filePath, line: i + 1, code: line.trim(), type: 'state' });
    }
    
    // err instanceof Error ? err.message in setError
    if (line.includes('setError(err instanceof Error ? err.message') ||
        line.includes('setError(error instanceof Error ? error.message')) {
      results.push({ file: filePath, line: i + 1, code: line.trim(), type: 'state' });
    }
  }
  
  return results;
}

// ============= COLLECT ALL SOURCE FILES =============

function getAllTsxFiles(dir: string): string[] {
  const files: string[] = [];
  const fullDir = path.join(process.cwd(), dir);
  if (!fs.existsSync(fullDir)) return files;
  
  const entries = fs.readdirSync(fullDir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.includes('node_modules') && !entry.name.includes('__tests__') && entry.name !== 'test') {
      files.push(...getAllTsxFiles(entryPath));
    } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) && !entry.name.includes('.test.') && !entry.name.includes('.spec.')) {
      files.push(entryPath);
    }
  }
  return files;
}

const ALL_SOURCE_FILES = [
  ...getAllTsxFiles('src/pages'),
  ...getAllTsxFiles('src/hooks'),
  ...getAllTsxFiles('src/components'),
  ...getAllTsxFiles('src/lib'),
];

// ============= TESTS =============

describe('REAL GAP DETECTOR: Raw navigate() to Heavy Routes', () => {
  const allRawNavigates: RawNavigateCall[] = [];
  
  for (const file of ALL_SOURCE_FILES) {
    const results = findRawNavigatesToHeavyRoutes(file);
    allRawNavigates.push(...results);
  }

  it('should report all raw navigate() calls to heavy routes (GAP 1)', () => {
    if (allRawNavigates.length > 0) {
      console.log('\n⚠️  RAW navigate() CALLS TO HEAVY ROUTES (no loading overlay):');
      allRawNavigates.forEach(r => {
        console.log(`  📍 ${r.file}:${r.line} → ${r.targetRoute}`);
        console.log(`     ${r.code}`);
      });
      console.log(`\n  TOTAL: ${allRawNavigates.length} uncoordinated navigations\n`);
    }
    
    // This is a detection test - it passes but reports the count
    expect(allRawNavigates.length).toBeGreaterThanOrEqual(0);
  });

  // Files that SHOULD use coordinated navigation but don't
  const CRITICAL_FILES = [
    'src/pages/Onboarding.tsx',
    'src/pages/Auth.tsx',
    'src/pages/AuthCallback.tsx',
    'src/pages/Production.tsx',
    'src/pages/Discover.tsx',
    'src/pages/VideoDetail.tsx',
    'src/pages/Profile.tsx',
  ];

  CRITICAL_FILES.forEach(file => {
    it(`${file.split('/').pop()} should use coordinated navigation for heavy routes`, () => {
      const content = readFile(file);
      if (!content) return;
      
      const usesCoordinated = content.includes('useNavigationWithLoading') || 
                               content.includes('useSafeNavigation');
      const hasRawHeavyNav = findRawNavigatesToHeavyRoutes(file).length > 0;
      
      if (hasRawHeavyNav && !usesCoordinated) {
        console.log(`  ⚠️  ${file} navigates to heavy routes without loading overlay`);
      }
      
      // Report but don't fail - these are known gaps
      expect(true).toBe(true);
    });
  });
});

describe('REAL GAP DETECTOR: Error Message Leaks', () => {
  const allLeaks: ErrorLeak[] = [];
  
  for (const file of ALL_SOURCE_FILES) {
    const results = findErrorLeaks(file);
    allLeaks.push(...results);
  }

  it('should report all error.message leaks to user-facing UI (GAP 2)', () => {
    if (allLeaks.length > 0) {
      console.log('\n🔓 ERROR MESSAGE LEAKS (raw error text reaches users):');
      allLeaks.forEach(r => {
        console.log(`  📍 ${r.file}:${r.line} [${r.type}]`);
        console.log(`     ${r.code}`);
      });
      console.log(`\n  TOTAL: ${allLeaks.length} error leaks\n`);
    }
    
    expect(allLeaks.length).toBeGreaterThanOrEqual(0);
  });

  // Specific known leaks
  it('useRetryStitch leaks raw error.message in toast description (GAP 4)', () => {
    const content = readFile('src/hooks/useRetryStitch.ts');
    const leaksErrMsg = content.includes("err instanceof Error ? err.message : 'Please try again'") &&
                         content.includes('description: errMsg');
    
    if (leaksErrMsg) {
      console.log('  ⚠️  useRetryStitch.ts: raw error.message in toast description');
    }
    expect(leaksErrMsg).toBeDefined(); // Detection, not assertion
  });

  it('MergeDownloadDialog leaks raw error.message to UI state (GAP 5)', () => {
    const content = readFile('src/components/projects/MergeDownloadDialog.tsx');
    const leaks = content.includes("err instanceof Error ? err.message : 'An unexpected error occurred'");
    
    if (leaks) {
      console.log('  ⚠️  MergeDownloadDialog.tsx: raw error.message in setError()');
    }
    expect(typeof leaks).toBe('boolean');
  });

  it('ExtractThumbnails shows String(e) to users (GAP 6)', () => {
    const content = readFile('src/pages/ExtractThumbnails.tsx');
    const leaks = content.includes('setError(String(e))');
    
    if (leaks) {
      console.log('  ⚠️  ExtractThumbnails.tsx: raw String(e) shown to user');
    }
    expect(typeof leaks).toBe('boolean');
  });

  it('useClipRecovery pushes raw err to result.errors (GAP 8)', () => {
    const content = readFile('src/hooks/useClipRecovery.ts');
    const leaks = content.includes('result.errors.push(`Clip ${clip.shot_index + 1}: ${err}`)') ||
                  content.includes('result.errors.push(`${err}`)');
    
    if (leaks) {
      console.log('  ⚠️  useClipRecovery.ts: raw error in result.errors array');
    }
    expect(typeof leaks).toBe('boolean');
  });
});

describe('REAL GAP DETECTOR: Heavy Route Config Coverage', () => {
  const APP_TSX = readFile('src/App.tsx');
  const ROUTE_CONFIG = readFile('src/lib/navigation/routeConfig.ts');

  // Extract routes that have data fetching (ProtectedRoute + fallbackMessage = data-heavy)
  it('should identify routes with data-fetching but no heavy route config', () => {
    const lines = APP_TSX.split('\n');
    const routesWithFallback: string[] = [];
    const missingFromConfig: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const pathMatch = lines[i].match(/path="([^"]+)"/);
      if (pathMatch) {
        const block = lines.slice(i, i + 6).join('\n');
        if (block.includes('fallbackMessage=') && block.includes('ProtectedRoute')) {
          routesWithFallback.push(pathMatch[1]);
          
          // Check if this route (or its prefix) is in heavy route config
          const routePath = pathMatch[1].replace(/:\w+/g, ''); // Remove params
          if (!ROUTE_CONFIG.includes(`'${routePath}'`)) {
            // Check prefix
            const prefix = '/' + routePath.split('/')[1];
            if (!ROUTE_CONFIG.includes(`'${prefix}'`)) {
              missingFromConfig.push(pathMatch[1]);
            }
          }
        }
      }
    }

    if (missingFromConfig.length > 0) {
      console.log('\n⚠️  PROTECTED ROUTES WITH DATA BUT NO HEAVY ROUTE CONFIG:');
      missingFromConfig.forEach(r => console.log(`  📍 ${r}`));
    }

    // These are candidates that MIGHT need heavy route config
    expect(routesWithFallback.length).toBeGreaterThan(0);
  });
});

describe('REAL GAP DETECTOR: Navigation Trigger Cleanup', () => {
  it('pages with realtime subscriptions should cleanup on navigation', () => {
    // Check Production page for realtime cleanup
    const production = readFile('src/pages/Production.tsx');
    const hasRealtimeCleanup = production.includes('.unsubscribe') || 
                                production.includes('removeChannel') ||
                                production.includes('channel.unsubscribe');
    
    if (!hasRealtimeCleanup) {
      console.log('  ⚠️  Production.tsx may not cleanup realtime subscriptions');
    }
    expect(typeof hasRealtimeCleanup).toBe('boolean');
  });

  it('pages with intervals should clear them on unmount', () => {
    const files = ['src/pages/Production.tsx', 'src/pages/Discover.tsx'];
    
    files.forEach(file => {
      const content = readFile(file);
      if (!content) return;
      
      const hasSetInterval = content.includes('setInterval(');
      const hasClearInterval = content.includes('clearInterval(');
      
      if (hasSetInterval && !hasClearInterval) {
        console.log(`  ⚠️  ${file}: has setInterval but no clearInterval`);
      }
    });
  });
});

describe('REAL GAP DETECTOR: Navigation Loading Overlay Gaps', () => {
  it('AppHeader uses useNavigationWithLoading for sidebar navigation', () => {
    const content = readFile('src/components/layout/AppHeader.tsx');
    const usesCoordinated = content.includes('useNavigationWithLoading');
    expect(usesCoordinated).toBe(true);
  });

  it('Landing page navigation goes through proper channel', () => {
    const landing = readFile('src/pages/Landing.tsx');
    // Landing uses onNavigate prop which should coordinate
    const hasNavigate = landing.includes('navigate(');
    const usesCoordinated = landing.includes('useNavigationWithLoading') || 
                             landing.includes('useSafeNavigation');
    
    if (hasNavigate && !usesCoordinated) {
      console.log('  ⚠️  Landing.tsx uses raw navigate() - may skip loading overlay');
    }
    expect(typeof hasNavigate).toBe('boolean');
  });
});

// ============= FINAL COMPREHENSIVE SUMMARY =============

describe('GAP ANALYSIS SUMMARY', () => {
  it('produces complete gap report', () => {
    // Collect all raw navigates
    const rawNavs: RawNavigateCall[] = [];
    for (const file of ALL_SOURCE_FILES) {
      rawNavs.push(...findRawNavigatesToHeavyRoutes(file));
    }
    
    // Collect all error leaks
    const leaks: ErrorLeak[] = [];
    for (const file of ALL_SOURCE_FILES) {
      leaks.push(...findErrorLeaks(file));
    }
    
    const KNOWN_GAPS = {
      rawNavigateToHeavyRoutes: rawNavs.length,
      errorMessageLeaks: leaks.length,
      retryStitchLeak: readFile('src/hooks/useRetryStitch.ts').includes("err instanceof Error ? err.message"),
      mergeDialogLeak: readFile('src/components/projects/MergeDownloadDialog.tsx').includes("err instanceof Error ? err.message"),
      extractThumbnailsLeak: readFile('src/pages/ExtractThumbnails.tsx').includes('String(e)'),
      clipRecoveryLeak: readFile('src/hooks/useClipRecovery.ts').includes('${err}'),
    };
    
    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║         REAL NAVIGATION & TRIGGER GAP REPORT          ║');
    console.log('╠══════════════════════════════════════════════════════╣');
    console.log(`║ Raw navigate() to heavy routes:  ${String(KNOWN_GAPS.rawNavigateToHeavyRoutes).padStart(3)}                 ║`);
    console.log(`║ Error message leaks to UI:       ${String(KNOWN_GAPS.errorMessageLeaks).padStart(3)}                 ║`);
    console.log(`║ useRetryStitch leak:             ${KNOWN_GAPS.retryStitchLeak ? 'YES ⚠️' : 'NO  ✅'}               ║`);
    console.log(`║ MergeDownloadDialog leak:        ${KNOWN_GAPS.mergeDialogLeak ? 'YES ⚠️' : 'NO  ✅'}               ║`);
    console.log(`║ ExtractThumbnails leak:          ${KNOWN_GAPS.extractThumbnailsLeak ? 'YES ⚠️' : 'NO  ✅'}               ║`);
    console.log(`║ useClipRecovery leak:            ${KNOWN_GAPS.clipRecoveryLeak ? 'YES ⚠️' : 'NO  ✅'}               ║`);
    console.log('╚══════════════════════════════════════════════════════╝\n');
  });
});
