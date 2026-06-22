// Direct Resend transport. Replaces the former Lovable email proxy
// (`sendLovableEmail`). Sends a single pre-rendered email through the Resend
// HTTP API (https://resend.com/docs/api-reference/emails/send-email).
//
// Errors are thrown as `EmailSendError`, which carries the HTTP `status` and
// (when present) `retryAfterSeconds`. The queue dispatcher's existing 429/403
// handling reads exactly those fields, so its retry / rate-limit / DLQ logic
// keeps working unchanged after the transport swap.

export class EmailSendError extends Error {
  readonly status: number
  readonly retryAfterSeconds: number | null

  constructor(message: string, status: number, retryAfterSeconds: number | null = null) {
    super(message)
    this.name = 'EmailSendError'
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export interface ResendSendParams {
  to: string
  // Fully-formatted From header, e.g. `Small Bridges <noreply@notify.smallbridges.co>`.
  // The domain MUST be a verified sending domain in the Resend account.
  from: string
  subject: string
  html: string
  text?: string
  // Used as Resend's Idempotency-Key so retries of the same message never
  // produce duplicate sends (Resend dedupes for 24h on this key).
  idempotencyKey?: string
  // When both are provided, a one-click List-Unsubscribe header (RFC 8058) is
  // attached pointing at the unsubscribe function with this token.
  unsubscribeToken?: string
  unsubscribeBaseUrl?: string
  // Optional tag for Resend dashboard filtering (e.g. the template name).
  label?: string
}

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

export async function sendResendEmail(
  params: ResendSendParams,
  opts: { apiKey: string },
): Promise<{ id: string }> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${opts.apiKey}`,
    'Content-Type': 'application/json',
  }
  // Resend treats a repeated Idempotency-Key (within 24h) as the same request.
  if (params.idempotencyKey) headers['Idempotency-Key'] = params.idempotencyKey

  const body: Record<string, unknown> = {
    from: params.from,
    to: [params.to],
    subject: params.subject,
    html: params.html,
  }
  if (params.text) body.text = params.text

  // Resend tag values must match /^[A-Za-z0-9_-]+$/; sanitize the label.
  if (params.label) {
    const value = params.label.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 256)
    if (value) body.tags = [{ name: 'label', value }]
  }

  if (params.unsubscribeToken && params.unsubscribeBaseUrl) {
    const url = `${params.unsubscribeBaseUrl}?token=${encodeURIComponent(params.unsubscribeToken)}`
    body.headers = {
      'List-Unsubscribe': `<${url}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    }
  }

  let res: Response
  try {
    res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
  } catch (e) {
    // Network/transport failure — surface as a 5xx so the dispatcher retries.
    throw new EmailSendError(
      `Resend request failed: ${e instanceof Error ? e.message : String(e)}`,
      503,
    )
  }

  if (!res.ok) {
    let message = `Resend API error ${res.status}`
    try {
      const err = await res.json()
      if (err?.message) message = String(err.message)
      else if (err?.error) message = String(err.error)
    } catch {
      // non-JSON body — keep the generic message
    }

    let retryAfterSeconds: number | null = null
    const retryAfter = res.headers.get('retry-after')
    if (retryAfter) {
      const n = Number(retryAfter)
      if (!Number.isNaN(n)) retryAfterSeconds = n
    }

    throw new EmailSendError(message, res.status, retryAfterSeconds)
  }

  const data = await res.json().catch(() => ({}))
  return { id: typeof data?.id === 'string' ? data.id : '' }
}
