# Comprehensive Stability Audit Report
**Date:** 2026-02-02
**Status:** Critical Issues Identified

---

## EXECUTIVE SUMMARY

This audit identifies **7 categories** of stability issues across **100+ files** that cause the recurring crashes and refresh loops.

---

## CATEGORY 1: CORS VIOLATIONS (CRITICAL)
**Impact:** Videos fail to load, causing cascade failures

### Files with `crossOrigin` that MUST be removed:

| File | Line | Issue |
|------|------|-------|
| `src/utils/extractVideoThumbnails.ts` | 21 | `video.crossOrigin = 'anonymous'` blocks CDN videos |
| `src/lib/videoEngine/HydratedBootSequence.ts` | 162 | Conditional `crossOrigin` - should be removed entirely |

### Fix Required:
Remove ALL `crossOrigin = 'anonymous'` from video elements - Supabase/Replicate CDNs don't support CORS headers for media.

---

## CATEGORY 2: UNSAFE VIDEO OPERATIONS (CRITICAL)
**Impact:** AbortError, InvalidStateError crashes

### `safeVideoOperations.ts` EXISTS but ZERO components import it!

Files calling `.play()` or `.pause()` DIRECTLY (19 files, 297+ calls):

| File | Unsafe Calls | Needs Safe Wrapper |
|------|--------------|-------------------|
| `src/components/studio/VideoThumbnail.tsx` | `.play().catch()` | YES |
| `src/components/studio/ManifestVideoPlayer.tsx` | 8+ direct calls | YES |
| `src/components/studio/FullscreenVideoPlayer.tsx` | 6+ direct calls | YES |
| `src/components/studio/SmartStitcherPlayer.tsx` | 10+ direct calls | YES |
| `src/components/studio/AvatarTemplateSelector.tsx` | `audio.play().catch()` | YES |
| `src/components/studio/MSEVideoPlayer.tsx` | 4+ direct calls | YES |
| `src/components/landing/ExamplesGallery.tsx` | 3+ direct calls | YES |
| `src/pages/Gallery.tsx` | 5+ direct calls | YES |
| `src/pages/Discover.tsx` | 4+ direct calls | YES |
| `src/pages/Projects.tsx` | Direct video calls | YES |
| `src/hooks/useMSEPlayback.ts` | 8+ direct calls | YES |
| `src/lib/videoEngine/AtomicFrameSwitch.ts` | Direct calls | YES |
| `src/lib/videoEngine/HydratedBootSequence.ts` | Direct calls | YES |
| `src/lib/videoEngine/MSEGaplessEngine.ts` | Direct calls | YES |
| `src/lib/videoEngine/PrecisionRenderingEngine.ts` | Direct calls | YES |
| `src/lib/videoEngine/HDExportPipeline.ts` | Direct calls | YES |
| `src/components/projects/ProjectCard.tsx` | Direct calls | YES |

### Fix Required:
Replace ALL direct `.play()/.pause()/.currentTime` with imports from `safeVideoOperations.ts`:
```typescript
import { safePlay, safePause, safeSeek } from '@/lib/video/safeVideoOperations';
```

---

## CATEGORY 3: TIMER CLEANUP FAILURES (HIGH)
**Impact:** Memory leaks, stale callbacks

### Files using `setInterval` (24 files, 179 matches):

| File | Has Cleanup? | Status |
|------|--------------|--------|
| `src/hooks/useFileUpload.ts` | ✅ | OK |
| `src/pages/Production.tsx` | ⚠️ | Needs verification |
| `src/lib/videoEngine/MSEGaplessEngine.ts` | ✅ | OK |
| `src/components/production/SpecializedModeProgress.tsx` | ✅ | OK |
| `src/components/production/CinematicPipelineProgress.tsx` | ⚠️ | Needs verification |
| `src/lib/audioVideoSync.ts` | ⚠️ | Needs verification |
| `src/components/admin/AdminPipelineMonitor.tsx` | ✅ | OK |
| `src/components/diagnostics/HealthCheckDashboard.tsx` | ✅ | OK |
| `src/hooks/useAdminAccess.ts` | ⚠️ | Missing cleanup |
| `src/hooks/useStabilityGuard.ts` | ✅ | OK |
| `src/hooks/useZombieWatcher.ts` | ✅ | OK |
| `src/contexts/AuthContext.tsx` | ✅ | OK |
| `src/components/ui/app-loader.tsx` | ⚠️ | Two intervals - verify both cleanup |
| `src/components/stability/GlobalStabilityBoundary.tsx` | ✅ | OK |

### Files using `setTimeout` (64 files, 672 matches):
Most need verification for proper cleanup in useEffect return statements.

**High-Priority Files to Audit:**
1. `src/pages/ResetPassword.tsx` - Line 90: Naked `setTimeout` without cleanup
2. `src/lib/errorHandler.ts` - Promise-based timeout
3. `src/components/studio/CreationHub.tsx` - Line 338: Has cleanup ✅
4. `src/components/landing/CinematicTransition.tsx` - Multiple timers

---

## CATEGORY 4: MISSING MOUNT GUARDS (HIGH)
**Impact:** State updates on unmounted components

### Files with `isMountedRef` pattern (28 files):
These are CORRECT and should be the model.

### Files with async operations MISSING mount guards:

