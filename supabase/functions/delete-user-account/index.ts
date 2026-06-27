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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Validate JWT using shared auth guard
    const { validateAuth, unauthorizedResponse } = await import("../_shared/auth-guard.ts");
    const auth = await validateAuth(req);
    if (!auth.authenticated || !auth.userId) {
      return unauthorizedResponse(corsHeaders, auth.error);
    }
    const userId = auth.userId;

    // Re-authentication gate: deleting an account is irreversible. The bar
    // must be session-theft + a REAL re-auth, never a guessable public
    // constant. We branch on whether the account actually has a password:
    //   * Password account (has an 'email' identity) → password is REQUIRED
    //     and verified via signInWithPassword. The 'DELETE MY ACCOUNT'
    //     constant is NOT accepted (it was previously a bypass).
    //   * Passwordless account (OAuth / passkey / SSO only, no email
    //     identity) → there is no password to verify, so we fall back to the
    //     typed confirmation phrase (the strongest signal available, on top
    //     of the already-validated live session).
    let body: any = {}
    try { body = await req.json() } catch { /* allow empty body for legacy */ }
    const reauthClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: userData } = await reauthClient.auth.getUser(authHeader.replace(/^Bearer\s+/i, ''))
    const currentEmail = userData?.user?.email
    if (!currentEmail) {
      return new Response(
        JSON.stringify({ error: 'Sign in expired — sign in again, then retry' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Does this account have a password? An 'email' identity means yes.
    const identities = (userData?.user?.identities ?? []) as Array<{ provider?: string }>
    const hasPasswordIdentity = identities.some((i) => i?.provider === 'email')

    if (hasPasswordIdentity) {
      // Password account: a real password is the ONLY acceptable confirmation.
      if (!body?.password || typeof body.password !== 'string') {
        return new Response(
          JSON.stringify({ error: 'Enter your password to confirm account deletion' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      const { error: reauthErr } = await reauthClient.auth.signInWithPassword({
        email: currentEmail,
        password: body.password,
      })
      if (reauthErr) {
        return new Response(
          JSON.stringify({ error: 'That password is incorrect' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } else {
      // Passwordless account (OAuth/passkey/SSO): no password exists to verify.
      // Require the typed confirmation phrase on top of the live session.
      if (body?.confirm !== 'DELETE MY ACCOUNT') {
        return new Response(
          JSON.stringify({ error: 'Type "DELETE MY ACCOUNT" to confirm deletion' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Create admin client for deletions
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    console.log(`[DeleteAccount] Starting full account deletion for user ${userId}`)

    // Capture user email + fire admin alert BEFORE wiping data (best-effort, never blocks)
    try {
      const { data: userRec } = await supabaseAdmin.auth.admin.getUserById(userId)
      const userEmail = userRec?.user?.email || null
      await supabaseAdmin.rpc('admin_alert_account_deleted', {
        p_user_email: userEmail,
        p_user_id: userId,
        p_reason: null,
      })
      await supabaseAdmin.functions.invoke('admin-alert-dispatch', {
        body: {
          kind: 'account_deleted',
          eventId: userId,
          data: {
            title: `Account deleted — ${userEmail || userId}`,
            body: `User permanently removed their account.`,
            user_email: userEmail,
            user_id: userId,
          },
        },
      })
    } catch (e) {
      console.error('[DeleteAccount] admin alert failed (non-fatal)', e)
    }

    // Delete user data in dependency order (children first, then parents)
    // ===== SOCIAL / ENGAGEMENT =====
    await supabaseAdmin.from('chat_message_reactions').delete().eq('user_id', userId)
    await supabaseAdmin.from('chat_messages').delete().eq('user_id', userId)
    await supabaseAdmin.from('conversation_members').delete().eq('user_id', userId)
    await supabaseAdmin.from('comment_likes').delete().eq('user_id', userId)
    await supabaseAdmin.from('comment_reactions').delete().eq('user_id', userId)
    await supabaseAdmin.from('project_comments').delete().eq('user_id', userId)
    await supabaseAdmin.from('video_likes').delete().eq('user_id', userId)
    await supabaseAdmin.from('video_reactions').delete().eq('user_id', userId)
    await supabaseAdmin.from('genesis_video_votes').delete().eq('user_id', userId)
    await supabaseAdmin.from('direct_messages').delete().eq('sender_id', userId)
    await supabaseAdmin.from('direct_messages').delete().eq('recipient_id', userId)
    await supabaseAdmin.from('user_follows').delete().eq('follower_id', userId)
    await supabaseAdmin.from('user_follows').delete().eq('following_id', userId)
    await supabaseAdmin.from('world_chat_messages').delete().eq('user_id', userId)
    await supabaseAdmin.from('notifications').delete().eq('user_id', userId)

    // ===== GAMIFICATION =====
    await supabaseAdmin.from('user_achievements').delete().eq('user_id', userId)
    await supabaseAdmin.from('user_challenge_progress').delete().eq('user_id', userId)
    await supabaseAdmin.from('user_gamification').delete().eq('user_id', userId)
    await supabaseAdmin.from('leaderboard').delete().eq('user_id', userId)
    await supabaseAdmin.from('user_presence').delete().eq('user_id', userId)

    // ===== CHARACTERS & LENDING =====
    await supabaseAdmin.from('character_loans').delete().eq('borrower_id', userId)
    await supabaseAdmin.from('character_loans').delete().eq('owner_id', userId)
    await supabaseAdmin.from('character_voice_assignments').delete().in('character_id', 
      (await supabaseAdmin.from('characters').select('id').eq('user_id', userId)).data?.map((c: any) => c.id) || []
    )

    // ===== VIDEO PRODUCTION =====
    await supabaseAdmin.from('video_clips').delete().eq('user_id', userId)
    await supabaseAdmin.from('stitch_jobs').delete().eq('user_id', userId)
    await supabaseAdmin.from('production_credit_phases').delete().eq('user_id', userId)
    await supabaseAdmin.from('edit_sessions').delete().eq('user_id', userId)
    await supabaseAdmin.from('training_videos').delete().eq('user_id', userId)

    // ===== GENESIS =====
    await supabaseAdmin.from('genesis_videos').delete().eq('user_id', userId)
    await supabaseAdmin.from('genesis_character_castings').delete().eq('user_id', userId)

    // ===== BILLING: PRESERVE for financial audit trail (GDPR allows anonymized retention) =====
    // Nullify user_id to anonymize while preserving transaction records for accounting
    await supabaseAdmin.from('credit_transactions').update({ user_id: null as any }).eq('user_id', userId)
    await supabaseAdmin.from('api_cost_logs').update({ user_id: null as any }).eq('user_id', userId)

    // ===== PROJECTS =====
    await supabaseAdmin.from('movie_projects').delete().eq('user_id', userId)

    // ===== UNIVERSES =====
    await supabaseAdmin.from('universe_activity').delete().eq('user_id', userId)
    await supabaseAdmin.from('universe_continuity').delete().eq('created_by', userId)
    await supabaseAdmin.from('universe_messages').delete().eq('user_id', userId)
    await supabaseAdmin.from('universe_members').delete().eq('user_id', userId)
    await supabaseAdmin.from('universes').delete().eq('user_id', userId)

    // ===== CHARACTERS (after loans/voice assignments deleted) =====
    await supabaseAdmin.from('characters').delete().eq('user_id', userId)

    // ===== TEMPLATES & MISC =====
    await supabaseAdmin.from('script_templates').delete().eq('user_id', userId)
    await supabaseAdmin.from('project_templates').delete().eq('user_id', userId)
    await supabaseAdmin.from('widget_configs').delete().eq('user_id', userId)
    await supabaseAdmin.from('support_messages').delete().eq('user_id', userId)
    await supabaseAdmin.from('signup_analytics').delete().eq('user_id', userId)

    // ===== ROLES & AUTH =====
    await supabaseAdmin.from('user_roles').delete().eq('user_id', userId)

    // ===== PROFILE (last before auth) =====
    await supabaseAdmin.from('profiles').delete().eq('id', userId)

    // ===== FINALLY: Delete the auth user =====
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (deleteUserError) {
      console.error('[DeleteAccount] Error deleting auth user:', deleteUserError)
      return new Response(
        JSON.stringify({ error: 'Failed to delete user account' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[DeleteAccount] Successfully deleted all data for user ${userId}`)

    return new Response(
      JSON.stringify({ success: true, message: 'Account deleted successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in delete-user-account:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})