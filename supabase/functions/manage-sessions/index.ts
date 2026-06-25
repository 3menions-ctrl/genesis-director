/**
 * Manage Sessions — list, revoke single, revoke all-other for the authenticated user.
 *
 * Actions (POST body):
 *   { action: 'list' }
 *   { action: 'revoke', session_id: string }
 *   { action: 'revoke_others' }   // signs out everywhere except current
 *   { action: 'revoke_all' }      // signs out everywhere including current
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { validateAuth, unauthorizedResponse } from '../_shared/auth-guard.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const auth = await validateAuth(req)
    if (!auth.authenticated || !auth.userId) {
      return unauthorizedResponse(corsHeaders, auth.error || 'Unauthorized')
    }
    const userId = auth.userId

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, serviceKey)

    let body: { action?: string; session_id?: string } = {}
    try { body = await req.json() } catch { /* allow empty for GET-like calls */ }
    const action = body.action || 'list'

    // Identify the caller's current session id from the JWT (session_id claim).
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    let currentSessionId: string | null = null
    try {
      const payload = JSON.parse(atob(token.split('.')[1] || ''))
      currentSessionId = payload?.session_id || null
    } catch { /* ignore */ }

    if (action === 'list') {
      // Query auth.sessions via service-role REST (PostgREST exposes only public schema,
      // so use a raw SQL RPC). We inline via the auth admin DB through the SQL editor isn't
      // available — use postgres-meta style via supabase-js by selecting from a SECURITY DEFINER view.
      // Simpler: use the admin REST endpoint /auth/v1/admin/users/{id}/sessions if exposed —
      // GoTrue exposes session listing per user via admin API.
      const resp = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}/sessions`, {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      })
      if (!resp.ok) {
        const text = await resp.text()
        console.error('[manage-sessions] list failed', resp.status, text)
        return jsonResponse({ error: 'Failed to list sessions' }, 500)
      }
      const data = await resp.json()
      const sessions = (Array.isArray(data) ? data : data?.sessions || []).map((s: any) => ({
        id: s.id,
        created_at: s.created_at,
        updated_at: s.updated_at,
        not_after: s.not_after,
        refreshed_at: s.refreshed_at,
        user_agent: s.user_agent,
        ip: s.ip,
        is_current: s.id === currentSessionId,
      }))
      return jsonResponse({ sessions, current_session_id: currentSessionId })
    }

    if (action === 'revoke') {
      const sid = body.session_id
      if (!sid) return jsonResponse({ error: 'Missing session_id' }, 400)

      // AUDIT FIX M-11: verify the session belongs to the calling user before
      // deleting it. Previously any caller-supplied session_id was deleted via
      // the service-role admin API — an IDOR allowing targeted force-sign-out of
      // another user's device.
      const ownResp = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}/sessions`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      })
      if (!ownResp.ok) {
        return jsonResponse({ error: 'Failed to verify session ownership' }, 500)
      }
      const ownData = await ownResp.json()
      const ownSessions: Array<{ id: string }> = Array.isArray(ownData) ? ownData : (ownData?.sessions || [])
      if (!ownSessions.some((s) => s.id === sid)) {
        return jsonResponse({ error: 'Session not found' }, 404)
      }

      const resp = await fetch(`${supabaseUrl}/auth/v1/admin/sessions/${sid}`, {
        method: 'DELETE',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      })
      if (!resp.ok && resp.status !== 404) {
        const text = await resp.text()
        console.error('[manage-sessions] revoke failed', resp.status, text)
        return jsonResponse({ error: 'Failed to revoke session' }, 500)
      }
      return jsonResponse({ success: true, revoked_session_id: sid })
    }

    if (action === 'revoke_others' || action === 'revoke_all') {
      const scope = action === 'revoke_all' ? 'global' : 'others'
      const { error } = await admin.auth.admin.signOut(userId, scope as any)
      if (error) {
        console.error('[manage-sessions] signOut failed', error)
        return jsonResponse({ error: 'Failed to revoke sessions' }, 500)
      }
      return jsonResponse({ success: true, scope })
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400)
  } catch (err) {
    console.error('[manage-sessions] Error:', err)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
})