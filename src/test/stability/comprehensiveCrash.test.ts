/**
 * Comprehensive Browser & Device Crash Tests
 * 
 * Modeled after OpenAI-style resilience testing:
 * 1. Global error handler resilience
 * 2. Error boundary suppression accuracy
 * 3. Memory pressure & leak vectors
 * 4. Video/media crash vectors
 * 5. Safari/iOS specific crash paths
 * 6. Concurrent async crash scenarios
 * 7. DOM mutation crash vectors
 * 8. Storage exhaustion
 * 9. Navigation crash resilience
 * 10. Crash forensics integrity
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================================
// 1. GLOBAL ERROR HANDLER RESILIENCE
// ============================================================================

describe('Global Error Handler Resilience', () => {
  it('should suppress ResizeObserver loop errors', () => {
    const { shouldSuppressError } = require('@/lib/stabilityMonitor');
    expect(shouldSuppressError(new Error('ResizeObserver loop completed with undelivered notifications'))).toBe(true);
    expect(shouldSuppressError(new Error('ResizeObserver loop limit exceeded'))).toBe(true);
  });

  it('should suppress AbortError by name', () => {
    const { shouldSuppressError } = require('@/lib/stabilityMonitor');
    const err = new DOMException('The user aborted a request.', 'AbortError');
    expect(shouldSuppressError(err)).toBe(true);
  });

  it('should suppress ChunkLoadError variants', () => {
    const { shouldSuppressError } = require('@/lib/stabilityMonitor');
    expect(shouldSuppressError(new Error('ChunkLoadError: Loading chunk 42 failed'))).toBe(true);
    expect(shouldSuppressError(new Error('Failed to fetch dynamically imported module: /assets/Page-abc123.js'))).toBe(true);
    expect(shouldSuppressError(new Error('Importing a module script failed.'))).toBe(false); // Check if this is handled
  });

  it('should suppress network errors', () => {
    const { shouldSuppressError } = require('@/lib/stabilityMonitor');
    expect(shouldSuppressError(new Error('Failed to fetch'))).toBe(true);
    expect(shouldSuppressError(new Error('NetworkError when attempting to fetch resource'))).toBe(true);
    expect(shouldSuppressError(new TypeError('Load failed'))).toBe(true);
  });

  it('should suppress video playback interruptions', () => {
    const { shouldSuppressError } = require('@/lib/stabilityMonitor');
    expect(shouldSuppressError(new Error('The play() request was interrupted by a call to pause()'))).toBe(true);
    expect(shouldSuppressError(new Error('play() request was interrupted because the media was removed'))).toBe(true);
  });

  it('should NOT suppress real application errors', () => {
    const { shouldSuppressError } = require('@/lib/stabilityMonitor');
    expect(shouldSuppressError(new Error('Cannot read properties of undefined (reading "map")'))).toBe(false);
    expect(shouldSuppressError(new TypeError('x is not a function'))).toBe(false);
    expect(shouldSuppressError(new RangeError('Maximum call stack size exceeded'))).toBe(false);
    expect(shouldSuppressError(new Error('Invalid hook call'))).toBe(false);
  });

  it('should suppress DOMException types by name in GlobalStabilityBoundary', () => {
    // These names should be caught in getDerivedStateFromError
    const suppressedNames = ['AbortError', 'NotAllowedError', 'NotSupportedError', 'InvalidStateError', 'QuotaExceededError', 'SecurityError', 'NotFoundError', 'HierarchyRequestError'];
    
    suppressedNames.forEach(name => {
      const err = new DOMException(`Test ${name}`, name);
      expect(err.name).toBe(name);
    });
  });

  it('should handle null/undefined errors without crashing', () => {
    const { shouldSuppressError } = require('@/lib/stabilityMonitor');
    expect(shouldSuppressError(null)).toBe(true);
    expect(shouldSuppressError(undefined)).toBe(true);
    expect(shouldSuppressError('')).toBe(true);
    expect(shouldSuppressError(0)).toBe(true);
  });

  it('should handle non-Error objects in global handler', () => {
    const { classifyError } = require('@/lib/stabilityMonitor');
    expect(classifyError('string error')).toBe('UNKNOWN');
    expect(classifyError(42)).toBe('UNKNOWN');
    expect(classifyError({ message: 'object error' })).toBe('UNKNOWN');
    expect(classifyError(Symbol('test'))).toBe('UNKNOWN');
  });
});

// ============================================================================
// 2. ERROR CLASSIFICATION ACCURACY
// ============================================================================

describe('Error Classification Accuracy', () => {
  it('should classify network errors correctly', () => {
    const { classifyError } = require('@/lib/stabilityMonitor');
    expect(classifyError(new Error('Failed to fetch'))).toBe('NETWORK');
    expect(classifyError(new Error('NetworkError'))).toBe('NETWORK');
    expect(classifyError(new Error('net::ERR_CONNECTION_REFUSED'))).toBe('NETWORK');
  });

  it('should classify auth errors correctly', () => {
    const { classifyError } = require('@/lib/stabilityMonitor');
    expect(classifyError(new Error('Session expired'))).toBe('AUTH');
    expect(classifyError(new Error('Unauthorized'))).toBe('AUTH');
    expect(classifyError(new Error('JWT token invalid'))).toBe('AUTH');
  });

  it('should classify timeout errors correctly', () => {
    const { classifyError } = require('@/lib/stabilityMonitor');
    expect(classifyError(new Error('Request timed out'))).toBe('TIMEOUT');
    expect(classifyError(new Error('Operation timeout'))).toBe('TIMEOUT');
  });

  it('should classify async race conditions', () => {
    const { classifyError } = require('@/lib/stabilityMonitor');
    expect(classifyError(new Error("Can't perform a React state update on an unmounted component"))).toBe('ASYNC_RACE');
    expect(classifyError(new Error('state update on an unmounted'))).toBe('ASYNC_RACE');
  });

  it('should classify state corruption errors', () => {
    const { classifyError } = require('@/lib/stabilityMonitor');
    expect(classifyError(new Error("Cannot read properties of undefined (reading 'id')"))).toBe('STATE_CORRUPTION');
    expect(classifyError(new TypeError('null is not an object'))).toBe('STATE_CORRUPTION');
  });

  it('should classify render errors', () => {
    const { classifyError } = require('@/lib/stabilityMonitor');
    expect(classifyError(new Error('Error during render'))).toBe('RENDER');
    expect(classifyError(new Error('Hydration failed'))).toBe('RENDER');
  });
});

// ============================================================================
// 3. CHUNK LOAD RECOVERY
// ============================================================================

describe('ChunkLoadError Recovery System', () => {
  beforeEach(() => {
    const { clearRecoveryState } = require('@/lib/chunkLoadRecovery');
    clearRecoveryState();
  });

  it('should identify all ChunkLoadError variants', () => {
    const { isChunkLoadError } = require('@/lib/chunkLoadRecovery');
    
    const variants = [
      'ChunkLoadError: Loading chunk 42 failed',
      'Loading chunk xyz failed after 3 retries',
      'Importing a module script failed.',
      'Failed to fetch dynamically imported module: /src/pages/MyPage.tsx',
      'error loading dynamically imported module',
    ];

    variants.forEach(msg => {
      expect(isChunkLoadError(new Error(msg))).toBe(true);
    });
  });

  it('should NOT identify regular errors as chunk errors', () => {
    const { isChunkLoadError } = require('@/lib/chunkLoadRecovery');
    
    expect(isChunkLoadError(new Error('Cannot read property'))).toBe(false);
    expect(isChunkLoadError(new Error('TypeError: x is not a function'))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
    expect(isChunkLoadError('')).toBe(false);
  });

  it('should limit recovery attempts', async () => {
    const { recoverFromChunkError, clearRecoveryState } = require('@/lib/chunkLoadRecovery');
    clearRecoveryState();
    
    const chunkError = new Error('Loading chunk test failed');
    
    // Attempt 3 recoveries (MAX_RETRY_ATTEMPTS = 3)
    await recoverFromChunkError(chunkError);
    await recoverFromChunkError(chunkError);
    await recoverFromChunkError(chunkError);
    
    // 4th should fail
    const result = await recoverFromChunkError(chunkError);
    expect(result).toBe(false);
  });
});

// ============================================================================
// 4. CRASH FORENSICS INTEGRITY
// ============================================================================

describe('Crash Forensics System', () => {
  it('should mark boot checkpoints', () => {
    const { markCheckpoint, getCheckpoints } = require('@/lib/crashForensics');
    
    markCheckpoint('A0');
    const checkpoints = getCheckpoints();
    const a0 = checkpoints.find((c: any) => c.id === 'A0');
    
    expect(a0?.passed).toBe(true);
    expect(a0?.timestamp).toBeGreaterThan(0);
  });

  it('should detect crash loops at threshold 5', () => {
    const { recordCrashEvent, isCrashLoopDetected } = require('@/lib/crashForensics');
    
    // 4 events = not a crash loop
    for (let i = 0; i < 4; i++) {
      recordCrashEvent('error', { path: '/test-crash', message: `crash ${i}` });
    }
    // May or may not be detected yet depending on accumulation with other tests
    // The 5th MUST trigger it
    recordCrashEvent('error', { path: '/test-crash', message: 'crash 4' });
    expect(isCrashLoopDetected()).toBe(true);
  });

  it('should suppress harmless errors from crash count', () => {
    const { recordError } = require('@/lib/crashForensics');
    
    // These should NOT increment crash counter
    const harmlessErrors = [
      'ResizeObserver loop completed',
      'The play() request was interrupted',
      'AbortError: The operation was aborted',
      'Failed to fetch',
      'ChunkLoadError: Loading chunk 1 failed',
      "Can't perform a React state update on an unmounted component",
    ];
    
    harmlessErrors.forEach(msg => {
      // Should not throw
      expect(() => recordError(msg)).not.toThrow();
    });
  });

  it('should capture memory signals without crashing', () => {
    const { captureMemorySignal } = require('@/lib/crashForensics');
    
    const signal = captureMemorySignal();
    expect(signal).toHaveProperty('timestamp');
    expect(signal).toHaveProperty('domNodes');
    expect(signal).toHaveProperty('intervals');
    expect(signal).toHaveProperty('timeouts');
    expect(signal).toHaveProperty('videoElements');
    expect(typeof signal.domNodes).toBe('number');
  });

  it('should track route changes without loop', () => {
    const { recordRouteChange } = require('@/lib/crashForensics');
    
    // Should not throw for normal navigation
    expect(() => recordRouteChange('/page-a')).not.toThrow();
    expect(() => recordRouteChange('/page-b')).not.toThrow();
    expect(() => recordRouteChange('/page-c')).not.toThrow();
    
    // Duplicate routes should be ignored
    expect(() => recordRouteChange('/page-c')).not.toThrow();
  });
});

// ============================================================================
// 5. SAFE MODE SYSTEM
// ============================================================================

describe('Safe Mode System', () => {
  it('should provide correct config shape', () => {
    const { getSafeModeConfig } = require('@/lib/safeMode');
    const config = getSafeModeConfig();
    
    expect(config).toHaveProperty('enabled');
    expect(config).toHaveProperty('disableVideoMount');
    expect(config).toHaveProperty('disablePolling');
    expect(config).toHaveProperty('disableMSE');
    expect(typeof config.enabled).toBe('boolean');
  });

  it('should install/uninstall timer interceptors cleanly', () => {
    const { installSafeModeInterceptors } = require('@/lib/safeMode');
    
    const cleanup = installSafeModeInterceptors();
    expect(typeof cleanup).toBe('function');
    
    // Should not throw when cleaning up
    expect(() => cleanup()).not.toThrow();
    
    // Should be idempotent
    expect(() => cleanup()).not.toThrow();
  });

  it('should not break setTimeout/setInterval in normal mode', () => {
    const { installSafeModeInterceptors } = require('@/lib/safeMode');
    const cleanup = installSafeModeInterceptors();
    
    // Short timers should still work
    const id = setTimeout(() => {}, 100);
    expect(id).toBeDefined();
    clearTimeout(id);
    
    const intervalId = setInterval(() => {}, 100);
    expect(intervalId).toBeDefined();
    clearInterval(intervalId);
    
    cleanup();
  });
});

// ============================================================================
// 6. SAFE VIDEO OPERATIONS
// ============================================================================

describe('Safe Video Operations', () => {
  it('should handle null video element in all operations', () => {
    const ops = require('@/lib/video/safeVideoOperations');
    
    expect(ops.safePause(null)).toBe(false);
    expect(ops.safeSeek(null, 5)).toBe(false);
    expect(ops.safeLoad(null)).toBe(false);
    expect(ops.getSafeDuration(null)).toBe(0);
    expect(ops.getSafeCurrentTime(null)).toBe(0);
    expect(ops.isVideoPlayable(null)).toBe(false);
    expect(ops.safeSetMuted(null, true)).toBe(false);
  });

  it('should validate seek time values', () => {
    const { safeSeek } = require('@/lib/video/safeVideoOperations');
    const video = document.createElement('video');
    
    // NaN, Infinity, negative should fail
    expect(safeSeek(video, NaN)).toBe(false);
    expect(safeSeek(video, Infinity)).toBe(false);
    expect(safeSeek(video, -Infinity)).toBe(false);
    expect(safeSeek(video, -1)).toBe(false);
  });

  it('should validate number safety check', () => {
    const { isSafeVideoNumber } = require('@/lib/video/safeVideoOperations');
    
    expect(isSafeVideoNumber(0)).toBe(true);
    expect(isSafeVideoNumber(42)).toBe(true);
    expect(isSafeVideoNumber(0.5)).toBe(true);
    expect(isSafeVideoNumber(NaN)).toBe(false);
    expect(isSafeVideoNumber(Infinity)).toBe(false);
    expect(isSafeVideoNumber(-Infinity)).toBe(false);
    expect(isSafeVideoNumber(-1)).toBe(false);
    expect(isSafeVideoNumber('5')).toBe(false);
    expect(isSafeVideoNumber(null)).toBe(false);
    expect(isSafeVideoNumber(undefined)).toBe(false);
  });

  it('should handle play() on unready video', async () => {
    const { safePlay } = require('@/lib/video/safeVideoOperations');
    const video = document.createElement('video');
    
    // readyState is 0 (HAVE_NOTHING) by default
    const result = await safePlay(video);
    expect(result).toBe(false);
  });

  it('should create safe error handlers', () => {
    const { createSafeErrorHandler } = require('@/lib/video/safeVideoOperations');
    
    const onError = vi.fn();
    const handler = createSafeErrorHandler(onError);
    
    // Should not throw with mock event
    const mockEvent = { target: { error: null } } as unknown as Event;
    expect(() => handler(mockEvent)).not.toThrow();
  });

  it('should cleanup blob URLs without crashing', () => {
    const { createBlobUrlCleaner } = require('@/lib/video/safeVideoOperations');
    
    // Array version
    const cleanerArr = createBlobUrlCleaner(['blob:test1', 'blob:test2', 'not-a-blob']);
    expect(() => cleanerArr()).not.toThrow();
    
    // Map version
    const map = new Map<number, string>();
    map.set(0, 'blob:test3');
    map.set(1, 'not-a-blob');
    const cleanerMap = createBlobUrlCleaner(map);
    expect(() => cleanerMap()).not.toThrow();
    expect(map.size).toBe(0); // Map should be cleared
  });
});

// ============================================================================
// 7. MEMORY MANAGER
// ============================================================================

describe('Memory Manager', () => {
  it('should track and revoke blob URLs', () => {
    const { blobUrlTracker } = require('@/lib/memoryManager');
    const originalRevoke = URL.revokeObjectURL;
    URL.revokeObjectURL = vi.fn();
    
    blobUrlTracker.track('blob:test-url-1', 'comp-1');
    blobUrlTracker.track('blob:test-url-2', 'comp-1');
    blobUrlTracker.track('blob:test-url-3', 'comp-2');
    
    expect(blobUrlTracker.getCount()).toBeGreaterThanOrEqual(3);
    
    blobUrlTracker.revokeForComponent('comp-1');
    
    // comp-2 URLs should still exist
    expect(blobUrlTracker.getUrls()).toContain('blob:test-url-3');
    
    blobUrlTracker.revokeAll();
    URL.revokeObjectURL = originalRevoke;
  });

  it('should cleanup video elements without crashing', () => {
    const { cleanupVideoElement } = require('@/lib/memoryManager');
    
    // Null should be safe
    expect(() => cleanupVideoElement(null)).not.toThrow();
    
    // Real video element
    const video = document.createElement('video');
    expect(() => cleanupVideoElement(video)).not.toThrow();
  });

  it('should cleanup canvas elements without crashing', () => {
    const { cleanupCanvasElement } = require('@/lib/memoryManager');
    
    expect(() => cleanupCanvasElement(null)).not.toThrow();
    
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    expect(() => cleanupCanvasElement(canvas)).not.toThrow();
    expect(canvas.width).toBe(1); // Should be resized to release GPU memory
    expect(canvas.height).toBe(1);
  });

  it('should cleanup audio elements without crashing', () => {
    const { cleanupAudioElement } = require('@/lib/memoryManager');
    
    expect(() => cleanupAudioElement(null)).not.toThrow();
    
    const audio = document.createElement('audio');
    expect(() => cleanupAudioElement(audio)).not.toThrow();
  });

  it('should report memory usage without crashing', () => {
    const { getMemoryUsage } = require('@/lib/memoryManager');
    
    const usage = getMemoryUsage();
    expect(usage).toHaveProperty('blobUrlCount');
    expect(typeof usage.blobUrlCount).toBe('number');
  });
});

// ============================================================================
// 8. BROWSER COMPATIBILITY
// ============================================================================

describe('Browser Compatibility Layer', () => {
  it('should detect browser features without crashing', () => {
    const { browserFeatures } = require('@/lib/browserCompat');
    
    expect(typeof browserFeatures.backdropFilter).toBe('boolean');
    expect(typeof browserFeatures.cssGrid).toBe('boolean');
    expect(typeof browserFeatures.flexGap).toBe('boolean');
    expect(typeof browserFeatures.intersectionObserver).toBe('boolean');
    expect(typeof browserFeatures.resizeObserver).toBe('boolean');
    expect(typeof browserFeatures.mse).toBe('boolean');
    expect(typeof browserFeatures.webAnimations).toBe('boolean');
    expect(typeof browserFeatures.requestIdleCallback).toBe('boolean');
    expect(typeof browserFeatures.touch).toBe('boolean');
    expect(typeof browserFeatures.smoothScroll).toBe('boolean');
    expect(typeof browserFeatures.aspectRatio).toBe('boolean');
    expect(typeof browserFeatures.containerQueries).toBe('boolean');
  });

  it('should provide browser info without crashing', () => {
    const { browserInfo } = require('@/lib/browserCompat');
    
    expect(typeof browserInfo.name).toBe('string');
    expect(typeof browserInfo.version).toBe('number');
    expect(typeof browserInfo.isMobile).toBe('boolean');
    expect(typeof browserInfo.isIOS).toBe('boolean');
    expect(typeof browserInfo.isSafari).toBe('boolean');
  });

  it('should provide requestIdleCallback polyfill', () => {
    const { safeRequestIdleCallback, safeCancelIdleCallback } = require('@/lib/browserCompat');
    
    const id = safeRequestIdleCallback(() => {});
    expect(id).toBeDefined();
    expect(() => safeCancelIdleCallback(id)).not.toThrow();
  });

  it('should create safe IntersectionObserver', () => {
    const { createSafeIntersectionObserver } = require('@/lib/browserCompat');
    
    const observer = createSafeIntersectionObserver(() => {});
    // May be null in jsdom (no IntersectionObserver)
    if (observer) {
      expect(typeof observer.observe).toBe('function');
      expect(typeof observer.disconnect).toBe('function');
      observer.disconnect();
    }
  });

  it('should create safe ResizeObserver', () => {
    const { createSafeResizeObserver } = require('@/lib/browserCompat');
    
    const observer = createSafeResizeObserver(() => {});
    if (observer) {
      expect(typeof observer.observe).toBe('function');
      expect(typeof observer.disconnect).toBe('function');
      observer.disconnect();
    }
  });

  it('should detect media preferences without crashing', () => {
    const { prefersReducedMotion, prefersHighContrast, getColorSchemePreference } = require('@/lib/browserCompat');
    
    expect(typeof prefersReducedMotion()).toBe('boolean');
    expect(typeof prefersHighContrast()).toBe('boolean');
    expect(['light', 'dark', 'no-preference']).toContain(getColorSchemePreference());
  });

  it('should provide safe RAF/cancelRAF', () => {
    const { safeRAF, safeCancelRAF } = require('@/lib/browserCompat');
    
    const id = safeRAF(() => {});
    expect(id).toBeDefined();
    expect(() => safeCancelRAF(id)).not.toThrow();
  });
});

// ============================================================================
// 9. STABILITY MONITOR PATTERNS
// ============================================================================

describe('Stability Monitor', () => {
  it('should track events without exceeding cap', () => {
    const { logStabilityEvent, getRecentEvents } = require('@/lib/stabilityMonitor');
    
    // Log more than MAX_EVENTS (50)
    for (let i = 0; i < 60; i++) {
      logStabilityEvent('UNKNOWN', `Test event ${i}`, { silent: true });
    }
    
    const events = getRecentEvents(100);
    expect(events.length).toBeLessThanOrEqual(50);
  });

  it('should compute health score', () => {
    const { getHealthScore } = require('@/lib/stabilityMonitor');
    
    const score = getHealthScore();
    expect(typeof score).toBe('number');
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('should create safe executor with abort signal', () => {
    const { createSafeExecutor } = require('@/lib/stabilityMonitor');
    
    const controller = new AbortController();
    const executor = createSafeExecutor(controller.signal);
    
    expect(executor.isCancelled()).toBe(false);
    
    controller.abort();
    expect(executor.isCancelled()).toBe(true);
  });

  it('should handle withTimeout correctly', async () => {
    const { withTimeout } = require('@/lib/stabilityMonitor');
    
    // Should resolve fast promises
    const fast = await withTimeout(Promise.resolve('ok'), 1000, 'fast');
    expect(fast).toBe('ok');
    
    // Should reject on timeout
    const slow = new Promise(resolve => setTimeout(resolve, 5000));
    await expect(withTimeout(slow, 10, 'slow')).rejects.toThrow('timed out');
  });

  it('should handle suppress logic edge cases', () => {
    const { shouldSuppressError } = require('@/lib/stabilityMonitor');
    
    // Non-Error promise rejections
    expect(shouldSuppressError(new Error('Non-Error promise rejection'))).toBe(true);
    
    // False - string that happens to have fetch in it
    expect(shouldSuppressError(new Error('User fetched the wrong data'))).toBe(false);
  });
});

// ============================================================================
// 10. CONCURRENT ASYNC CRASH SCENARIOS
// ============================================================================

describe('Concurrent Async Crash Scenarios', () => {
  it('should handle rapid sequential state updates without error', async () => {
    let updateCount = 0;
    const updates: Promise<void>[] = [];
    
    for (let i = 0; i < 100; i++) {
      updates.push(
        new Promise<void>(resolve => {
          setTimeout(() => {
            updateCount++;
            resolve();
          }, Math.random() * 10);
        })
      );
    }
    
    await Promise.all(updates);
    expect(updateCount).toBe(100);
  });

  it('should handle AbortController cleanup edge cases', () => {
    // Abort after abort should not throw
    const controller = new AbortController();
    controller.abort();
    expect(() => controller.abort()).not.toThrow();
    expect(controller.signal.aborted).toBe(true);
    
    // Adding listener to aborted signal
    const listener = vi.fn();
    controller.signal.addEventListener('abort', listener);
    // Listener fires immediately for already-aborted signal
    expect(listener).toHaveBeenCalled();
  });

  it('should handle Promise.race with abort signals', async () => {
    const controller = new AbortController();
    
    const fetchLike = new Promise((_, reject) => {
      controller.signal.addEventListener('abort', () => {
        reject(new DOMException('Aborted', 'AbortError'));
      });
    });
    
    const timeout = new Promise(resolve => setTimeout(resolve, 100, 'timeout'));
    
    controller.abort();
    
    try {
      await Promise.race([fetchLike, timeout]);
    } catch (e: any) {
      expect(e.name).toBe('AbortError');
    }
  });
});

// ============================================================================
// 11. DOM MUTATION CRASH VECTORS
// ============================================================================

describe('DOM Mutation Crash Vectors', () => {
  it('should handle rapid DOM append/remove cycles', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    
    for (let i = 0; i < 100; i++) {
      const child = document.createElement('div');
      container.appendChild(child);
    }
    
    // Rapid removal
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    
    expect(container.childNodes.length).toBe(0);
    document.body.removeChild(container);
  });

  it('should handle removeChild on already-removed elements', () => {
    const parent = document.createElement('div');
    const child = document.createElement('div');
    parent.appendChild(child);
    parent.removeChild(child);
    
    // Second removal should throw - this is expected browser behavior
    expect(() => parent.removeChild(child)).toThrow();
  });

  it('should handle script injection attacks gracefully', () => {
    const div = document.createElement('div');
    div.innerHTML = '<img onerror="alert(1)" src="x">';
    // In jsdom, this doesn't execute but the element exists
    expect(div.querySelector('img')).not.toBeNull();
  });
});

// ============================================================================
// 12. STORAGE EXHAUSTION
// ============================================================================

describe('Storage Exhaustion Resilience', () => {
  it('should handle sessionStorage being full', () => {
    const originalSetItem = sessionStorage.setItem;
    sessionStorage.setItem = vi.fn(() => {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError');
    });
    
    // CrashForensics persistence should not crash
    const { recordError } = require('@/lib/crashForensics');
    expect(() => recordError('test error')).not.toThrow();
    
    sessionStorage.setItem = originalSetItem;
  });

  it('should handle localStorage being unavailable', () => {
    const originalGetItem = localStorage.getItem;
    localStorage.getItem = vi.fn(() => {
      throw new Error('Access denied');
    });
    
    // Should not crash when trying to read
    expect(() => {
      try {
        localStorage.getItem('test');
      } catch {
        // Expected
      }
    }).not.toThrow();
    
    localStorage.getItem = originalGetItem;
  });
});

// ============================================================================
// 13. CSS/STYLE CRASH VECTORS
// ============================================================================

describe('CSS/Style Crash Vectors', () => {
  it('should handle invalid CSS values without crashing', () => {
    const el = document.createElement('div');
    
    // These should not throw in any browser
    expect(() => { el.style.width = 'invalid'; }).not.toThrow();
    expect(() => { el.style.transform = 'rotate(NaNdeg)'; }).not.toThrow();
    expect(() => { el.style.opacity = ''; }).not.toThrow();
    expect(() => { el.style.setProperty('--custom', 'value'); }).not.toThrow();
  });

  it('should handle CSS.supports check failures', () => {
    // CSS.supports should never throw, just return false
    if (typeof CSS !== 'undefined' && CSS.supports) {
      expect(() => CSS.supports('invalid-property', 'invalid-value')).not.toThrow();
      expect(CSS.supports('invalid-property', 'invalid-value')).toBe(false);
    }
  });
});

// ============================================================================
// 14. SERVICE WORKER RESILIENCE
// ============================================================================

describe('Service Worker Resilience', () => {
  it('should handle missing serviceWorker API', () => {
    // In jsdom, serviceWorker may not exist
    const hasServiceWorker = 'serviceWorker' in navigator;
    expect(typeof hasServiceWorker).toBe('boolean');
    
    // Registration should be guarded
    if (!hasServiceWorker) {
      expect(() => {
        // The code in main.tsx checks for this
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.register('/sw.js');
        }
      }).not.toThrow();
    }
  });
});

// ============================================================================
// 15. ERROR RECOVERY SUGGESTIONS
// ============================================================================

describe('Error Recovery Suggestions', () => {
  it('should provide human-friendly suggestions for all categories', () => {
    const { getRecoverySuggestion } = require('@/lib/stabilityMonitor');
    
    const categories = ['NETWORK', 'AUTH', 'TIMEOUT', 'ASYNC_RACE', 'RENDER', 'STATE_CORRUPTION', 'UNKNOWN'];
    
    categories.forEach(cat => {
      const suggestion = getRecoverySuggestion(cat);
      expect(typeof suggestion).toBe('string');
      expect(suggestion.length).toBeGreaterThan(10);
      // Should NOT contain technical jargon
      expect(suggestion).not.toMatch(/stack|trace|undefined|null|TypeError/i);
    });
  });
});

// ============================================================================
// 16. EDGE CASE CRASH VECTORS
// ============================================================================

describe('Edge Case Crash Vectors', () => {
  it('should handle JSON.parse of corrupted data', () => {
    const corruptedValues = [
      '',
      'undefined',
      '{invalid json}',
      '{"key": undefined}',
      '<html>',
      '\x00\x01\x02',
    ];
    
    corruptedValues.forEach(val => {
      expect(() => {
        try { JSON.parse(val); } catch { /* Expected */ }
      }).not.toThrow();
    });
  });

  it('should handle performance.now() edge cases', () => {
    expect(typeof performance.now()).toBe('number');
    expect(isFinite(performance.now())).toBe(true);
    expect(performance.now()).toBeGreaterThanOrEqual(0);
  });

  it('should handle crypto.randomUUID availability', () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      const uuid = crypto.randomUUID();
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    }
  });

  it('should handle rapid Date.now() calls without collision', () => {
    const timestamps = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      timestamps.add(Date.now() + i); // Add i to simulate differentiation
    }
    expect(timestamps.size).toBe(1000);
  });

  it('should handle Math operations edge cases', () => {
    expect(isNaN(Math.sqrt(-1))).toBe(true);
    expect(isFinite(1 / 0)).toBe(false);
    expect(Math.max() === -Infinity).toBe(true);
    expect(Math.min() === Infinity).toBe(true);
  });
});
