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
import { RequireAccountType } from "@/components/auth/RequireAccountType";
import { EnterpriseGate } from "@/components/auth/EnterpriseGate";
import { WorkspaceLayout } from "@/components/workspace/WorkspaceLayout";
import { AppLoader } from "@/components/ui/app-loader";
import { ErrorBoundary } from "@/components/ui/error-boundary";
// WorldChatButton removed - now a dedicated page
import { WelcomeVideoModal } from "@/components/welcome/WelcomeVideoModal";
import { GlobalPublishWizard } from "@/components/publish/GlobalPublishWizard";
import { GlobalAtomListingWizard } from "@/components/market/GlobalAtomListingWizard";
import { GlobalConfirmHost } from "@/components/ui/global-confirm";
import { SkipToContent } from "@/components/a11y/SkipToContent";
import { CursorSpotlight } from "@/components/ui/cursor-spotlight";
import { CompanionPanel } from "@/components/companion/CompanionPanel";
import { ConcentrationOverlay } from "@/components/focus/ConcentrationMode";
import { TimeOfDayAura } from "@/components/studio/TimeOfDayAura";
import { VoicePalette } from "@/components/agent/VoicePalette";
import { OnThisDayNudge } from "@/components/nudge/OnThisDayNudge";
import { GlobalStabilityBoundary } from "@/components/stability/GlobalStabilityBoundary";
import { RouteContainer } from "@/components/layout/RouteContainer";
import { NavigationLoadingProvider, GlobalLoadingOverlay } from "@/components/navigation";

import { NavigationGuardProvider, NavigationBridge } from "@/lib/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { AdaptiveShell } from "@/components/shell/AdaptiveShell";

import { crashForensics } from "@/lib/crashForensics";
import { getSafeModeStatus } from "@/lib/safeMode";

import { CommandCenter } from "@/components/foundation/CommandCenter";

// Lazy load all pages for code splitting
// Tiny adapter to redirect legacy plural URLs (e.g. /universes/abc) to their
// canonical singular form (/universe/abc) while preserving the id param.
// React Router's `<Navigate to="/universe/:id">` treats `:id` as a literal,
// which silently 404s — this fixes that.
function LegacyParamRedirect({ to }: { to: string }) {
  const params = useParams<{ id?: string; userId?: string; videoId?: string }>();
  const id = params.id ?? params.userId ?? params.videoId ?? "";
  return <Navigate to={`${to}/${id}`} replace />;
}

