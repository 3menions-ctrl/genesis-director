import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import App from "./App.tsx";
import "./index.css";
import { stabilityMonitor, shouldSuppressError } from "./lib/stabilityMonitor";

// Track error count to prevent infinite crash loops
let errorCount = 0;
const ERROR_THRESHOLD = 10;
const ERROR_RESET_INTERVAL = 30000; // 30 seconds

// Store interval ID for cleanup during HMR
let errorResetInterval: ReturnType<typeof setInterval> | null = null;

// Error patterns that should NOT crash the app or show toasts
const SUPPRESSED_ERROR_PATTERNS = [
  'ResizeObserver loop',
  'ResizeObserver loop completed',
  'Non-Error promise rejection captured',
  'ChunkLoadError',
  'Loading chunk',
  'Cannot read properties of null (reading \'removeChild\')',
  'Cannot read properties of null (reading \'insertBefore\')',
  'Failed to fetch dynamically imported module',
  'Network Error',
  'cancelled',
  // AbortController errors - expected during navigation
  'AbortError',
  'The operation was aborted',
  'signal is aborted',
  'DOMException: The user aborted a request',
  // React ref warnings - non-fatal
  'Function components cannot be given refs',
  'forwardRef render functions accept',
  // Radix/Dialog cleanup race conditions
  'removeAttribute',
  'setAttribute',
];

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
  
  // Prevent the error from crashing the app if it's a ref warning
  if (event.error?.message?.includes('ref') || event.error?.message?.includes('forwardRef')) {
    event.preventDefault();
  }
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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
