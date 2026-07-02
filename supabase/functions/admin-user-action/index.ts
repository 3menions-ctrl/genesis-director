import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { newErrorId } from "../_shared/error-response.ts";
// AUDIT FIX (admin lockout): import the shared auth guard STATICALLY. The
// previous `await import("../_shared/auth-guard.ts")` (dynamic) was not bundled
// by the edge-function deployer, so the deployed function threw
// "Module not found: _shared/auth-guard.ts" (HTTP 500) on EVERY call — breaking
// delete-user, force-verify, password-reset, magic-link and impersonation.
// Static imports are always bundled.
import { validateAuth, unauthorizedResponse } from "../_shared/auth-guard.ts";
import { sendResendEmail } from "../_shared/resend.ts";

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
        if (preErr) return adminFail("delete_precheck_failed", preErr, 400);

        // Step 2: delete the auth user. profiles + cascades happen via the
        // ON DELETE CASCADE chains we built into every owned table.
        const { error: authErr } = await admin.auth.admin.deleteUser(
          body.userId,
        );
        if (authErr) return adminFail("delete_failed", authErr, 500);

        return json({ ok: true, deleted: true, snapshot: pre });
      }

      case "force_verify": {
        const { error } = await admin.auth.admin.updateUserById(body.userId, {
          email_confirm: true,
        });
        if (error) return adminFail("force_verify_failed", error, 500);
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
          Deno.env.get("PUBLIC_SITE_URL") ?? "https://smallbridges.co";
        const { data, error } = await admin.auth.admin.generateLink({
          type: "recovery",
          email: profile.email,
          options: {
            redirectTo: `${siteUrl}/auth/callback`,
          },
        });
        if (error) return adminFail("password_reset_failed", error, 500);
        const resetLink = data?.properties?.action_link ?? null;
        // generateLink does NOT send mail — deliver it ourselves via Resend.
        const resetEmailed = resetLink
          ? await deliverAuthEmail("recovery", profile.email, resetLink)
          : false;
        await logAction(admin, auth.userId!, "send_password_reset", body.userId, body.reason);
        return json({
          ok: true,
          emailed: resetEmailed,
          // Always surface the link so the admin can copy/paste it to the user
          // (e.g. in support chat) if email delivery is disabled or bounces.
          action_link: resetLink,
          warning: resetEmailed ? undefined : "Email not sent — copy the link to the user manually.",
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
          Deno.env.get("PUBLIC_SITE_URL") ?? "https://smallbridges.co";
        const { data, error } = await admin.auth.admin.generateLink({
          type: "magiclink",
          email: profile.email,
          options: {
            redirectTo: `${siteUrl}/auth/callback`,
          },
        });
        if (error) return adminFail("magic_link_failed", error, 500);
        const magicLink = data?.properties?.action_link ?? null;
        // generateLink does NOT send mail — deliver it ourselves via Resend.
        const magicEmailed = magicLink
          ? await deliverAuthEmail("magiclink", profile.email, magicLink)
          : false;
        await logAction(admin, auth.userId!, "send_magic_link", body.userId, body.reason);
        return json({
          ok: true,
          emailed: magicEmailed,
          // Surface the link as a fallback so the admin can deliver it manually
          // if email is disabled or bounces.
          action_link: magicLink,
          warning: magicEmailed ? undefined : "Email not sent — copy the link to the user manually.",
        });
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
          Deno.env.get("PUBLIC_SITE_URL") ?? "https://smallbridges.co";
        const { data, error } = await admin.auth.admin.generateLink({
          type: "magiclink",
          email: profile.email,
          options: {
            redirectTo: `${siteUrl}/auth/callback`,
          },
        });
        if (error) return adminFail("impersonation_link_failed", error, 500);
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
    return adminFail("internal_error", error, 500);
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

// Deliver an auth action link by email via Resend.
//
// `auth.admin.generateLink()` only GENERATES a link — it does NOT send mail
// (that only happens on GoTrue's own send path / Send Email hook, which the
// admin API bypasses). So for admin-initiated password resets and magic links
// we send the email ourselves here. Best-effort: returns false on any failure
// (missing RESEND_API_KEY, send error) so the caller can still surface the link
// for the admin to copy/paste manually instead of failing the whole action.
type AuthEmailKind = "recovery" | "magiclink";

async function deliverAuthEmail(
  kind: AuthEmailKind,
  to: string,
  actionLink: string,
): Promise<boolean> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.warn("[admin-user-action] RESEND_API_KEY unset — cannot send", kind);
    return false;
  }
  const fromDomain = Deno.env.get("EMAIL_FROM_DOMAIN") ?? "smallbridges.co";
  const from = `Small Bridges <noreply@${fromDomain}>`;
  const copy = kind === "recovery"
    ? {
        subject: "Reset your Small Bridges password",
        heading: "Reset your password",
        body: "We received a request to reset your password. Click the button below to choose a new one. If you didn’t request this, you can safely ignore this email.",
        cta: "Reset password",
      }
    : {
        subject: "Your Small Bridges sign-in link",
        heading: "Sign in to Small Bridges",
        body: "Click the button below to sign in. This link is single-use and expires shortly. If you didn’t request this, you can safely ignore this email.",
        cta: "Sign in",
      };

  const safeLink = actionLink.replace(/"/g, "&quot;");
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#070a12;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:40px 24px;color:#e8ecf4;">
    <h1 style="font-size:20px;font-weight:600;margin:0 0 16px;">${copy.heading}</h1>
    <p style="font-size:14px;line-height:1.6;color:#aeb6c6;margin:0 0 24px;">${copy.body}</p>
    <a href="${safeLink}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 22px;border-radius:10px;">${copy.cta}</a>
    <p style="font-size:12px;line-height:1.6;color:#6b748a;margin:24px 0 0;">If the button doesn’t work, copy and paste this link into your browser:<br><span style="color:#8b93a8;word-break:break-all;">${safeLink}</span></p>
  </div></body></html>`;
  const text = `${copy.heading}\n\n${copy.body}\n\n${copy.cta}: ${actionLink}\n`;

  try {
    await sendResendEmail(
      {
        to,
        from,
        subject: copy.subject,
        html,
        text,
        label: kind === "recovery" ? "admin_password_reset" : "admin_magic_link",
      },
      { apiKey },
    );
    return true;
  } catch (e) {
    console.error("[admin-user-action] resend send failed for", kind, e);
    return false;
  }
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Log full technical detail server-side (visible in edge logs); return only a
// stable code + correlation id. Keeps raw Supabase/auth error text out of the
// response body even on the admin console.
function adminFail(code: string, detail: unknown, status = 500): Response {
  const errorId = newErrorId();
  console.error(`[admin-user-action] ${code} errorId=${errorId} ::`, detail);
  return json({ ok: false, error: code, errorId }, status);
}