| File | Has isMountedRef? | Needs Fix |
|------|-------------------|-----------|
| `src/hooks/useSocial.ts` | ❌ | Multiple mutations need guards |
| `src/pages/TrainingVideo.tsx` | ❌ | Long async operations need guards |
| `src/pages/Production.tsx` | ⚠️ | Some paths missing guards |
| `src/components/admin/AdminMessageCenter.tsx` | ❌ | All async calls unguarded |
| `src/pages/Profile.tsx` | ❌ | Async metrics/video fetch unguarded |
| `src/components/universes/CreateUniverseDialog.tsx` | ✅ | OK |
| `src/hooks/useClipRecovery.ts` | ❌ | Recovery loop unguarded |

---

## CATEGORY 5: UNCONTROLLED ERROR PROPAGATION (MEDIUM)
**Impact:** Errors cascade to global boundary

### `console.error` calls that should be `console.debug` (72 files, 913 matches):

**Network-related errors to suppress:**
- Token refresh failures (transient)
- Video load errors (expected on CDN)
- Fetch timeouts (handled by retry)

**Files with excessive error logging:**
| File | console.error calls | Should convert to debug |
|------|---------------------|------------------------|
| `src/main.tsx` | 4 | Some OK (global handlers) |
| `src/components/credits/BuyCreditsModal.tsx` | 3 | YES - user-facing should toast |
| `src/utils/extractVideoThumbnails.ts` | 2 | YES |
| `src/hooks/useClipRecovery.ts` | 3 | YES |
| `src/components/admin/AdminMessageCenter.tsx` | 4 | YES |
| `src/pages/Profile.tsx` | 2 | YES |

---

## CATEGORY 6: THROW WITHOUT CATCH (MEDIUM)
**Impact:** Unhandled rejections crash app

### Files with `throw new Error` (39 files, 339 matches):

**High-Risk Throws (in async paths without try-catch):**
| File | Line | Issue |
|------|------|-------|
| `src/hooks/useSocial.ts` | 109, 140, 258, 347, 422, 443 | Mutations throw without caller catch |
| `src/pages/TrainingVideo.tsx` | 331, 403, 457, 472, 483, 624, 633, 636 | 8 throws in generation flow |
| `src/pages/Production.tsx` | 884, 960, 992, 996, 1057 | Pipeline throws |
| `src/components/studio/FailedClipsPanel.tsx` | 164 | Rephrase throw |

### Fix Required:
Wrap mutation calls in try-catch at the call site, OR convert throws to return error objects.

---

## CATEGORY 7: EMPTY CATCH PATTERNS (LOW)
**Impact:** Silent failures mask real issues

### Files with `.catch(() => {})` or `.catch(() => {` (15 files, 226 matches):

This pattern is ACCEPTABLE for play/pause since AbortError is expected.
However, these should log to debug:

```typescript
// Bad
video.play().catch(() => {});

// Better
video.play().catch(e => console.debug('[Video] Play interrupted:', e?.name));
```

---

## PRIORITY FIX ORDER

### Phase 1: CRITICAL (Do First)
1. ✅ Remove ALL `crossOrigin="anonymous"` from video elements (2 files)
2. ✅ Add `safeVideoOperations` imports to all 17 video-playing files
3. ✅ Fix `src/hooks/useAdminAccess.ts` interval cleanup

### Phase 2: HIGH (Do Second)
4. Add `isMountedRef` to 6 identified files
5. Verify timer cleanup in 8 flagged files
6. Convert 6 files' console.error to console.debug for network errors

### Phase 3: MEDIUM (Do Third)
7. Add try-catch wrappers around 6 files with unhandled throws
8. Audit remaining 30+ files with async patterns

### Phase 4: LOW (Maintenance)
9. Convert empty catches to debug-logging catches
10. Add JSDoc comments explaining suppression patterns

---

## FILES REQUIRING IMMEDIATE ATTENTION

```
src/utils/extractVideoThumbnails.ts      - CORS + error logging
src/lib/videoEngine/HydratedBootSequence.ts - CORS + direct play
src/components/studio/SmartStitcherPlayer.tsx - 10+ unsafe video ops
src/components/studio/ManifestVideoPlayer.tsx - 8+ unsafe video ops
src/components/studio/FullscreenVideoPlayer.tsx - 6+ unsafe video ops
src/pages/Gallery.tsx                    - 5+ unsafe video ops
src/pages/Discover.tsx                   - 4+ unsafe video ops
src/hooks/useMSEPlayback.ts              - 8+ unsafe video ops
src/hooks/useAdminAccess.ts              - Missing interval cleanup
src/hooks/useSocial.ts                   - Missing mount guards
src/pages/TrainingVideo.tsx              - 8 unhandled throws
src/pages/Production.tsx                 - 5 unhandled throws
```

---

## VERIFICATION CHECKLIST

After fixes, verify:
- [ ] No `crossOrigin` in any video element
- [ ] All `.play()` calls use `safePlay()`
- [ ] All `.pause()` calls use `safePause()`
- [ ] All `setInterval` have matching `clearInterval` in useEffect cleanup
- [ ] All async operations in hooks have `isMountedRef` guards
- [ ] No network-related `console.error` (use `console.debug`)
- [ ] All mutation throws have try-catch at call sites

---

*Generated by Lovable Stability Audit*
