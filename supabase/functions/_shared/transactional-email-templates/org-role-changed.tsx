import * as React from 'npm:react@18.3.1'
import { Link, Text } from 'npm:@react-email/components@0.0.22'
import { EmailLayout, styles } from './_layout.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  orgName?: string
  newRole?: string
  changedBy?: string
  workspaceUrl?: string
}

function OrgRoleChanged({
  orgName = 'Your workspace',
  newRole = 'producer',
  changedBy = 'An admin',
  workspaceUrl = 'https://smallbridges.co/workspace',
}: Props) {
  return (
    <EmailLayout preview={`Your role in ${orgName} is now ${newRole}`}>
      <Text style={styles.h1}>Your role changed.</Text>
      <Text style={styles.body}>
        {changedBy} updated your role in <strong style={{ color: '#fff' }}>{orgName}</strong> to <strong style={{ color: '#fff' }}>{newRole}</strong>.
      </Text>
      <Link href={workspaceUrl} style={styles.button}>Open workspace</Link>
      <Text style={styles.muted}>If this wasn’t expected, contact your workspace owner.</Text>
    </EmailLayout>
  )
}

export const template: TemplateEntry = {
  component: OrgRoleChanged,
  displayName: 'Org · Role Changed',
  subject: (d: Props) => `Your role in ${d?.orgName ?? 'your workspace'} is now ${d?.newRole ?? 'updated'}`,
  previewData: {
    orgName: 'Acme Studio',
    newRole: 'admin',
    changedBy: 'Sasha',
    workspaceUrl: 'https://smallbridges.co/workspace',
  },
}