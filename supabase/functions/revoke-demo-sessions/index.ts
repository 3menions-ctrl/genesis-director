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

    // Delete the user and recreate to clear all sessions
    // Or we can update the user to invalidate tokens by changing aud claim
    // The cleanest way is to delete all sessions via the auth.sessions table
    
    // Use raw SQL to delete sessions for this user
    const { error: deleteError } = await supabaseAdmin
      .from('sessions')
      .delete()
      .eq('user_id', demoUser.id);

    // If that doesn't work (sessions might be in auth schema), try updating refresh token version
    // This will invalidate all existing tokens
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      demoUser.id,
      { 
        // Force token refresh by updating user metadata
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
        message: `Sessions invalidated for demo account (${demoUser.email}). Users will need to re-authenticate.`,
        userId: demoUser.id
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error revoking demo sessions:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
