/**
 * Shared circuit breaker for translate-text edge function.
 * Stops both aiBackend (i18next) and domTranslator from hammering
 * the function once we hit a hard failure (402 credits exhausted, 500…).
 */
const FLAG_KEY = 'sb.i18n.disabled.until';
const TOAST_KEY = 'sb.i18n.disabled.notified';
const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

let runtimeDisabledUntil = 0;

export const isTranslationDisabled = (): boolean => {
  if (Date.now() < runtimeDisabledUntil) return true;
  try {
    const v = Number(localStorage.getItem(FLAG_KEY) || 0);
    if (v && Date.now() < v) {
      runtimeDisabledUntil = v;
      return true;
    }
  } catch { /* ignore */ }
  return false;
};

export const tripBreaker = (reason: "credits" | "error" = "error") => {
  const until = Date.now() + COOLDOWN_MS;
  runtimeDisabledUntil = until;
  try { localStorage.setItem(FLAG_KEY, String(until)); } catch { /* quota */ }
  // One-time console warning + custom event for UI to surface
  try {
    const notified = sessionStorage.getItem(TOAST_KEY);
    if (!notified) {
      sessionStorage.setItem(TOAST_KEY, "1");
      // eslint-disable-next-line no-console
      console.warn(
        reason === "credits"
          ? "[i18n] Auto-translation paused: AI credits exhausted. Add credits in Lovable Cloud to re-enable."
          : "[i18n] Auto-translation paused after repeated failures."
      );
      window.dispatchEvent(new CustomEvent('sb:i18n-disabled', { detail: { reason } }));
    }
  } catch { /* ignore */ }
};

export const resetBreaker = () => {
  runtimeDisabledUntil = 0;
  try { localStorage.removeItem(FLAG_KEY); } catch { /* ignore */ }
  try { sessionStorage.removeItem(TOAST_KEY); } catch { /* ignore */ }
};

/** Inspect a Supabase functions.invoke error and detect 402 / quota. */
export const looksLikeCreditsError = (err: unknown): boolean => {
  const msg = String((err as any)?.message ?? err ?? "").toLowerCase();
  const ctx = String((err as any)?.context?.status ?? "");
  return (
    msg.includes("credits exhausted") ||
    msg.includes("402") ||
    ctx === "402" ||
    msg.includes("payment required")
  );
};