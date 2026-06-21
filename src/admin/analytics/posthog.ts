/**
 * PostHog — the analytics backbone (product analytics, funnels, retention,
 * flags, experiments, surveys, and session replay). This is the data source
 * that powers the admin's deep user analytics & User 360.
 *
 * Safe by default: a no-op until VITE_POSTHOG_KEY is set, so it ships inert and
 * is turned on deliberately (with a real project key + privacy review). Session
 * replay stays OFF unless VITE_POSTHOG_REPLAY=true (it records real users —
 * enable only with consent).
 *
 * Call initPostHog() once at app boot (main.tsx); identify the user on login;
 * capture events with `posthog.capture(...)`.
 */
import posthog from "posthog-js";

let started = false;

export function initPostHog(): void {
  const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
  if (started || !key || typeof window === "undefined") return;
  posthog.init(key, {
    api_host: (import.meta.env.VITE_POSTHOG_HOST as string) || "https://us.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: true,
    autocapture: true,
    disable_session_recording: import.meta.env.VITE_POSTHOG_REPLAY !== "true",
  });
  started = true;
}

/** Tie events to a user once authenticated. */
export function identifyUser(userId: string, traits?: Record<string, unknown>): void {
  if (!started) return;
  posthog.identify(userId, traits);
}

export function resetAnalytics(): void {
  if (started) posthog.reset();
}

export { posthog };
