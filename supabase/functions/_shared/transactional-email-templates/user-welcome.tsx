import * as React from 'npm:react@18.3.1'
import { Link, Text } from 'npm:@react-email/components@0.0.22'
import { EmailLayout, styles } from './_layout.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  displayName?: string
}

function UserWelcome({ displayName = 'there' }: Props) {
  return (
    <EmailLayout preview="Welcome to Small Bridges — your first video is on us">
      <Text style={styles.h1}>Welcome to Small Bridges, {displayName}.</Text>
      <Text style={styles.body}>
        Your <strong style={{ color: '#fff' }}>first 5-second video is free</strong> — generated on Wan. Drop in a prompt
        and watch your idea move, no card required.
      </Text>
      <Text style={styles.body}>
        Try a sample prompt, paste in your own concept, or browse the templates to find your starting point.
      </Text>
      <Link href="https://smallbridges.co/studio" style={styles.button}>
        Open the studio
      </Link>
      <Text style={styles.muted}>
        Ready to make more? Top up credits anytime from your{' '}
        <Link href="https://smallbridges.co/credits" style={{ color: '#6FB6FF' }}>
          Credits page
        </Link>
        .
      </Text>
    </EmailLayout>
  )
}

export const template: TemplateEntry = {
  component: UserWelcome,
  subject: (data: Props) => `Welcome to Small Bridges, ${data.displayName || 'there'} — your first video is on us`,
  displayName: 'User Welcome',
  previewData: {
    displayName: 'Jordan',
  },
}
