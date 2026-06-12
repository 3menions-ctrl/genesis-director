import * as React from 'npm:react@18.3.1'
import { Link, Text } from 'npm:@react-email/components@0.0.22'
import { EmailLayout, styles } from './_layout.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  projectTitle?: string
  projectUrl?: string
}

function RenderComplete({ projectTitle = 'Your project', projectUrl = 'https://smallbridges.co/projects' }: Props) {
  return (
    <EmailLayout preview={`${projectTitle} is ready to watch`}>
      <Text style={styles.h1}>Your render is ready.</Text>
      <Text style={styles.body}>
        <strong style={{ color: '#fff' }}>{projectTitle}</strong> just finished generating. Open it in Small Bridges to watch, edit, or share.
      </Text>
      <Link href={projectUrl} style={styles.button}>Watch now</Link>
      <Text style={styles.muted}>Tip — projects stay in your Library forever; download or remix anytime.</Text>
    </EmailLayout>
  )
}

export const template: TemplateEntry = {
  component: RenderComplete,
  displayName: 'Render Complete',
  subject: (d: Props) => `🎬 ${d?.projectTitle ?? 'Your project'} is ready`,
  previewData: { projectTitle: 'Neon City Chase', projectUrl: 'https://smallbridges.co/projects' },
}