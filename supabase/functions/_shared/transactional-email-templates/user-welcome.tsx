import * as React from 'npm:react@18.3.1'
import { Link, Text } from 'npm:@react-email/components@0.0.22'
import { EmailLayout, styles } from './_layout.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  displayName?: string
  starterCredits?: number
}

function UserWelcome({ displayName = 'there', starterCredits = 100 }: Props) {
  return (
    <EmailLayout preview="Welcome to Small Bridges — your starter credits are ready">
      <Text style={styles.h1}>Welcome to Small Bridges, {displayName}.</Text>
      <Text style={styles.body}>
        Small Bridges is free during beta — we've credited your account with{' '}
        <strong style={{ color: '#fff' }}>{starterCredits.toLocaleString()}</strong> starter credits so you can build something the moment you sign in.
      </Text>
      <Text style={styles.body}>
        Try a sample prompt, drop in your own concept, or browse the templates to find your starting point.
      </Text>
      <Link href="https://smallbridges.co/create" style={styles.button}>
        Open the studio
      </Link>
      <Text style={styles.muted}>
        Need more credits? Ask us anytime from your{' '}
        <Link href="https://smallbridges.co/credits" style={{ color: '#6FB6FF' }}>
          Credits page
        </Link>{' '}
        — we hand-allocate top-ups during beta.
      </Text>
    </EmailLayout>
  )
}

export const template: TemplateEntry = {
  component: UserWelcome,
  subject: (data: Props) => `Welcome to Small Bridges, ${data.displayName || 'there'} — your starter credits are ready`,
  displayName: 'User Welcome',
  previewData: {
    displayName: 'Jordan',
    starterCredits: 100,
  },
}
