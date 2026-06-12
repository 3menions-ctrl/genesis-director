import * as React from 'npm:react@18.3.1'
import { Text, Hr } from 'npm:@react-email/components@0.0.22'
import { EmailLayout, styles } from './_layout.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  title?: string
  body?: string
  severity?: 'info' | 'warn' | 'critical'
  href?: string
  [key: string]: any
}

const SEV_COLOR: Record<string, string> = {
  info: '#0A84FF',
  warn: '#FFB020',
  critical: '#FF3B30',
}

function AdminAlert({ title = 'Admin alert', body = '', severity = 'info', href, ...rest }: Props) {
  const color = SEV_COLOR[severity] || SEV_COLOR.info
  const extras = Object.entries(rest).filter(([k, v]) =>
    !['title','body','severity','href'].includes(k) && v != null && typeof v !== 'object'
  )
  return (
    <EmailLayout preview={title} footerNote={`Internal admin alert — severity: ${severity}`}>
      <Text style={{ ...styles.h1, color }}>{title}</Text>
      {body && <Text style={styles.body}>{body}</Text>}
      {extras.length > 0 && <Hr style={{ borderColor: '#1A1F28', margin: '16px 0' }} />}
      {extras.map(([k, v]) => (
        <React.Fragment key={k}>
          <Text style={styles.muted}>{k}</Text>
          <Text style={styles.body}>{String(v)}</Text>
        </React.Fragment>
      ))}
      {href && (<>
        <Hr style={{ borderColor: '#1A1F28', margin: '16px 0' }} />
        <Text style={styles.muted}>Open: https://smallbridges.com{href}</Text>
      </>)}
    </EmailLayout>
  )
}

export const template: TemplateEntry = {
  component: AdminAlert,
  displayName: 'Admin: Generic Alert',
  subject: (d: Props) => `[Small Bridges${d?.severity === 'critical' ? ' · CRITICAL' : d?.severity === 'warn' ? ' · WARN' : ''}] ${d?.title || 'Admin alert'}`,
  to: 'smallbridges.com@smallbridges.com',
  previewData: { title: 'Stuck pipeline job', body: 'Project abc12345 stuck for 42 minutes.', severity: 'warn', href: '/admin/projects' },
}
