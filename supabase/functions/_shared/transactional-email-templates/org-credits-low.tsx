import * as React from 'npm:react@18.3.1'
import { Link, Text } from 'npm:@react-email/components@0.0.22'
import { EmailLayout, styles } from './_layout.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  orgName?: string
  balance?: number
  threshold?: number
  billingUrl?: string
}

function OrgCreditsLow({
  orgName = 'Your workspace',
  balance = 0,
  threshold = 100,
  billingUrl = 'https://smallbridges.co/workspace/billing',
}: Props) {
  return (
    <EmailLayout preview={`${orgName} is running low on credits`}>
      <Text style={styles.h1}>{orgName} is running low.</Text>
      <Text style={styles.body}>
        Your workspace balance is <strong style={{ color: '#fff' }}>{balance.toLocaleString()} credits</strong> — below the <strong style={{ color: '#fff' }}>{threshold.toLocaleString()}</strong> threshold. Top up to keep your team rendering without interruption.
      </Text>
      <Link href={billingUrl} style={styles.button}>Top up workspace</Link>
      <Text style={styles.muted}>Auto-refill is available on Business Growth and Scale.</Text>
    </EmailLayout>
  )
}

export const template: TemplateEntry = {
  component: OrgCreditsLow,
  displayName: 'Org · Credits Low',
  subject: (d: Props) => `${d?.orgName ?? 'Your workspace'} is low on credits`,
  previewData: {
    orgName: 'Acme Studio',
    balance: 47,
    threshold: 500,
    billingUrl: 'https://smallbridges.co/workspace/billing',
  },
}