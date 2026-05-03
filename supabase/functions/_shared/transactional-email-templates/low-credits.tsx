import * as React from 'npm:react@18.3.1'
import { Link, Text } from 'npm:@react-email/components@0.0.22'
import { EmailLayout, styles } from './_layout.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props { balance?: number }

function LowCredits({ balance = 0 }: Props) {
  return (
    <EmailLayout preview={`Only ${balance} credits left in your account`}>
      <Text style={styles.h1}>Running low on credits.</Text>
      <Text style={styles.body}>
        Your balance dropped to <strong style={{ color: '#fff' }}>{balance} credits</strong>. Top up now so your next scene generates without interruption.
      </Text>
      <Link href="https://apex-studio.ai/settings?section=billing" style={styles.button}>Buy credits</Link>
      <Text style={styles.muted}>Credits never expire. $0.10 per credit, pay-as-you-go.</Text>
    </EmailLayout>
  )
}

export const template: TemplateEntry = {
  component: LowCredits,
  displayName: 'Low Credits',
  subject: (d: Props) => `Only ${d?.balance ?? 0} credits left`,
  previewData: { balance: 8 },
}