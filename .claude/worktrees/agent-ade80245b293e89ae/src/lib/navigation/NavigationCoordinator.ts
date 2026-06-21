/**
 * NavigationCoordinator - World-Class Navigation System v2.0
 * 
 * Central coordinator for navigation lifecycle management.
 * Prevents crashes by:
 * 1. Locking navigation during transitions (prevents double-nav race conditions)
 * 2. Managing cleanup registry for route exit
 * 3. Coordinating video playback abort
 * 4. Providing safe navigation primitives
 * 5. Memory cleanup between routes (integrated with memoryManager)
 * 6. BFCache handling for Safari
 * 7. Navigation queue for rapid navigation handling
 */

import { blobUrlTracker, cleanupVideoElement, cleanupAudioElement } from '@/lib/memoryManager';

type CleanupFunction = () => void | Promise<void>;
type NavigationPhase = 'idle' | 'preparing' | 'transitioning' | 'completing';

interface NavigationState {
  phase: NavigationPhase;
  fromRoute: string | null;
  toRoute: string | null;
  startTime: number;
  isLocked: boolean;
  completionSource: string | null; // Track who triggered completion for debugging
}

interface CoordinatorOptions {
  lockTimeoutMs?: number;
  cleanupTimeoutMs?: number;
  enableLogging?: boolean;
  maxListeners?: number;
  maxQueueSize?: number;
}

interface CleanupSummary {
  totalCleanups: number;
  successfulCleanups: number;
  failedCleanups: number;
  timedOutCleanups: number;
  errors: string[];
}

interface NavigationQueueItem {
  fromRoute: string;
  toRoute: string;
  timestamp: number;
  resolve: (canNavigate: boolean) => void;
}

class NavigationCoordinatorImpl {
  private state: NavigationState = {
    phase: 'idle',
    fromRoute: null,
    toRoute: null,
    startTime: 0,
    isLocked: false,
    completionSource: null,
  };

  // Guard against competing completion calls
  private completionInProgress = false;
  private lastCompletionTime = 0;
  private static readonly COMPLETION_DEBOUNCE_MS = 50;

  private cleanupRegistry = new Map<string, Set<CleanupFunction>>();
  private globalCleanups = new Set<CleanupFunction>();
  private registeredMediaElements = new Set<HTMLMediaElement>(); // Changed from WeakSet to Set for iteration
  private activeAbortControllers = new Set<AbortController>();
  private listeners = new Set<(state: NavigationState) => void>();
  private lockTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private navigationQueue: NavigationQueueItem[] = [];
  private isProcessingQueue = false;
  private bfcacheHandlersRegistered = false;
  
  // Metrics for performance tracking
  private metrics = {
    totalNavigations: 0,
    averageNavigationTime: 0,
    totalCleanupTime: 0,
    abortedRequests: 0,
    cleanupErrors: 0,
  };
  
  private options: Required<CoordinatorOptions> = {
    lockTimeoutMs: 4000, // FIX: Increased from 3000ms to allow complex page transitions
    cleanupTimeoutMs: 1500, // FIX: Increased from 1000ms for heavy cleanup operations
    enableLogging: process.env.NODE_ENV === 'development',
    maxListeners: 50,
    maxQueueSize: 5,
  };

  constructor(options?: CoordinatorOptions) {
    if (options) {
      this.options = { ...this.options, ...options };
    }
    
    // Register BFCache handlers for Safari
    this.registerBFCacheHandlers();
  }

  // ============= BFCache Handling (Safari) =============

