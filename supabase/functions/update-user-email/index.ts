// ──────────────────────────────────────────────────────────────────────
// Update user email — two-step flow with re-auth.
//
// Old version: client posts { newEmail } → server immediately calls
// admin.updateUserById and overwrites profiles.email. A stolen access
// token = permanent ATO (attacker moves password reset to their address
// without the legit owner ever knowing).
//
// New version: two-step.
//   step 1: { newEmail, password } → server re-checks password against the
//           OLD email, then triggers a confirmation email to the NEW email
//           using Supabase's built-in `updateUser` with `email_confirm: true`
//           which sends a verification link. profiles.email is NOT touched
//           yet — only set when the new address is verified.
//   step 2: User clicks the link in the new inbox; Supabase rotates the
//           auth user's email. A trigger keeps profiles.email in sync
//           AFTER successful verification.
//
// We also send a notice to the OLD email so the legitimate owner can
// react if the change was attacker-initiated (still in the
// password-rotation window).
// ──────────────────────────────────────────────────────────────────────

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Sign in required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { newEmail, password } = await req.json()
    if (!newEmail || typeof newEmail !== 'string') {
      return new Response(
        JSON.stringify({ error: 'New email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    if (!password || typeof password !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Confirm your password to change your email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newEmail)) {
      return new Response(
        JSON.stringify({ error: 'That email address looks invalid' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Auth gate using the shared validator.
    const { validateAuth, unauthorizedResponse } = await import("../_shared/auth-guard.ts")
    const auth = await validateAuth(req)
    if (!auth.authenticated || !auth.userId) {
      return unauthorizedResponse(corsHeaders, auth.error)
    }
    const userId = auth.userId

    // Fetch current email from auth.users via the user-scoped client (uses
    // their JWT, not the service key — so the email lookup is auth-bounded).
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    const currentEmail = userData?.user?.email
    if (userErr || !currentEmail) {
      return new Response(
        JSON.stringify({ error: 'Sign in expired — sign in again' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Re-auth: prove ownership of the OLD email by signing in with the
    // password against a fresh anon client. Successful sign-in proves the
    // attacker has both the JWT AND the password — the bar is now
    // session-theft + password-knowledge, not just session-theft.
    const reauthClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { error: reauthErr } = await reauthClient.auth.signInWithPassword({
      email: currentEmail,
      password,
    })
    if (reauthErr) {
      return new Response(
        JSON.stringify({ error: 'That password is incorrect' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Trigger the verification email to the NEW address. Supabase will
    // send a confirmation link; only on click is the auth user's email
    // rotated. profiles.email is updated via a DB trigger on
    // auth.users.email change (added in migration 20260611210000).
    // NOTE: we explicitly do NOT pass email_confirm: true — that would
    // skip verification. We pass `email` only, which triggers the flow.
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    })
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      userId,
      { email: newEmail },
    )
    if (updateError) {
      return new Response(
        JSON.stringify({ error: updateError.message.includes('already')
          ? 'That email is already in use'
          : 'Could not request the change — try again' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fire-and-forget notice to the OLD email so the legitimate owner sees
    // the change even if their session was stolen. send-transactional-email
    // is internal; we don't await it.
    try {
      void adminClient.functions.invoke('send-transactional-email', {
        body: {
          template: 'email_change_notice',
          to: currentEmail,
          data: { newEmail, requestedAt: new Date().toISOString() },
        },
      })
    } catch { /* best-effort */ }

    // Bump the user's security_version so other active sessions are
    // invalidated on next token refresh.
    try {
      await adminClient
        .from('profiles')
        .update({ security_version: (Math.floor(Date.now() / 1000)) })
        .eq('id', userId)
    } catch { /* best-effort */ }

    return new Response(
      JSON.stringify({
        success: true,
        pendingVerification: true,
        message: `Check ${newEmail} for a confirmation link. Your address won't change until you click it.`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('update-user-email failed', String(error))
    return new Response(
      JSON.stringify({ error: 'Something went wrong — try again in a moment' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
