import type { ComponentType } from 'npm:react@18.3.1'
import { template as renderComplete } from './render-complete.tsx'
import { template as lowCredits } from './low-credits.tsx'
import { template as paymentFailed } from './payment-failed.tsx'
import { template as orgMemberJoined } from './org-member-joined.tsx'
import { template as orgRoleChanged } from './org-role-changed.tsx'
import { template as orgCreditsLow } from './org-credits-low.tsx'
import { template as adminContactMessage } from './admin-contact-message.tsx'
import { template as adminNewSignup } from './admin-new-signup.tsx'
import { template as adminCreditPurchase } from './admin-credit-purchase.tsx'
import { template as adminSalesInquiry } from './admin-sales-inquiry.tsx'
import { template as adminAlert } from './admin-alert.tsx'

// Registry contract — used by send-transactional-email and preview-transactional-email.
export interface TemplateEntry {
  // React Email component
  component: ComponentType<any>
  // Subject can be static or derived from templateData
  subject: string | ((data: any) => string)
  // Friendly name shown in admin / preview UI
  displayName?: string
  // Sample data used by the preview function
  previewData?: Record<string, unknown>
  // Optional fixed recipient (overrides caller-provided recipientEmail)
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  render_complete: renderComplete,
  low_credits: lowCredits,
  payment_failed: paymentFailed,
  org_member_joined: orgMemberJoined,
  org_role_changed: orgRoleChanged,
  org_credits_low: orgCreditsLow,
  admin_contact_message: adminContactMessage,
  admin_new_signup: adminNewSignup,
  admin_credit_purchase: adminCreditPurchase,
  admin_sales_inquiry: adminSalesInquiry,
  admin_alert: adminAlert,
  admin_payment_failed: adminAlert,
  admin_refund: adminAlert,
  admin_dispute: adminAlert,
  admin_stuck_job: adminAlert,
  admin_account_deleted: adminAlert,
  admin_first_video: adminAlert,
  admin_abuse_signal: adminAlert,
  admin_error_spike: adminAlert,
  admin_high_value_purchase: adminCreditPurchase,
}