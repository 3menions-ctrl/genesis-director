import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import App from "./App.tsx";
import "./index.css";
// Initialize i18n (must run before any component renders)
import "./i18n";
// Console shield — must be imported early to intercept all logs
import { installConsoleShield } from "./lib/consoleShield";
import { stabilityMonitor, shouldSuppressError } from "./lib/stabilityMonitor";
import { initializeDiagnostics, setStateSnapshotProvider, getCurrentSnapshot } from "./lib/diagnostics";
// Initialize cross-browser compatibility layer
import { injectBrowserFixes, browserInfo } from "./lib/browserCompat";
import { bootTheme } from "./lib/theme";
import { installRoutePrefetcher, registerPrefetch } from "./lib/routePreload";
// ChunkLoadError recovery system
import { 
  installChunkErrorInterceptor, 
  setupHMRRecovery, 
  isChunkLoadError,
  clearRecoveryState 
} from "./lib/chunkLoadRecovery";
// Safe Mode - MUST be imported before any heavy components
import { 
  getSafeModeStatus, 
  installSafeModeInterceptors,
  getSafeModeConfig 
} from "./lib/safeMode";

// ============= PHASE 0: OBSERVABILITY + CONSOLE SHIELD (FIRST!) =============
// Observability boot is first so Sentry's beforeSend can capture any
// error from the boot sequence below. PII scrubber strips emails / phones
// / JWTs before events leave the browser.
import { bootObservability } from "./lib/observability";
bootObservability();
// PostHog product analytics backbone (no-op until VITE_POSTHOG_KEY is set).
import { initPostHog } from "./admin/analytics/posthog";
initPostHog();
// Must run before any other code that might log sensitive data
const cleanupConsoleShield = installConsoleShield();

// ============= PHASE 1: SAFE MODE DETECTION =============
// This must happen before ANYTHING else
const SAFE_MODE = getSafeModeStatus();
const safeModeConfig = getSafeModeConfig();

if (SAFE_MODE) {
  console.warn('[SAFE MODE] ⚠️ Safe Mode is ACTIVE - heavy features disabled');
  console.info('[SAFE MODE] Disabled features:', safeModeConfig);
  // Install interceptors to block polling/timers
  installSafeModeInterceptors();
}

// Apply browser-specific fixes immediately
injectBrowserFixes();
// Boot theme (Dailies / Production Day) from localStorage
bootTheme();

// ── Anticipatory route prefetching — register the heavy / common routes
// so they begin downloading on hover. The list is small on purpose; we
// only want to fire prefetch for routes a user is *very likely* to hit.
installRoutePrefetcher();
registerPrefetch('/library',    () => import('./pages/Library'));
registerPrefetch('/studio',     () => import('./pages/Studio'));
registerPrefetch('/templates',  () => import('./pages/Templates'));
registerPrefetch('/avatars',    () => import('./pages/Avatars'));
registerPrefetch('/pricing',    () => import('./pages/Pricing'));
registerPrefetch('/settings',   () => import('./pages/Settings'));
registerPrefetch('/profile',    () => import('./pages/Profile'));
// Inbox absorbed both /messages and /notifications. Prefetch the
// unified surface so deep links still warm the right chunk.
registerPrefetch('/inbox',      () => import('./pages/Inbox'));

// Install chunk error recovery FIRST (before any errors can occur)
const cleanupChunkRecovery = installChunkErrorInterceptor();
setupHMRRecovery();

// Log browser info for debugging
if (process.env.NODE_ENV === 'development') {
  console.info('[BrowserCompat] Detected:', browserInfo.name, 'v' + browserInfo.version, {
    mobile: browserInfo.isMobile,
    iOS: browserInfo.isIOS,
    safari: browserInfo.isSafari,
    safeMode: SAFE_MODE
  });
}

// Track error count to prevent infinite crash loops
let errorCount = 0;
const ERROR_THRESHOLD = 10;
const ERROR_RESET_INTERVAL = 30000; // 30 seconds

// Store interval ID for cleanup during HMR
let errorResetInterval: ReturnType<typeof setInterval> | null = null;

// Error patterns that should NOT crash the app or show toasts
// FIX: TIGHTENED list - only specific, unambiguous non-fatal errors
// Removed overly broad patterns that masked real crashes
const SUPPRESSED_ERROR_PATTERNS = [
  // ResizeObserver - browser quirk, never a real crash
  'ResizeObserver loop',
  'ResizeObserver loop completed',
  
  // ChunkLoadError - handled by recovery system
  'ChunkLoadError',
  'Loading chunk',
  'Importing a module script failed',
  'error loading dynamically imported module',
  'Failed to fetch dynamically imported module',
  
  // AbortController - expected during navigation
  'AbortError',
  'The operation was aborted',
  'signal is aborted',
  'DOMException: The user aborted a request',
  
  // Video/audio playback interruptions - harmless
  'play() request was interrupted',
  'The play() request was interrupted',
  'NotAllowedError: play()',
  'DOMException: play() failed',
  
  // React state updates on unmounted - warning, not crash
  "Can't perform a React state update on an unmounted component",
  'state update on an unmounted',
  
  // HMR/Vite development
  'Vite HMR',
  
  // Safari BFCache restoration
  'A problem repeatedly occurred',
  
  // NOTE: 'Failed to fetch', 'NetworkError', 'Unexpected token', 'Load failed'
  // were REMOVED from this list. These are real errors that users need to see
  // (via toast) so they know something went wrong. Suppressing them caused
  // silent failures where API calls failed with zero feedback.
];

