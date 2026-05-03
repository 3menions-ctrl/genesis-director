import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Fixed demo credentials — public on purpose. This is a sandbox account.
const DEMO_EMAIL = 'demo-business@apexstudio.ai'
const DEMO_PASSWORD = 'DemoBusiness!2026'
const DEMO_ORG_NAME = 'Apex Demo Studio'
const DEMO_ORG_SLUG = 'apex-demo-studio'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

    // 1. Ensure auth user exists (idempotent)
    let userId: string | null = null
    const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
    const found = existing?.users?.find((u) => u.email?.toLowerCase() === DEMO_EMAIL)
    if (found) {
      userId = found.id
      // Reset password so the published demo always works
      await admin.auth.admin.updateUserById(userId, { password: DEMO_PASSWORD, email_confirm: true })
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: 'Demo Business Owner', account_type: 'business' },
      })
      if (createErr || !created.user) throw createErr ?? new Error('user create failed')
      userId = created.user.id
    }

    // 2. Ensure profile is fully onboarded as a business account
    await admin.from('profiles').upsert({
      id: userId,
      email: DEMO_EMAIL,
      display_name: 'Demo Business Owner',
      full_name: 'Demo Business Owner',
      account_type: 'business',
      account_tier: 'agency',
      company: DEMO_ORG_NAME,
      job_title: 'Creative Director',
      onboarding_completed: true,
      credits_balance: 500,
    }, { onConflict: 'id' })

    // 3. Ensure organization exists
    let orgId: string | null = null
    const { data: orgRow } = await admin.from('organizations').select('id').eq('slug', DEMO_ORG_SLUG).maybeSingle()
    if (orgRow) {
      orgId = orgRow.id
      await admin.from('organizations').update({
        name: DEMO_ORG_NAME,
        plan: 'business_growth',
        credits_balance: 5000,
        industry: 'Marketing & Advertising',
        team_size: '11-50',
        primary_use_case: 'Branded social campaigns',
        monthly_volume: '50-100 videos',
        brand_voice: 'Confident, modern, witty — concise lines, strong hooks.',
        brand_colors: ['#0A84FF', '#0F172A', '#F8FAFC'],
        brand_primary_color: '#0A84FF',
        brand_accent_color: '#F8FAFC',
        billing_email: DEMO_EMAIL,
        onboarding_completed: true,
      }).eq('id', orgId)
    } else {
      const { data: newOrg, error: orgErr } = await admin.from('organizations').insert({
        name: DEMO_ORG_NAME,
        slug: DEMO_ORG_SLUG,
        plan: 'business_growth',
        credits_balance: 5000,
        created_by: userId,
        industry: 'Marketing & Advertising',
        team_size: '11-50',
        primary_use_case: 'Branded social campaigns',
        monthly_volume: '50-100 videos',
        brand_voice: 'Confident, modern, witty — concise lines, strong hooks.',
        brand_colors: ['#0A84FF', '#0F172A', '#F8FAFC'],
        brand_primary_color: '#0A84FF',
        brand_accent_color: '#F8FAFC',
        billing_email: DEMO_EMAIL,
        onboarding_completed: true,
      }).select('id').single()
      if (orgErr) throw orgErr
      orgId = newOrg.id
    }

    // 4. Ensure membership as admin
    await admin.from('organization_members').upsert({
      organization_id: orgId,
      user_id: userId,
      role: 'admin',
    }, { onConflict: 'organization_id,user_id' })

    return new Response(
      JSON.stringify({ ok: true, email: DEMO_EMAIL, password: DEMO_PASSWORD }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    console.error('demo-business-login error', e)
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})