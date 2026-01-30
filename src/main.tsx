import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import App from "./App.tsx";
import "./index.css";
import { stabilityMonitor, shouldSuppressError } from "./lib/stabilityMonitor";

// Global error handler with stability monitoring
window.addEventListener("error", (event) => {
  if (shouldSuppressError(event.error)) return;
  
  const stabilityEvent = stabilityMonitor.handle(event.error, 'Global Error', {
    showToast: true,
  });
  
  // Log for debugging
  if (stabilityEvent) {
    console.error("[Global Error]", stabilityEvent.category, event.error);
  }
});

// Global promise rejection handler with stability monitoring
window.addEventListener("unhandledrejection", (event) => {
  if (shouldSuppressError(event.reason)) return;
  
  const stabilityEvent = stabilityMonitor.handle(event.reason, 'Async Error', {
    showToast: true,
  });
  
  // Log for debugging
  if (stabilityEvent) {
    console.error("[Unhandled Rejection]", stabilityEvent.category, event.reason);
  }
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