// ============= CONSOLE INTERCEPTION (MINIMAL) =============
// Only suppress React dev-mode warnings that are non-fatal and noise
// Most ref issues have been fixed architecturally - this is just cleanup

const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// Minimal suppression - only truly non-actionable React dev warnings
const MINIMAL_SUPPRESSED_PATTERNS = [
  // These are React StrictMode double-render warnings - not bugs
  'Each child in a list should have a unique',
  // StrictMode double-invocation warnings
  'was already mounted',
  // STABILITY FIX: Style property conflicts during animation - cosmetic warning only
  'shorthand and non-shorthand properties',
  'style property during rerender',
  'conflicting property is set',
  // STABILITY FIX: Framer-motion ref warnings during animation - handled gracefully
  'ref-forwarding component',
];

const shouldSuppressConsoleMessage = (args: unknown[]): boolean => {
  const message = args.map(arg => 
    typeof arg === 'string' ? arg : arg instanceof Error ? arg.message : String(arg)
  ).join(' ');
  
  return MINIMAL_SUPPRESSED_PATTERNS.some(pattern => 
    message.includes(pattern)
  );
};

// Override console.error with minimal suppression
console.error = (...args: unknown[]) => {
  if (shouldSuppressConsoleMessage(args)) {
    return;
  }
  originalConsoleError.apply(console, args);
};

// Override console.warn with minimal suppression
console.warn = (...args: unknown[]) => {
  if (shouldSuppressConsoleMessage(args)) {
    return;
  }
  originalConsoleWarn.apply(console, args);
};

// Clean up console overrides on HMR to prevent stacking
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  });
}

// Check if error should be suppressed
const shouldSuppressGlobalError = (error: unknown): boolean => {
  if (!error) return true;
  
  // CRITICAL: Always suppress ChunkLoadErrors - handled by recovery system
  if (isChunkLoadError(error)) {
    console.debug('[Global] ChunkLoadError suppressed - recovery system handling');
    return true;
  }
  
  const errorMessage = error instanceof Error 
    ? error.message 
    : typeof error === 'string' 
      ? error 
      : String(error);
  
  return SUPPRESSED_ERROR_PATTERNS.some(pattern => 
    errorMessage.toLowerCase().includes(pattern.toLowerCase())
  );
};

// Clear existing interval before creating new one (prevents HMR stacking)
if (errorResetInterval) {
  clearInterval(errorResetInterval);
}

// Reset error count periodically
errorResetInterval = setInterval(() => {
  errorCount = 0;
}, ERROR_RESET_INTERVAL);

// Clean up on HMR module replacement
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (errorResetInterval) {
      clearInterval(errorResetInterval);
      errorResetInterval = null;
    }
  });
}

// Global error handler with stability monitoring
window.addEventListener("error", (event) => {
  // Check if error should be suppressed first
  if (shouldSuppressGlobalError(event.error) || shouldSuppressError(event.error)) {
    event.preventDefault();
    return;
  }

  // Prevent infinite crash loops
  errorCount++;
  if (errorCount > ERROR_THRESHOLD) {
    console.warn('[Global] Too many errors, suppressing further error handling');
    event.preventDefault();
    return;
  }
  
  const stabilityEvent = stabilityMonitor.handle(event.error, 'Global Error', {
    showToast: true,
  });
  
  // Log for debugging
  if (stabilityEvent) {
    console.error("[Global Error]", stabilityEvent.category, event.error);
  }
  
  // NOTE: Only suppress known-safe errors via the check above.
  // Real errors must propagate so they appear in console for debugging.
  // Removed blanket event.preventDefault() that was hiding all errors.
});

// Global promise rejection handler with stability monitoring
window.addEventListener("unhandledrejection", (event) => {
  // Check if error should be suppressed first
  if (shouldSuppressGlobalError(event.reason) || shouldSuppressError(event.reason)) {
    event.preventDefault();
    return;
  }

  // Prevent infinite crash loops
  errorCount++;
  if (errorCount > ERROR_THRESHOLD) {
    console.warn('[Global] Too many rejections, suppressing further error handling');
    event.preventDefault();
    return;
  }
  
  const stabilityEvent = stabilityMonitor.handle(event.reason, 'Async Error', {
    showToast: true,
  });
  
  // Log for debugging
  if (stabilityEvent) {
    console.error("[Unhandled Rejection]", stabilityEvent.category, event.reason);
  }
  
  // NOTE: Only suppress known-safe rejections (handled above).
  // Real unhandled rejections should propagate to console for debugging.
});

