import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { Webhook } from 'npm:standardwebhooks@1.0.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { SignupEmail } from '../_shared/email-templates/signup.tsx'
import { InviteEmail } from '../_shared/email-templates/invite.tsx'
import { MagicLinkEmail } from '../_shared/email-templates/magic-link.tsx'
import { RecoveryEmail } from '../_shared/email-templates/recovery.tsx'
import { EmailChangeEmail } from '../_shared/email-templates/email-change.tsx'
import { ReauthenticationEmail } from '../_shared/email-templates/reauthentication.tsx'
import { publicErrorMessage } from '../_shared/safe-error.ts'

// @public-endpoint
// Supabase Auth "Send Email Hook" target. Supabase Auth (not an end user)
// POSTs here without a JWT; authenticity is enforced by verifying the
// SEND_EMAIL_HOOK_SECRET Standard-Webhooks signature in-handler.

// ────────────────────────────────────────────────────────────────────────────
// Native Supabase Auth "Send Email Hook".
//
// Supabase Auth POSTs here (Standard Webhooks signed) whenever it needs to send
// a confirmation / recovery / magic-link / invite / email-change / reauth email.
// We verify the signature, render the matching branded React template, and
// enqueue it for the dispatcher (process-email-queue), which sends via Resend.
//
// Enable in Supabase dashboard: Authentication → Emails → "Send Email Hook"
//   URI:    https://<project-ref>.supabase.co/functions/v1/auth-email-hook
//   Secret: copy into the SEND_EMAIL_HOOK_SECRET secret (format: v1,whsec_…)
//
// Payload shape: https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook
// ────────────────────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, webhook-id, webhook-timestamp, webhook-signature',
}

const EMAIL_SUBJECTS: Record<string, string> = {
  signup: 'Your Small Bridges verification code',
  invite: "You've been invited to Small Bridges",
  magiclink: 'Your Small Bridges login link',
  recovery: 'Reset your Small Bridges password',
  email_change: 'Confirm your new email',
  reauthentication: 'Your verification code',
}

// Maps Supabase's `email_action_type` to the React template + Supabase
// auth/v1/verify `type` query param. Supabase emits action types that match
// our template keys 1:1, except they must be lower-cased defensively.
const EMAIL_TEMPLATES: Record<string, React.ComponentType<any>> = {
  signup: SignupEmail,
  invite: InviteEmail,
  magiclink: MagicLinkEmail,
  recovery: RecoveryEmail,
  email_change: EmailChangeEmail,
  reauthentication: ReauthenticationEmail,
}

// Configuration. FROM_DOMAIN MUST be a domain verified in Resend.
// Using the root domain (the one already added to the Resend account).
const SITE_NAME = 'Small Bridges'
const ROOT_DOMAIN = 'smallbridges.co'
const FROM_DOMAIN = 'smallbridges.co'

// ── Preview endpoint (admin tooling) ────────────────────────────────────────
// Renders a template with sample data without sending. Gated behind the
// service-role key now that the Lovable preview proxy is gone.
const SAMPLE_PROJECT_URL = `https://${ROOT_DOMAIN}`
const SAMPLE_EMAIL = 'user@example.test'
const SAMPLE_DATA: Record<string, object> = {
  signup: { siteName: SITE_NAME, siteUrl: SAMPLE_PROJECT_URL, recipient: SAMPLE_EMAIL, confirmationUrl: SAMPLE_PROJECT_URL, token: '12345678' },
  magiclink: { siteName: SITE_NAME, confirmationUrl: SAMPLE_PROJECT_URL },
  recovery: { siteName: SITE_NAME, confirmationUrl: SAMPLE_PROJECT_URL },
  invite: { siteName: SITE_NAME, siteUrl: SAMPLE_PROJECT_URL, confirmationUrl: SAMPLE_PROJECT_URL },
  email_change: { siteName: SITE_NAME, oldEmail: SAMPLE_EMAIL, email: SAMPLE_EMAIL, newEmail: SAMPLE_EMAIL, confirmationUrl: SAMPLE_PROJECT_URL },
  reauthentication: { token: '12345678' },
}

