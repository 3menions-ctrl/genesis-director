import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

// Public, unauthenticated endpoint — provisions / refreshes a single demo
// account so the team (and prospective customers) can click "Demo Login"
// and land in a working session without going through email OTP.
//
// Returns the demo credentials so the client can sign in via the standard
// supabase.auth.signInWithPassword flow (keeps the session, refresh, and
// onAuthStateChange wiring identical to a real user).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DEMO_EMAIL = 'demo@apex-studio.ai';
const DEMO_PASSWORD = 'ApexDemo!2026#Studio';
const DEMO_DISPLAY_NAME = 'Apex Demo';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1) Find existing demo user (paginate-safe — limit by email filter)
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listErr) throw listErr;
    let user = list?.users?.find((u) => u.email?.toLowerCase() === DEMO_EMAIL);

    // 2) Create on first call; auto-confirm so they can sign in immediately
    if (!user) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { display_name: DEMO_DISPLAY_NAME, demo_account: true },
      });
      if (createErr) throw createErr;
      user = created.user!;
    } else {
      // Reset the password on every call so a previous tester cannot lock the
      // account out and so password rotations land instantly.
      await admin.auth.admin.updateUserById(user.id, {
        password: DEMO_PASSWORD,
        email_confirm: true,
      });
    }

    // 3) Make sure the profile row exists, onboarding is skipped, and the
    //    account has demo credits to actually try a generation.
    await admin.from('profiles').upsert(
      {
        id: user.id,
        email: DEMO_EMAIL,
        display_name: DEMO_DISPLAY_NAME,
        full_name: DEMO_DISPLAY_NAME,
        account_type: 'personal',
        account_tier: 'free',
        onboarding_completed: true,
        has_seen_welcome_video: true,
        has_seen_welcome_offer: true,
        credits_balance: 50,
      },
      { onConflict: 'id' },
    );

    return new Response(
      JSON.stringify({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        user_id: user.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[demo-login] failed', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? 'demo login failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});