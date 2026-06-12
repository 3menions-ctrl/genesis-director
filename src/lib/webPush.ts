/**
 * Web Push registration helper — OSS, no FCM / APNs dependency.
 *
 * 1. ensurePushPermission() — prompts the user for permission once;
 *    persists the subscription to push_subscriptions.
 * 2. unregisterPush() — removes the local subscription + DB row.
 * 3. isPushEnabled() — boolean check the Settings UI can display.
 *
 * VAPID public key is read from VITE_VAPID_PUBLIC_KEY. The matching
 * private key lives in the supabase secrets and is used only by the
 * send-push edge function.
 */
import { supabase } from "@/integrations/supabase/client";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.ready;
  } catch { return null; }
}

export async function isPushEnabled(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;
  const reg = await getRegistration();
  if (!reg) return false;
  const sub = await reg.pushManager.getSubscription();
  return !!sub;
}

export async function ensurePushPermission(): Promise<{ ok: boolean; reason?: string }> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return { ok: false, reason: "Web Push isn't supported in this browser." };
  }
  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (!vapidKey) {
    return { ok: false, reason: "Push isn't configured for this deployment." };
  }

  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") {
    return { ok: false, reason: "Permission denied." };
  }

  const reg = await getRegistration();
  if (!reg) return { ok: false, reason: "Service worker isn't ready." };

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
  }

  const json = sub.toJSON();
  const p256dh = json.keys?.p256dh;
  const authKey = json.keys?.auth;
  if (!sub.endpoint || !p256dh || !authKey) {
    return { ok: false, reason: "Subscription is incomplete." };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "Sign in first." };

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint: sub.endpoint,
        p256dh_key: p256dh,
        auth_key: authKey,
        user_agent: navigator.userAgent,
      },
      { onConflict: "user_id,endpoint" },
    );
  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}

export async function unregisterPush(): Promise<boolean> {
  const reg = await getRegistration();
  if (!reg) return false;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return true;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.from("push_subscriptions").delete()
      .eq("user_id", user.id)
      .eq("endpoint", endpoint);
  }
  return true;
}
