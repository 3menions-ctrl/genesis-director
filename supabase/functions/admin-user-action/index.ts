import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * admin-user-action — every destructive admin operation that needs the
 * service role (delete user, force email verify, password reset, generate
 * an impersonation link, send magic link) lives here.
 *
 * Why an edge fn and not RPCs?
 *   • Supabase auth.users can only be mutated via the JS admin client
 *     using the service role key. RLS / RPC have no equivalent.
 *   • Centralizing here gives us ONE place to enforce admin role +
 *     audit-log writes + self-protection guards.
 *
 * Body shape:
 *   {
 *     action: 'delete' | 'force_verify' | 'send_password_reset' |
 *             'send_magic_link' | 'generate_impersonation_link',
 *     userId: string,
 *     reason?: string,
 *   }
 *
 * All actions return `{ ok: boolean, ...details, error?: string }`.
 * All successful actions write to admin_audit_log.
 */

interface ActionBody {
  action:
    | "delete"
    | "force_verify"
    | "send_password_reset"
    | "send_magic_link"
    | "generate_impersonation_link";
  userId: string;
  reason?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const { validateAuth, unauthorizedResponse } = await import(
      "../_shared/auth-guard.ts"
    );
    const auth = await validateAuth(req);
    if (!auth.authenticated || !auth.userId) {
      return unauthorizedResponse(corsHeaders, auth.error);
    }

    const body = (await req.json()) as ActionBody;
    if (!body.action || !body.userId) {
      throw new Error("action + userId required");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── Re-verify the caller is an admin via the is_admin RPC. We use the
    // user's own JWT for this check so it respects RLS.
    const authHeader = req.headers.get("Authorization") ?? "";
    const userScoped = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: isAdmin } = await userScoped.rpc("is_admin", {
      _user_id: auth.userId,
    });
    if (!isAdmin) {
      return json({ ok: false, error: "not_admin" }, 403);
    }

    // ── Self-protection — admins cannot use this surface to target
    // themselves. The deny is general so a confused admin can't reset
    // their own password / send themselves a magic link from this page.
    if (body.userId === auth.userId) {
      return json({ ok: false, error: "self_target_forbidden" }, 400);
    }

    switch (body.action) {
      case "delete": {
        // Step 1: write the audit row + cascade cleanup of app data via the
        // pre-delete RPC. This refuses on self-delete and on deleting admins.
        const { data: pre, error: preErr } = await userScoped.rpc(
          "admin_pre_delete_user",
          { p_target_user: body.userId, p_reason: body.reason ?? null },
        );
        if (preErr) return json({ ok: false, error: preErr.message }, 400);

        // Step 2: delete the auth user. profiles + cascades happen via the
        // ON DELETE CASCADE chains we built into every owned table.
        const { error: authErr } = await admin.auth.admin.deleteUser(
          body.userId,
        );
        if (authErr) return json({ ok: false, error: authErr.message }, 500);

        return json({ ok: true, deleted: true, snapshot: pre });
      }

      case "force_verify": {
        const { error } = await admin.auth.admin.updateUserById(body.userId, {
          email_confirm: true,
        });
        if (error) return json({ ok: false, error: error.message }, 500);
        await logAction(admin, auth.userId!, "force_verify_email", body.userId, body.reason);
        return json({ ok: true });
      }

      case "send_password_reset": {
        // Pull the target user's email then send a reset.
        const { data: profile } = await admin
          .from("profiles")
          .select("email")
          .eq("id", body.userId)
          .maybeSingle();
        if (!profile?.email) {
          return json({ ok: false, error: "no_email_on_record" }, 400);
        }
        const siteUrl =
          Deno.env.get("PUBLIC_SITE_URL") ?? "https://smallbridges.com";
        const { data, error } = await admin.auth.admin.generateLink({
          type: "recovery",
          email: profile.email,
          options: {
            redirectTo: `${siteUrl}/auth/callback`,
          },
        });
        if (error) return json({ ok: false, error: error.message }, 500);
        await logAction(admin, auth.userId!, "send_password_reset", body.userId, body.reason);
        return json({
          ok: true,
          // The recovery link is also emailed by Supabase. We surface it
          // here so the admin can copy/paste it to the user in chat if
          // the user reports the email never arrived.
          action_link: data?.properties?.action_link ?? null,
        });
      }

      case "send_magic_link": {
        const { data: profile } = await admin
          .from("profiles")
          .select("email")
          .eq("id", body.userId)
          .maybeSingle();
        if (!profile?.email) {
          return json({ ok: false, error: "no_email_on_record" }, 400);
        }
        const siteUrl =
          Deno.env.get("PUBLIC_SITE_URL") ?? "https://smallbridges.com";
        const { error } = await admin.auth.admin.generateLink({
          type: "magiclink",
          email: profile.email,
          options: {
            redirectTo: `${siteUrl}/auth/callback`,
          },
        });
        if (error) return json({ ok: false, error: error.message }, 500);
        await logAction(admin, auth.userId!, "send_magic_link", body.userId, body.reason);
        return json({ ok: true });
      }

      case "generate_impersonation_link": {
        // Generate a one-shot sign-in link for the target user so an admin
        // can step into their account for support debugging. This is a
        // *magic link* under the hood — Supabase doesn't expose direct
        // impersonation. The link is single-use and short-lived.
        const { data: profile } = await admin
          .from("profiles")
          .select("email")
          .eq("id", body.userId)
          .maybeSingle();
        if (!profile?.email) {
          return json({ ok: false, error: "no_email_on_record" }, 400);
        }
        const siteUrl =
          Deno.env.get("PUBLIC_SITE_URL") ?? "https://smallbridges.com";
        const { data, error } = await admin.auth.admin.generateLink({
          type: "magiclink",
          email: profile.email,
          options: {
            redirectTo: `${siteUrl}/auth/callback`,
          },
        });
        if (error) return json({ ok: false, error: error.message }, 500);
        await logAction(
          admin,
          auth.userId!,
          "generate_impersonation_link",
          body.userId,
          body.reason,
        );
        return json({
          ok: true,
          action_link: data?.properties?.action_link ?? null,
          warning:
            "This link signs you in as the target user. Open in an incognito window and close it immediately when done.",
        });
      }

      default:
        return json({ ok: false, error: "unknown_action" }, 400);
    }
  } catch (error) {
    console.error("[admin-user-action] Error:", error);
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

async function logAction(
  admin: ReturnType<typeof createClient>,
  adminId: string,
  action: string,
  targetUserId: string,
  reason: string | undefined,
): Promise<void> {
  try {
    await admin.from("admin_audit_log").insert({
      admin_id: adminId,
      action,
      target_type: "user",
      target_id: targetUserId,
      details: { reason: reason ?? null },
    });
  } catch (e) {
    console.warn("[admin-user-action] audit-log insert failed", e);
  }
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
