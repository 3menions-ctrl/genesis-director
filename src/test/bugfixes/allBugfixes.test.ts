/**
 * Comprehensive Bug Fix Verification Suite
 * 
 * Tests ALL 9 bugs fixed across two rounds:
 * 
 * Round 1 (4 fixes):
 *   1. Phantom credits fallback (AuthContext)
 *   2. Hook rule violation (usePredictivePipeline)
 *   3. Memory leak via interval churn (useZombieWatcher)
 *   4. Re-render loop via callback deps (useSelfDiagnostic)
 * 
 * Round 2 (5 fixes):
 *   5. Poll interval leak on unmount (VideoEditor)
 *   6. Double-fetch on mount (usePaginatedProjects)
 *   7. URL not synced after auto-detect (VideoEditor)
 *   8. Notification realtime re-subscribe churn (useNotifications)
 *   9. Missing error recovery in loadProjectClips (VideoEditor)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ─── Helper: read source file ───────────────────────────────────────────────
function readSrc(relativePath: string): string {
  return fs.readFileSync(path.resolve(__dirname, '../../', relativePath), 'utf-8');
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUND 1 — FIXES 1–4
// ═══════════════════════════════════════════════════════════════════════════════

describe('Round 1: Core stability fixes', () => {

  // ─── FIX 1: Phantom Credits ─────────────────────────────────────────────
  describe('Fix #1 — Phantom credits fallback set to 0', () => {
    const source = readSrc('contexts/AuthContext.tsx');

    it('fallback profile uses credits_balance: 0, not 60', () => {
      // Find all credits_balance assignments in the file
      const creditMatches = source.match(/credits_balance:\s*(\d+)/g) || [];
      expect(creditMatches.length).toBeGreaterThanOrEqual(1);
      
      // NONE of them should be 60
      for (const match of creditMatches) {
        expect(match).not.toContain('60');
      }
    });

    it('all credits_balance fallbacks are explicitly 0', () => {
      const allMatches = source.match(/credits_balance:\s*\d+/g) || [];
      const nonZero = allMatches.filter(m => !m.includes(': 0'));
      expect(nonZero).toEqual([]);
    });
  });

  // ─── FIX 2: Hook Rule Violation ─────────────────────────────────────────
  describe('Fix #2 — No React hooks called inside plain async functions', () => {
    const source = readSrc('hooks/usePredictivePipeline.ts');

    it('warmAvatarCache does NOT call useQueryClient as executable code', () => {
      const fnStart = source.indexOf('async function warmAvatarCache');
      expect(fnStart).toBeGreaterThan(-1);
      
      const fnBody = source.substring(fnStart, source.indexOf('}', fnStart) + 1);
      // The comment mentions useQueryClient as a warning, but it must NOT be called/imported
      expect(fnBody).not.toMatch(/await\s+import.*useQueryClient/);
      expect(fnBody).not.toContain('= useQueryClient');
    });

    it('warmAvatarCache is a no-op with explanatory comment', () => {
      const fnStart = source.indexOf('async function warmAvatarCache');
      const fnBody = source.substring(fnStart, source.indexOf('}', fnStart) + 1);
      expect(fnBody).toContain('No-op');
      expect(fnBody).toContain('Do NOT call React hooks');
    });
  });

  // ─── FIX 3: Memory Leak via Interval Churn ──────────────────────────────
  describe('Fix #3 — useZombieWatcher uses ref-stabilized refresh', () => {
    const source = readSrc('hooks/useZombieWatcher.ts');

    it('declares refreshRef', () => {
      expect(source).toContain('const refreshRef = useRef(refresh)');
    });

    it('keeps refreshRef.current up to date', () => {
      expect(source).toContain('refreshRef.current = refresh');
    });

    it('initial mount effect uses refreshRef.current, not refresh directly', () => {
      // The mount effect should call refreshRef.current()
      expect(source).toContain('refreshRef.current()');
    });

    it('periodic interval uses refreshRef.current via arrow fn', () => {
      expect(source).toContain('setInterval(() => refreshRef.current()');
    });

    it('mount effect deps do NOT include refresh', () => {
      // Find the deps array for the mount effect (after "Initial check on mount")
      const mountSection = source.substring(
        source.indexOf('// Initial check on mount'),
        source.indexOf('// Periodic auto-check')
      );
      // Should have [enabled, userId] not [enabled, userId, refresh]
      expect(mountSection).toContain('[enabled, userId]');
      expect(mountSection).not.toContain('[enabled, userId, refresh]');
    });

    it('periodic effect deps do NOT include refresh', () => {
      const periodicSection = source.substring(
        source.indexOf('// Periodic auto-check')
      );
      const depsMatch = periodicSection.match(/\[autoCheck,\s*enabled,\s*userId,\s*checkInterval\]/);
      expect(depsMatch).not.toBeNull();
    });
  });

  // ─── FIX 4: Re-render Loop ──────────────────────────────────────────────
  describe('Fix #4 — useSelfDiagnostic ref-stabilizes onReady/onFailure', () => {
    const source = readSrc('hooks/useSelfDiagnostic.ts');

    it('creates onReadyRef with useRef', () => {
      expect(source).toContain('const onReadyRef = useRef(onReady)');
    });

    it('creates onFailureRef with useRef', () => {
      expect(source).toContain('const onFailureRef = useRef(onFailure)');
    });

    it('keeps refs current', () => {
      expect(source).toContain('onReadyRef.current = onReady');
      expect(source).toContain('onFailureRef.current = onFailure');
    });

    it('calls onReadyRef.current instead of onReady directly', () => {
      expect(source).toContain('onReadyRef.current?.(');
    });

    it('calls onFailureRef.current instead of onFailure directly', () => {
      expect(source).toContain('onFailureRef.current?.(');
    });

    it('runChecks useCallback deps do NOT include onReady or onFailure', () => {
      // Find the closing deps of runChecks useCallback
      const depsComment = source.indexOf('onReady/onFailure removed from deps');
      expect(depsComment).toBeGreaterThan(-1);
      
      // Get the deps line after the comment
      const afterComment = source.substring(depsComment, depsComment + 200);
      const depsMatch = afterComment.match(/\[([^\]]*)\]/);
      expect(depsMatch).not.toBeNull();
      expect(depsMatch![1]).not.toContain('onReady');
      expect(depsMatch![1]).not.toContain('onFailure');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ROUND 2 — FIXES 5–9
// ═══════════════════════════════════════════════════════════════════════════════

describe('Round 2: Editor & infrastructure fixes', () => {

  // ─── FIX 5: Poll Interval Leak ──────────────────────────────────────────
  describe('Fix #5 — pollRenderStatus interval cleaned up on unmount', () => {
    const source = readSrc('pages/VideoEditor.tsx');

    it('stores poll interval in a ref (pollIntervalRef)', () => {
      expect(source).toContain('const pollIntervalRef = useRef<');
    });

    it('clears previous interval before starting new one', () => {
      const fnBody = source.substring(
        source.indexOf('const pollRenderStatus'),
        source.indexOf('// Cleanup poll interval')
      );
      // Should clear at the start of the function
      const firstClear = fnBody.indexOf('clearInterval(pollIntervalRef.current)');
      const setIntervalPos = fnBody.indexOf('pollIntervalRef.current = setInterval');
      expect(firstClear).toBeGreaterThan(-1);
      expect(setIntervalPos).toBeGreaterThan(firstClear);
    });

    it('has a cleanup useEffect that clears the interval on unmount', () => {
      const cleanupSection = source.substring(
        source.indexOf('// Cleanup poll interval on unmount')
      );
      expect(cleanupSection).toContain('return () => {');
      expect(cleanupSection).toContain('clearInterval(pollIntervalRef.current)');
    });

    it('nullifies the ref after clearing inside the poll callback', () => {
      const fnBody = source.substring(
        source.indexOf('const pollRenderStatus'),
        source.indexOf('// Cleanup poll interval')
      );
      // After clearing, should set to null
      const nullAssignments = (fnBody.match(/pollIntervalRef\.current = null/g) || []).length;
      // Should null it on completed, failed, AND catch
      expect(nullAssignments).toBeGreaterThanOrEqual(3);
    });
  });

  // ─── FIX 6: Double-fetch on Mount ──────────────────────────────────────
  describe('Fix #6 — usePaginatedProjects single fetch on mount', () => {
    const source = readSrc('hooks/usePaginatedProjects.ts');

    it('the main re-fetch effect uses [fetchProjects] as sole dependency', () => {
      // The key fix: the effect that re-fetches on filter change uses fetchProjects
      // as the only dep, not the raw filter values
      const effectSection = source.substring(
        source.indexOf('// Re-fetch when filters/sort change')
      );
      const depsLine = effectSection.match(/\}, \[fetchProjects\]/);
      expect(depsLine).not.toBeNull();
    });

    it('uses [fetchProjects] as the sole dependency', () => {
      // Find the effect that calls fetchProjects(true)
      const effectSection = source.substring(
        source.indexOf('// Re-fetch when filters/sort change')
      );
      expect(effectSection).toContain('[fetchProjects]');
    });

    it('does NOT have sortBy, sortOrder, statusFilter, searchQuery in the effect deps', () => {
      // The old pattern had these as direct deps causing double-fire
      const effectSection = source.substring(
        source.indexOf('// Re-fetch when filters/sort change'),
        source.indexOf('// Cleanup debounce')
      );
      const depsLine = effectSection.match(/\}, \[([^\]]*)\]/);
      expect(depsLine).not.toBeNull();
      expect(depsLine![1]).not.toContain('sortBy');
      expect(depsLine![1]).not.toContain('sortOrder');
      expect(depsLine![1]).not.toContain('statusFilter');
      expect(depsLine![1]).not.toContain('searchQuery');
    });

    it('buildQuery useCallback captures the filter state (single dep chain)', () => {
      // buildQuery's useCallback deps must include filter variables
      // so that fetchProjects (which depends on buildQuery) re-fires when filters change
      const buildQuerySection = source.substring(
        source.indexOf('const buildQuery = useCallback'),
        source.indexOf('// Initial fetch')
      );
      // Find the last [...] which is the deps array (after the function body)
      const allBrackets = [...buildQuerySection.matchAll(/\[([^\]]*)\]/g)];
      const depsArray = allBrackets[allBrackets.length - 1]?.[1] || '';
      expect(depsArray).toContain('statusFilter');
      expect(depsArray).toContain('sortBy');
    });
  });

  // ─── FIX 7: URL Sync ──────────────────────────────────────────────────
  describe('Fix #7 — Auto-detected project ID synced to URL', () => {
    const source = readSrc('pages/VideoEditor.tsx');

    it('uses window.history.replaceState to update URL after auto-detect', () => {
      const autoDetectSection = source.substring(
        source.indexOf('No projects with clips found'),
        source.indexOf('} else {')
      );
      expect(autoDetectSection).toContain('window.history.replaceState');
    });

    it('sets the "project" search param in the URL', () => {
      expect(source).toContain('newParams.set("project", targetProjectId)');
    });

    it('uses replaceState (not pushState) to avoid polluting browser history', () => {
      const section = source.substring(
        source.indexOf('// Sync URL'),
        source.indexOf('} else {')
      );
      expect(section).toContain('replaceState');
      expect(section).not.toContain('pushState');
    });
  });

  // ─── FIX 8: Notification Realtime Re-subscribe ─────────────────────────
  describe('Fix #8 — useNotifications stable realtime subscription', () => {
    const source = readSrc('hooks/useNotifications.ts');

    it('imports useRef from react', () => {
      expect(source).toMatch(/import\s*\{[^}]*useRef[^}]*\}\s*from\s*['"]react['"]/);
    });

    it('creates queryClientRef with useRef', () => {
      expect(source).toContain('const queryClientRef = useRef(queryClient)');
    });

    it('keeps queryClientRef.current in sync', () => {
      expect(source).toContain('queryClientRef.current = queryClient');
    });

    it('uses queryClientRef.current inside the realtime callback', () => {
      const realtimeSection = source.substring(
        source.indexOf("'postgres_changes'"),
        source.indexOf('.subscribe()')
      );
      expect(realtimeSection).toContain('queryClientRef.current.invalidateQueries');
      expect(realtimeSection).not.toMatch(/[^.]queryClient\.invalidateQueries/);
    });

    it('realtime useEffect deps use user?.id instead of full user object', () => {
      const effectSection = source.substring(
        source.indexOf('// Subscribe to realtime notifications')
      );
      // Find the closing deps
      const depsMatch = effectSection.match(/\}, \[([^\]]*)\]/);
      expect(depsMatch).not.toBeNull();
      expect(depsMatch![1]).toContain('user?.id');
      expect(depsMatch![1]).not.toContain('queryClient');
    });
  });

  // ─── FIX 9: Error Recovery in loadProjectClips ─────────────────────────
  describe('Fix #9 — loadProjectClips separates error from empty state', () => {
    const source = readSrc('pages/VideoEditor.tsx');

    it('handles network errors with console.error and toast.error', () => {
      const loadFnSection = source.substring(
        source.indexOf('const loadProjectClips'),
        source.indexOf('const handleAddClipFromBrowser')
      );
      expect(loadFnSection).toContain("console.error('[VideoEditor] Failed to load clips:'");
      expect(loadFnSection).toContain("toast.error(\"Couldn't load clips. Please try again.\")");
    });

    it('handles empty results with toast.info (not toast.error)', () => {
      const loadFnSection = source.substring(
        source.indexOf('const loadProjectClips'),
        source.indexOf('const handleAddClipFromBrowser')
      );
      expect(loadFnSection).toContain('toast.info("No completed clips found for this project yet")');
    });

    it('does NOT use combined if (error || !clips?.length) anymore', () => {
      const loadFnSection = source.substring(
        source.indexOf('const loadProjectClips'),
        source.indexOf('const handleAddClipFromBrowser')
      );
      expect(loadFnSection).not.toContain('error || !clips');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CROSS-CUTTING: Structural integrity
// ═══════════════════════════════════════════════════════════════════════════════

describe('Cross-cutting: No regressions', () => {
  
  it('VideoEditor imports useRef', () => {
    const source = readSrc('pages/VideoEditor.tsx');
    expect(source).toMatch(/import\s*\{[^}]*useRef[^}]*\}\s*from\s*["']react["']/);
  });

  it('useNotifications imports useRef', () => {
    const source = readSrc('hooks/useNotifications.ts');
    expect(source).toMatch(/import\s*\{[^}]*useRef[^}]*\}\s*from\s*["']react["']/);
  });

  it('useSelfDiagnostic autoRetry defaults to false (prevents retry storms)', () => {
    const source = readSrc('hooks/useSelfDiagnostic.ts');
    expect(source).toContain('autoRetry = false');
  });

  it('useSelfDiagnostic maxRetries defaults to 1 (prevents cascade)', () => {
    const source = readSrc('hooks/useSelfDiagnostic.ts');
    expect(source).toContain('maxRetries = 1');
  });

  it('AuthContext never gives 60 free credits anywhere in the file', () => {
    const source = readSrc('contexts/AuthContext.tsx');
    // The string "credits_balance: 60" should not appear
    expect(source).not.toContain('credits_balance: 60');
  });
});
