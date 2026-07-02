/**
 * crashReporter — prod-safe client crash/error telemetry to `error_reports`.
 *
 * Why this exists: `DiagnosticsLogger` is dev-only (no-ops in production) and
 * keeps errors in memory, so we had ZERO production crash data — `error_reports`
 * was empty. This reporter runs in prod and persists to Supabase (the table
 * allows anonymous inserts with user_id=null, so logged-out landing visitors are
 * covered).
 *
 * The important part is the OOM HEARTBEAT. iOS Safari's "A problem repeatedly
 * occurred" is a *renderer process crash* (memory/GPU OOM) — the process is
 * killed before any JS runs, so window.onerror / unhandledrejection can NEVER
 * catch it. Instead we drop a heartbeat marker in localStorage while the
 * immersive film is playing and clear it on a clean exit (pagehide). If the next
 * page load still finds the marker, the previous session died mid-immersive
 * without a clean exit → almost certainly an OOM/renderer crash. We report that
 * with the captured device context (UA, deviceMemory, phase, sound on/off).
 */

import { supabase } from "@/integrations/supabase/client";

const HB_KEY = "sb.crash.hb";
const APP_VERSION = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? "unknown";
const MAX_REPORTS_PER_SESSION = 8;

let reported = 0;
let sessionId = "";
try {
  sessionId = (crypto as Crypto & { randomUUID?: () => string }).randomUUID?.() ?? String(Date.now());
} catch {
  sessionId = String(Date.now());
}

function deviceContext(): Record<string, unknown> {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { effectiveType?: string; saveData?: boolean };
  };
  const perfMem = (performance as Performance & {
    memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
  }).memory;
  try {
    return {
      deviceMemory: nav.deviceMemory ?? null,
      cores: navigator.hardwareConcurrency ?? null,
      dpr: window.devicePixelRatio,
      screen: { w: window.screen?.width ?? null, h: window.screen?.height ?? null },
      viewport: { w: window.innerWidth, h: window.innerHeight },
      connection: nav.connection
        ? { type: nav.connection.effectiveType ?? null, saveData: nav.connection.saveData ?? null }
        : null,
      jsHeap: perfMem ? { used: perfMem.usedJSHeapSize, limit: perfMem.jsHeapSizeLimit } : null,
    };
  } catch {
    return {};
  }
}

// The table CHECK constraints only allow a fixed set of category/severity
// values. We report everything under category 'unknown' (the catch-all) and
// encode the REAL type in `code` (e.g. "renderer_crash:immersive_session_died").
const VALID_SEVERITY = new Set(["debug", "info", "warning", "error", "fatal"]);

type ReportOpts = {
  severity?: "debug" | "info" | "warning" | "error" | "fatal";
  stack?: string | null;
  context?: Record<string, unknown>;
};

export function report(kind: string, code: string, message: string, opts?: ReportOpts): void {
  if (typeof window === "undefined") return;
  if (reported >= MAX_REPORTS_PER_SESSION) return;
  reported++;
  void (async () => {
    try {
      await supabase.from("error_reports").insert({
        user_id: null,
        severity: opts?.severity && VALID_SEVERITY.has(opts.severity) ? opts.severity : "error",
        category: "unknown",
        code: `${kind}:${code}`,
        technical_message: message?.slice(0, 2000) ?? null,
        stack: opts?.stack?.slice(0, 4000) ?? null,
        context: { ...deviceContext(), ...(opts?.context ?? {}) },
        // Path only — query strings carry project ids / tokens / share
        // params that don't belong in a telemetry table.
        page_url: location.origin + location.pathname,
        user_agent: navigator.userAgent,
        session_id: sessionId,
        app_version: APP_VERSION,
        retryable: false,
      });
    } catch {
      /* telemetry must never throw */
    }
  })();
}

// ── OOM heartbeat ─────────────────────────────────────────────────────────
export function beginCrashHeartbeat(page: string, meta?: Record<string, unknown>): void {
  try {
    localStorage.setItem(
      HB_KEY,
      JSON.stringify({ page, startedAt: Date.now(), ...meta, ctx: deviceContext() }),
    );
  } catch {
    /* storage may be unavailable (private mode) — heartbeat is best-effort */
  }
}

export function updateCrashHeartbeat(patch: Record<string, unknown>): void {
  try {
    const cur = localStorage.getItem(HB_KEY);
    if (!cur) return;
    localStorage.setItem(HB_KEY, JSON.stringify({ ...JSON.parse(cur), ...patch, updatedAt: Date.now() }));
  } catch {
    /* noop */
  }
}

export function endCrashHeartbeat(): void {
  try {
    localStorage.removeItem(HB_KEY);
  } catch {
    /* noop */
  }
}

export function initCrashReporter(): void {
  if (typeof window === "undefined") return;

  // 1) Detect a renderer/OOM crash from the previous session: a surviving
  //    heartbeat means the tab died mid-immersive without a clean pagehide.
  try {
    const hb = localStorage.getItem(HB_KEY);
    if (hb) {
      const prev = JSON.parse(hb) as { page?: string; phase?: string; startedAt?: number };
      // Ignore stale markers (>1h) so we never misattribute an old session.
      if (prev?.startedAt && Date.now() - prev.startedAt < 60 * 60 * 1000) {
        report(
          "renderer_crash",
          "immersive_session_died",
          `Suspected renderer/OOM crash during "${prev.page}" (phase=${prev.phase ?? "?"})`,
          { severity: "fatal", context: { detected: "heartbeat_survived_reload", previous: prev } },
        );
      }
      localStorage.removeItem(HB_KEY);
    }
  } catch {
    /* noop */
  }

  // 2) Uncaught JS errors (won't catch OOM, but catches real exceptions).
  window.addEventListener("error", (e: ErrorEvent) => {
    // Ignore resource-load errors (they don't carry a message/error).
    if (!e.message && !e.error) return;
    report("js_error", "window_onerror", String(e.message || "error"), {
      stack: e.error instanceof Error ? e.error.stack : null,
      context: { filename: e.filename, lineno: e.lineno, colno: e.colno },
    });
  });
  window.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
    const r = e.reason;
    report("js_error", "unhandled_rejection", r instanceof Error ? r.message : String(r), {
      stack: r instanceof Error ? r.stack : null,
    });
  });

  // 3) A clean exit clears the heartbeat so normal closes aren't misreported.
  window.addEventListener("pagehide", () => endCrashHeartbeat());
}
