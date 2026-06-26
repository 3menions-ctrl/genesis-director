/**
 * AdminApp — the entire admin console as one self-contained, lazy-loaded module.
 *
 * App.tsx mounts this at `/admin/*` ONLY when ADMIN_ENABLED (dev / internal
 * build). Because it's reached through a single dead-code-eliminated dynamic
 * import, none of the ~50 admin pages below ship in the public production
 * bundle — the admin console stays off the public internet and is served only
 * from the dev server or an internal/VPN-hosted build, against the same
 * (server-enforced) Supabase backend.
 *
 * Routes mirror the previous in-App admin block. User-surface sub-routes
 * (editor, avatars, create, …) redirect to their public equivalents so this
 * module never imports consumer pages.
 */
import { lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

const RefineAdminLayout = lazy(() => import("../refine/AdminLayout").then((m) => ({ default: m.RefineAdminLayout })));
const AdminDashboardPage = lazy(() => import("../refine/pages/AdminDashboardPage"));
const AdminUsersPage = lazy(() => import("../refine/pages/AdminUsersPage"));
const AdminProjectsPage = lazy(() => import("../refine/pages/AdminProjectsPage"));
const AdminCreditsPage = lazy(() => import("../refine/pages/AdminCreditsPage"));
const AdminMessagesPage = lazy(() => import("../refine/pages/AdminMessagesPage"));
const AdminFinancePage = lazy(() => import("../refine/pages/AdminFinancePage"));
const AdminProductionPage = lazy(() => import("../refine/pages/AdminProductionPage"));
const AdminModerationPage = lazy(() => import("../refine/pages/AdminModerationPage"));
const AdminConfigPage = lazy(() => import("../refine/pages/AdminConfigPage"));
const PeopleHubPage = lazy(() => import("../refine/pages/hubs/PeopleHubPage"));
const ProductionHubPage = lazy(() => import("../refine/pages/hubs/ProductionHubPage"));
const MoneyHubPage = lazy(() => import("../refine/pages/hubs/MoneyHubPage"));
const GrowthHubPage = lazy(() => import("../refine/pages/hubs/GrowthHubPage"));
const SystemHubPage = lazy(() => import("../refine/pages/hubs/SystemHubPage"));
const AdminEmailsPage = lazy(() => import("../refine/pages/AdminEmailsPage"));
// Detail / CRUD pages — previously built but unrouted (now wired).
const AdminUserDetailPage = lazy(() => import("../refine/pages/AdminUserDetailPage"));
const AdminProjectDetailPage = lazy(() => import("../refine/pages/AdminProjectDetailPage"));
const AdminOrgDetailPage = lazy(() => import("../refine/pages/AdminOrgDetailPage"));
const AdminOrgsPage = lazy(() => import("../refine/pages/ops/AdminOrgsPage"));
const AdminCommentsPage = lazy(() => import("../refine/pages/ops/AdminCommentsPage"));
const AdminEventsPage = lazy(() => import("../refine/pages/ops/AdminEventsPage"));
const AdminInsightsPage = lazy(() => import("../refine/pages/ops/AdminInsightsPage"));
const AdminTrafficPage = lazy(() => import("../refine/pages/ops/AdminTrafficPage"));
const AdminPnlPage = lazy(() => import("../refine/pages/ops/AdminPnlPage"));
const AdminStorageBillingPage = lazy(() => import("../refine/pages/ops/AdminStorageBillingPage"));
const AdminDbDiagnosticsPage = lazy(() => import("../refine/pages/ops/AdminDbDiagnosticsPage"));
const AdminPackagesPage = lazy(() => import("../refine/pages/AdminPackagesPage"));

// ── Ops pages (38) ──────────────────────────────────────────
const AdminDiagnosticsPage = lazy(() => import("../refine/pages/ops/AdminDiagnosticsPage"));
const AdminAuditLogPage = lazy(() => import("../refine/pages/ops/AdminAuditLogPage"));
const AdminEdgeLogsPage = lazy(() => import("../refine/pages/ops/AdminEdgeLogsPage"));
const AdminProvidersPage = lazy(() => import("../refine/pages/ops/AdminProvidersPage"));
const AdminQueuePage = lazy(() => import("../refine/pages/ops/AdminQueuePage"));
const AdminStatusPage = lazy(() => import("../refine/pages/ops/AdminStatusPage"));
const AdminObservabilityPage = lazy(() => import("../refine/pages/ops/AdminObservabilityPage"));
const AdminBackupsPage = lazy(() => import("../refine/pages/ops/AdminBackupsPage"));
const AdminRolesPage = lazy(() => import("../refine/pages/ops/AdminRolesPage"));
const AdminTeamPage = lazy(() => import("../refine/pages/ops/AdminTeamPage"));
const AdminSessionsPage = lazy(() => import("../refine/pages/ops/AdminSessionsPage"));
const AdminGdprPage = lazy(() => import("../refine/pages/ops/AdminGdprPage"));
const AdminAbusePage = lazy(() => import("../refine/pages/ops/AdminAbusePage"));
const AdminSubscriptionsPage = lazy(() => import("../refine/pages/ops/AdminSubscriptionsPage"));
const AdminRefundsPage = lazy(() => import("../refine/pages/ops/AdminRefundsPage"));
const AdminCouponsPage = lazy(() => import("../refine/pages/ops/AdminCouponsPage"));
const AdminReferralsPage = lazy(() => import("../refine/pages/ops/AdminReferralsPage"));
const AdminInvoicesPage = lazy(() => import("../refine/pages/ops/AdminInvoicesPage"));
const AdminReconcilePage = lazy(() => import("../refine/pages/ops/AdminReconcilePage"));
const AdminAvatarCatalogPage = lazy(() => import("../refine/pages/ops/AdminAvatarCatalogPage"));
const AdminGalleryCurationPage = lazy(() => import("../refine/pages/ops/AdminGalleryCurationPage"));
const AdminTemplatesAdminPage = lazy(() => import("../refine/pages/ops/AdminTemplatesAdminPage"));
const AdminStoragePage = lazy(() => import("../refine/pages/ops/AdminStoragePage"));
const AdminContentSafetyPage = lazy(() => import("../refine/pages/ops/AdminContentSafetyPage"));
const AdminAnalyticsPage = lazy(() => import("../refine/pages/ops/AdminAnalyticsPage"));
const AdminProjectionsPage = lazy(() => import("../refine/pages/ops/AdminProjectionsPage"));
const AdminOnboardingAnalyticsPage = lazy(() => import("../refine/pages/ops/AdminOnboardingAnalyticsPage"));
const AdminExperimentsPage = lazy(() => import("../refine/pages/ops/AdminExperimentsPage"));
const AdminCohortsPage = lazy(() => import("../refine/pages/ops/AdminCohortsPage"));
const AdminFeatureFlagsPage = lazy(() => import("../refine/pages/ops/AdminFeatureFlagsPage"));
const AdminAnnouncementsPage = lazy(() => import("../refine/pages/ops/AdminAnnouncementsPage"));
const AdminEmailTemplatesPage = lazy(() => import("../refine/pages/ops/AdminEmailTemplatesPage"));
const AdminNotificationsPage = lazy(() => import("../refine/pages/ops/AdminNotificationsPage"));
const AdminMacrosPage = lazy(() => import("../refine/pages/ops/AdminMacrosPage"));
const AdminChangelogPage = lazy(() => import("../refine/pages/ops/AdminChangelogPage"));
const AdminApiKeysPage = lazy(() => import("../refine/pages/ops/AdminApiKeysPage"));
const AdminWebhooksPage = lazy(() => import("../refine/pages/ops/AdminWebhooksPage"));
const AdminSecretsPage = lazy(() => import("../refine/pages/ops/AdminSecretsPage"));
const AdminDbHealthPage = lazy(() => import("../refine/pages/ops/AdminDbHealthPage"));
const AdminCrashForensicsPage = lazy(() => import("../refine/pages/ops/AdminCrashForensicsPage"));

export default function AdminApp() {
  return (
    <Routes>
      <Route
        element={
          <ProtectedRoute>
            <RefineAdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboardPage />} />
        {/* Section hubs — sidebar groups 02–06 */}
        <Route path="people" element={<PeopleHubPage />} />
        <Route path="production-hub" element={<ProductionHubPage />} />
        <Route path="money" element={<MoneyHubPage />} />
        <Route path="growth" element={<GrowthHubPage />} />
        <Route path="system" element={<SystemHubPage />} />
        {/* User-surface sub-routes redirect to their public equivalents */}
        <Route path="library" element={<Navigate to="/library" replace />} />
        <Route path="create" element={<Navigate to="/studio" replace />} />
        <Route path="editor" element={<Navigate to="/editor" replace />} />
        <Route path="avatars" element={<Navigate to="/avatars" replace />} />
        <Route path="templates" element={<Navigate to="/studio?drawer=templates" replace />} />
        <Route path="training-video" element={<Navigate to="/studio?tab=training" replace />} />
        <Route path="environments" element={<Navigate to="/studio?drawer=environments" replace />} />
        <Route path="developers" element={<Navigate to="/account?tab=developers" replace />} />
        {/* Top-level admin pages */}
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="users/:userId" element={<AdminUserDetailPage />} />
        <Route path="projects" element={<AdminProjectsPage />} />
        <Route path="projects/:projectId" element={<AdminProjectDetailPage />} />
        <Route path="orgs" element={<AdminOrgsPage />} />
        <Route path="orgs/:orgId" element={<AdminOrgDetailPage />} />
        <Route path="credits" element={<AdminCreditsPage />} />
        <Route path="messages" element={<AdminMessagesPage />} />
        <Route path="finance" element={<AdminFinancePage />} />
        <Route path="production" element={<AdminProductionPage />} />
        <Route path="moderation" element={<AdminModerationPage />} />
        <Route path="config" element={<AdminConfigPage />} />
        <Route path="emails" element={<AdminEmailsPage />} />
        {/* ── Ops pages (38) ─────────────────────────── */}
        <Route path="diagnostics" element={<AdminDiagnosticsPage />} />
        <Route path="audit" element={<AdminAuditLogPage />} />
        <Route path="edge-logs" element={<AdminEdgeLogsPage />} />
        <Route path="providers" element={<AdminProvidersPage />} />
        <Route path="queue" element={<AdminQueuePage />} />
        <Route path="status" element={<AdminStatusPage />} />
        <Route path="observability" element={<AdminObservabilityPage />} />
        <Route path="backups" element={<AdminBackupsPage />} />
        <Route path="roles" element={<AdminRolesPage />} />
        <Route path="team" element={<AdminTeamPage />} />
        <Route path="sessions" element={<AdminSessionsPage />} />
        <Route path="gdpr" element={<AdminGdprPage />} />
        <Route path="abuse" element={<AdminAbusePage />} />
        <Route path="subscriptions" element={<AdminSubscriptionsPage />} />
        <Route path="refunds" element={<AdminRefundsPage />} />
        <Route path="coupons" element={<AdminCouponsPage />} />
        <Route path="referrals" element={<AdminReferralsPage />} />
        <Route path="invoices" element={<AdminInvoicesPage />} />
        <Route path="reconcile" element={<AdminReconcilePage />} />
        <Route path="avatar-catalog" element={<AdminAvatarCatalogPage />} />
        <Route path="gallery" element={<AdminGalleryCurationPage />} />
        <Route path="template-library" element={<AdminTemplatesAdminPage />} />
        <Route path="storage" element={<AdminStoragePage />} />
        <Route path="content-safety" element={<AdminContentSafetyPage />} />
        <Route path="comments" element={<AdminCommentsPage />} />
        <Route path="events" element={<AdminEventsPage />} />
        <Route path="insights" element={<AdminInsightsPage />} />
        <Route path="traffic" element={<AdminTrafficPage />} />
        <Route path="pnl" element={<AdminPnlPage />} />
        <Route path="storage-billing" element={<AdminStorageBillingPage />} />
        <Route path="db-diagnostics" element={<AdminDbDiagnosticsPage />} />
        <Route path="analytics" element={<AdminAnalyticsPage />} />
        <Route path="projections" element={<AdminProjectionsPage />} />
        <Route path="onboarding-analytics" element={<AdminOnboardingAnalyticsPage />} />
        <Route path="experiments" element={<AdminExperimentsPage />} />
        <Route path="cohorts" element={<AdminCohortsPage />} />
        <Route path="feature-flags" element={<AdminFeatureFlagsPage />} />
        <Route path="announcements" element={<AdminAnnouncementsPage />} />
        <Route path="email-templates" element={<AdminEmailTemplatesPage />} />
        <Route path="notifications-center" element={<AdminNotificationsPage />} />
        <Route path="macros" element={<AdminMacrosPage />} />
        <Route path="changelog" element={<AdminChangelogPage />} />
        <Route path="api-keys" element={<AdminApiKeysPage />} />
        <Route path="webhooks" element={<AdminWebhooksPage />} />
        <Route path="secrets" element={<AdminSecretsPage />} />
        <Route path="db-health" element={<AdminDbHealthPage />} />
        <Route path="crash-forensics" element={<AdminCrashForensicsPage />} />
        {/* Legacy admin redirects */}
        <Route path="financials" element={<Navigate to="/admin/finance" replace />} />
        <Route path="costs" element={<Navigate to="/admin/finance" replace />} />
        <Route path="packages" element={<AdminPackagesPage />} />
        <Route path="pipeline" element={<Navigate to="/admin/production" replace />} />
        <Route path="failed" element={<Navigate to="/admin/production" replace />} />
        <Route path="studio" element={<Navigate to="/admin/create" replace />} />
        <Route path="inventory" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  );
}
