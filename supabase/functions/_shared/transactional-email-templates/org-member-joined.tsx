import * as React from 'npm:react@18.3.1'
import { Link, Text } from 'npm:@react-email/components@0.0.22'
import { EmailLayout, styles } from './_layout.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  orgName?: string
  memberName?: string
  memberEmail?: string
  role?: string
  workspaceUrl?: string
}

function OrgMemberJoined({
  orgName = 'Your workspace',
  memberName = 'A new member',
  memberEmail = '',
  role = 'producer',
  workspaceUrl = 'https://smallbridges.co/workspace/team',
}: Props) {
  return (
    <EmailLayout preview={`${memberName} joined ${orgName}`}>
      <Text style={styles.h1}>{memberName} just joined {orgName}.</Text>
      <Text style={styles.body}>
        They accepted your invite{memberEmail ? ` (${memberEmail})` : ''} and joined as <strong style={{ color: '#fff' }}>{role}</strong>.
      </Text>
      <Link href={workspaceUrl} style={styles.button}>Open team</Link>
      <Text style={styles.muted}>You can change their role or remove them anytime from the Team page.</Text>
    </EmailLayout>
  )
}

export const template: TemplateEntry = {
  component: OrgMemberJoined,
  displayName: 'Org · Member Joined',
  subject: (d: Props) => `${d?.memberName ?? 'A new member'} joined ${d?.orgName ?? 'your workspace'}`,
  previewData: {
    orgName: 'Acme Studio',
    memberName: 'Jordan Lee',
    memberEmail: 'jordan@acme.com',
    role: 'producer',
    workspaceUrl: 'https://smallbridges.co/workspace/team',
  },
}