/**
 * NavigationCoordinator - World-Class Navigation System
 * 
 * Central coordinator for navigation lifecycle management.
 * Prevents crashes by:
 * 1. Locking navigation during transitions (prevents double-nav race conditions)
 * 2. Managing cleanup registry for route exit
 * 3. Coordinating video playback abort
 * 4. Providing safe navigation primitives
 * 5. Memory cleanup between routes
 */

type CleanupFunction = () => void | Promise<void>;
type NavigationPhase = 'idle' | 'preparing' | 'transitioning' | 'completing';

interface NavigationState {
  phase: NavigationPhase;
  fromRoute: string | null;
  toRoute: string | null;
  startTime: number;
  isLocked: boolean;
}

interface CoordinatorOptions {
  lockTimeoutMs?: number;
  cleanupTimeoutMs?: number;
  enableLogging?: boolean;
}

class NavigationCoordinatorImpl {
  private state: NavigationState = {
    phase: 'idle',
    fromRoute: null,
    toRoute: null,
    startTime: 0,
    isLocked: false,
  };

  private cleanupRegistry = new Map<string, Set<CleanupFunction>>();
  private globalCleanups = new Set<CleanupFunction>();
  private mediaElements = new WeakSet<HTMLMediaElement>();
  private activeAbortControllers = new Set<AbortController>();
  private listeners = new Set<(state: NavigationState) => void>();
  private lockTimeoutId: ReturnType<typeof setTimeout> | null = null;
  
  private options: Required<CoordinatorOptions> = {
    lockTimeoutMs: 3000,
    cleanupTimeoutMs: 1000,
    enableLogging: process.env.NODE_ENV === 'development',
  };

