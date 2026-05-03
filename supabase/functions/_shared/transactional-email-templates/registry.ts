import type { ComponentType } from 'npm:react@18.3.1'
import { template as renderComplete } from './render-complete.tsx'
import { template as lowCredits } from './low-credits.tsx'
import { template as paymentFailed } from './payment-failed.tsx'
import { template as orgMemberJoined } from './org-member-joined.tsx'
import { template as orgRoleChanged } from './org-role-changed.tsx'
import { template as orgCreditsLow } from './org-credits-low.tsx'

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
}