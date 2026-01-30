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

// Reset error count periodically
setInterval(() => {
  errorCount = 0;
}, ERROR_RESET_INTERVAL);

// Global error handler with stability monitoring
window.addEventListener("error", (event) => {
  // Prevent infinite crash loops
  errorCount++;
  if (errorCount > ERROR_THRESHOLD) {
    console.warn('[Global] Too many errors, suppressing further error handling');
    event.preventDefault();
    return;
  }

  if (shouldSuppressError(event.error)) return;
  
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
  // Prevent infinite crash loops
  errorCount++;
  if (errorCount > ERROR_THRESHOLD) {
    console.warn('[Global] Too many rejections, suppressing further error handling');
    event.preventDefault();
    return;
  }

  if (shouldSuppressError(event.reason)) return;
  
  const stabilityEvent = stabilityMonitor.handle(event.reason, 'Async Error', {
    showToast: true,
  });
  
  // Log for debugging
  if (stabilityEvent) {
    console.error("[Unhandled Rejection]", stabilityEvent.category, event.reason);
  }
  
  // Prevent crash from async errors
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
