/**
 * main-admin.tsx — boot entry for the STANDALONE admin app (dist-admin/).
 *
 * Deliberately lean vs. the public src/main.tsx: no PWA service worker, no
 * consumer route prefetching, no safe-mode/consumer instrumentation. Just
 * theme + observability + the admin root. Built only via `npm run build:admin`.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import AdminStandalone from "./AdminStandalone";
import "../index.css";
import "../i18n";
import { bootTheme } from "../lib/theme";
import { bootObservability } from "../lib/observability";

bootObservability();
bootTheme();

const disableStrict = import.meta.env.VITE_DISABLE_STRICT === "1";
createRoot(document.getElementById("root")!).render(
  disableStrict ? <AdminStandalone /> : <StrictMode><AdminStandalone /></StrictMode>,
);
