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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { event_type, user_id } = await req.json();

    if (!event_type || !user_id) {
      throw new Error("Missing event_type or user_id");
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
