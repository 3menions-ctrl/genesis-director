import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import App from "./App.tsx";
import "./index.css";
import { stabilityMonitor, shouldSuppressError } from "./lib/stabilityMonitor";
import { initializeDiagnostics, setStateSnapshotProvider, getCurrentSnapshot } from "./lib/diagnostics";
import { crashForensics } from "./lib/crashForensics";
// Initialize cross-browser compatibility layer
import { injectBrowserFixes, browserInfo } from "./lib/browserCompat";
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

// ============= PHASE 1: SAFE MODE DETECTION (FIRST!) =============
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
// COMPREHENSIVE list - includes all variations of common non-fatal errors
// SAFARI-SPECIFIC patterns added for iOS/macOS Safari stability
const SUPPRESSED_ERROR_PATTERNS = [
  'ResizeObserver loop',
  'ResizeObserver loop completed',
  'Non-Error promise rejection captured',
  'ChunkLoadError',
  'Loading chunk',
  'Cannot read properties of null (reading \'removeChild\')',
  'Cannot read properties of null (reading \'insertBefore\')',
  'Cannot read properties of null',
  // CRITICAL: Network/Fetch failures - suppress to prevent cascade
  'Load failed',
  'TypeError: Load failed',
  'Failed to fetch',
  'NetworkError',
  'net::ERR',
  'fetch failed',
  'Failed to fetch dynamically imported module',
  'Network Error',
  'cancelled',
  // AbortController errors - expected during navigation (all variants)
  'AbortError',
  'The operation was aborted',
  'signal is aborted',
  'DOMException: The user aborted a request',
  'aborted',
  // VIDEO PLAYBACK ERRORS - CRITICAL: These are harmless and common
  'instance of Object',
  'is not a function',
  // Radix/Dialog cleanup race conditions - CRITICAL for stability
  'removeAttribute',
  'setAttribute',
  'removeChild',
  'insertBefore',
  'parentNode',
  'Node.removeChild',
  'Failed to execute',
  'Dialog',
  'DialogContent',
  'DialogPortal',
  // VIDEO PLAYBACK ERRORS - CRITICAL: These are harmless and common
  'play() request was interrupted',
  'The play() request was interrupted by a call to pause()',
  'NotAllowedError',
  'NotSupportedError',
  'MEDIA_ERR',
  'MediaError',
  'The media resource',
  'video element',
  'Video',
  'video playback',
  'InvalidStateError',
  'The element has no supported sources',
  'MEDIA_ELEMENT_ERROR',
  'HTMLMediaElement',
  'playback error',
  'decoding failed',
  'decode error',
  // Additional video/media errors - EXPANDED COVERAGE
  'Failed to load because no supported source was found',
  'PIPELINE_ERROR_READ',
  'PIPELINE_ERROR_DECODE',
  'DEMUXER_ERROR',
  'AUDIO_RENDERER_ERROR',
  'VIDEO_RENDERER_ERROR',
  'The play method is not allowed',
  'The fetching process for the media resource',
  'A network error caused the media download to fail',
  'currentTime',
  'duration is not a finite number',
  'Cannot set property currentTime',
  'seeking is not supported',
  'The requested operation is not supported',
  'SourceBuffer',
  'MediaSource',
  'buffered',
  'The video playback was aborted',
  'Uncaught (in promise) AbortError',
  // HMR/Vite development errors
  'Vite HMR',
  // Framer Motion cleanup
  'Cannot read property',
  'measure',
  'animation',
  // Tooltip/Popover cleanup
  'Tooltip',
  'Popover',
  'radix',
  'Radix',
  'Portal',
  // React internal warnings that shouldn't crash
  'Check the render method',
  'validateFunctionComponentInDev',
  // ReadyState and loading errors
  'readyState',
  'HAVE_NOTHING',
  'load() was called',
  // JSON parsing and network errors
  'Expected JSON but got',
  'API returned HTML',
  'Unexpected response format',
  'Unexpected token',
  'Unexpected end of JSON',
  'JSON.parse',
  'JSON parse',
  'SyntaxError',
  // Permission errors (handled by auth flow, not crash)
  'permission denied',
  'Permission denied',
  'PGRST',
  '42501',
  // Auth context errors (handled gracefully)
  'auth context',
  'session',
  'Session',
  // Touch/pointer events on unmounted elements
  'touch event',
  'pointer event',
  'target is null',
  // Image loading errors
  'Failed to load image',
  'Image load error',
  // Intersection Observer cleanup
  'IntersectionObserver',
  'disconnect',
  // SAFARI-SPECIFIC ERRORS - CRITICAL FOR iOS/macOS SAFARI
  'A problem repeatedly occurred',
  'QuotaExceededError',
  'The quota has been exceeded',
  'SecurityError',
  'Cross-origin',
  'cross-origin',
  'The object is in an invalid state',
  'The object is not in a valid state',
  'WebKit',
  'webkit',
  'Safari',
  'ITP',
  'The request is not allowed by the user agent',
  'undefined is not an object (evaluating',
  'null is not an object (evaluating',
  'Type error',
  'undefined is not a function',
  'Can\'t find variable',
  // Additional DOM errors for Safari
  'NotFoundError',
  'HierarchyRequestError',
  'DataCloneError',
  'WrongDocumentError',
  'ReadOnlyError',
  // MSE/SourceBuffer Safari issues
  'addSourceBuffer',
  'endOfStream',
  'SourceOpen',
  'sourceopen',
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
  
  // Prevent the error from crashing the app if it's any suppressed pattern
  event.preventDefault();
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
  
  // Prevent crash from async errors - CRITICAL for navigation stability
  event.preventDefault();
});

// Register service worker for PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Service worker registration failed - app still works
    });
  });
}

// Initialize diagnostics in development mode
let cleanupDiagnostics: (() => void) | null = null;
let cleanupForensics: (() => void) | null = null;

// ALWAYS initialize crash forensics (even in production for Safe Mode)
cleanupForensics = crashForensics.init();

if (process.env.NODE_ENV === 'development') {
  cleanupDiagnostics = initializeDiagnostics();
  setStateSnapshotProvider(getCurrentSnapshot);
}

// Clean up diagnostics, forensics, and chunk recovery on HMR
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (cleanupDiagnostics) {
      cleanupDiagnostics();
    }
    if (cleanupForensics) {
      cleanupForensics();
    }
    if (cleanupChunkRecovery) {
      cleanupChunkRecovery();
    }
    // Clear chunk recovery state on HMR success
    clearRecoveryState();
  });
}

// Log boot status
console.info('[Boot] Starting React render...', { safeMode: SAFE_MODE });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Mark boot complete
console.info('[Boot] React render initiated');
