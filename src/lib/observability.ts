/**
 * Observability boot for Small Bridges.
 *
 * Heavy dependencies (@sentry/react + posthog-js + web-vitals) are
 * dynamically imported AFTER first paint so the initial bundle doesn't
 * stall the cinematic loader. Identification still queues if the user
 * signs in before observability boot completes.
 */

// Lazy import handles — populated after bootObservability runs.
let SentryMod: typeof import("@sentry/react") | null = null;
let posthogMod: typeof import("posthog-js")["default"] | null = null;

// Pending identity calls that arrived before boot finished.
let queuedUser: { id: string; email?: string | null } | null = null;
let queuedReset = false;
let booted = false;

export async function bootObservability() {
  if (booted) return;
  booted = true;

  const env = import.meta.env;
  const isProd = env.PROD;
  const sentryDsn = env.VITE_GLITCHTIP_DSN as string | undefined;
  const posthogKey = env.VITE_POSTHOG_KEY as string | undefined;
  const posthogHost = (env.VITE_POSTHOG_HOST as string | undefined)
    || "https://us.i.posthog.com";

  // Defer the heavy work to idle time so it never competes with the
  // first paint. `requestIdleCallback` is missing in Safari/iOS — fall
  // back to a 1s timer.
  const schedule = (cb: () => void) => {
    if (typeof (globalThis as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback === "function") {
      (globalThis as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(cb);
    } else {
      setTimeout(cb, 1000);
    }
  };

  schedule(async () => {
    if (sentryDsn) {
      const Sentry = await import("@sentry/react");
      SentryMod = Sentry;
      Sentry.init({
        dsn: sentryDsn,
        environment: isProd ? "production" : "development",
        release: typeof env.VITE_RELEASE === "string" ? env.VITE_RELEASE : "dev",
        integrations: [
          Sentry.browserTracingIntegration(),
          Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
        ],
        tracesSampleRate: isProd ? 0.05 : 0,
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: isProd ? 1 : 0,
        beforeSend(event) { return scrubPII(event); },
        beforeBreadcrumb(crumb) {
          if (crumb.message) crumb.message = scrubString(crumb.message);
          return crumb;
        },
      });
      if (queuedUser) Sentry.setUser({ id: queuedUser.id, email: queuedUser.email ?? undefined });
      if (queuedReset) Sentry.setUser(null);
    }

    if (posthogKey) {
      const { default: posthog } = await import("posthog-js");
      posthogMod = posthog;
      posthog.init(posthogKey, {
        api_host: posthogHost,
        respect_dnt: true,
        autocapture: true,
        capture_pageview: true,
        capture_pageleave: true,
        person_profiles: "identified_only",
        loaded: (ph) => { if (!isProd) ph.opt_out_capturing(); },
      });
      if (queuedUser) {
        try { posthog.identify(queuedUser.id, { email: queuedUser.email ?? undefined }); } catch {}
      }
      if (queuedReset) { try { posthog.reset(); } catch {} }

      // web-vitals → PostHog (no separate RUM tool).
      const { onCLS, onFCP, onINP, onLCP, onTTFB } = await import("web-vitals");
      const sendVital = (metric: { name: string; value: number; id: string; rating?: string }) => {
        posthog.capture("web_vital", {
          metric: metric.name,
          value: metric.value,
          id: metric.id,
          rating: metric.rating,
        });
      };
      onCLS(sendVital);
      onFCP(sendVital);
      onINP(sendVital);
      onLCP(sendVital);
      onTTFB(sendVital);
    }

    queuedUser = null;
    queuedReset = false;
  });
}

export function identifyUser(user: { id: string; email?: string | null }) {
  if (SentryMod) {
    SentryMod.setUser({ id: user.id, email: user.email ?? undefined });
  }
  if (posthogMod) {
    try { posthogMod.identify(user.id, { email: user.email ?? undefined }); } catch {}
  }
  if (!SentryMod && !posthogMod) {
    queuedUser = user;
  }
}

export function resetIdentity() {
  if (SentryMod) SentryMod.setUser(null);
  if (posthogMod) { try { posthogMod.reset(); } catch {} }
  if (!SentryMod && !posthogMod) {
    queuedReset = true;
    queuedUser = null;
  }
}

// ── PII scrubbers ────────────────────────────────────────────────────
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE_RE = /\+?\d[\d\s().-]{7,}\d/g;
const TOKEN_RE = /\b(eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,})\b/g;

function scrubString(s: string): string {
  return s
    .replace(EMAIL_RE, "[email]")
    .replace(PHONE_RE, "[phone]")
    .replace(TOKEN_RE, "[token]");
}

function scrubPII<T>(event: T): T {
  try {
    const cleaned = scrubString(JSON.stringify(event));
    return JSON.parse(cleaned) as T;
  } catch {
    return event;
  }
}
