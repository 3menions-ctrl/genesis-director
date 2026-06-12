import { lazy, Suspense, useEffect } from "react";
// Sonner is the canonical toast system; the legacy `@/components/ui/toaster`
// Radix-based renderer is no longer mounted to avoid duplicate stacking.
// Callers should use `import { toast } from "sonner"` everywhere.
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
import { StudioProvider } from "@/contexts/StudioContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { CreditsProvider } from "@/contexts/CreditsContext";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import MockupPreview from "./pages/MockupPreview";
import { RequireAccountType } from "@/components/auth/RequireAccountType";
import { EnterpriseGate } from "@/components/auth/EnterpriseGate";
import { AppLoader } from "@/components/ui/app-loader";
import { ErrorBoundary } from "@/components/ui/error-boundary";
// WorldChatButton removed - now a dedicated page
import { WelcomeVideoModal } from "@/components/welcome/WelcomeVideoModal";
import { GlobalPublishWizard } from "@/components/publish/GlobalPublishWizard";
import { GlobalAtomListingWizard } from "@/components/market/GlobalAtomListingWizard";
import { GlobalConfirmHost } from "@/components/ui/global-confirm";
import { GlobalStabilityBoundary } from "@/components/stability/GlobalStabilityBoundary";
import { RouteContainer } from "@/components/layout/RouteContainer";
import { NavigationLoadingProvider, GlobalLoadingOverlay } from "@/components/navigation";

import { NavigationGuardProvider, NavigationBridge } from "@/lib/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { AdaptiveShell } from "@/components/shell/AdaptiveShell";

import { crashForensics } from "@/lib/crashForensics";
import { getSafeModeStatus } from "@/lib/safeMode";

import { CommandPalette } from "@/components/agent/CommandPalette";

// Lazy load all pages for code splitting
// Tiny adapter to redirect legacy plural URLs (e.g. /universes/abc) to their
// canonical singular form (/universe/abc) while preserving the id param.
// React Router's `<Navigate to="/universe/:id">` treats `:id` as a literal,
// which silently 404s — this fixes that.
function LegacyParamRedirect({ to }: { to: string }) {
  const params = useParams<{ id?: string; userId?: string }>();
  const id = params.id ?? params.userId ?? "";
  return <Navigate to={`${to}/${id}`} replace />;
}