async function handlePreview(req: Request): Promise<Response> {
  const previewCorsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: previewCorsHeaders })
  }

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const authHeader = req.headers.get('Authorization')
  if (!serviceKey || authHeader !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...previewCorsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let type: string
  try {
    type = (await req.json()).type
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
      status: 400,
      headers: { ...previewCorsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const EmailTemplate = EMAIL_TEMPLATES[type]
  if (!EmailTemplate) {
    return new Response(JSON.stringify({ error: `Unknown email type: ${type}` }), {
      status: 400,
      headers: { ...previewCorsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const html = await renderAsync(React.createElement(EmailTemplate, SAMPLE_DATA[type] || {}))
  return new Response(html, {
    status: 200,
    headers: { ...previewCorsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
  })
}

// ── Supabase Auth payload ────────────────────────────────────────────────────
interface SendEmailHookPayload {
  user: { email: string; new_email?: string }
  email_data: {
    token: string
    token_hash: string
    redirect_to: string
    email_action_type: string
    site_url: string
    token_new?: string
    token_hash_new?: string
  }
}

// Builds the Supabase verification link from a token hash. The verify endpoint
// lives on the Supabase API host (SUPABASE_URL), not the app's Site URL.
function buildConfirmationUrl(
  supabaseUrl: string,
  tokenHash: string,
  type: string,
  redirectTo: string,
): string {
  const params = new URLSearchParams({ token: tokenHash, type })
  if (redirectTo) params.set('redirect_to', redirectTo)
  return `${supabaseUrl}/auth/v1/verify?${params.toString()}`
}

async function handleWebhook(req: Request): Promise<Response> {
  const hookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!hookSecret || !supabaseUrl || !serviceKey) {
    console.error('Missing required environment variables (SEND_EMAIL_HOOK_SECRET / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)')
    return new Response(
      JSON.stringify({ error: { http_code: 500, message: 'Server configuration error' } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  // 1. Verify the Standard Webhooks signature against the raw body.
  const rawBody = await req.text()
  let payload: SendEmailHookPayload
  try {
    const wh = new Webhook(hookSecret.replace('v1,whsec_', ''))
    payload = wh.verify(rawBody, {
      'webhook-id': req.headers.get('webhook-id') ?? '',
      'webhook-timestamp': req.headers.get('webhook-timestamp') ?? '',
      'webhook-signature': req.headers.get('webhook-signature') ?? '',
    }) as SendEmailHookPayload
  } catch (error) {
    console.error('Webhook signature verification failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return new Response(
      JSON.stringify({ error: { http_code: 401, message: 'Invalid signature' } }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  const { user, email_data } = payload
  const emailType = (email_data?.email_action_type ?? '').toLowerCase()
  // For an email change the confirmation must go to the new address.
  const recipient = emailType === 'email_change' ? (user.new_email ?? user.email) : user.email

  console.log('Received auth email event', { emailType, recipient })

  const EmailTemplate = EMAIL_TEMPLATES[emailType]
  if (!EmailTemplate) {
    console.error('Unknown email action type', { emailType })
    return new Response(
      JSON.stringify({ error: { http_code: 400, message: `Unknown email action type: ${emailType}` } }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  const confirmationUrl = buildConfirmationUrl(
    supabaseUrl,
    email_data.token_hash,
    emailType,
    email_data.redirect_to,
  )

  const templateProps = {
    siteName: SITE_NAME,
    siteUrl: `https://${ROOT_DOMAIN}`,
    recipient,
    confirmationUrl,
    token: email_data.token,
    email: user.email,
    oldEmail: user.email,
    newEmail: user.new_email,
  }

  const html = await renderAsync(React.createElement(EmailTemplate, templateProps))
  const text = await renderAsync(React.createElement(EmailTemplate, templateProps), { plainText: true })

  // 2. Enqueue for the dispatcher (process-email-queue → Resend).
  const supabase = createClient(supabaseUrl, serviceKey)
  const messageId = crypto.randomUUID()

  // Log pending BEFORE enqueue so we have a record even if enqueue crashes.
  await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: emailType,
    recipient_email: recipient,
    status: 'pending',
  })

  const { error: enqueueError } = await supabase.rpc('enqueue_email', {
    queue_name: 'auth_emails',
    payload: {
      message_id: messageId,
      to: recipient,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      subject: EMAIL_SUBJECTS[emailType] || 'Notification',
      html,
      text,
      label: emailType,
      idempotency_key: messageId,
      queued_at: new Date().toISOString(),
    },
  })

  if (enqueueError) {
    console.error('Failed to enqueue auth email', { error: enqueueError, emailType })
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: emailType,
      recipient_email: recipient,
      status: 'failed',
      error_message: 'Failed to enqueue email',
    })
    return new Response(
      JSON.stringify({ error: { http_code: 500, message: 'Failed to enqueue email' } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  console.log('Auth email enqueued', { emailType, recipient })

  // Supabase treats a 200 with empty/`{}` body as "hook handled the email".
  return new Response('{}', {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  const url = new URL(req.url)

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (url.pathname.endsWith('/preview')) {
    return handlePreview(req)
  }

  try {
    return await handleWebhook(req)
  } catch (error) {
    console.error('Webhook handler error:', error)
    const message = publicErrorMessage(error)
    return new Response(
      JSON.stringify({ error: { http_code: 500, message } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