const Landing = lazy(() => import("./pages/Landing"));
const Studio = lazy(() => import("./pages/Studio"));
const Auth = lazy(() => import("./pages/Auth"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const StartOnboarding = lazy(() => import("./pages/StartOnboarding"));
const WelcomeCheckout = lazy(() => import("./pages/WelcomeCheckout"));
const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("./pages/Settings"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
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

const Production = lazy(() => import("./pages/Production"));

const HelpCenter = lazy(() => import("./pages/HelpCenter"));
// Discover removed - redirects to /creators
const Blog = lazy(() => import("./pages/Blog"));
const Press = lazy(() => import("./pages/Press"));
// ExtractThumbnails removed — orphan utility with no nav entry
const Pricing = lazy(() => import("./pages/Pricing"));
const Avatars = lazy(() => import("./pages/Avatars"));
const HowItWorks = lazy(() => import("./pages/HowItWorks"));
const VideoEditorPage = lazy(() => import("./pages/VideoEditor"));

// ─── FOUNDATION SPINE ──────────────────────────────────────────────────────
// Canonical surfaces on Foundation design. Other routes redirect into these.
const Library = lazy(() => import("./pages/Library"));
const Reel = lazy(() => import("./pages/Reel"));
const Account = lazy(() => import("./pages/Account"));
const Cast = lazy(() => import("./pages/Cast"));

// Standalone creation-adjacent surfaces — restored after the earlier merge
// proved too aggressive. Each is a deep workflow / browse, not a tab.
const Templates = lazy(() => import("./pages/Templates"));
const Environments = lazy(() => import("./pages/Environments"));
const TrainingVideo = lazy(() => import("./pages/TrainingVideo"));
const Crossover = lazy(() => import("./pages/Crossover"));

// Entertainment Hub (public watch experience — the Netflix half)
const Lobby = lazy(() => import("./pages/Lobby"));
const WorldDetail = lazy(() => import("./pages/WorldDetail"));
// Entertainment Hub (creator economy — the YouTube half)
// Entertainment Hub (atom marketplace)
const Market = lazy(() => import("./pages/Market"));
// Crossover — next-gen VFX template library (break-out effects)
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

const WidgetLanding = lazy(() => import("./pages/WidgetLanding"));
const WidgetEmbed = lazy(() => import("./pages/WidgetEmbed"));
// Public sharing — unauthenticated, viral
const PublicShare = lazy(() => import("./pages/PublicShare"));
const EmbedPlayer = lazy(() => import("./pages/EmbedPlayer"));
const HiddenRoom = lazy(() => import("./pages/HiddenRoom"));
const EnterpriseComingSoon = lazy(() => import("./pages/EnterpriseComingSoon"));

// Route change tracker component
function RouteChangeTracker() {
  const location = useLocation();

  useEffect(() => {
    crashForensics.recordRoute(location.pathname);
    // Feed the concierge so the next-likely route gets pre-warmed.
    void import("@/lib/concierge").then(({ recordVisit, nextLikelyRoutes }) => {
      recordVisit(location.pathname);
      const nexts = nextLikelyRoutes(location.pathname);
      if (nexts.length === 0) return;
      // Schedule the prefetcher during browser idle time so first paint
      // for the current page isn't delayed.
      const schedule = (cb: () => void) => {
        const ric = (globalThis as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
        if (typeof ric === "function") ric(cb); else setTimeout(cb, 500);
      };
      schedule(() => {
        void import("@/lib/routePreload").then((mod) => {
          for (const p of nexts) {
            try { (mod as { prefetchByPath?: (p: string) => void }).prefetchByPath?.(p); }
            catch { /* noop */ }
          }
        });
      });
    });
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
            {/* WCAG 2.1 SC 2.4.1 — skip nav for keyboard users */}
            <SkipToContent />
            {/* Subtle cursor-following spotlight. Disabled on touch &
                reduced-motion devices internally. Adds "the room is lit
                by my attention" feel. */}
            <CursorSpotlight />
            {/* Time-of-day aura — soft hue tint that shifts with local time. */}
            <TimeOfDayAura />
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
                  <RouteContainer fallbackMessage="Loading…">
                    <Landing />
                  </RouteContainer>
                } />
                <Route path="/auth" element={
                  <RouteContainer fallbackMessage="Loading authentication…">
                    <Auth />
                  </RouteContainer>
                } />
                <Route path="/auth/callback" element={
                  <RouteContainer fallbackMessage="Verifying…">
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
                  <RouteContainer fallbackMessage="Loading search…">
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
                {/* Inbox cluster — Messages, Notifications, Credits all
                    live as tabs inside /account now. Standalone routes
                    redirect to their tab. */}
                <Route path="/messages" element={<Navigate to="/account?tab=messages" replace />} />
                <Route path="/notifications" element={<Navigate to="/account?tab=notifications" replace />} />
                <Route path="/credits" element={<Navigate to="/account?tab=credits" replace />} />
                
                {/* Protected routes - each with isolated error boundary */}
                {/* /projects is canonical Library's predecessor; folds in. */}
                <Route path="/projects" element={<Navigate to="/library" replace />} />

                {/* ── Foundation spine — canonical surfaces ───────────── */}
                <Route path="/library" element={
                  <RouteContainer fallbackMessage="Pulling up your library…">
                    <ProtectedRoute>
                      <Library />
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                <Route path="/r/:id" element={
                  <RouteContainer fallbackMessage="Loading the reel…">
                    <Reel />
                  </RouteContainer>
                } />
                <Route path="/account" element={
                  <RouteContainer fallbackMessage="Loading your account…">
                    <ProtectedRoute>
                      <Account />
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                {/* Legacy → canonical redirects */}
                <Route path="/reel/:id" element={<LegacyParamRedirect to="/r" />} />
                {/* /media folds into Library. The standalone MediaLibrary
                    page (assets browser) is retired; Library is where your
                    work lives. */}
                <Route path="/media" element={<Navigate to="/library" replace />} />
                {/* Profile is reachable by any signed-in user regardless of
                   account type — it's their personal identity page, not a
                   workspace surface. Previously this was gated by
                   RequireAccountType which redirected business/enterprise
                   accounts to /workspace/general, making the Profile menu
                   link feel broken for those users. */}
                <Route path="/profile" element={
                  <RouteContainer fallbackMessage="Loading profile…">
                    <ProtectedRoute>
                      <AppShell><Profile /></AppShell>
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                {/* /settings — folded into the unified Account surface as a tab.
                    Personal users land on Account; business accounts still get
                    routed to their workspace settings root. */}
                <Route path="/settings" element={
                  <RequireAccountType allow={["personal", "admin"]} redirectTo="/workspace/general">
                    <Navigate to="/account?tab=settings" replace />
                  </RequireAccountType>
                } />
                {/* Legacy /settings/* surfaces fold into Account tabs and
                    workspace settings. */}
                <Route path="/settings/deactivate" element={<Navigate to="/account?tab=settings" replace />} />
                <Route path="/settings/support" element={<Navigate to="/account?tab=messages" replace />} />
                <Route path="/settings/workspace" element={<Navigate to="/workspace/general" replace />} />
                {/* Business workspace admin hub — separate from app /admin.
                    Every workspace route is wrapped at this layer:
                      RouteContainer → RequireAccountType → EnterpriseGate
                      → WorkspaceLayout → page
                    Three pages (Create, Editor, Avatars) want full-bleed
                    canvases; the rest use the default padded shell. Lifting
                    WorkspaceLayout into the route definition fixes the
                    pre-existing bug where 14 pages rendered with no chrome. */}
                {([
                  ['',              WorkspaceOverview,    false, "Spinning up your workspace…"],
                  ['team',          WorkspaceTeam,        false, "Loading team…"],
                  ['brand',         WorkspaceBrand,       false, "Loading brand kit…"],
                  ['assets',        WorkspaceAssets,      false, "Loading assets…"],
                  ['billing',       WorkspaceBilling,     false, "Loading billing…"],
                  ['analytics',     WorkspaceAnalytics,   false, "Loading analytics…"],
                  ['projects',      WorkspaceProjects,    false, "Loading workspace projects…"],
                  ['avatars',       WorkspaceAvatars,     true,  "Loading workspace cast…"],
                  ['create',        WorkspaceCreate,      true,  "Entering workspace studio…"],
                  ['editor',        WorkspaceEditor,      true,  "Loading workspace editor…"],
                  ['templates',     WorkspaceTemplates,   false, "Loading templates…"],
                  ['approvals',     WorkspaceApprovals,   false, "Loading approvals…"],
                  ['permissions',   WorkspacePermissions, false, "Loading permissions…"],
                  ['audit',         WorkspaceAuditLog,    false, "Loading audit log…"],
                  ['credits',       WorkspaceCredits,     false, "Loading workspace credits…"],
                  ['reports',       WorkspaceReports,     false, "Loading reports…"],
                  ['integrations',  WorkspaceIntegrations,false, "Loading integrations…"],
                  ['api',           WorkspaceApi,         false, "Loading API keys…"],
                  ['notifications', WorkspaceNotifications,false,"Loading workspace inbox…"],
                  ['general',       WorkspaceGeneral,     false, "Loading workspace settings…"],
                  ['security',      WorkspaceSecurity,    false, "Loading security…"],
                  ['danger',        WorkspaceDanger,      false, "Loading danger zone…"],
                ] as const).map(([slug, Comp, fullBleed, fallback]) => (
                  <Route key={slug || 'overview'} path={`/workspace${slug ? `/${slug}` : ''}`} element={
                    <RouteContainer fallbackMessage={fallback}>
                      <RequireAccountType allow={["business","enterprise","admin"]}>
                        <EnterpriseGate>
                          <WorkspaceLayout fullBleed={fullBleed}>
                            <Comp />
                          </WorkspaceLayout>
                        </EnterpriseGate>
                      </RequireAccountType>
                    </RouteContainer>
                  } />
                ))}
                {/* Developers folds into Account → Developers tab. */}
                <Route path="/developers" element={<Navigate to="/account?tab=developers" replace />} />
                <Route path="/invite/:token" element={
                  <RouteContainer fallbackMessage="Joining workspace...">
                    <AcceptInvite />
                  </RouteContainer>
                } />
                
                {/* Studio is the single workshop. /create, /director, and
                    any /studio/* legacy nested URL fold into it. */}
                <Route path="/create" element={<Navigate to="/studio" replace />} />
                <Route path="/create/legacy" element={<Navigate to="/studio" replace />} />
                <Route path="/director" element={<Navigate to="/studio" replace />} />
                <Route path="/studio/*" element={<Navigate to="/studio" replace />} />
                <Route path="/me/year" element={
                  <RouteContainer fallbackMessage="Loading your year...">
                    <ProtectedRoute>
                      <AppShell><DirectorCards /></AppShell>
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                {/* /music and /market are now tabs inside /lobby. */}
                {/* Music — standalone parallel creation surface. */}
                <Route path="/music" element={
                  <RouteContainer fallbackMessage="Loading music…">
                    <MusicHub />
                  </RouteContainer>
                } />
                
                {/* Cast — Foundation surface that absorbs /avatars,
                    /avatars-gallery, and /mascots into one talent locker
                    with People · Mascots · Brand tabs. */}
                <Route path="/cast" element={
                  <RouteContainer fallbackMessage="Opening the locker…">
                    <ProtectedRoute>
                      <Cast />
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                {/* Avatars studio — standalone deep-workflow surface.
                    Cast (/cast) is the talent browse; Avatars is the
                    studio where you create + edit them. */}
                <Route path="/avatars" element={
                  <RouteContainer fallbackMessage="Calling cast to set…">
                    <ProtectedRoute>
                      <Avatars />
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                
                {/* Script Review now lives as a step inside the Studio
                    pipeline — generate → script ready → review → render.
                    Standalone route folds into /studio. */}
                <Route path="/script-review" element={<Navigate to="/studio" replace />} />
                
                {/* Production Pipeline Routes - supports both query params and path params */}
                <Route path="/production" element={
                  <RouteContainer fallbackMessage="Loading production…">
                    <ProtectedRoute>
                      <AppShell><Production /></AppShell>
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                <Route path="/production/:projectId" element={
                  <RouteContainer fallbackMessage="Loading production…">
                    <ProtectedRoute>
                      <AppShell><Production /></AppShell>
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                
                {/* Keep production route for active productions */}
                
                {/* Legacy universe routes - redirect to projects */}
                {/* Canonical singular per hub convention. */}
                <Route path="/universe/:id" element={
                  <RouteContainer fallbackMessage="Charting the universe…">
                    <AppShell><UniverseDetail /></AppShell>
                  </RouteContainer>
                } />
                {/* Legacy plural URL — redirect to singular, preserving id.
                    A literal `:id` in the `to` prop is a broken NoOp; route
                    through a small adapter that reads the param. */}
                <Route path="/universes/:id" element={<LegacyParamRedirect to="/universe" />} />
                <Route path="/universes" element={
                  <RouteContainer fallbackMessage="Charting the universes…">
                    <AppShell><Universes /></AppShell>
                  </RouteContainer>
                } />
                
                {/* Templates / Environments / Training are pickers and
                    modes that live inside Studio. The standalone routes
                    redirect with hints so Studio can preselect once the
                    drawer / mode embedding lands. */}
                {/* Templates · Environments · Training — standalone
                    creation-adjacent surfaces. Each is its own browse +
                    workflow; standalone respects the depth. */}
                <Route path="/templates" element={
                  <RouteContainer fallbackMessage="Pulling templates…">
                    <ProtectedRoute>
                      <Templates />
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                <Route path="/environments" element={
                  <RouteContainer fallbackMessage="Loading environments…">
                    <ProtectedRoute>
                      <Environments />
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                <Route path="/training-video" element={
                  <RouteContainer fallbackMessage="Loading training mode...">
                    <ProtectedRoute>
                      <TrainingVideo />
                    </ProtectedRoute>
                  </RouteContainer>
                } />

                {/* Legacy Cast routes — both fold into /cast tabs. */}
                <Route path="/mascots" element={<Navigate to="/cast?tab=mascots" replace />} />
                <Route path="/avatars-gallery" element={<Navigate to="/cast" replace />} />
                
                {/* /creators sunset — folds into universal Search. */}
                <Route path="/creators" element={<Navigate to="/search" replace />} />
                {/* /c/:id renders the same comprehensive Profile component as
                    /profile, in "viewing-another-user" mode. Owner-only
                    affordances (edit, danger zone, credits tab) are hidden
                    automatically when the viewed user isn't the signed-in
                    user. Follow / Share become the primary CTAs. */}
                <Route path="/c/:id" element={
                  <RouteContainer fallbackMessage="Loading channel…">
                    <AppShell><Profile /></AppShell>
                  </RouteContainer>
                } />
                {/* Market — standalone creation-economy surface. */}
                <Route path="/market" element={
                  <RouteContainer fallbackMessage="Opening the doors…">
                    <Market />
                  </RouteContainer>
                } />
                {/* Crossover is a creation mode — folds into Studio as a tab. */}
                {/* Crossover — standalone VFX template library
                    (50 break-out effects). Distinct from Studio modes. */}
                <Route path="/crossover" element={
                  <RouteContainer fallbackMessage="Loading Crossover...">
                    <Crossover />
                  </RouteContainer>
                } />
                <Route path="/crews" element={
                  <RouteContainer fallbackMessage="Rallying your crew…">
                    <AppShell><Crews /></AppShell>
                  </RouteContainer>
                } />
                <Route path="/crews/:id" element={
                  <RouteContainer fallbackMessage="Loading crew…">
                    <AppShell><CrewDetail /></AppShell>
                  </RouteContainer>
                } />
                <Route path="/user/:userId" element={<Navigate to="/projects" replace />} />

                {/* Chat route removed */}
                
                {/* Legacy /video/:videoId folds into canonical Reel /r/:id.
                    LegacyParamRedirect resolves :id / :userId / :videoId. */}
                <Route path="/video/:videoId" element={<LegacyParamRedirect to="/r" />} />

                {/* ── Entertainment Hub — the public watch experience ── */}
                {/* These are reachable without auth (you should be able
                    to browse + watch reels signed out, like YouTube). */}
                <Route path="/lobby" element={
                  <RouteContainer fallbackMessage="Reading the room…">
                    <Lobby />
                  </RouteContainer>
                } />
                {/* Legacy /watch/:id (Theater) folds into canonical Reel. */}
                <Route path="/watch/:id" element={<LegacyParamRedirect to="/r" />} />
                <Route path="/world/:slug" element={
                  <RouteContainer fallbackMessage="Loading world…">
                    <AppShell><WorldDetail /></AppShell>
                  </RouteContainer>
                } />
                
                {/* Video Editor - Twick Studio. Both /editor and /editor/:id
                    resolve to the same page; the editor reads `:id` from
                    params or `?project=` from search. */}
                <Route path="/editor" element={
                  <RouteContainer fallbackMessage="Loading the cutting room…">
                    <ProtectedRoute>
                      <VideoEditorPage />
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                <Route path="/editor/:id" element={
                  <RouteContainer fallbackMessage="Loading the cutting room…">
                    <ProtectedRoute>
                      <VideoEditorPage />
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                
                <Route path="/w/:slug" element={
                  <RouteContainer fallbackMessage="Loading…">
                    <WidgetLanding />
                  </RouteContainer>
                } />
                {/* Viral public share — unauthenticated. RLS-gated by project_shares.is_public. */}
                <Route path="/p/:slug" element={
                  <RouteContainer fallbackMessage="Loading…">
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
                {/* The Hidden Room — /loft — unmarked, not in any nav,
                    excluded from sitemap.xml. Daily-generated cinematic
                    installation; seed = userId × calendar date. */}
                <Route path="/loft" element={
                  <RouteContainer fallbackMessage="">
                    <HiddenRoom />
                  </RouteContainer>
                } />

                {/* Admin — Refine-powered */}
                <Route path="/admin" element={
                  <RouteContainer fallbackMessage="Booting the bridge…">
                    <ProtectedRoute>
                      <RefineAdminLayout />
                    </ProtectedRoute>
                  </RouteContainer>
                }>
                  <Route index element={<AdminDashboardPage />} />
                  <Route path="library" element={<Navigate to="/library" replace />} />
                  <Route path="create" element={<Navigate to="/studio" replace />} />
                  <Route path="editor" element={<VideoEditorPage />} />
                  <Route path="avatars" element={<Avatars />} />
                  {/* Templates / Environments / Training-Video lazy imports
                      were removed when the public routes folded into Studio.
                      The admin sub-routes redirect into the public Studio
                      equivalents so admins still reach the same surfaces. */}
                  <Route path="templates" element={<Navigate to="/studio?drawer=templates" replace />} />
                  <Route path="training-video" element={<Navigate to="/studio?tab=training" replace />} />
                  <Route path="environments" element={<Navigate to="/studio?drawer=environments" replace />} />
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
                {/* Hoppy — the persistent AI companion. Skipped for
                    pre-auth marketing routes via internal gating. */}
                <CompanionPanel />
                {/* Concentration mode — dims the world around the canvas
                    when the user starts creating. Esc returns. */}
                <ConcentrationOverlay />
                {/* Voice palette — Cmd/Ctrl+Shift+Space, speech → prompt. */}
                <VoicePalette />
                {/* "On this day" — surfaces a year/month/week-old project
                    as a remix nudge. Fires once per day per user. */}
                <OnThisDayNudge />
                {/* Command Center (Cmd+K / "/") — primary navigation surface */}
                <CommandCenter />
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
