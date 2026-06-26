/**
 * Push notifications (APNs via Capacitor) — client registration + handlers.
 *
 * This is the CLIENT half only. It registers the device with APNs, forwards
 * the resulting device token to Supabase so the backend can target it, and
 * routes notification taps into the app. Actually SENDING pushes is a backend
 * concern (an edge function calling APNs) — see IOS_SETUP.md.
 *
 * Nothing here runs on web. Permission is requested lazily; if the user has
 * not yet granted it, registration simply doesn't complete and the app is
 * unaffected.
 */
import { IS_NATIVE } from './index';
import { supabase } from '@/integrations/supabase/client';
import { safeInAppPath } from './deepLink';

let started = false;

type Navigate = (path: string) => void;

/** Persist the APNs device token against the signed-in user (best effort). */
async function saveToken(token: string): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) return; // not signed in yet; will re-register after login
    // Table is created by the migration documented in IOS_SETUP.md. If it does
    // not exist yet this throws and is swallowed — registration is non-fatal.
    await supabase.from('device_push_tokens' as never).upsert(
      {
        user_id: userId,
        token,
        platform: 'ios',
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: 'token' } as never,
    );
  } catch {
    /* token storage is best-effort; never block on it */
  }
}

/**
 * Begin push registration and wire up handlers. Safe to call on every boot;
 * it self-guards against double-registration.
 *
 * @param navigate router navigate fn, used to deep-link on notification tap.
 */
export async function initPush(navigate?: Navigate): Promise<void> {
  if (!IS_NATIVE || started) return;
  started = true;

  let PushNotifications: typeof import('@capacitor/push-notifications').PushNotifications;
  try {
    ({ PushNotifications } = await import('@capacitor/push-notifications'));
  } catch {
    return; // plugin unavailable
  }

  // Ask for permission. On iOS this shows the system prompt the first time.
  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== 'granted') return;

  // Triggers the native registration → fires 'registration' below with token.
  await PushNotifications.register();

  PushNotifications.addListener('registration', (token) => {
    void saveToken(token.value);
  });

  PushNotifications.addListener('registrationError', (err) => {
    console.warn('[push] registration error', err?.error);
  });

  // Tapping a notification routes the user wherever the payload points — but the
  // payload is server-controlled, so the target is VALIDATED (same allowlist as
  // deep links): only same-app absolute paths, never a hostile scheme/external URL.
  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const data = action.notification?.data ?? {};
    const path = safeInAppPath(data.path ?? data.url ?? data.route);
    if (path && navigate) navigate(path);
  });
}

/**
 * Re-run token registration after a successful sign-in (so the token gets
 * associated with the now-known user id). Call from your auth success handler.
 */
export async function refreshPushToken(): Promise<void> {
  if (!IS_NATIVE) return;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'granted') await PushNotifications.register();
  } catch {
    /* ignore */
  }
}
