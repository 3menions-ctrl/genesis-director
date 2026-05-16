import * as React from 'npm:react@18.3.1'
import { Text, Hr } from 'npm:@react-email/components@0.0.22'
import { EmailLayout, styles } from './_layout.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  email?: string
  fullName?: string | null
  userId?: string
  signedUpAt?: string
  source?: string | null
}

function AdminNewSignup({
  email = 'unknown@unknown',
  fullName = null,
  userId = '',
  signedUpAt = new Date().toISOString(),
  source = null,
}: Props) {
  return (
    <EmailLayout preview={`New signup: ${email}`} footerNote="Internal admin notification — new user signed up to Apex Studio.">
      <Text style={styles.h1}>New signup</Text>
      <Text style={styles.body}>
        <strong style={{ color: '#fff' }}>{fullName || email}</strong> just created an account.
      </Text>
      <Hr style={{ borderColor: '#1A1F28', margin: '16px 0' }} />
      <Text style={styles.muted}>Email</Text>
      <Text style={styles.body}><strong style={{ color: '#fff' }}>{email}</strong></Text>
      {fullName && (<>
        <Text style={styles.muted}>Name</Text>
        <Text style={styles.body}>{fullName}</Text>
      </>)}
      {source && (<>
        <Text style={styles.muted}>Source</Text>
        <Text style={styles.body}>{source}</Text>
      </>)}
      <Hr style={{ borderColor: '#1A1F28', margin: '16px 0' }} />
      <Text style={styles.muted}>User ID: {userId} · Signed up: {signedUpAt}</Text>
    </EmailLayout>
  )
}

export const template: TemplateEntry = {
  component: AdminNewSignup,
  displayName: 'Admin: New Signup',
  subject: (d: Props) => `[Apex] New signup — ${d?.fullName || d?.email || 'unknown'}`,
  to: 'admincole@apex-studio.ai',
  previewData: {
    email: 'jane@example.com',
    fullName: 'Jane Doe',
    userId: '00000000-0000-0000-0000-000000000000',
    signedUpAt: new Date().toISOString(),
    source: 'web',
  },
}