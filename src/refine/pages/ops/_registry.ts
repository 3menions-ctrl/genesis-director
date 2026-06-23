/**
 * Compile-time typing for the ops registry.
 *
 * `OpsPath` and `OpsFile` are template-literal types so any future entry that
 * doesn't follow the `/admin/<slug>` route + `Admin<Name>Page` component
 * naming convention fails the build instead of slipping through silently.
 *
 * The `satisfies OpsRegistry` clause below enforces the shape *while*
 * preserving the literal-string narrowing from `as const`, so consumers (and
 * tests) keep getting exact path/file unions instead of `string`.
 */
export type OpsPath = `/admin/${string}`;
export type OpsFile = `Admin${string}Page`;
export type OpsSection =
  | "Observability"
  | "Access"
  | "Money"
  | "Content"
  | "Growth"
  | "Comms"
  | "System";

export interface OpsRegistryEntry {
  readonly file: OpsFile;
  readonly path: OpsPath;
  readonly section: OpsSection;
  readonly label: string;
  readonly code: string;
}

export type OpsRegistry = readonly OpsRegistryEntry[];

export const OPS_PAGES = [
  {
    "file": "AdminAuditLogPage",
    "path": "/admin/audit",
    "section": "Observability",
    "label": "Audit",
    "code": "AUD"
  },
  {
    "file": "AdminEdgeLogsPage",
    "path": "/admin/edge-logs",
    "section": "Observability",
    "label": "Edge",
    "code": "EDG"
  },
  {
    "file": "AdminProvidersPage",
    "path": "/admin/providers",
    "section": "Observability",
    "label": "Provider",
    "code": "PRV"
  },
  {
    "file": "AdminQueuePage",
    "path": "/admin/queue",
    "section": "Observability",
    "label": "Queue",
    "code": "QUE"
  },
  {
    "file": "AdminStatusPage",
    "path": "/admin/status",
    "section": "Observability",
    "label": "Status",
    "code": "STA"
  },
  {
    "file": "AdminObservabilityPage",
    "path": "/admin/observability",
    "section": "Observability",
    "label": "Render telemetry",
    "code": "OBS"
  },
  {
    "file": "AdminBackupsPage",
    "path": "/admin/backups",
    "section": "Observability",
    "label": "Backups",
    "code": "BKP"
  },
  {
    "file": "AdminRolesPage",
    "path": "/admin/roles",
    "section": "Access",
    "label": "Roles",
    "code": "RLS"
  },
  {
    "file": "AdminTeamPage",
    "path": "/admin/team",
    "section": "Access",
    "label": "Admin",
    "code": "TEM"
  },
  {
    "file": "AdminSessionsPage",
    "path": "/admin/sessions",
    "section": "Access",
    "label": "Sessions",
    "code": "SES"
  },
  {
    "file": "AdminGdprPage",
    "path": "/admin/gdpr",
    "section": "Access",
    "label": "GDPR",
    "code": "GDP"
  },
  {
    "file": "AdminAbusePage",
    "path": "/admin/abuse",
    "section": "Access",
    "label": "Abuse",
    "code": "ABS"
  },
  {
    "file": "AdminSubscriptionsPage",
    "path": "/admin/subscriptions",
    "section": "Money",
    "label": "Subscriptions",
    "code": "SUB"
  },
  {
    "file": "AdminRefundsPage",
    "path": "/admin/refunds",
    "section": "Money",
    "label": "Refunds",
    "code": "REF"
  },
  {
    "file": "AdminCouponsPage",
    "path": "/admin/coupons",
    "section": "Money",
    "label": "Coupons",
    "code": "CPN"
  },
  {
    "file": "AdminReferralsPage",
    "path": "/admin/referrals",
    "section": "Money",
    "label": "Referrals",
    "code": "REF"
  },
  {
    "file": "AdminInvoicesPage",
    "path": "/admin/invoices",
    "section": "Money",
    "label": "Tax",
    "code": "INV"
  },
  {
    "file": "AdminReconcilePage",
    "path": "/admin/reconcile",
    "section": "Money",
    "label": "Stripe",
    "code": "REC"
  },
  {
    "file": "AdminAvatarCatalogPage",
    "path": "/admin/avatar-catalog",
    "section": "Content",
    "label": "Avatar",
    "code": "AVC"
  },
  {
    "file": "AdminGalleryCurationPage",
    "path": "/admin/gallery",
    "section": "Content",
    "label": "Gallery",
    "code": "GAL"
  },
  {
    "file": "AdminTemplatesAdminPage",
    "path": "/admin/template-library",
    "section": "Content",
    "label": "Template",
    "code": "TPL"
  },
  {
    "file": "AdminStoragePage",
    "path": "/admin/storage",
    "section": "Content",
    "label": "Asset",
    "code": "STG"
  },
  {
    "file": "AdminContentSafetyPage",
    "path": "/admin/content-safety",
    "section": "Content",
    "label": "Content",
    "code": "SAF"
  },
  {
    "file": "AdminAnalyticsPage",
    "path": "/admin/analytics",
    "section": "Growth",
    "label": "Analytics",
    "code": "ANL"
  },
  {
    "file": "AdminProjectionsPage",
    "path": "/admin/projections",
    "section": "Growth",
    "label": "Projections",
    "code": "PRJ"
  },
  {
    "file": "AdminOnboardingAnalyticsPage",
    "path": "/admin/onboarding-analytics",
    "section": "Growth",
    "label": "Onboarding",
    "code": "OBA"
  },
  {
    "file": "AdminExperimentsPage",
    "path": "/admin/experiments",
    "section": "Growth",
    "label": "A/B",
    "code": "AB"
  },
  {
    "file": "AdminCohortsPage",
    "path": "/admin/cohorts",
    "section": "Growth",
    "label": "Cohorts",
    "code": "COH"
  },
  {
    "file": "AdminFeatureFlagsPage",
    "path": "/admin/feature-flags",
    "section": "Growth",
    "label": "Feature",
    "code": "FLG"
  },
  {
    "file": "AdminAnnouncementsPage",
    "path": "/admin/announcements",
    "section": "Growth",
    "label": "Announcements",
    "code": "ANN"
  },
  {
    "file": "AdminEmailTemplatesPage",
    "path": "/admin/email-templates",
    "section": "Comms",
    "label": "Email",
    "code": "TPL"
  },
  {
    "file": "AdminNotificationsPage",
    "path": "/admin/notifications-center",
    "section": "Comms",
    "label": "Notification",
    "code": "NTF"
  },
  {
    "file": "AdminMacrosPage",
    "path": "/admin/macros",
    "section": "Comms",
    "label": "Support",
    "code": "MCR"
  },
  {
    "file": "AdminChangelogPage",
    "path": "/admin/changelog",
    "section": "Comms",
    "label": "Changelog",
    "code": "CHG"
  },
  {
    "file": "AdminApiKeysPage",
    "path": "/admin/api-keys",
    "section": "System",
    "label": "API",
    "code": "API"
  },
  {
    "file": "AdminWebhooksPage",
    "path": "/admin/webhooks",
    "section": "System",
    "label": "Webhooks",
    "code": "WHK"
  },
  {
    "file": "AdminSecretsPage",
    "path": "/admin/secrets",
    "section": "System",
    "label": "Secrets",
    "code": "SEC"
  },
  {
    "file": "AdminDbHealthPage",
    "path": "/admin/db-health",
    "section": "System",
    "label": "Database",
    "code": "DB"
  },
  {
    "file": "AdminCrashForensicsPage",
    "path": "/admin/crash-forensics",
    "section": "System",
    "label": "Crash",
    "code": "CRF"
  }
] as const satisfies OpsRegistry;

// Narrow string-union helpers derived directly from the registry.
export type RegisteredOpsPath = (typeof OPS_PAGES)[number]["path"];
export type RegisteredOpsFile = (typeof OPS_PAGES)[number]["file"];
