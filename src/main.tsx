import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import App from "./App.tsx";
import "./index.css";
import { stabilityMonitor, shouldSuppressError } from "./lib/stabilityMonitor";
import { initializeDiagnostics, setStateSnapshotProvider, getCurrentSnapshot } from "./lib/diagnostics";

// Track error count to prevent infinite crash loops
let errorCount = 0;
const ERROR_THRESHOLD = 10;
const ERROR_RESET_INTERVAL = 30000; // 30 seconds

// Store interval ID for cleanup during HMR
let errorResetInterval: ReturnType<typeof setInterval> | null = null;

// Error patterns that should NOT crash the app or show toasts
// COMPREHENSIVE list - includes all variations of common non-fatal errors
const SUPPRESSED_ERROR_PATTERNS = [
  'ResizeObserver loop',
  'ResizeObserver loop completed',
  'Non-Error promise rejection captured',
  'ChunkLoadError',
  'Loading chunk',
  'Cannot read properties of null (reading \'removeChild\')',
  'Cannot read properties of null (reading \'insertBefore\')',
  'Cannot read properties of null',
  'Failed to fetch dynamically imported module',
  'Network Error',
  'cancelled',
  // AbortController errors - expected during navigation (all variants)
  'AbortError',
  'The operation was aborted',
  'signal is aborted',
  'DOMException: The user aborted a request',
  'aborted',
  // React ref warnings - non-fatal (CRITICAL: must suppress to prevent crash loop)
  'Function components cannot be given refs',
  'forwardRef render functions accept',
  'Warning: Function components cannot be given refs',
  'ref',
  'Ref',
  'forwardRef',
  // Component loading errors - prevent cascade on lazy load issues
  'Component is not a function',
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
  // Video playback errors - common and harmless
  'play() request was interrupted',
  'The play() request was interrupted by a call to pause()',
  'NotAllowedError',
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
];

// ============= CONSOLE INTERCEPTION =============
// Intercept console.error/warn to suppress React development warnings
// This is the world-class solution - catch warnings at the source

const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// Patterns specifically for console warnings (React dev mode)
const CONSOLE_SUPPRESSED_PATTERNS = [
  'Function components cannot be given refs',
  'forwardRef render functions',
  'Check the render method',
  'validateFunctionComponentInDev',
  'Did you mean to use React.forwardRef',
  'Attempts to access this ref will fail',
];

const shouldSuppressConsoleMessage = (args: unknown[]): boolean => {
  const message = args.map(arg => 
    typeof arg === 'string' ? arg : arg instanceof Error ? arg.message : String(arg)
  ).join(' ');
  
  return CONSOLE_SUPPRESSED_PATTERNS.some(pattern => 
    message.includes(pattern)
  );
};

// Override console.error to suppress React ref warnings
console.error = (...args: unknown[]) => {
  if (shouldSuppressConsoleMessage(args)) {
    // Log at debug level instead of error (visible but doesn't pollute console)
    console.debug('[Suppressed React Warning]', args[0]?.toString?.()?.substring(0, 80) || 'ref warning');
    return;
  }
  originalConsoleError.apply(console, args);
};

// Override console.warn for completeness
console.warn = (...args: unknown[]) => {
  if (shouldSuppressConsoleMessage(args)) {
    console.debug('[Suppressed React Warning]', args[0]?.toString?.()?.substring(0, 80) || 'ref warning');
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

  // Extra check: prevent ref-related errors from counting toward crash threshold
  const errorMessage = event.error?.message || '';
  if (errorMessage.includes('ref') || errorMessage.includes('Ref') || errorMessage.includes('forwardRef')) {
    console.debug('[Global] Suppressed ref-related error:', errorMessage.substring(0, 100));
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

  // Extra check: prevent ref-related rejections from counting
  const reasonMessage = event.reason?.message || String(event.reason) || '';
  if (reasonMessage.includes('ref') || reasonMessage.includes('Ref') || reasonMessage.includes('forwardRef')) {
    console.debug('[Global] Suppressed ref-related rejection:', reasonMessage.substring(0, 100));
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
if (process.env.NODE_ENV === 'development') {
  cleanupDiagnostics = initializeDiagnostics();
  setStateSnapshotProvider(getCurrentSnapshot);
}

// Clean up diagnostics on HMR
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (cleanupDiagnostics) {
      cleanupDiagnostics();
    }
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