const Landing = lazy(() => import("./pages/Landing"));
const Studio = lazy(() => import("./pages/Studio"));
const Projects = lazy(() => import("./pages/Projects"));
const MediaLibraryPage = lazy(() => import("./pages/MediaLibrary"));
const Auth = lazy(() => import("./pages/Auth"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const StartOnboarding = lazy(() => import("./pages/StartOnboarding"));
const WelcomeCheckout = lazy(() => import("./pages/WelcomeCheckout"));
const Credits = lazy(() => import("./pages/Credits"));
const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("./pages/Settings"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const WorkspaceSettings = lazy(() => import("./pages/WorkspaceSettings"));
const WorkspaceTeam = lazy(() => import("./pages/workspace/WorkspaceTeam"));
const WorkspaceBrand = lazy(() => import("./pages/workspace/WorkspaceBrand"));
const WorkspaceBilling = lazy(() => import("./pages/workspace/WorkspaceBilling"));
const WorkspaceAnalytics = lazy(() => import("./pages/workspace/WorkspaceAnalytics"));
const WorkspaceOverview = lazy(() => import("./pages/workspace/WorkspaceOverview"));
const WorkspaceAssets = lazy(() => import("./pages/workspace/WorkspaceAssets"));
const WorkspaceProjects = lazy(() => import("./pages/workspace/WorkspaceProjects"));
const WorkspaceAvatars = lazy(() => import("./pages/workspace/WorkspaceAvatars"));
const WorkspaceCreate = lazy(() => import("./pages/workspace/WorkspaceCreate"));
const WorkspaceEditor = lazy(() => import("./pages/workspace/WorkspaceEditor"));
const WorkspaceTemplates = lazy(() => import("./pages/workspace/WorkspaceTemplates"));
const WorkspaceApprovals = lazy(() => import("./pages/workspace/WorkspaceApprovals"));
const WorkspacePermissions = lazy(() => import("./pages/workspace/WorkspacePermissions"));
const WorkspaceAuditLog = lazy(() => import("./pages/workspace/WorkspaceAuditLog"));
const WorkspaceCredits = lazy(() => import("./pages/workspace/WorkspaceCredits"));
const WorkspaceReports = lazy(() => import("./pages/workspace/WorkspaceReports"));
const WorkspaceIntegrations = lazy(() => import("./pages/workspace/WorkspaceIntegrations"));
const WorkspaceApi = lazy(() => import("./pages/workspace/WorkspaceApi"));
const WorkspaceNotifications = lazy(() => import("./pages/workspace/WorkspaceNotifications"));
const WorkspaceGeneral = lazy(() => import("./pages/workspace/WorkspaceGeneral"));
const WorkspaceSecurity = lazy(() => import("./pages/workspace/WorkspaceSecurity"));
const WorkspaceDanger = lazy(() => import("./pages/workspace/WorkspaceDanger"));
const AcceptInvite = lazy(() => import("./pages/AcceptInvite"));
const DeactivateAccount = lazy(() => import("./pages/DeactivateAccount"));
const Developers = lazy(() => import("./pages/Developers"));
const NotFound = lazy(() => import("./pages/NotFound"));
// Legacy Admin removed — replaced by Refine admin
const RefineAdminLayout = lazy(() => import("./refine/AdminLayout").then(m => ({ default: m.RefineAdminLayout })));
const AdminDashboardPage = lazy(() => import("./refine/pages/AdminDashboardPage"));
const AdminUsersPage = lazy(() => import("./refine/pages/AdminUsersPage"));
const AdminProjectsPage = lazy(() => import("./refine/pages/AdminProjectsPage"));
const AdminCreditsPage = lazy(() => import("./refine/pages/AdminCreditsPage"));
const AdminMessagesPage = lazy(() => import("./refine/pages/AdminMessagesPage"));
const AdminFinancePage = lazy(() => import("./refine/pages/AdminFinancePage"));
const AdminProductionPage = lazy(() => import("./refine/pages/AdminProductionPage"));
const AdminModerationPage = lazy(() => import("./refine/pages/AdminModerationPage"));
const AdminConfigPage = lazy(() => import("./refine/pages/AdminConfigPage"));
const AdminEmailsPage = lazy(() => import("./refine/pages/AdminEmailsPage"));

// ── Ops / missing admin pages (37) ──────────────────────────
const AdminAuditLogPage = lazy(() => import("./refine/pages/ops/AdminAuditLogPage"));
const AdminEdgeLogsPage = lazy(() => import("./refine/pages/ops/AdminEdgeLogsPage"));
const AdminProvidersPage = lazy(() => import("./refine/pages/ops/AdminProvidersPage"));
const AdminQueuePage = lazy(() => import("./refine/pages/ops/AdminQueuePage"));
const AdminStatusPage = lazy(() => import("./refine/pages/ops/AdminStatusPage"));
const AdminBackupsPage = lazy(() => import("./refine/pages/ops/AdminBackupsPage"));
const AdminRolesPage = lazy(() => import("./refine/pages/ops/AdminRolesPage"));
const AdminTeamPage = lazy(() => import("./refine/pages/ops/AdminTeamPage"));
const AdminSessionsPage = lazy(() => import("./refine/pages/ops/AdminSessionsPage"));
const AdminGdprPage = lazy(() => import("./refine/pages/ops/AdminGdprPage"));
const AdminAbusePage = lazy(() => import("./refine/pages/ops/AdminAbusePage"));
const AdminSubscriptionsPage = lazy(() => import("./refine/pages/ops/AdminSubscriptionsPage"));
const AdminRefundsPage = lazy(() => import("./refine/pages/ops/AdminRefundsPage"));
const AdminCouponsPage = lazy(() => import("./refine/pages/ops/AdminCouponsPage"));
const AdminReferralsPage = lazy(() => import("./refine/pages/ops/AdminReferralsPage"));
const AdminInvoicesPage = lazy(() => import("./refine/pages/ops/AdminInvoicesPage"));
const AdminReconcilePage = lazy(() => import("./refine/pages/ops/AdminReconcilePage"));
const AdminAvatarCatalogPage = lazy(() => import("./refine/pages/ops/AdminAvatarCatalogPage"));
const AdminGalleryCurationPage = lazy(() => import("./refine/pages/ops/AdminGalleryCurationPage"));
const AdminTemplatesAdminPage = lazy(() => import("./refine/pages/ops/AdminTemplatesAdminPage"));
const AdminStoragePage = lazy(() => import("./refine/pages/ops/AdminStoragePage"));
const AdminContentSafetyPage = lazy(() => import("./refine/pages/ops/AdminContentSafetyPage"));
const AdminAnalyticsPage = lazy(() => import("./refine/pages/ops/AdminAnalyticsPage"));
const AdminOnboardingAnalyticsPage = lazy(() => import("./refine/pages/ops/AdminOnboardingAnalyticsPage"));
const AdminExperimentsPage = lazy(() => import("./refine/pages/ops/AdminExperimentsPage"));
const AdminCohortsPage = lazy(() => import("./refine/pages/ops/AdminCohortsPage"));
const AdminFeatureFlagsPage = lazy(() => import("./refine/pages/ops/AdminFeatureFlagsPage"));
const AdminAnnouncementsPage = lazy(() => import("./refine/pages/ops/AdminAnnouncementsPage"));
const AdminEmailTemplatesPage = lazy(() => import("./refine/pages/ops/AdminEmailTemplatesPage"));
const AdminNotificationsPage = lazy(() => import("./refine/pages/ops/AdminNotificationsPage"));
const AdminMacrosPage = lazy(() => import("./refine/pages/ops/AdminMacrosPage"));
const AdminChangelogPage = lazy(() => import("./refine/pages/ops/AdminChangelogPage"));
const AdminApiKeysPage = lazy(() => import("./refine/pages/ops/AdminApiKeysPage"));
const AdminWebhooksPage = lazy(() => import("./refine/pages/ops/AdminWebhooksPage"));
const AdminSecretsPage = lazy(() => import("./refine/pages/ops/AdminSecretsPage"));
const AdminDbHealthPage = lazy(() => import("./refine/pages/ops/AdminDbHealthPage"));
const AdminCrashForensicsPage = lazy(() => import("./refine/pages/ops/AdminCrashForensicsPage"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Contact = lazy(() => import("./pages/Contact"));

const ScriptReview = lazy(() => import("./pages/ScriptReview"));
const Production = lazy(() => import("./pages/Production"));

const HelpCenter = lazy(() => import("./pages/HelpCenter"));
const Templates = lazy(() => import("./pages/Templates"));
const Environments = lazy(() => import("./pages/Environments"));
const Mascots = lazy(() => import("./pages/Mascots"));
const AvatarsGallery = lazy(() => import("./pages/AvatarsGallery"));
// Discover removed - redirects to /creators
const Blog = lazy(() => import("./pages/Blog"));
const Press = lazy(() => import("./pages/Press"));
const TrainingVideo = lazy(() => import("./pages/TrainingVideo"));
// ExtractThumbnails removed — orphan utility with no nav entry
const Create = lazy(() => import("./pages/CreateCanvas"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Avatars = lazy(() => import("./pages/Avatars"));
const VideoDetail = lazy(() => import("./pages/VideoDetail"));
const HowItWorks = lazy(() => import("./pages/HowItWorks"));
const VideoEditorPage = lazy(() => import("./pages/VideoEditor"));

// Entertainment Hub (public watch experience — the Netflix half)
const Lobby = lazy(() => import("./pages/Lobby"));
const Theater = lazy(() => import("./pages/Theater"));
const WorldDetail = lazy(() => import("./pages/WorldDetail"));
// Entertainment Hub (creator economy — the YouTube half)
const Creators = lazy(() => import("./pages/Creators"));
// Entertainment Hub (atom marketplace)
const Market = lazy(() => import("./pages/Market"));
// Crossover — next-gen VFX template library (break-out effects)
const Crossover = lazy(() => import("./pages/Crossover"));
// Entertainment Hub (universes — shared worldbuilding)
const UniverseDetail = lazy(() => import("./pages/UniverseDetail"));
const Universes = lazy(() => import("./pages/Universes"));
// Entertainment Hub (crews — persistent collab groups)
const Crews = lazy(() => import("./pages/Crews"));
const CrewDetail = lazy(() => import("./pages/CrewDetail"));
// Entertainment Hub (universal discovery)
const SearchHub = lazy(() => import("./pages/SearchHub"));
// Entertainment Hub (year-in-review)
const DirectorCards = lazy(() => import("./pages/DirectorCards"));
// Entertainment Hub (music parallel surface)
const MusicHub = lazy(() => import("./pages/MusicHub"));
const SupportInbox = lazy(() => import("./pages/SupportInbox"));
const Messages = lazy(() => import("./pages/Messages"));
// Director Studio — multi-scene cockpit creation experience
const DirectorStudio = lazy(() => import("./pages/DirectorStudio"));

const WidgetLanding = lazy(() => import("./pages/WidgetLanding"));
const WidgetEmbed = lazy(() => import("./pages/WidgetEmbed"));
// Public sharing — unauthenticated, viral
const PublicShare = lazy(() => import("./pages/PublicShare"));
const EmbedPlayer = lazy(() => import("./pages/EmbedPlayer"));
const EnterpriseComingSoon = lazy(() => import("./pages/EnterpriseComingSoon"));

// Route change tracker component
function RouteChangeTracker() {
  const location = useLocation();
  
  useEffect(() => {
    crashForensics.recordRoute(location.pathname);
  }, [location.pathname]);
  
  return null;
}

// Boot checkpoint markers
function BootCheckpointMarker() {
  useEffect(() => {
    // Mark A2 - first render
    crashForensics.checkpoint('A2');
    
    // Mark A3 - hydration complete (after a tick)
    const timer = setTimeout(() => {
      crashForensics.checkpoint('A3');
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);
  
  return null;
}



// Error boundaries RE-ENABLED for production stability
const App = () => {
  // Mark A1 checkpoint - router setup begins
  useEffect(() => {
    crashForensics.checkpoint('A1');
  }, []);
  
  return (
  <GlobalStabilityBoundary>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Sonner />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            {/* Boot checkpoint markers */}
            <BootCheckpointMarker />
            {/* Route change tracker for forensics */}
            <RouteChangeTracker />
          <NavigationLoadingProvider>
            <NavigationGuardProvider>
            <NavigationBridge>
            <AuthProvider>
              <CreditsProvider>
              <WorkspaceProvider>
              <StudioProvider>
                {/* Global Loading Overlay for smooth transitions */}
                <GlobalLoadingOverlay />
                <Routes>
                {/* Public routes - each wrapped for isolation */}
                <Route path="/" element={
                  <RouteContainer fallbackMessage="Loading...">
                    <Landing />
                  </RouteContainer>
                } />
                <Route path="/mockup" element={<MockupPreview />} />
                <Route path="/auth" element={
                  <RouteContainer fallbackMessage="Loading authentication...">
                    <Auth />
                  </RouteContainer>
                } />
                <Route path="/auth/callback" element={
                  <RouteContainer fallbackMessage="Verifying...">
                    <AuthCallback />
                  </RouteContainer>
                } />
                <Route path="/forgot-password" element={
                  <RouteContainer>
                    <ForgotPassword />
                  </RouteContainer>
                } />
                <Route path="/reset-password" element={
                  <RouteContainer>
                    <ResetPassword />
                  </RouteContainer>
                } />
                <Route path="/terms" element={
                  <RouteContainer>
                    <Terms />
                  </RouteContainer>
                } />
                <Route path="/privacy" element={
                  <RouteContainer>
                    <Privacy />
                  </RouteContainer>
                } />
                <Route path="/unsubscribe" element={
                  <RouteContainer fallbackMessage="Loading…">
                    <Unsubscribe />
                  </RouteContainer>
                } />
                <Route path="/contact" element={
                  <RouteContainer>
                    <AdaptiveShell><Contact /></AdaptiveShell>
                  </RouteContainer>
                } />
                {/* Enterprise — Coming Soon + lead capture (no signup). All entry points land here. */}
                <Route path="/enterprise" element={<Navigate to="/enterprise/coming-soon" replace />} />
                <Route path="/enterprise/onboarding" element={<Navigate to="/enterprise/coming-soon" replace />} />
                <Route path="/enterprise/coming-soon" element={
                  <RouteContainer fallbackMessage="Loading…">
                    <EnterpriseComingSoon />
                  </RouteContainer>
                } />
                {/* /discover → /search is the natural hub-discovery path now */}
                <Route path="/discover" element={<Navigate to="/search" replace />} />
                <Route path="/search" element={
                  <RouteContainer fallbackMessage="Loading search...">
                    <AppShell><SearchHub /></AppShell>
                  </RouteContainer>
                } />
                <Route path="/help" element={
                  <RouteContainer>
                    <AdaptiveShell><HelpCenter /></AdaptiveShell>
                  </RouteContainer>
                } />
                <Route path="/blog" element={
                  <RouteContainer>
                    <AdaptiveShell><Blog /></AdaptiveShell>
                  </RouteContainer>
                } />
                <Route path="/press" element={
                  <RouteContainer>
                    <AdaptiveShell><Press /></AdaptiveShell>
                  </RouteContainer>
                } />
                {/* Consumer gallery sunset → redirect to projects (auth) or landing */}
                <Route path="/gallery" element={<Navigate to="/projects" replace />} />
                <Route path="/pricing" element={
                  <RouteContainer>
                    <AdaptiveShell><Pricing /></AdaptiveShell>
                  </RouteContainer>
                } />
                <Route path="/how-it-works" element={
                  <RouteContainer>
                    <AdaptiveShell><HowItWorks /></AdaptiveShell>
                  </RouteContainer>
                } />
                <Route path="/studio" element={
                  <RouteContainer fallbackMessage="Entering the studio…">
                    <Studio />
                  </RouteContainer>
                } />
                
                {/* Onboarding - protected but no layout */}
                <Route path="/onboarding" element={
                  <RouteContainer fallbackMessage="Setting up your experience...">
                    <ProtectedRoute>
                      <Onboarding />
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                {/* Pre-signup wizard — public, no auth required */}
                <Route path="/start" element={
                  <RouteContainer fallbackMessage="Loading…">
                    <StartOnboarding />
                  </RouteContainer>
                } />
                {/* Post-signup checkout handoff */}
                <Route path="/welcome/checkout" element={
                  <RouteContainer fallbackMessage="Preparing checkout…">
                    <ProtectedRoute>
                      <WelcomeCheckout />
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                <Route path="/messages" element={
                  <RouteContainer fallbackMessage="Loading messages…">
                    <ProtectedRoute>
                      <AppShell><Messages /></AppShell>
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                <Route path="/notifications" element={
                  <RouteContainer fallbackMessage="Loading inbox…">
                    <ProtectedRoute>
                      <Notifications />
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                <Route path="/credits" element={
                  <RouteContainer fallbackMessage="Loading Cinema plans…">
                    <ProtectedRoute>
                      <AppShell><Credits /></AppShell>
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                
                {/* Protected routes - each with isolated error boundary */}
                <Route path="/projects" element={
                  <RouteContainer fallbackMessage="Loading projects...">
                    <ProtectedRoute>
                      <AppShell><Projects /></AppShell>
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                <Route path="/media" element={
                  <RouteContainer fallbackMessage="Loading media library...">
                    <ProtectedRoute>
                      <AppShell><MediaLibraryPage /></AppShell>
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                {/* Profile is reachable by any signed-in user regardless of
                   account type — it's their personal identity page, not a
                   workspace surface. Previously this was gated by
                   RequireAccountType which redirected business/enterprise
                   accounts to /workspace/general, making the Profile menu
                   link feel broken for those users. */}
                <Route path="/profile" element={
                  <RouteContainer fallbackMessage="Loading profile...">
                    <ProtectedRoute>
                      <AppShell><Profile /></AppShell>
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                <Route path="/settings" element={
                  <RouteContainer fallbackMessage="Loading settings...">
                    <RequireAccountType allow={["personal", "admin"]} redirectTo="/workspace/general">
                      <AppShell><Settings /></AppShell>
                    </RequireAccountType>
                  </RouteContainer>
                } />
                <Route path="/settings/deactivate" element={
                  <RouteContainer fallbackMessage="Loading...">
                    <ProtectedRoute>
                      <AppShell><DeactivateAccount /></AppShell>
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                <Route path="/settings/support" element={
                  <RouteContainer fallbackMessage="Loading support inbox...">
                    <ProtectedRoute>
                      <AppShell><SupportInbox /></AppShell>
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                <Route path="/settings/workspace" element={
                  <RouteContainer fallbackMessage="Loading workspace...">
                    <ProtectedRoute>
                      <AppShell><WorkspaceSettings /></AppShell>
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                {/* Business workspace admin hub — separate from app /admin */}
                <Route path="/workspace" element={
                  <RouteContainer fallbackMessage="Loading workspace...">
                    <RequireAccountType allow={["business","enterprise","admin"]}>
                      <EnterpriseGate><WorkspaceOverview /></EnterpriseGate>
                    </RequireAccountType>
                  </RouteContainer>
                } />
                <Route path="/workspace/team" element={
                  <RouteContainer fallbackMessage="Loading team...">
                    <RequireAccountType allow={["business","enterprise","admin"]}>
                      <EnterpriseGate><WorkspaceTeam /></EnterpriseGate>
                    </RequireAccountType>
                  </RouteContainer>
                } />
                <Route path="/workspace/brand" element={
                  <RouteContainer fallbackMessage="Loading brand kit...">
                    <RequireAccountType allow={["business","enterprise","admin"]}>
                      <EnterpriseGate><WorkspaceBrand /></EnterpriseGate>
                    </RequireAccountType>
                  </RouteContainer>
                } />
                <Route path="/workspace/assets" element={
                  <RouteContainer fallbackMessage="Loading assets...">
                    <RequireAccountType allow={["business","enterprise","admin"]}>
                      <EnterpriseGate><WorkspaceAssets /></EnterpriseGate>
                    </RequireAccountType>
                  </RouteContainer>
                } />
                <Route path="/workspace/billing" element={
                  <RouteContainer fallbackMessage="Loading billing...">
                    <RequireAccountType allow={["business","enterprise","admin"]}>
                      <EnterpriseGate><WorkspaceBilling /></EnterpriseGate>
                    </RequireAccountType>
                  </RouteContainer>
                } />
                <Route path="/workspace/analytics" element={
                  <RouteContainer fallbackMessage="Loading analytics...">
                    <RequireAccountType allow={["business","enterprise","admin"]}>
                      <EnterpriseGate><WorkspaceAnalytics /></EnterpriseGate>
                    </RequireAccountType>
                  </RouteContainer>
                } />
                {/* New workspace pages */}
                {([
                  ['projects',      WorkspaceProjects],
                  ['avatars',       WorkspaceAvatars],
                  ['create',        WorkspaceCreate],
                  ['editor',        WorkspaceEditor],
                  ['templates',     WorkspaceTemplates],
                  ['approvals',     WorkspaceApprovals],
                  ['permissions',   WorkspacePermissions],
                  ['audit',         WorkspaceAuditLog],
                  ['credits',       WorkspaceCredits],
                  ['reports',       WorkspaceReports],
                  ['integrations',  WorkspaceIntegrations],
                  ['api',           WorkspaceApi],
                  ['notifications', WorkspaceNotifications],
                  ['general',       WorkspaceGeneral],
                  ['security',      WorkspaceSecurity],
                  ['danger',        WorkspaceDanger],
                ] as const).map(([slug, Comp]) => (
                  <Route key={slug} path={`/workspace/${slug}`} element={
                    <RouteContainer fallbackMessage="Loading workspace…">
                      <RequireAccountType allow={["business","enterprise","admin"]}>
                        <EnterpriseGate><Comp /></EnterpriseGate>
                      </RequireAccountType>
                    </RouteContainer>
                  } />
                ))}
                <Route path="/developers" element={
                  <RouteContainer fallbackMessage="Loading developer portal...">
                    <ProtectedRoute>
                      <AppShell><Developers /></AppShell>
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                <Route path="/invite/:token" element={
                  <RouteContainer fallbackMessage="Joining workspace...">
                    <AcceptInvite />
                  </RouteContainer>
                } />
                
                <Route path="/create" element={
                  <RouteContainer fallbackMessage="Entering Director Studio...">
                    <ProtectedRoute>
                      <AppShell><Create /></AppShell>
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                <Route path="/director" element={
                  <RouteContainer fallbackMessage="Loading director...">
                    <ProtectedRoute>
                      <AppShell><DirectorStudio /></AppShell>
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                <Route path="/me/year" element={
                  <RouteContainer fallbackMessage="Loading your year...">
                    <ProtectedRoute>
                      <AppShell><DirectorCards /></AppShell>
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                <Route path="/music" element={
                  <RouteContainer fallbackMessage="Loading music...">
                    <AppShell><MusicHub /></AppShell>
                  </RouteContainer>
                } />
                {/* /studio is rendered above (line 328) — only nested URLs need a legacy redirect. */}
                <Route path="/studio/*" element={<Navigate to="/create" replace />} />
                <Route path="/create/legacy" element={
                  <RouteContainer fallbackMessage="Preparing studio...">
                    <ProtectedRoute>
                      <AppShell><Create /></AppShell>
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                
                {/* Avatar Selection Page */}
                <Route path="/avatars" element={
                  <RouteContainer fallbackMessage="Loading avatars...">
                    <ProtectedRoute>
                      <AppShell><Avatars /></AppShell>
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                
                {/* Script Review Route */}
                <Route path="/script-review" element={
                  <RouteContainer fallbackMessage="Loading script review...">
                    <ProtectedRoute>
                      <AppShell><ScriptReview /></AppShell>
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                
                {/* Production Pipeline Routes - supports both query params and path params */}
                <Route path="/production" element={
                  <RouteContainer fallbackMessage="Loading production...">
                    <ProtectedRoute>
                      <AppShell><Production /></AppShell>
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                <Route path="/production/:projectId" element={
                  <RouteContainer fallbackMessage="Loading production...">
                    <ProtectedRoute>
                      <AppShell><Production /></AppShell>
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                
                {/* Keep production route for active productions */}
                
                {/* Legacy universe routes - redirect to projects */}
                {/* Canonical singular per hub convention. */}
                <Route path="/universe/:id" element={
                  <RouteContainer fallbackMessage="Loading universe...">
                    <AppShell><UniverseDetail /></AppShell>
                  </RouteContainer>
                } />
                {/* Legacy plural URL — redirect to singular, preserving id.
                    A literal `:id` in the `to` prop is a broken NoOp; route
                    through a small adapter that reads the param. */}
                <Route path="/universes/:id" element={<LegacyParamRedirect to="/universe" />} />
                <Route path="/universes" element={
                  <RouteContainer fallbackMessage="Loading universes...">
                    <AppShell><Universes /></AppShell>
                  </RouteContainer>
                } />
                
                {/* Templates Gallery */}
                <Route path="/templates" element={
                  <RouteContainer fallbackMessage="Loading templates...">
                    <ProtectedRoute>
                      <AppShell><Templates /></AppShell>
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                
                {/* Training Video Mode */}
                <Route path="/training-video" element={
                  <RouteContainer fallbackMessage="Loading training mode...">
                    <ProtectedRoute>
                      <AppShell><TrainingVideo /></AppShell>
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                
                {/* Environments DNA */}
                <Route path="/environments" element={
                  <RouteContainer fallbackMessage="Loading environments...">
                    <ProtectedRoute>
                      <AppShell><Environments /></AppShell>
                    </ProtectedRoute>
                  </RouteContainer>
                } />

                {/* Brand Mascot Pack */}
                <Route path="/mascots" element={
                  <RouteContainer fallbackMessage="Loading mascot pack...">
                    <ProtectedRoute>
                      <AppShell><Mascots /></AppShell>
                    </ProtectedRoute>
                  </RouteContainer>
                } />

                {/* Avatar Gallery — style-tagged cast */}
                <Route path="/avatars-gallery" element={
                  <RouteContainer fallbackMessage="Loading avatar gallery...">
                    <ProtectedRoute>
                      <AppShell><AvatarsGallery /></AppShell>
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                
                {/* Consumer social hub sunset — redirect to projects */}
                <Route path="/creators" element={
                  <RouteContainer fallbackMessage="Loading creators...">
                    <AppShell><Creators /></AppShell>
                  </RouteContainer>
                } />
                {/* /c/:id renders the same comprehensive Profile component as
                    /profile, in "viewing-another-user" mode. Owner-only
                    affordances (edit, danger zone, credits tab) are hidden
                    automatically when the viewed user isn't the signed-in
                    user. Follow / Share become the primary CTAs. */}
                <Route path="/c/:id" element={
                  <RouteContainer fallbackMessage="Loading channel...">
                    <AppShell><Profile /></AppShell>
                  </RouteContainer>
                } />
                <Route path="/market" element={
                  <RouteContainer fallbackMessage="Loading market...">
                    <AppShell><Market /></AppShell>
                  </RouteContainer>
                } />
                {/* Crossover — VFX template library (50 break-out effects) */}
                <Route path="/crossover" element={
                  <RouteContainer fallbackMessage="Loading Crossover...">
                    <AppShell><Crossover /></AppShell>
                  </RouteContainer>
                } />
                <Route path="/crews" element={
                  <RouteContainer fallbackMessage="Loading crews...">
                    <AppShell><Crews /></AppShell>
                  </RouteContainer>
                } />
                <Route path="/crews/:id" element={
                  <RouteContainer fallbackMessage="Loading crew...">
                    <AppShell><CrewDetail /></AppShell>
                  </RouteContainer>
                } />
                <Route path="/user/:userId" element={<Navigate to="/projects" replace />} />

                {/* Chat route removed */}
                
                {/* Video Detail Page */}
                <Route path="/video/:videoId" element={
                  <RouteContainer fallbackMessage="Loading video...">
                    <AppShell><VideoDetail /></AppShell>
                  </RouteContainer>
                } />

                {/* ── Entertainment Hub — the public watch experience ── */}
                {/* These are reachable without auth (you should be able
                    to browse + watch reels signed out, like YouTube). */}
                <Route path="/lobby" element={
                  <RouteContainer fallbackMessage="Loading lobby...">
                    <AppShell><Lobby /></AppShell>
                  </RouteContainer>
                } />
                <Route path="/watch/:id" element={
                  <RouteContainer fallbackMessage="Loading theater...">
                    <AppShell><Theater /></AppShell>
                  </RouteContainer>
                } />
                <Route path="/world/:slug" element={
                  <RouteContainer fallbackMessage="Loading world...">
                    <AppShell><WorldDetail /></AppShell>
                  </RouteContainer>
                } />
                
                {/* Video Editor - Twick Studio. Both /editor and /editor/:id
                    resolve to the same page; the editor reads `:id` from
                    params or `?project=` from search. */}
                <Route path="/editor" element={
                  <RouteContainer fallbackMessage="Loading editor...">
                    <ProtectedRoute>
                      <VideoEditorPage />
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                <Route path="/editor/:id" element={
                  <RouteContainer fallbackMessage="Loading editor...">
                    <ProtectedRoute>
                      <VideoEditorPage />
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                
                <Route path="/w/:slug" element={
                  <RouteContainer fallbackMessage="Loading...">
                    <WidgetLanding />
                  </RouteContainer>
                } />
                {/* Viral public share — unauthenticated. RLS-gated by project_shares.is_public. */}
                <Route path="/p/:slug" element={
                  <RouteContainer fallbackMessage="Loading...">
                    <PublicShare />
                  </RouteContainer>
                } />
                {/* Minimal iframe-friendly player. No shell, no auth. */}
                <Route path="/embed/:slug" element={
                  <RouteContainer fallbackMessage="">
                    <EmbedPlayer />
                  </RouteContainer>
                } />
                <Route path="/widget/:publicKey" element={
                  <RouteContainer fallbackMessage="">
                    <WidgetEmbed />
                  </RouteContainer>
                } />
                
                {/* Admin — Refine-powered */}
                <Route path="/admin" element={
                  <RouteContainer fallbackMessage="Loading admin...">
                    <ProtectedRoute>
                      <RefineAdminLayout />
                    </ProtectedRoute>
                  </RouteContainer>
                }>
                  <Route index element={<AdminDashboardPage />} />
                  <Route path="library" element={<Projects />} />
                  <Route path="create" element={<Create />} />
                  <Route path="editor" element={<VideoEditorPage />} />
                  <Route path="avatars" element={<Avatars />} />
                  <Route path="templates" element={<Templates />} />
                  <Route path="training-video" element={<TrainingVideo />} />
                  <Route path="environments" element={<Environments />} />
                  <Route path="developers" element={<Developers />} />
                  <Route path="users" element={<AdminUsersPage />} />
                  <Route path="projects" element={<AdminProjectsPage />} />
                  <Route path="credits" element={<AdminCreditsPage />} />
                  <Route path="messages" element={<AdminMessagesPage />} />
                  <Route path="finance" element={<AdminFinancePage />} />
                  <Route path="production" element={<AdminProductionPage />} />
                  <Route path="moderation" element={<AdminModerationPage />} />
                  <Route path="config" element={<AdminConfigPage />} />
                  <Route path="emails" element={<AdminEmailsPage />} />
                  {/* ── Ops pages (37) ─────────────────────────── */}
                  <Route path="audit" element={<AdminAuditLogPage />} />
                  <Route path="edge-logs" element={<AdminEdgeLogsPage />} />
                  <Route path="providers" element={<AdminProvidersPage />} />
                  <Route path="queue" element={<AdminQueuePage />} />
                  <Route path="status" element={<AdminStatusPage />} />
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
                  <Route path="analytics" element={<AdminAnalyticsPage />} />
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
                  <Route path="packages" element={<Navigate to="/admin/finance" replace />} />
                  <Route path="pipeline" element={<Navigate to="/admin/production" replace />} />
                  <Route path="failed" element={<Navigate to="/admin/production" replace />} />
                  <Route path="audit" element={<Navigate to="/admin" replace />} />
                  <Route path="gallery" element={<Navigate to="/admin" replace />} />
                  <Route path="studio" element={<Navigate to="/admin/create" replace />} />
                  <Route path="inventory" element={<Navigate to="/admin" replace />} />
                </Route>
                
                
                {/* Legacy redirect — extract-thumbnails had no nav entry */}
                <Route path="/extract-thumbnails" element={<Navigate to="/projects" replace />} />
                
                <Route path="*" element={
                  <RouteContainer>
                    <NotFound />
                  </RouteContainer>
                } />
                </Routes>
                {/* Diagnostics - Admin console only */}
                
                {/* Welcome Video Modal - shows once for new users */}
                <WelcomeVideoModal />
                {/* Publish Wizard — triggered by openPublishWizard(projectId) */}
                <GlobalPublishWizard />
                {/* Atom Listing Wizard — triggered by openAtomListingWizard() */}
                <GlobalAtomListingWizard />
                {/* Global confirm dialog — replaces native window.confirm() */}
                <GlobalConfirmHost />
                {/* Command Palette (Cmd+K) */}
                <CommandPalette />
              </StudioProvider>
              </WorkspaceProvider>
              </CreditsProvider>
            </AuthProvider>
            </NavigationBridge>
            </NavigationGuardProvider>
          </NavigationLoadingProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  </GlobalStabilityBoundary>
  );
};

export default App;