  constructor(options?: CoordinatorOptions) {
    if (options) {
      this.options = { ...this.options, ...options };
    }
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

  subscribe(listener: (state: NavigationState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
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
   */
  async beginNavigation(fromRoute: string, toRoute: string): Promise<boolean> {
    // SAFARI FIX: Allow same-route navigation (refresh/re-render)
    if (fromRoute === toRoute) {
      this.log('info', `Same-route navigation allowed: ${toRoute}`);
      return true;
    }
    
    // Prevent double-navigation to DIFFERENT routes
    if (this.state.isLocked) {
      // SAFARI FIX: Auto-unlock if locked for too long (Safari can get stuck)
      const lockAge = performance.now() - this.state.startTime;
      if (lockAge > 1500) {
        this.log('warn', `Stale navigation lock detected (${lockAge.toFixed(0)}ms), force unlocking`);
        this.forceUnlock();
      } else {
        this.log('warn', `Navigation locked, rejecting: ${fromRoute} → ${toRoute}`);
        return false;
      }
    }

    // Lock navigation
    this.state = {
      phase: 'preparing',
      fromRoute,
      toRoute,
      startTime: performance.now(),
      isLocked: true,
    };
    this.notifyListeners();

    // Set safety timeout to auto-unlock (reduced for Safari responsiveness)
    this.lockTimeoutId = setTimeout(() => {
      this.log('warn', 'Navigation lock timeout, force unlocking');
      this.forceUnlock();
    }, this.options.lockTimeoutMs);

    this.log('info', `Navigation started: ${fromRoute} → ${toRoute}`);

    // Run pre-navigation cleanup
    await this.runCleanups(fromRoute);

    // Abort all media playback
    this.abortAllMedia();

    // Abort all fetch requests
    this.abortAllRequests();

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
  completeNavigation(): void {
    // IDEMPOTENT GUARD: Only complete if we're actually navigating
    if (this.state.phase === 'idle' && !this.state.isLocked) {
      // Already idle - no-op to prevent duplicate logs
      return;
    }

    if (this.lockTimeoutId) {
      clearTimeout(this.lockTimeoutId);
      this.lockTimeoutId = null;
    }

    // Only log duration if we have a valid startTime (navigation was actually started)
    if (this.state.startTime > 0) {
      const duration = performance.now() - this.state.startTime;
      this.log('info', `Navigation completed in ${duration.toFixed(0)}ms`);
    }

    this.state = {
      phase: 'idle',
      fromRoute: null,
      toRoute: null,
      startTime: 0,
      isLocked: false,
    };
    this.notifyListeners();
  }

  /**
   * Force unlock navigation (emergency recovery)
   */
  forceUnlock(): void {
    if (this.lockTimeoutId) {
      clearTimeout(this.lockTimeoutId);
      this.lockTimeoutId = null;
    }

    this.state = {
      ...this.state,
      phase: 'idle',
      isLocked: false,
    };
    this.notifyListeners();
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
   * Run all cleanups for a route
   */
  private async runCleanups(routePath: string): Promise<void> {
    const routeCleanups = this.cleanupRegistry.get(routePath) || new Set();
    const allCleanups = [...routeCleanups, ...this.globalCleanups];

    if (allCleanups.length === 0) return;

    this.log('info', `Running ${allCleanups.length} cleanup(s) for ${routePath}`);

    // Run cleanups with timeout protection
    const cleanupPromises = allCleanups.map(async (cleanup) => {
      try {
        const result = cleanup();
        if (result instanceof Promise) {
          await Promise.race([
            result,
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Cleanup timeout')), this.options.cleanupTimeoutMs)
            ),
          ]);
        }
      } catch (err) {
        this.log('warn', 'Cleanup error:', err);
      }
    });

    await Promise.allSettled(cleanupPromises);

    // Clear route-specific cleanups after running
    this.cleanupRegistry.delete(routePath);
  }

  // ============= Media Management =============

  /**
   * Register a media element for automatic cleanup
   */
  registerMediaElement(element: HTMLMediaElement): void {
    this.mediaElements.add(element);
  }

  /**
   * Abort all registered media playback
   */
  abortAllMedia(): void {
    // Query all video/audio elements in the document
    const mediaElements = document.querySelectorAll('video, audio');
    
    mediaElements.forEach((el) => {
      const media = el as HTMLMediaElement;
      try {
        // Pause playback
        if (!media.paused) {
          media.pause();
        }
        // Reset source to stop buffering
        media.src = '';
        media.load();
      } catch {
        // Ignore errors on destroyed elements
      }
    });

    this.log('info', `Aborted ${mediaElements.length} media element(s)`);
  }

  // ============= AbortController Management =============

  /**
   * Create a managed AbortController that will be aborted on navigation
   */
  createAbortController(): AbortController {
    const controller = new AbortController();
    this.activeAbortControllers.add(controller);

    // Auto-remove when aborted
    controller.signal.addEventListener('abort', () => {
      this.activeAbortControllers.delete(controller);
    });

    return controller;
  }

  /**
   * Abort all active fetch requests
   */
  abortAllRequests(): void {
    const count = this.activeAbortControllers.size;
    this.activeAbortControllers.forEach(controller => {
      try {
        controller.abort();
      } catch {
        // Ignore
      }
    });
    this.activeAbortControllers.clear();

    if (count > 0) {
      this.log('info', `Aborted ${count} request(s)`);
    }
  }

  // ============= Memory Cleanup =============

  /**
   * Run garbage collection hints
   */
  triggerGC(): void {
    // Revoke any lingering blob URLs
    if (typeof URL.revokeObjectURL === 'function') {
      // Note: We'd need to track blob URLs to revoke them
      // This is a placeholder for integration with memoryManager
    }

    // Force layout recalculation to release references
    document.body.offsetHeight;

    this.log('info', 'GC hint triggered');
  }
}

// Singleton instance
export const navigationCoordinator = new NavigationCoordinatorImpl();

// Export class for testing
export { NavigationCoordinatorImpl };
export type { NavigationState, CleanupFunction, NavigationPhase, CoordinatorOptions };
