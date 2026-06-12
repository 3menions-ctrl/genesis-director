import * as React from 'npm:react@18.3.1'
import { Text, Hr } from 'npm:@react-email/components@0.0.22'
import { EmailLayout, styles } from './_layout.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  fullName?: string
  workEmail?: string
  companyName?: string
  companySize?: string | null
  estimatedSeats?: number | null
  estimatedVideosPerMonth?: string | null
  tierInterest?: string
  useCase?: string | null
  message?: string | null
  submittedAt?: string
  inquiryId?: string
}

function AdminSalesInquiry({
  fullName = 'Unknown',
  workEmail = 'unknown@unknown',
  companyName = 'Unknown company',
  companySize = null,
  estimatedSeats = null,
  estimatedVideosPerMonth = null,
  tierInterest = 'enterprise',
  useCase = null,
  message = null,
  submittedAt = new Date().toISOString(),
  inquiryId = '',
}: Props) {
  return (
    <EmailLayout preview={`New ${tierInterest} inquiry from ${companyName}`} footerNote="Internal admin notification — sales inquiry submitted.">
      <Text style={styles.h1}>New sales inquiry</Text>
      <Text style={styles.body}>
        <strong style={{ color: '#fff' }}>{fullName}</strong> from <strong style={{ color: '#fff' }}>{companyName}</strong> requested a <strong style={{ color: '#0A84FF' }}>{tierInterest}</strong> conversation.
      </Text>
      <Hr style={{ borderColor: '#1A1F28', margin: '16px 0' }} />
      <Text style={styles.muted}>Contact</Text>
      <Text style={styles.body}>{fullName} &lt;{workEmail}&gt;</Text>
      <Text style={styles.muted}>Company</Text>
      <Text style={styles.body}>{companyName}{companySize ? ` · ${companySize}` : ''}</Text>
      {(estimatedSeats || estimatedVideosPerMonth) && (<>
        <Text style={styles.muted}>Scale</Text>
        <Text style={styles.body}>
          {estimatedSeats ? `${estimatedSeats} seats` : ''}
          {estimatedSeats && estimatedVideosPerMonth ? ' · ' : ''}
          {estimatedVideosPerMonth || ''}
        </Text>
      </>)}
      {useCase && (<>
        <Text style={styles.muted}>Use case</Text>
        <Text style={styles.body}>{useCase}</Text>
      </>)}
      {message && (<>
        <Text style={styles.muted}>Message</Text>
        <Text style={{ ...styles.body, whiteSpace: 'pre-wrap' }}>{message}</Text>
      </>)}
      <Hr style={{ borderColor: '#1A1F28', margin: '16px 0' }} />
      <Text style={styles.muted}>Inquiry ID: {inquiryId} · Submitted: {submittedAt}</Text>
    </EmailLayout>
  )
}

export const template: TemplateEntry = {
  component: AdminSalesInquiry,
  displayName: 'Admin: Sales Inquiry',
  subject: (d: Props) => `[Small Bridges Sales] ${d?.companyName ?? 'New inquiry'} — ${d?.tierInterest ?? 'enterprise'}`,
  to: 'cole@smallbridges.co',
  previewData: {
    fullName: 'Jane Doe',
    workEmail: 'jane@acme.com',
    companyName: 'Acme Inc.',
    companySize: '50-200',
    estimatedSeats: 25,
    estimatedVideosPerMonth: '100-500',
    tierInterest: 'enterprise',
    useCase: 'Marketing video production at scale',
    message: 'Looking to evaluate Small Bridges for our brand team.',
    submittedAt: new Date().toISOString(),
    inquiryId: '00000000-0000-0000-0000-000000000000',
  },
}