/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
  token: string
}

export const MagicLinkEmail = ({
  siteName,
  token,
}: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {siteName} sign-in code: {token}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={brand}>{siteName}</Heading>
        <Heading style={h1}>Sign in to your account</Heading>
        <Text style={text}>
          Use the code below to sign in to {siteName}.
        </Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={small}>This code expires in 10 minutes.</Text>
        <Text style={footer}>
          If you didn't request this, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '480px' }
const brand = { fontSize: '14px', fontWeight: 'bold' as const, color: '#0A84FF', letterSpacing: '0.08em', textTransform: 'uppercase' as const, margin: '0 0 24px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#0a0a0a', margin: '0 0 16px', letterSpacing: '-0.02em' }
const text = { fontSize: '15px', color: '#3a3a3a', lineHeight: '1.6', margin: '0 0 24px' }
const codeStyle = {
  fontFamily: '"SF Mono", Menlo, Consolas, monospace',
  fontSize: '34px', fontWeight: 'bold' as const, color: '#0a0a0a',
  letterSpacing: '0.4em', background: '#f5f6f8', borderRadius: '12px',
  padding: '20px 24px', textAlign: 'center' as const, margin: '0 0 16px',
}
const small = { fontSize: '13px', color: '#7a7a7a', margin: '0 0 32px', textAlign: 'center' as const }
const footer = { fontSize: '12px', color: '#999999', margin: '24px 0 0', borderTop: '1px solid #eee', paddingTop: '16px' }
