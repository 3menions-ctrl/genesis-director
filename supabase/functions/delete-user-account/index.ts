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
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create authenticated client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Get the current user
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = user.id

    // Create admin client for deletions
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Delete user data in order (respecting foreign keys)
    // 1. Delete video clips
    await supabaseAdmin.from('video_clips').delete().eq('user_id', userId)

    // 2. Delete credit transactions
    await supabaseAdmin.from('credit_transactions').delete().eq('user_id', userId)

    // 3. Delete production credit phases
    await supabaseAdmin.from('production_credit_phases').delete().eq('user_id', userId)

    // 4. Delete API cost logs
    await supabaseAdmin.from('api_cost_logs').delete().eq('user_id', userId)

    // 5. Delete stitch jobs
    await supabaseAdmin.from('stitch_jobs').delete().eq('user_id', userId)

    // 6. Delete movie projects
    await supabaseAdmin.from('movie_projects').delete().eq('user_id', userId)

    // 7. Delete characters
    await supabaseAdmin.from('characters').delete().eq('user_id', userId)

    // 8. Delete universe activity
    await supabaseAdmin.from('universe_activity').delete().eq('user_id', userId)

    // 9. Delete universe continuity
    await supabaseAdmin.from('universe_continuity').delete().eq('created_by', userId)

    // 10. Delete universe members
    await supabaseAdmin.from('universe_members').delete().eq('user_id', userId)

    // 11. Delete universes
    await supabaseAdmin.from('universes').delete().eq('user_id', userId)

    // 12. Delete script templates
    await supabaseAdmin.from('script_templates').delete().eq('user_id', userId)

    // 13. Delete project templates
    await supabaseAdmin.from('project_templates').delete().eq('user_id', userId)

    // 14. Delete profile
    await supabaseAdmin.from('profiles').delete().eq('id', userId)

    // 15. Finally, delete the auth user
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (deleteUserError) {
      console.error('Error deleting auth user:', deleteUserError)
      return new Response(
        JSON.stringify({ error: 'Failed to delete user account' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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