// Register service worker for PWA — production only.
// In dev there is no real /sw.js (vite-plugin-pwa skips it), so registering
// would either fail or, worse, leave a stale SW from a prior prod visit
// active — which then serves dead cached chunks and strands the UI on the
// Suspense spinner. So in dev we actively unregister + purge caches.
if ("serviceWorker" in navigator) {
  if (import.meta.env.PROD) {
    // Auto-reload onto a fresh deploy (audit D42). registerType:"autoUpdate"
    // regenerates + activates a new SW, but nothing reloaded the PAGE, so an
    // installed PWA / open tab kept running the OLD cached bundle until a manual
    // refresh — the recurring "stale version" symptom. When a new SW takes
    // control we reload, but ONLY if this page already had a controller (a real
    // UPDATE) so the first-install claim doesn't bounce a fresh visit.
    const hadController = !!navigator.serviceWorker.controller;
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing || !hadController) return;
      refreshing = true;
      window.location.reload();
    });
    window.addEventListener("load", () => {
      // updateViaCache:"none" forces the browser to BYPASS the HTTP cache when
      // fetching /sw.js on every update check. Without it the browser may reuse a
      // cached sw.js (heuristically up to 24h) and never notice a new deploy —
      // the root cause of the recurring "I still see the old version" symptom.
      // With it, reg.update() reliably detects new deploys; skipWaiting +
      // clientsClaim (in the generated SW) then activate it and the
      // controllerchange handler above reloads the page onto the fresh bundle.
      navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).then((reg) => {
        // Proactively pull a newer SW on load and every few minutes so a deploy
        // is picked up without waiting for the next cold start.
        reg.update().catch(() => {});
        setInterval(() => reg.update().catch(() => {}), 60 * 1000);
      }).catch(() => {
        // Service worker registration failed - app still works
      });
    });
  } else {
    navigator.serviceWorker.getRegistrations()
      .then((regs) => {
        if (regs.length) {
          console.warn('[Dev] Unregistering', regs.length, 'stale service worker(s)');
        }
        return Promise.all(regs.map((r) => r.unregister()));
      })
      .then(() => {
        if ("caches" in window) {
          return caches.keys().then((keys) =>
            Promise.all(keys.map((k) => caches.delete(k)))
          );
        }
      })
      .catch(() => {
        // Best-effort cleanup; never block boot on this.
      });
  }
}

// Initialize diagnostics in development mode
let cleanupDiagnostics: (() => void) | null = null;

if (process.env.NODE_ENV === 'development') {
  cleanupDiagnostics = initializeDiagnostics();
  setStateSnapshotProvider(getCurrentSnapshot);
}

// Clean up diagnostics, chunk recovery, and console shield on HMR
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (cleanupDiagnostics) {
      cleanupDiagnostics();
    }
    if (cleanupChunkRecovery) {
      cleanupChunkRecovery();
    }
    cleanupConsoleShield();
    // Clear chunk recovery state on HMR success
    clearRecoveryState();
  });
}

// Security warning is now handled by consoleShield — no duplicate needed

// Log boot status
console.info('[Boot] Starting React render...', { safeMode: SAFE_MODE });

// StrictMode double-invokes effects + renders to catch concurrency
// bugs — invaluable for correctness, but it doubles every
// provider's mount-time data fetch (StudioContext.loadProjects,
// CreditsContext.reconcile, etc.), which surfaces as 2× latency on
// initial app load + every full provider remount. Allow opting out
// via VITE_DISABLE_STRICT=1 when chasing perf locally; production
// always runs without StrictMode anyway (vite strips it).
const disableStrict = import.meta.env.VITE_DISABLE_STRICT === "1";

// Boot guard: if Supabase env vars are missing, the supabase client falls back
// to inert placeholders (see integrations/supabase/client.ts) and sets this
// flag. Render an actionable configuration screen instead of a blank page.
const envMissing = (globalThis as { __SUPABASE_ENV_MISSING__?: boolean }).__SUPABASE_ENV_MISSING__;
if (envMissing) {
  createRoot(document.getElementById("root")!).render(
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#030303", color: "#fff", fontFamily: "system-ui, sans-serif", padding: 24, textAlign: "center" }}>
      <div style={{ maxWidth: 460 }}>
        <div style={{ fontSize: 12, letterSpacing: "0.22em", color: "#f59e0b", marginBottom: 14 }}>CONFIGURATION REQUIRED</div>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 12px" }}>Supabase environment not set</h1>
        <p style={{ color: "#a1a1aa", fontSize: 14, lineHeight: 1.65, margin: 0 }}>
          Copy <code style={{ color: "#fff" }}>.env.example</code> to <code style={{ color: "#fff" }}>.env.local</code> and set{" "}
          <code style={{ color: "#fff" }}>VITE_SUPABASE_URL</code> and <code style={{ color: "#fff" }}>VITE_SUPABASE_PUBLISHABLE_KEY</code>, then restart the dev server.
        </p>
      </div>
    </div>
  );
} else {
  createRoot(document.getElementById("root")!).render(
    disableStrict ? <App /> : <StrictMode><App /></StrictMode>
  );
}

// Mark boot complete
console.info('[Boot] React render initiated');