  /**
   * Register handlers for Safari's Back/Forward Cache.
   * Prevents stale state when user navigates back.
   */
  private registerBFCacheHandlers(): void {
    if (this.bfcacheHandlersRegistered || typeof window === 'undefined') return;
    
    // pageshow fires when page is restored from BFCache
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) {
        // Page was restored from BFCache - reset coordinator state
        // FIX: Only call forceUnlock which already does full state reset
        this.log('info', 'Page restored from BFCache, resetting state');
        this.forceUnlock('bfcache');
      }
    });
    
    // pagehide fires when page might enter BFCache
    window.addEventListener('pagehide', () => {
      // Clean up before potentially entering BFCache
      this.abortAllRequests();
      this.abortAllMedia();
    });
    
    this.bfcacheHandlersRegistered = true;
    this.log('info', 'BFCache handlers registered');
  }

  // ============= State Management =============

  getState(): Readonly<NavigationState> {
    return { ...this.state };
  }

  isNavigating(): boolean {
    return this.state.phase !== 'idle';
  }

  isLocked(): boolean {
    return this.state.isLocked;
  }
  
  getMetrics(): Readonly<typeof this.metrics> {
    return { ...this.metrics };
  }

  subscribe(listener: (state: NavigationState) => void): () => void {
    // Guard against too many listeners (memory leak protection)
    if (this.listeners.size >= this.options.maxListeners) {
      this.log('warn', `Max listeners (${this.options.maxListeners}) reached. Possible memory leak.`);
      // Remove oldest listeners to make room (FIFO cleanup)
      const iterator = this.listeners.values();
      const oldest = iterator.next().value;
      if (oldest) {
        this.listeners.delete(oldest);
        this.log('info', 'Evicted oldest listener to prevent unbounded growth');
      }
    }
    
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  getListenerCount(): number {
    return this.listeners.size;
  }

  private notifyListeners(): void {
    const snapshot = this.getState();
    this.listeners.forEach(listener => {
      try {
        listener(snapshot);
      } catch (err) {
        this.log('warn', 'Listener error:', err);
      }
    });
  }

  private log(level: 'info' | 'warn' | 'error', ...args: unknown[]): void {
    if (!this.options.enableLogging) return;
    const prefix = `[NavigationCoordinator]`;
    switch (level) {
      case 'info':
        console.log(prefix, ...args);
        break;
      case 'warn':
        console.warn(prefix, ...args);
        break;
      case 'error':
        console.error(prefix, ...args);
        break;
    }
  }

  // ============= Navigation Lifecycle =============

  /**
   * Begin navigation transition. Returns false if navigation is locked.
   * Uses queue system for rapid navigation handling.
   * 
   * FIX: Added duplicate navigation detection to prevent double-trigger crashes
   */
  async beginNavigation(fromRoute: string, toRoute: string): Promise<boolean> {
    // SAFARI FIX: Allow same-route navigation (refresh/re-render)
    if (fromRoute === toRoute) {
      this.log('info', `Same-route navigation allowed: ${toRoute}`);
      return true;
    }
    
    // FIX: Detect duplicate navigation attempts to the same target
    // This prevents the double-navigation race condition seen in logs
    if (this.state.isLocked && this.state.toRoute === toRoute) {
      this.log('info', `Duplicate navigation to ${toRoute} detected, returning existing lock`);
      return true; // Allow - already navigating there
    }
    
    // If locked, queue navigation instead of rejecting immediately
    if (this.state.isLocked) {
      // Check for stale lock - increased threshold for complex pages
      const lockAge = performance.now() - this.state.startTime;
      if (lockAge > 2000) { // FIX: Increased from 1500ms to 2000ms for complex pages
        this.log('warn', `Stale navigation lock detected (${lockAge.toFixed(0)}ms), force unlocking`);
        this.forceUnlock();
      } else {
        // FIX: Check if already queued to same destination
        const alreadyQueued = this.navigationQueue.some(q => q.toRoute === toRoute);
        if (alreadyQueued) {
          this.log('info', `Navigation to ${toRoute} already queued, skipping duplicate`);
          return true;
        }
        // Queue this navigation request
        return this.queueNavigation(fromRoute, toRoute);
      }
    }

    return this.executeNavigation(fromRoute, toRoute);
  }
  
  /**
   * Queue a navigation request for when current navigation completes.
   */
  private queueNavigation(fromRoute: string, toRoute: string): Promise<boolean> {
    return new Promise((resolve) => {
      // Limit queue size to prevent memory issues
      if (this.navigationQueue.length >= this.options.maxQueueSize) {
        // Remove oldest queued item and reject it
        const dropped = this.navigationQueue.shift();
        if (dropped) {
          this.log('info', `Queue full, dropping navigation to: ${dropped.toRoute}`);
          dropped.resolve(false);
        }
      }
      
      this.navigationQueue.push({
        fromRoute,
        toRoute,
        timestamp: performance.now(),
        resolve,
      });
      
      this.log('info', `Navigation queued: ${fromRoute} → ${toRoute} (queue size: ${this.navigationQueue.length})`);
    });
  }
  
  /**
   * Process next item in navigation queue.
   * FIX: Use setTimeout to prevent recursive stack overflow
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.state.isLocked) return;
    
    const nextNav = this.navigationQueue.shift();
    if (!nextNav) return;
    
    this.isProcessingQueue = true;
    
    try {
      // Check if this queued navigation is still valid (not too old)
      const age = performance.now() - nextNav.timestamp;
      if (age > 5000) {
        this.log('warn', `Queued navigation expired (${age.toFixed(0)}ms old): ${nextNav.toRoute}`);
        nextNav.resolve(false);
        return;
      }
      
      const canNavigate = await this.executeNavigation(nextNav.fromRoute, nextNav.toRoute);
      nextNav.resolve(canNavigate);
    } finally {
      this.isProcessingQueue = false;
      
      // FIX: Use setTimeout to break the call stack and prevent recursion
      if (this.navigationQueue.length > 0) {
        setTimeout(() => this.processQueue(), 0);
      }
    }
  }
  
  /**
   * Execute the actual navigation (internal).
   */
  private async executeNavigation(fromRoute: string, toRoute: string): Promise<boolean> {
    // Lock navigation
    this.state = {
      phase: 'preparing',
      fromRoute,
      toRoute,
      startTime: performance.now(),
      isLocked: true,
      completionSource: null,
    };
    this.notifyListeners();
    this.metrics.totalNavigations++;

    // Set safety timeout to auto-unlock (reduced for Safari responsiveness)
    this.lockTimeoutId = setTimeout(() => {
      this.log('warn', 'Navigation lock timeout, force unlocking');
      this.forceUnlock();
    }, this.options.lockTimeoutMs);

    this.log('info', `Navigation started: ${fromRoute} → ${toRoute}`);

    // Run pre-navigation cleanup with summary
    const cleanupSummary = await this.runCleanups(fromRoute);
    if (cleanupSummary.failedCleanups > 0) {
      this.log('warn', `Cleanup summary: ${cleanupSummary.successfulCleanups}/${cleanupSummary.totalCleanups} succeeded, ${cleanupSummary.failedCleanups} failed`);
      if (cleanupSummary.errors.length > 0) {
        this.log('warn', 'Cleanup errors:', cleanupSummary.errors.slice(0, 3).join('; '));
      }
    }

    // Abort all media playback (using registered elements + DOM query)
    this.abortAllMedia();

    // Abort all fetch requests
    const abortedCount = this.abortAllRequests();
    this.metrics.abortedRequests += abortedCount;

    // Transition phase
    this.state.phase = 'transitioning';
    this.notifyListeners();

    return true;
  }

  /**
   * Complete navigation transition (IDEMPOTENT)
   * Only logs and resets if there's an active navigation to complete.
   * Prevents duplicate completion calls from accumulating phantom times.
   */
  completeNavigation(source: string = 'unknown'): void {
    // DEBOUNCE: Prevent competing completion calls within 50ms
    const now = performance.now();
    if (now - this.lastCompletionTime < NavigationCoordinatorImpl.COMPLETION_DEBOUNCE_MS) {
      this.log('info', `Debounced duplicate completion from: ${source}`);
      return;
    }

    // IDEMPOTENT GUARD: Only complete if we're actually navigating
    if (this.state.phase === 'idle' && !this.state.isLocked) {
      // Already idle - no-op to prevent duplicate logs
      return;
    }

    // GUARD: Prevent re-entry from competing hooks
    if (this.completionInProgress) {
      this.log('info', `Completion already in progress, ignoring call from: ${source}`);
      return;
    }

    this.completionInProgress = true;
    this.lastCompletionTime = now;

    if (this.lockTimeoutId) {
      clearTimeout(this.lockTimeoutId);
      this.lockTimeoutId = null;
    }

    // Only log duration if we have a valid startTime (navigation was actually started)
    if (this.state.startTime > 0) {
      const duration = performance.now() - this.state.startTime;
      this.log('info', `Navigation completed in ${duration.toFixed(0)}ms`);
      
      // FIX: Guard against division by zero
      if (this.metrics.totalNavigations > 0) {
        this.metrics.averageNavigationTime = 
          (this.metrics.averageNavigationTime * (this.metrics.totalNavigations - 1) + duration) / 
          this.metrics.totalNavigations;
      }
    }

    this.state = {
      phase: 'idle',
      fromRoute: null,
      toRoute: null,
      startTime: 0,
      isLocked: false,
      completionSource: source,
    };
    this.notifyListeners();
    
    // Release completion guard after state update
    this.completionInProgress = false;
    
    // Process queued navigations
    this.processQueue();
  }

  /**
   * Force unlock navigation (emergency recovery)
   * FIX: Now fully resets state including fromRoute/toRoute to prevent stale data
   */
  forceUnlock(source: string = 'unknown'): void {
    this.log('info', `Force unlock from: ${source}`);
    
    if (this.lockTimeoutId) {
      clearTimeout(this.lockTimeoutId);
      this.lockTimeoutId = null;
    }

    // Reset completion guard on force unlock
    this.completionInProgress = false;

    // FIX: Full state reset, not partial spread
    this.state = {
      phase: 'idle',
      fromRoute: null,
      toRoute: null,
      startTime: 0,
      isLocked: false,
      completionSource: `force:${source}`,
    };
    this.notifyListeners();
    
    // Process queued navigations after force unlock
    this.processQueue();
  }

  // ============= Cleanup Registry =============

  /**
   * Register a cleanup function for a specific route
   */
  registerCleanup(routePath: string, cleanup: CleanupFunction): () => void {
    if (!this.cleanupRegistry.has(routePath)) {
      this.cleanupRegistry.set(routePath, new Set());
    }
    this.cleanupRegistry.get(routePath)!.add(cleanup);

    // Return unregister function
    return () => {
      const routeCleanups = this.cleanupRegistry.get(routePath);
      if (routeCleanups) {
        routeCleanups.delete(cleanup);
        if (routeCleanups.size === 0) {
          this.cleanupRegistry.delete(routePath);
        }
      }
    };
  }

  /**
   * Register a global cleanup that runs on every navigation
   */
  registerGlobalCleanup(cleanup: CleanupFunction): () => void {
    this.globalCleanups.add(cleanup);
    return () => this.globalCleanups.delete(cleanup);
  }

  /**
   * Run all cleanups for a route with aggregated summary
   * FIX: Corrected async handling to properly await cleanup promises
   */
  private async runCleanups(routePath: string): Promise<CleanupSummary> {
    const routeCleanups = this.cleanupRegistry.get(routePath) || new Set();
    const allCleanups = [...routeCleanups, ...this.globalCleanups];

    const summary: CleanupSummary = {
      totalCleanups: allCleanups.length,
      successfulCleanups: 0,
      failedCleanups: 0,
      timedOutCleanups: 0,
      errors: [],
    };

    if (allCleanups.length === 0) return summary;

    this.log('info', `Running ${allCleanups.length} cleanup(s) for ${routePath}`);
    const cleanupStartTime = performance.now();

    // FIX: Return proper promises from map for Promise.allSettled to await
    const cleanupPromises = allCleanups.map((cleanup): Promise<void> => {
      return new Promise((resolve) => {
        try {
          const result = cleanup();
          if (result instanceof Promise) {
            Promise.race([
              result.then(() => 'success' as const),
              new Promise<'timeout'>((r) => 
                setTimeout(() => r('timeout'), this.options.cleanupTimeoutMs)
              ),
            ]).then((outcome) => {
              if (outcome === 'timeout') {
                summary.timedOutCleanups++;
                summary.failedCleanups++;
                summary.errors.push('Cleanup timed out');
              } else {
                summary.successfulCleanups++;
              }
              resolve();
            }).catch((err) => {
              summary.failedCleanups++;
              this.metrics.cleanupErrors++;
              summary.errors.push(err instanceof Error ? err.message : String(err));
              resolve();
            });
          } else {
            summary.successfulCleanups++;
            resolve();
          }
        } catch (err) {
          summary.failedCleanups++;
          this.metrics.cleanupErrors++;
          const errorMsg = err instanceof Error ? err.message : String(err);
          summary.errors.push(errorMsg);
          this.log('warn', 'Cleanup error:', errorMsg);
          resolve();
        }
      });
    });

    await Promise.allSettled(cleanupPromises);

    // Track cleanup time
    const cleanupDuration = performance.now() - cleanupStartTime;
    this.metrics.totalCleanupTime += cleanupDuration;

    // Clear route-specific cleanups after running
    this.cleanupRegistry.delete(routePath);

    return summary;
  }

  // ============= Media Management =============

  /**
   * Register a media element for automatic cleanup
   * FIX: Simplified to avoid MutationObserver + setInterval leaks
   */
  registerMediaElement(element: HTMLMediaElement): void {
    if (!element || !element.isConnected) return;
    
    this.registeredMediaElements.add(element);
    
    // Use a single cleanup mechanism: check on navigation only
    // The element will be cleaned up when abortAllMedia() is called
    // No need for continuous polling or observers - they leak
  }

  /**
   * Abort all registered media playback
   * FIX: Collect elements to remove first, then process - avoids mutation during iteration
   */
  abortAllMedia(): void {
    let abortedCount = 0;
    
    // FIX: Collect elements to process first to avoid mutation during iteration
    const elementsToProcess = Array.from(this.registeredMediaElements);
    
    elementsToProcess.forEach((media) => {
      try {
        // Only process if element is still connected to DOM
        if (!media.isConnected) {
          return;
        }
        
        if (!media.paused) {
          media.pause();
        }
        if (media instanceof HTMLVideoElement) {
          cleanupVideoElement(media);
        } else if (media instanceof HTMLAudioElement) {
          cleanupAudioElement(media);
        }
        abortedCount++;
      } catch {
        // Element may be destroyed - ignore
      }
    });
    
    // Clear set after processing
    this.registeredMediaElements.clear();

    if (abortedCount > 0) {
      this.log('info', `Aborted ${abortedCount} media element(s)`);
    }
  }

  // ============= AbortController Management =============

  /**
   * Create a managed AbortController that will be aborted on navigation
   * FIX: Added WeakRef-style cleanup to prevent accumulation of unused controllers
   */
  createAbortController(): AbortController {
    const controller = new AbortController();
    this.activeAbortControllers.add(controller);

    // Auto-remove when aborted
    controller.signal.addEventListener('abort', () => {
      this.activeAbortControllers.delete(controller);
    }, { once: true });

    // FIX: Periodic cleanup of stale controllers (those that were created but never used)
    // Only keep this check lightweight - runs once per controller creation
    if (this.activeAbortControllers.size > 20) {
      // Clean up any already-aborted controllers that might have slipped through
      this.activeAbortControllers.forEach(ctrl => {
        if (ctrl.signal.aborted) {
          this.activeAbortControllers.delete(ctrl);
        }
      });
    }

    return controller;
  }

  /**
   * Abort all active fetch requests. Returns count of aborted requests.
   */
  abortAllRequests(): number {
    const count = this.activeAbortControllers.size;
    this.activeAbortControllers.forEach(controller => {
      try {
        if (!controller.signal.aborted) {
          controller.abort();
        }
      } catch {
        // Ignore
      }
    });
    this.activeAbortControllers.clear();

    if (count > 0) {
      this.log('info', `Aborted ${count} request(s)`);
    }
    
    return count;
  }

  // ============= Memory Cleanup =============

  /**
   * Run garbage collection hints - now integrated with memoryManager
   */
  triggerGC(): void {
    // Revoke blob URLs via memoryManager
    const blobCount = blobUrlTracker.getCount();
    if (blobCount > 0) {
      this.log('info', `Revoking ${blobCount} tracked blob URL(s)`);
      blobUrlTracker.revokeAll();
    }

    // Force layout recalculation to release references
    if (typeof document !== 'undefined') {
      // Read to trigger recalc
      void document.body.offsetHeight;
    }

    this.log('info', 'GC hint triggered');
  }
  
  /**
   * Clean up resources for a specific component
   */
  cleanupComponent(componentId: string): void {
    blobUrlTracker.revokeForComponent(componentId);
  }
}

// Singleton instance
export const navigationCoordinator = new NavigationCoordinatorImpl();

// Export class for testing
export { NavigationCoordinatorImpl };
export type { NavigationState, CleanupFunction, NavigationPhase, CoordinatorOptions, CleanupSummary };
