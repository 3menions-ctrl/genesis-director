import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { validateAuth, unauthorizedResponse } from '../_shared/auth-guard.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const auth = await validateAuth(req)
    if (!auth.authenticated) {
      return unauthorizedResponse(corsHeaders, auth.error || 'Unauthorized')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Verify caller has admin role (service role calls bypass this check)
    if (!auth.isServiceRole) {
      const { data: roles } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', auth.userId!)

      const isAdmin = roles?.some(r => r.role === 'admin')
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Admin access required' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    const { target_user_id } = await req.json()
    if (!target_user_id) {
      return new Response(JSON.stringify({ error: 'Missing target_user_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`[AdminDeleteAuthUser] Admin ${auth.userId} deleting auth user ${target_user_id}`)

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(target_user_id)
    if (deleteError) {
      console.error('[AdminDeleteAuthUser] Error:', deleteError)
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Log the action
    await supabaseAdmin.from('admin_audit_log').insert({
      admin_id: auth.userId,
      action: 'delete_auth_user',
      target_type: 'user',
      target_id: target_user_id,
      details: { timestamp: new Date().toISOString() }
    })

    return new Response(JSON.stringify({ success: true, deleted_user_id: target_user_id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
