import * as React from 'npm:react@18.3.1'
import { Text, Hr } from 'npm:@react-email/components@0.0.22'
import { EmailLayout, styles } from './_layout.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  fromName?: string
  fromEmail?: string
  subject?: string
  message?: string
  source?: string
  userId?: string | null
  submittedAt?: string
}

function AdminContactMessage({
  fromName = 'Anonymous',
  fromEmail = 'unknown@unknown',
  subject = '(no subject)',
  message = '',
  source = 'contact',
  userId = null,
  submittedAt = new Date().toISOString(),
}: Props) {
  return (
    <EmailLayout preview={`New ${source} message: ${subject}`} footerNote="Internal admin notification — Small Bridges support inbox.">
      <Text style={styles.h1}>New support message</Text>
      <Text style={styles.body}>
        <strong style={{ color: '#fff' }}>{fromName}</strong> &lt;{fromEmail}&gt; submitted a message via <strong style={{ color: '#fff' }}>{source}</strong>.
      </Text>
      <Hr style={{ borderColor: '#1A1F28', margin: '16px 0' }} />
      <Text style={styles.muted}>Subject</Text>
      <Text style={styles.body}><strong style={{ color: '#fff' }}>{subject}</strong></Text>
      <Text style={styles.muted}>Message</Text>
      <Text style={{ ...styles.body, whiteSpace: 'pre-wrap' }}>{message}</Text>
      <Hr style={{ borderColor: '#1A1F28', margin: '16px 0' }} />
      <Text style={styles.muted}>User ID: {userId ?? 'guest'} · Submitted: {submittedAt}</Text>
    </EmailLayout>
  )
}

export const template: TemplateEntry = {
  component: AdminContactMessage,
  displayName: 'Admin: Contact Message',
  subject: (d: Props) => `[Small Bridges Support] ${d?.subject ?? 'New message'} — ${d?.fromName ?? 'Anonymous'}`,
  to: 'cole@smallbridges.co',
  previewData: {
    fromName: 'Jane Doe',
    fromEmail: 'jane@example.com',
    subject: 'Question about credits',
    message: 'Hi, I purchased 100 credits but only see 50 in my account.',
    source: 'contact',
    userId: null,
    submittedAt: new Date().toISOString(),
  },
}