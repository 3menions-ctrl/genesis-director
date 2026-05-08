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

    if (!auth.isServiceRole) {
      const { data: roles } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', auth.userId!)
      const isAdmin = roles?.some((r) => r.role === 'admin')
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Admin access required' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    let body: { target_user_id?: string; scope?: 'all' | 'user' } = {}
    try {
      body = await req.json()
    } catch {
      body = {}
    }

    const callerId = auth.userId!
    const scope = body.scope || (body.target_user_id ? 'user' : 'all')

    let affected = 0
    let failed = 0

    if (scope === 'user') {
      const targetId = body.target_user_id
      if (!targetId) {
        return new Response(JSON.stringify({ error: 'Missing target_user_id' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const { error } = await supabaseAdmin.auth.admin.signOut(targetId, 'global')
      if (error) failed++
      else affected++

      await supabaseAdmin
        .from('profiles')
        .update({ security_version: 999999, updated_at: new Date().toISOString() })
        .eq('id', targetId)

      await supabaseAdmin.from('admin_audit_log').insert({
        admin_id: callerId,
        action: 'force_logout',
        target_type: 'user',
        target_id: targetId,
        details: { method: 'edge_revoke' },
      })
    } else {
      // ALL users — paginate auth.users via admin API, skip caller
      let page = 1
      const perPage = 200
      while (true) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
        if (error) {
          console.error('[AdminForceLogout] listUsers error:', error)
          break
        }
        const users = data?.users || []
        if (users.length === 0) break

        for (const u of users) {
          if (u.id === callerId) continue
          const { error: soErr } = await supabaseAdmin.auth.admin.signOut(u.id, 'global')
          if (soErr) {
            failed++
            console.warn('[AdminForceLogout] signOut failed for', u.id, soErr.message)
          } else {
            affected++
          }
        }

        if (users.length < perPage) break
        page++
      }

      // Bump security_version for all profiles except caller (forces client-side
      // sign-out on next auth init even if access token is still cached).
      await supabaseAdmin.rpc('admin_bump_security_versions_except', { p_except: callerId }).catch(async () => {
        // Fallback: direct update if RPC doesn't exist
        await supabaseAdmin
          .from('profiles')
          .update({ updated_at: new Date().toISOString() })
          .neq('id', callerId)
      })

      await supabaseAdmin.from('admin_audit_log').insert({
        admin_id: callerId,
        action: 'force_logout_all',
        target_type: 'system',
        details: { affected, failed, method: 'edge_revoke' },
      })
    }

    return new Response(
      JSON.stringify({ success: true, affected, failed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('[AdminForceLogout] Error:', error)
    return new Response(JSON.stringify({ error: (error as Error).message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})