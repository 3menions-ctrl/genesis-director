/**
 * First-party analytics SDK — our own PostHog-class event tracker.
 *
 * No third party, no key: events batch to the `analytics_ingest` RPC (which
 * server-stamps user_id, so identity can't be spoofed) and land in our own
 * Supabase `analytics_events` table. Anonymous + session IDs are managed
 * client-side; identity stitches anon → user on login.
 *
 *   track("project_created", { genre })   // custom event
 *   page()                                 // pageview (autocaptured on route change)
 *   identify(userId, { account_type })     // on login
 *   resetTracking()                        // on logout
 */
import { supabase } from "@/integrations/supabase/client";

const ANON_KEY = "sb_an_anon";
const SESSION_KEY = "sb_an_session";
const SESSION_AT_KEY = "sb_an_session_at";
const SESSION_IDLE_MS = 30 * 60 * 1000; // 30-min idle → new session
const BATCH_MAX = 50;
const FLUSH_MS = 4000;

function uuid(): string {
  try { if (crypto?.randomUUID) return crypto.randomUUID(); } catch { /* ignore */ }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function anonId(): string {
  try {
    let v = localStorage.getItem(ANON_KEY);
    if (!v) { v = uuid(); localStorage.setItem(ANON_KEY, v); }
    return v;
  } catch { return "anon"; }
}

function sessionId(): string {
  try {
    const now = Date.now();
    const last = Number(sessionStorage.getItem(SESSION_AT_KEY) || 0);
    let sid = sessionStorage.getItem(SESSION_KEY);
    if (!sid || now - last > SESSION_IDLE_MS) { sid = uuid(); sessionStorage.setItem(SESSION_KEY, sid); }
    sessionStorage.setItem(SESSION_AT_KEY, String(now));
    return sid;
  } catch { return "s"; }
}

function utm(): Record<string, string> | undefined {
  try {
    const p = new URLSearchParams(window.location.search);
    const out: Record<string, string> = {};
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
      const v = p.get(k); if (v) out[k] = v;
    }
    return Object.keys(out).length ? out : undefined;
  } catch { return undefined; }
}

function deviceInfo() {
  try {
    const ua = navigator.userAgent || "";
    const mobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
    let browser = "Other";
    if (/Edg\//.test(ua)) browser = "Edge";
    else if (/OPR\//.test(ua)) browser = "Opera";
    else if (/Chrome\//.test(ua)) browser = "Chrome";
    else if (/Firefox\//.test(ua)) browser = "Firefox";
    else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = "Safari";
    let os = "Other";
    if (/Windows/.test(ua)) os = "Windows";
    else if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";
    else if (/Mac OS X/.test(ua)) os = "macOS";
    else if (/Android/.test(ua)) os = "Android";
    else if (/Linux/.test(ua)) os = "Linux";
    let tz: string | undefined;
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { /* ignore */ }
    return { device: mobile ? "mobile" : "desktop", browser, os, tz };
  } catch { return {}; }
}

let distinctId: string | null = null;
let traits: Record<string, unknown> = {};
let queue: Record<string, unknown>[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function enrich(event: string, properties?: Record<string, unknown>) {
  return {
    event,
    properties: properties ?? {},
    anonymous_id: anonId(),
    session_id: sessionId(),
    occurred_at: new Date().toISOString(),
    path: typeof window !== "undefined" ? window.location.pathname + window.location.search : null,
    referrer: typeof document !== "undefined" ? (document.referrer || null) : null,
    utm: utm(),
    context: {
      distinct_id: distinctId,
      ...traits,
      ua: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      lang: typeof navigator !== "undefined" ? navigator.language : undefined,
      vw: typeof window !== "undefined" ? window.innerWidth : undefined,
      vh: typeof window !== "undefined" ? window.innerHeight : undefined,
      ...deviceInfo(),
    },
  };
}

export function track(event: string, properties?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  queue.push(enrich(event, properties));
  if (queue.length >= BATCH_MAX) void flush();
  else if (!timer) timer = setTimeout(() => void flush(), FLUSH_MS);
}

export function page(properties?: Record<string, unknown>): void {
  track("$pageview", properties);
}

export function identify(userId: string, userTraits?: Record<string, unknown>): void {
  distinctId = userId;
  if (userTraits) traits = { ...traits, ...userTraits };
  track("$identify", userTraits);
  void flush();
}

export function resetTracking(): void {
  distinctId = null;
  traits = {};
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

export async function flush(): Promise<void> {
  if (timer) { clearTimeout(timer); timer = null; }
  if (!queue.length) return;
  const batch = queue.splice(0, 100);
  try {
    await supabase.rpc("analytics_ingest" as never, { _events: batch } as never);
  } catch {
    // Best-effort telemetry — drop on failure rather than grow unbounded.
  }
}

if (typeof window !== "undefined") {
  const onHide = () => { if (document.visibilityState === "hidden") void flush(); };
  window.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", () => void flush());
}
