import * as React from 'npm:react@18.3.1'
import { Link, Text } from 'npm:@react-email/components@0.0.22'
import { EmailLayout, styles } from './_layout.tsx'
import type { TemplateEntry } from './registry.ts'

function PaymentFailed() {
  return (
    <EmailLayout preview="We couldn't process your payment">
      <Text style={styles.h1}>Payment didn't go through.</Text>
      <Text style={styles.body}>
        Your most recent charge for Small Bridges failed. To keep your subscription and access active, please update your payment method.
      </Text>
      <Link href="https://smallbridges.com/settings?section=billing" style={styles.button}>Update payment</Link>
      <Text style={styles.muted}>If you do nothing, your subscription will be canceled at the end of the billing period.</Text>
    </EmailLayout>
  )
}

export const template: TemplateEntry = {
  component: PaymentFailed,
  displayName: 'Payment Failed',
  subject: 'Action required: payment failed',
  previewData: {},
}