import * as React from 'npm:react@18.3.1'
import { Text, Hr } from 'npm:@react-email/components@0.0.22'
import { EmailLayout, styles } from './_layout.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  buyerEmail?: string
  buyerUserId?: string
  credits?: number
  usd?: number
  stripePaymentId?: string | null
  purchasedAt?: string
}

function AdminCreditPurchase({
  buyerEmail = 'unknown@unknown',
  buyerUserId = '',
  credits = 0,
  usd = 0,
  stripePaymentId = null,
  purchasedAt = new Date().toISOString(),
}: Props) {
  return (
    <EmailLayout preview={`+$${Number(usd).toFixed(2)} from ${buyerEmail}`} footerNote="Internal admin notification — credit purchase confirmed.">
      <Text style={styles.h1}>New credit purchase</Text>
      <Text style={styles.body}>
        <strong style={{ color: '#fff' }}>{buyerEmail}</strong> bought <strong style={{ color: '#0A84FF' }}>{credits} credits</strong> for <strong style={{ color: '#0A84FF' }}>${Number(usd).toFixed(2)}</strong>.
      </Text>
      <Hr style={{ borderColor: '#1A1F28', margin: '16px 0' }} />
      <Text style={styles.muted}>Buyer</Text>
      <Text style={styles.body}><strong style={{ color: '#fff' }}>{buyerEmail}</strong></Text>
      <Text style={styles.muted}>Credits</Text>
      <Text style={styles.body}>{credits}</Text>
      <Text style={styles.muted}>Amount</Text>
      <Text style={styles.body}>${Number(usd).toFixed(2)} USD</Text>
      {stripePaymentId && (<>
        <Text style={styles.muted}>Stripe Payment</Text>
        <Text style={{ ...styles.body, fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{stripePaymentId}</Text>
      </>)}
      <Hr style={{ borderColor: '#1A1F28', margin: '16px 0' }} />
      <Text style={styles.muted}>User ID: {buyerUserId} · Purchased: {purchasedAt}</Text>
    </EmailLayout>
  )
}

export const template: TemplateEntry = {
  component: AdminCreditPurchase,
  displayName: 'Admin: Credit Purchase',
  subject: (d: Props) => `[Small Bridges] +$${Number(d?.usd ?? 0).toFixed(2)} · ${d?.credits ?? 0} credits — ${d?.buyerEmail ?? ''}`,
  to: 'cole@smallbridges.co',
  previewData: {
    buyerEmail: 'frank@example.com',
    buyerUserId: '00000000-0000-0000-0000-000000000000',
    credits: 100,
    usd: 10,
    stripePaymentId: 'pi_3OabcXYZ',
    purchasedAt: new Date().toISOString(),
  },
}