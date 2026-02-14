import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const XP_REWARDS: Record<string, number> = {
  video_created: 25,
  video_completed: 100,
  character_created: 50,
  universe_joined: 30,
  character_lent: 75,
  like_received: 5,
  comment_added: 10,
  follow_gained: 15,
  daily_login: 10,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ═══ JWT AUTHENTICATION ═══
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const user_id = claimsData.claims.sub as string;

    const { event_type } = await req.json();

    if (!event_type) {
      throw new Error("Missing event_type");
    }

    console.log(`Processing gamification event: ${event_type} for user ${user_id}`);

    const xpAmount = XP_REWARDS[event_type] || 10;

    // Add XP
    const { data: xpResult, error: xpError } = await supabase.rpc('add_user_xp', {
      p_user_id: user_id,
      p_xp_amount: xpAmount,
      p_reason: event_type,
    });

    if (xpError) {
      console.error('Error adding XP:', xpError);
    }

    // Update streak on daily login
    if (event_type === 'daily_login') {
      await supabase.rpc('update_user_streak', { p_user_id: user_id });
    }

    console.log(`Gamification complete: +${xpAmount} XP`);

    return new Response(
      JSON.stringify({ success: true, xp_awarded: xpAmount, xp_result: xpResult }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Gamification error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
