import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Hr, Html, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'

const BG = '#06080C'
const SURFACE = '#0E1218'
const BORDER = '#1A1F28'
const TEXT = '#E7ECF2'
const MUTED = '#8A93A0'
const ACCENT = '#0A84FF'

export function EmailLayout({
  preview, children, footerNote,
}: { preview: string; children: React.ReactNode; footerNote?: string }) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: BG, fontFamily: 'ui-serif, Georgia, "Times New Roman", serif', margin: 0, padding: '32px 0' }}>
        <Container style={{ maxWidth: 560, margin: '0 auto', backgroundColor: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: 'hidden' }}>
          <Section style={{ padding: '28px 32px 8px 32px' }}>
            <Text style={{ color: ACCENT, fontSize: 11, letterSpacing: '0.32em', textTransform: 'uppercase', fontFamily: 'ui-sans-serif, system-ui', margin: 0 }}>
              Apex Studio
            </Text>
          </Section>
          <Section style={{ padding: '0 32px 24px 32px' }}>{children}</Section>
          <Hr style={{ borderColor: BORDER, margin: 0 }} />
          <Section style={{ padding: '20px 32px' }}>
            <Text style={{ color: MUTED, fontSize: 12, lineHeight: '1.6', margin: 0 }}>
              {footerNote || 'You receive this because you have an active Apex Studio account.'}
            </Text>
            <Text style={{ color: MUTED, fontSize: 11, lineHeight: '1.6', marginTop: 8 }}>
              <Link href="https://apex-studio.ai/settings?section=notifications" style={{ color: MUTED, textDecoration: 'underline' }}>
                Manage email preferences
              </Link>
              {' · '}
              <Link href="{{unsubscribeUrl}}" style={{ color: MUTED, textDecoration: 'underline' }}>Unsubscribe</Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const styles = {
  h1: { color: TEXT, fontSize: 28, fontWeight: 300, lineHeight: '1.2', margin: '12px 0 8px 0' } as const,
  body: { color: TEXT, fontSize: 15, lineHeight: '1.65', margin: '12px 0' } as const,
  muted: { color: MUTED, fontSize: 13, lineHeight: '1.6', margin: '8px 0' } as const,
  button: {
    display: 'inline-block', backgroundColor: ACCENT, color: '#fff',
    padding: '12px 22px', borderRadius: 12, textDecoration: 'none',
    fontFamily: 'ui-sans-serif, system-ui', fontSize: 14, fontWeight: 500,
    marginTop: 16,
  } as const,
}