import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action } = await req.json().catch(() => ({ action: 'delete' }));
    
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Find the demo user
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      throw listError;
    }

    const demoUser = users.users.find(u => u.email === 'demo@aifilmstudio.com');
    
    if (!demoUser) {
      return new Response(
        JSON.stringify({ success: false, message: "Demo user not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    const userId = demoUser.id;
    console.log(`Processing demo account: ${demoUser.email} (${userId}), action: ${action}`);

    if (action === 'delete') {
      // Delete all user data in order (respecting foreign keys)
      console.log("Deleting user data...");
      
      await supabaseAdmin.from('video_clips').delete().eq('user_id', userId);
      await supabaseAdmin.from('credit_transactions').delete().eq('user_id', userId);
      await supabaseAdmin.from('production_credit_phases').delete().eq('user_id', userId);
      await supabaseAdmin.from('api_cost_logs').delete().eq('user_id', userId);
      await supabaseAdmin.from('stitch_jobs').delete().eq('user_id', userId);
      await supabaseAdmin.from('movie_projects').delete().eq('user_id', userId);
      await supabaseAdmin.from('characters').delete().eq('user_id', userId);
      await supabaseAdmin.from('universe_activity').delete().eq('user_id', userId);
      await supabaseAdmin.from('universe_continuity').delete().eq('created_by', userId);
      await supabaseAdmin.from('universe_members').delete().eq('user_id', userId);
      await supabaseAdmin.from('universes').delete().eq('user_id', userId);
      await supabaseAdmin.from('script_templates').delete().eq('user_id', userId);
      await supabaseAdmin.from('project_templates').delete().eq('user_id', userId);
      await supabaseAdmin.from('user_roles').delete().eq('user_id', userId);
      await supabaseAdmin.from('profiles').delete().eq('id', userId);

      console.log("Deleting auth user...");
      const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      
      if (deleteUserError) {
        console.error('Error deleting auth user:', deleteUserError);
        throw deleteUserError;
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Demo account (${demoUser.email}) has been permanently deleted.`,
          userId
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Just revoke sessions
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { 
          user_metadata: { 
            ...demoUser.user_metadata,
            sessions_revoked_at: new Date().toISOString() 
          }
        }
      );

      if (updateError) {
        console.log("Update error (non-fatal):", updateError);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Sessions invalidated for demo account (${demoUser.email}).`,
          userId
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error: unknown) {
    console.error("Error processing demo account:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
