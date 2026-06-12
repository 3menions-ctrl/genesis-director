/**
 * pushNotifications — opt-in browser push for "your render finished".
 *
 * Asks the user once. If granted, registers a subscription with the
 * existing service worker, then persists endpoint + keys to
 * `push_subscriptions` so server-side completion hooks can fire it.
 *
 * The VAPID public key is read from `VITE_VAPID_PUBLIC_KEY` at build time.
 * Without that env var, the function is a no-op so the rest of the app
 * keeps working in dev.
 */

import { supabase } from '@/integrations/supabase/client';

const VAPID_PUBLIC = (import.meta as { env?: { VITE_VAPID_PUBLIC_KEY?: string } }).env?.VITE_VAPID_PUBLIC_KEY;
const ASKED_KEY = 'smallbridges.push_asked';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    !!VAPID_PUBLIC
  );
}

export function pushPermission(): NotificationPermission | 'unsupported' {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

/** Ask for permission and register a subscription. Idempotent — calling
 *  again with permission already granted just refreshes the subscription. */
export async function enablePushNotifications(): Promise<{ ok: boolean; reason?: string }> {
  if (!pushSupported()) return { ok: false, reason: 'unsupported' };
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return { ok: false, reason: perm };
    try { localStorage.setItem(ASKED_KEY, '1'); } catch {}

    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const sub =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC!),
      }));

    const raw = sub.toJSON();
    const endpoint = raw.endpoint ?? sub.endpoint;
    const p256dh = raw.keys?.p256dh;
    const authSecret = raw.keys?.auth;
    if (!endpoint || !p256dh || !authSecret) return { ok: false, reason: 'malformed_subscription' };

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, reason: 'unauthenticated' };

    await supabase.from('push_subscriptions').upsert(
      {
        user_id: user.id,
        endpoint,
        p256dh,
        auth_secret: authSecret,
        user_agent: navigator.userAgent,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,endpoint' },
    );

    return { ok: true };
  } catch (e) {
    console.error('[push] enable failed', e);
    return { ok: false, reason: 'error' };
  }
}

/** Has the user already been prompted to enable push? */
export function alreadyAskedPush(): boolean {
  try { return localStorage.getItem(ASKED_KEY) === '1'; } catch { return false; }
}
