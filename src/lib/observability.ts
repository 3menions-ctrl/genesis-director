/**
 * Observability boot for Small Bridges.
 *
 * Wires:
 *   - **GlitchTip** (Sentry-compatible OSS error tracker) via @sentry/react.
 *     GlitchTip's API is wire-compatible with Sentry's, so we use the
 *     Sentry SDK pointed at a GlitchTip DSN. Self-hostable.
 *   - **PostHog Community Edition** for product analytics. OSS, self-host
 *     option available. We use the JS SDK pointed at either PostHog Cloud
 *     or your own host.
 *   - **web-vitals** for Core Web Vitals → PostHog (one less SaaS).
 *
 * All of these are no-ops if the corresponding env var is unset, so dev
 * builds and CI don't fire telemetry.
 */
import * as Sentry from "@sentry/react";
import posthog from "posthog-js";
import { onCLS, onFCP, onINP, onLCP, onTTFB } from "web-vitals";

let booted = false;

export function bootObservability() {
  if (booted) return;
  booted = true;

  const env = import.meta.env;
  const isProd = env.PROD;
  const release = typeof env.VITE_RELEASE === "string" ? env.VITE_RELEASE : "dev";

  // ── Error tracking (GlitchTip / Sentry) ─────────────────────────────
  const sentryDsn = env.VITE_GLITCHTIP_DSN as string | undefined;
  if (sentryDsn) {
    Sentry.init({
      dsn: sentryDsn,
      environment: isProd ? "production" : "development",
      release,
      // Catch unhandled promise rejections + console.error in prod.
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
      // Performance: a small sample, raise once we have traffic.
      tracesSampleRate: isProd ? 0.05 : 0,
      // Session replay: 0% by default; capture every error session.
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: isProd ? 1 : 0,
      // PII scrubber — strip emails / phone-like / token-like strings from
      // breadcrumbs and exception messages before they leave the browser.
      beforeSend(event) {
        return scrubPII(event);
      },
      beforeBreadcrumb(crumb) {
        if (!crumb.message) return crumb;
        crumb.message = scrubString(crumb.message);
        return crumb;
      },
    });
  }

  // ── Product analytics (PostHog) ─────────────────────────────────────
  const posthogKey = env.VITE_POSTHOG_KEY as string | undefined;
  const posthogHost = (env.VITE_POSTHOG_HOST as string | undefined) || "https://us.i.posthog.com";
  if (posthogKey) {
    posthog.init(posthogKey, {
      api_host: posthogHost,
      // Honor reduced-tracking preferences out of the box.
      respect_dnt: true,
      autocapture: true,
      capture_pageview: true,
      capture_pageleave: true,
      person_profiles: "identified_only",
      // Don't send anything in dev.
      loaded: (ph) => {
        if (!isProd) ph.opt_out_capturing();
      },
    });
  }

  // ── Core Web Vitals → PostHog ───────────────────────────────────────
  // No separate SaaS for RUM; PostHog ingests every event we send.
  const sendVital = (metric: { name: string; value: number; id: string; rating?: string }) => {
    if (!posthogKey) return;
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

/** Identify the user (call from AuthContext after sign-in). */
export function identifyUser(user: { id: string; email?: string | null }) {
  if (!booted) return;
  Sentry.setUser({ id: user.id, email: user.email ?? undefined });
  try { posthog.identify(user.id, { email: user.email ?? undefined }); } catch {}
}

/** Wipe identity on sign-out. */
export function resetIdentity() {
  if (!booted) return;
  Sentry.setUser(null);
  try { posthog.reset(); } catch {}
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
    const j = JSON.stringify(event);
    const cleaned = scrubString(j);
    return JSON.parse(cleaned) as T;
  } catch {
    return event;
  }
}
