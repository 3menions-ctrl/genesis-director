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

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = user.id

    // Fetch all user data
    const [
      profileResult,
      projectsResult,
      clipsResult,
      transactionsResult,
      charactersResult,
      universesResult,
      templatesResult
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('movie_projects').select('*').eq('user_id', userId),
      supabase.from('video_clips').select('*').eq('user_id', userId),
      supabase.from('credit_transactions').select('*').eq('user_id', userId),
      supabase.from('characters').select('*').eq('user_id', userId),
      supabase.from('universes').select('*').eq('user_id', userId),
      supabase.from('project_templates').select('*').eq('user_id', userId),
    ])

    const exportData = {
      exportDate: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        email_confirmed_at: user.email_confirmed_at,
        last_sign_in_at: user.last_sign_in_at,
      },
      profile: profileResult.data,
      projects: projectsResult.data || [],
      videoClips: clipsResult.data || [],
      creditTransactions: transactionsResult.data || [],
      characters: charactersResult.data || [],
      universes: universesResult.data || [],
      templates: templatesResult.data || [],
      summary: {
        totalProjects: projectsResult.data?.length || 0,
        totalVideoClips: clipsResult.data?.length || 0,
        totalCharacters: charactersResult.data?.length || 0,
        totalUniverses: universesResult.data?.length || 0,
        creditsBalance: profileResult.data?.credits_balance || 0,
        totalCreditsPurchased: profileResult.data?.total_credits_purchased || 0,
        totalCreditsUsed: profileResult.data?.total_credits_used || 0,
      }
    }

    return new Response(
      JSON.stringify(exportData, null, 2),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="apex-studio-data-export-${new Date().toISOString().split('T')[0]}.json"`
        } 
      }
    )
  } catch (error) {
    console.error('Error in export-user-data:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
