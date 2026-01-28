import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import App from "./App.tsx";
import "./index.css";

// Global error handler - catches unhandled errors and shows toast
window.addEventListener("error", (event) => {
  console.error("[Global Error]", event.error);
  toast.error("Something went wrong", {
    description: event.error?.message || "An unexpected error occurred",
    duration: 5000,
  });
});

// Global promise rejection handler
window.addEventListener("unhandledrejection", (event) => {
  console.error("[Unhandled Promise Rejection]", event.reason);
  toast.error("Operation failed", {
    description: event.reason?.message || "An async operation failed",
    duration: 5000,
  });
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
