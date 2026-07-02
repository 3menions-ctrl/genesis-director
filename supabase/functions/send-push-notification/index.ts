import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import webpush from "https://esm.sh/web-push@3.6.7";
import { requireServiceRole } from "../_shared/auth-guard.ts";
import { logAndSanitize } from "../_shared/safe-error.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * send-push-notification — fan a single payload out to every push
 * subscription registered for the given user.
 *
 * Required edge secrets:
 *   VAPID_PUBLIC_KEY  — same key shipped to clients via VITE_VAPID_PUBLIC_KEY
 *   VAPID_PRIVATE_KEY — kept server-side
 *   VAPID_SUBJECT     — `mailto:hello@smallbridges.co` style contact
 *
 * Caller body:
 *   { userId, title, body, url?: '/path/in/app' }
 *
 * Subscriptions that respond 410 Gone are deleted automatically so the
 * table stays tidy.
 */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // AUDIT FIX H-3 (High): this used the service-role key and trusted a
  // body-supplied `userId`, with no auth — anyone with the public anon key could
  // push brand-spoofed notifications (with an attacker deep-link `url`) to any
  // user's devices. It is an internal dispatch worker, so require service-role.
  if (!requireServiceRole(req)) {
    return new Response(JSON.stringify({ ok: false, error: "forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { userId, title, body, url } = await req.json();
    if (!userId || !title) throw new Error("userId + title required");

    const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY");
    const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY");
    const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:hello@smallbridges.co";
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      return new Response(
        JSON.stringify({ ok: false, reason: "vapid_missing" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth_secret")
      .eq("user_id", userId);

    const payload = JSON.stringify({ title, body: body ?? "", url: url ?? "/projects" });

    let sent = 0;
    let cleaned = 0;
    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth_secret },
          },
          payload,
        );
        sent++;
      } catch (e: unknown) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 410 || status === 404) {
          await supabase.from("push_subscriptions").delete().eq("id", s.id);
          cleaned++;
        } else {
          console.warn("[send-push] delivery failed", e);
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, sent, cleaned }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: logAndSanitize("send-push-notification", error),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
