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
import { UserPreferencesProvider } from "@/contexts/UserPreferencesContext";
import { UserPreferencesApplier } from "@/components/system/UserPreferencesApplier";
import { DeactivatedAccountGate } from "@/components/system/DeactivatedAccountGate";
import { CreditsProvider } from "@/contexts/CreditsContext";
import { PageToneProvider } from "@/lib/page-tone";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ADMIN_ENABLED } from "./admin/adminEnabled";
import { AdminBounce } from "./admin/AdminBounce";
import { AnalyticsTracker } from "./components/analytics/AnalyticsTracker";
import { RequireAccountType } from "@/components/auth/RequireAccountType";
import { RedirectBusinessToModule } from "@/components/auth/RedirectBusinessToModule";
import { BusinessWorldIsolation } from "@/components/auth/BusinessWorldIsolation";
import { ModuleBaseContext } from "@/components/foundation/moduleBase";
import { EnterpriseGate } from "@/components/auth/EnterpriseGate";
import { BUSINESS_NAV_ITEMS } from "@/components/business/businessNav";
import { AppLoader } from "@/components/ui/app-loader";
import { ErrorBoundary } from "@/components/ui/error-boundary";
// WorldChatButton removed - now a dedicated page
// Global widgets are lazy-loaded. They were being eagerly imported AND
// re-rendered on every route change. Lazy + Suspense pushes them out
// of the initial bundle; React.memo on each prevents re-renders when
// no props changed (and none do — these read from contexts internally).
const WelcomeVideoModal = lazy(() => import("@/components/welcome/WelcomeVideoModal").then(m => ({ default: m.WelcomeVideoModal })));
const GlobalPublishWizard = lazy(() => import("@/components/publish/GlobalPublishWizard").then(m => ({ default: m.GlobalPublishWizard })));
const GlobalConfirmHost = lazy(() => import("@/components/ui/global-confirm").then(m => ({ default: m.GlobalConfirmHost })));
import { SkipToContent } from "@/components/a11y/SkipToContent";
import { CursorSpotlight } from "@/components/ui/cursor-spotlight";
const ConcentrationOverlay = lazy(() => import("@/components/focus/ConcentrationMode").then(m => ({ default: m.ConcentrationOverlay })));
import { TimeOfDayAura } from "@/components/studio/TimeOfDayAura";
const VoicePalette = lazy(() => import("@/components/agent/VoicePalette").then(m => ({ default: m.VoicePalette })));
const OnThisDayNudge = lazy(() => import("@/components/nudge/OnThisDayNudge").then(m => ({ default: m.OnThisDayNudge })));
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

const Cinema = lazy(() => import("./pages/Cinema"));
const StudioShowcase = lazy(() => import("./pages/StudioShowcase"));
const FilmsGallery = lazy(() => import("./pages/FilmsGallery"));
const Studio = lazy(() => import("./pages/Studio"));
const Auth = lazy(() => import("./pages/Auth"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const BusinessStart = lazy(() => import("./pages/BusinessStart"));
const WelcomeCheckout = lazy(() => import("./pages/WelcomeCheckout"));
const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("./pages/Settings"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
// Legacy /workspace pages are retired (redirected to /business). Only the
// editor wrapper is still reused — by the business Editor route.
const WorkspaceEditor = lazy(() => import("./pages/workspace/WorkspaceEditor"));

// Business module — new slick, borderless, business-only surface at /business.
// Parallel to /workspace until cutover. See src/components/business/.
const BusinessShell = lazy(() => import("@/components/business/BusinessShell").then(m => ({ default: m.BusinessShell })));
const BusinessRail = lazy(() => import("@/components/business/BusinessRail").then(m => ({ default: m.BusinessRail })));
const BusinessOverview = lazy(() => import("./pages/business/BusinessOverview"));
const BusinessComingSoon = lazy(() => import("./pages/business/BusinessComingSoon"));
const BusinessProjects = lazy(() => import("./pages/business/BusinessProjects"));
const BusinessAdStudio = lazy(() => import("./pages/business/BusinessAdStudio"));
const BusinessTeamAccess = lazy(() => import("./pages/business/BusinessTeamAccess"));
const BusinessSettings = lazy(() => import("./pages/business/BusinessSettings"));
const BusinessBilling = lazy(() => import("./pages/business/BusinessBilling"));
const BusinessAnalytics = lazy(() => import("./pages/business/BusinessAnalytics"));
const BusinessBrand = lazy(() => import("./pages/business/BusinessBrand"));
const BusinessCredits = lazy(() => import("./pages/business/BusinessCredits"));
const BusinessTemplates = lazy(() => import("./pages/business/BusinessTemplates"));
const BusinessReports = lazy(() => import("./pages/business/BusinessReports"));
const BusinessIntegrations = lazy(() => import("./pages/business/BusinessIntegrations"));
const BusinessApi = lazy(() => import("./pages/business/BusinessApi"));
const BusinessDistribution = lazy(() => import("./pages/business/BusinessDistribution"));
// Shell-agnostic workbenches — same creation tools, rendered inside BusinessShell.
const StudioWorkbench = lazy(() => import("./pages/Studio").then(m => ({ default: m.StudioWorkbench })));
const AvatarsWorkbench = lazy(() => import("./pages/Avatars").then(m => ({ default: m.AvatarsWorkbench })));
const EnvironmentsWorkbench = lazy(() => import("./pages/Environments").then(m => ({ default: m.EnvironmentsWorkbench })));
const TrainingWorkbench = lazy(() => import("./pages/TrainingVideo").then(m => ({ default: m.TrainingWorkbench })));
const BusinessAudit = lazy(() => import("./pages/business/BusinessAudit"));
const BusinessAssets = lazy(() => import("./pages/business/BusinessAssets"));
const AcceptInvite = lazy(() => import("./pages/AcceptInvite"));
const NotFound = lazy(() => import("./pages/NotFound"));
// Admin console — the entire /admin/* surface lives in one lazy module that is
// only compiled in when ADMIN_ENABLED (dev / internal build). The public
// production build tree-shakes it out entirely (see src/admin/adminEnabled.ts),
// so the admin console is never served on the public internet.
const AdminApp = ADMIN_ENABLED ? lazy(() => import("./admin/AdminApp")) : null;
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Contact = lazy(() => import("./pages/Contact"));

const Production = lazy(() => import("./pages/Production"));

// Legacy help center — kept around for the unlikely external link that
// still points at it (we redirect /help-center → /help below). The new
// /help surface (Help, HelpDoc) is the canonical window-to-the-admins.
const HelpCenter = lazy(() => import("./pages/HelpCenter"));
const Help = lazy(() => import("./pages/Help"));
const HelpDoc = lazy(() => import("./pages/HelpDoc"));
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

// Standalone creation-adjacent surfaces — restored after the earlier merge
// proved too aggressive. Each is a deep workflow / browse, not a tab.
const Templates = lazy(() => import("./pages/Templates"));
const Environments = lazy(() => import("./pages/Environments"));
const TrainingVideo = lazy(() => import("./pages/TrainingVideo"));
const Crossover = lazy(() => import("./pages/Crossover"));

// Entertainment Hub (public watch experience — the Netflix half).
// Lobby is now the unified hangout — the standalone Hobby page was
// cannibalized into it on 2026-06-15. Routes pointing at /hobby fall
// through to a redirect below so any existing links keep working.
const Lobby = lazy(() => import("./pages/Lobby"));
const WorldDetail = lazy(() => import("./pages/WorldDetail"));
// Entertainment Hub (creator economy — the YouTube half)
// Entertainment Hub (atom marketplace)
// Crossover — next-gen VFX template library (break-out effects)
// Entertainment Hub (universes — shared worldbuilding)
// Entertainment Hub (crews — persistent collab groups)
// Entertainment Hub (universal discovery)
const SearchHub = lazy(() => import("./pages/SearchHub"));
const ProfileDashboard = lazy(() => import("./pages/account/ProfileDashboard"));
const NotificationSettings = lazy(() => import("./pages/account/NotificationSettings"));
const PatronHubPage = lazy(() => import("./pages/PatronHubPage"));
const Inbox = lazy(() => import("./pages/Inbox"));
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

// Hoisted to module scope — was being dynamic-imported on every route
// change, queuing two microtask promises per navigation. Vite caches
// resolved modules but the microtask churn still hurt nav latency.
import { recordVisit, nextLikelyRoutes } from "@/lib/concierge";
import { prefetchByPath } from "@/lib/routePreload";

// Route change tracker component
function RouteChangeTracker() {
  const location = useLocation();

  useEffect(() => {
    // Defer everything to idle — recordRoute + recordVisit both
    // touch synchronously-scheduled JSON.stringify pipelines that
    // were blocking the new route's render. requestIdleCallback gives
    // the browser a chance to paint before we start bookkeeping.
    const schedule = (cb: () => void) => {
      const ric = (globalThis as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
      if (typeof ric === "function") ric(cb); else setTimeout(cb, 500);
    };
    schedule(() => {
      crashForensics.recordRoute(location.pathname);
      recordVisit(location.pathname);
      const nexts = nextLikelyRoutes(location.pathname);
      for (const p of nexts) {
        try { prefetchByPath?.(p); } catch { /* noop */ }
      }
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
              <UserPreferencesProvider>
              <UserPreferencesApplier />
              <DeactivatedAccountGate />
              <CreditsProvider>
              <WorkspaceProvider>
              <StudioProvider>
              <PageToneProvider>
                {/* Global Loading Overlay for smooth transitions */}
                <GlobalLoadingOverlay />
                {/* Hard world isolation: business/enterprise accounts can't
                    wander into the consumer-account app surfaces. */}
                <BusinessWorldIsolation />
                <AnalyticsTracker />
                <Routes>
                {/* Public routes - each wrapped for isolation */}
                {/* Immersive cinema landing is the single home page. */}
                <Route path="/" element={
                  <RouteContainer fallbackMessage="Loading…">
                    <Cinema />
                  </RouteContainer>
                } />
                {/* Legacy /cinema path redirects to the one home page. */}
                <Route path="/cinema" element={<Navigate to="/" replace />} />
                <Route path="/studio-showcase" element={
                  <RouteContainer fallbackMessage="Loading…">
                    <StudioShowcase />
                  </RouteContainer>
                } />
                <Route path="/films" element={
                  <RouteContainer fallbackMessage="Loading…">
                    <FilmsGallery />
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
                {/* /help — the new window-to-the-admins surface (Linear × A24).
                    /help/:slug renders the docs deep-link stubs (editor-manual,
                    render-pipeline, marketplace-policies, api-reference).
                    /help-center keeps the legacy article browser around for
                    any external link that still points at it. */}
                <Route path="/help" element={
                  <RouteContainer>
                    <AdaptiveShell><Help /></AdaptiveShell>
                  </RouteContainer>
                } />
                <Route path="/help/:slug" element={
                  <RouteContainer>
                    <AdaptiveShell><HelpDoc /></AdaptiveShell>
                  </RouteContainer>
                } />
                <Route path="/help-center" element={
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
                {/* Standalone cinema-styled pricing — its own header, no shell nav. */}
                <Route path="/pricing" element={
                  <RouteContainer>
                    <Pricing />
                  </RouteContainer>
                } />
                <Route path="/how-it-works" element={
                  <RouteContainer>
                    <AdaptiveShell><HowItWorks /></AdaptiveShell>
                  </RouteContainer>
                } />
                <Route path="/studio" element={
                  <RouteContainer fallbackMessage="Entering the studio…">
                    <RedirectBusinessToModule base="/studio" target="/business/create">
                      <Studio />
                    </RedirectBusinessToModule>
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
                {/* Account-type choice is gone — personal sign-up lives on /auth,
                    business onboarding lives on /business/start. Legacy /start
                    links land on the sign-up form. */}
                <Route path="/start" element={<Navigate to="/auth?mode=signup" replace />} />
                {/* Advanced business onboarding — public, no auth required */}
                <Route path="/business/start" element={
                  <RouteContainer fallbackMessage="Loading…">
                    <BusinessStart />
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
                {/* Inbox — unified surface. Legacy /messages + /notifications
                    redirect into it so deep links still work. */}
                <Route path="/inbox" element={
                  <RouteContainer fallbackMessage="Loading inbox…">
                    <AppShell><Inbox /></AppShell>
                  </RouteContainer>
                } />
                <Route path="/messages" element={<Navigate to="/inbox?lane=people" replace />} />
                <Route path="/notifications" element={<Navigate to="/inbox?lane=system" replace />} />
                <Route path="/credits" element={<Navigate to="/account?tab=credits" replace />} />
                
                {/* Protected routes - each with isolated error boundary */}
                {/* /projects is canonical Library's predecessor; folds in. */}
                <Route path="/projects" element={<Navigate to="/library" replace />} />

                {/* ── Foundation spine — canonical surfaces ───────────── */}
                <Route path="/library" element={
                  <RouteContainer fallbackMessage="Pulling up your library…">
                    <RedirectBusinessToModule base="/library" target="/business/projects">
                      <ProtectedRoute>
                        <Library />
                      </ProtectedRoute>
                    </RedirectBusinessToModule>
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
                {/* Notification preferences — opened from the bell's
                    footer link. Stays under /account so it inherits the
                    Foundation chrome and shares the account-tab vocab. */}
                <Route path="/account/notifications" element={
                  <RouteContainer fallbackMessage="Loading preferences…">
                    <ProtectedRoute>
                      <NotificationSettings />
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
                      <AppShell><ProfileDashboard /></AppShell>
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
                {/* Cutover: the legacy /workspace module is retired — every
                    /workspace/* path now redirects to its /business/* twin.
                    Slugs match 1:1, so the redirect is slug-preserving. */}
                {([
                  '', 'team', 'brand', 'assets', 'billing', 'analytics', 'projects',
                  'avatars', 'create', 'editor', 'templates', 'approvals', 'permissions',
                  'audit', 'credits', 'reports', 'integrations', 'api', 'notifications',
                  'general', 'security', 'danger',
                ] as const).map((slug) => (
                  <Route
                    key={slug || 'overview'}
                    path={`/workspace${slug ? `/${slug}` : ''}`}
                    element={<Navigate to={`/business${slug ? `/${slug}` : ''}`} replace />}
                  />
                ))}
                {/* Business module — new slick borderless surface at /business,
                    parallel to /workspace. Same gate chain.
                    • Cockpit pages reuse the real workspace pages rendered
                      INSIDE BusinessShell (business rail + existing features).
                    • Self-shelling creation surfaces (Create/Editor/Avatars/
                      Environments/Learning) render directly — full reuse, their
                      own chrome; the Editor is unchanged by design. */}
                {(() => {
                  const COCKPIT: Record<string, JSX.Element> = {
                    "": <BusinessOverview />,
                    "ad-studio": <BusinessAdStudio />,
                    create: <StudioWorkbench />,
                    avatars: <AvatarsWorkbench />,
                    environments: <EnvironmentsWorkbench />,
                    learning: <TrainingWorkbench />,
                    projects: <BusinessProjects />,
                    assets: <BusinessAssets />,
                    templates: <BusinessTemplates />,
                    team: <BusinessTeamAccess />,
                    brand: <BusinessBrand />,
                    audit: <BusinessAudit />,
                    billing: <BusinessBilling />,
                    credits: <BusinessCredits />,
                    analytics: <BusinessAnalytics />,
                    reports: <BusinessReports />,
                    distribution: <BusinessDistribution />,
                    integrations: <BusinessIntegrations />,
                    api: <BusinessApi />,
                    settings: <BusinessSettings />,
                  };
                  // The Editor is full-bleed, so instead of BusinessShell's
                  // padded content column it renders bare — but we still attach
                  // the BusinessRail and the "/business" module context so a
                  // business user keeps the business left menu and every
                  // in-editor link resolves back into /business/* (never the
                  // consumer shell).
                  const businessEditor = (
                    <ModuleBaseContext.Provider value="/business">
                      <BusinessRail />
                      <WorkspaceEditor />
                    </ModuleBaseContext.Provider>
                  );
                  const SELF_SHELL: Record<string, JSX.Element> = {
                    editor: businessEditor,
                  };
                  const wrapBusiness = (el: JSX.Element) => (
                    <RouteContainer fallbackMessage="Loading business…">
                      <AdminBounce>
                        <RequireAccountType allow={["business","enterprise","admin"]}>
                          <EnterpriseGate>{el}</EnterpriseGate>
                        </RequireAccountType>
                      </AdminBounce>
                    </RouteContainer>
                  );
                  const routes = BUSINESS_NAV_ITEMS.map(({ slug, label, description }) => {
                    const selfEl = SELF_SHELL[slug];
                    const inner = selfEl ?? (
                      <BusinessShell>
                        {COCKPIT[slug] ?? <BusinessComingSoon title={label} description={description} />}
                      </BusinessShell>
                    );
                    return (
                      <Route key={slug || 'overview'} path={`/business${slug ? `/${slug}` : ''}`} element={wrapBusiness(inner)} />
                    );
                  });
                  // Deep-link a specific project into the business editor
                  // (/business/editor/:id) — mirrors the consumer /editor/:id so
                  // a redirected business user keeps their project.
                  routes.push(
                    <Route key="business-editor-id" path="/business/editor/:id" element={wrapBusiness(businessEditor)} />,
                  );
                  return routes;
                })()}

                {/* Legacy business slugs now folded into hub pages as tabs. */}
                <Route path="/business/general" element={<Navigate to="/business/settings?tab=general" replace />} />
                <Route path="/business/security" element={<Navigate to="/business/settings?tab=security" replace />} />
                <Route path="/business/notifications" element={<Navigate to="/business/settings?tab=notifications" replace />} />
                <Route path="/business/danger" element={<Navigate to="/business/settings?tab=danger" replace />} />
                <Route path="/business/permissions" element={<Navigate to="/business/team?tab=permissions" replace />} />
                <Route path="/business/approvals" element={<Navigate to="/business/team?tab=approvals" replace />} />

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
                
                {/* Cast page retired — folded into the Avatars studio.
                    Legacy /cast links redirect there. */}
                <Route path="/cast" element={<Navigate to="/avatars" replace />} />
                {/* Avatars studio — create + edit your characters/avatars. */}
                <Route path="/avatars" element={
                  <RouteContainer fallbackMessage="Calling cast to set…">
                    <RedirectBusinessToModule base="/avatars" target="/business/avatars">
                      <ProtectedRoute>
                        <Avatars />
                      </ProtectedRoute>
                    </RedirectBusinessToModule>
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
                
                {/* Universes feature retired with the social-graph
                    simplification. Old URLs (singular + plural + with id)
                    fold to /lobby so legacy links still resolve. */}
                <Route path="/universe/:id" element={<Navigate to="/lobby" replace />} />
                <Route path="/universes/:id" element={<Navigate to="/lobby" replace />} />
                <Route path="/universes" element={<Navigate to="/lobby" replace />} />
                
                {/* Templates / Environments / Training are pickers and
                    modes that live inside Studio. The standalone routes
                    redirect with hints so Studio can preselect once the
                    drawer / mode embedding lands. */}
                {/* Templates · Environments · Training — standalone
                    creation-adjacent surfaces. Each is its own browse +
                    workflow; standalone respects the depth. */}
                {/* /hobby → /lobby redirect. The standalone Hobby
                    surface was merged into Lobby on 2026-06-15. All
                    previous Hobby content (Today's Spark, Streak,
                    Techniques, Remix wall, Quote rotator) now lives
                    in Lobby. */}
                <Route path="/hobby" element={<Navigate to="/lobby" replace />} />
                <Route path="/templates" element={
                  <RouteContainer fallbackMessage="Pulling templates…">
                    <RedirectBusinessToModule base="/templates" target="/business/templates">
                      <ProtectedRoute>
                        <Templates />
                      </ProtectedRoute>
                    </RedirectBusinessToModule>
                  </RouteContainer>
                } />
                <Route path="/environments" element={
                  <RouteContainer fallbackMessage="Loading environments…">
                    <RedirectBusinessToModule base="/environments" target="/business/environments">
                      <ProtectedRoute>
                        <Environments />
                      </ProtectedRoute>
                    </RedirectBusinessToModule>
                  </RouteContainer>
                } />
                <Route path="/training-video" element={
                  <RouteContainer fallbackMessage="Loading training mode...">
                    <RedirectBusinessToModule base="/training-video" target="/business/learning">
                      <ProtectedRoute>
                        <TrainingVideo />
                      </ProtectedRoute>
                    </RedirectBusinessToModule>
                  </RouteContainer>
                } />

                {/* Legacy talent routes — fold into the Avatars studio. */}
                <Route path="/mascots" element={<Navigate to="/avatars" replace />} />
                <Route path="/avatars-gallery" element={<Navigate to="/avatars" replace />} />
                
                {/* /find-friends absorbed into /search People tab. The
                    old aliases keep working as redirects so any external
                    links + old bookmarks still land on the right surface. */}
                <Route path="/creators" element={<Navigate to="/search?tab=people" replace />} />
                <Route path="/discover/people" element={<Navigate to="/search?tab=people" replace />} />
                <Route path="/find-friends" element={<Navigate to="/search?tab=people" replace />} />
                {/* Live-streaming module removed — /live, /live/room/:roomId
                    and /live/premieres are retired. Legacy links redirect to
                    the lobby so nothing 404s. */}
                <Route path="/live" element={<Navigate to="/lobby" replace />} />
                <Route path="/live/*" element={<Navigate to="/lobby" replace />} />
                {/* /c/:id renders the same comprehensive Profile component as
                    /profile, in "viewing-another-user" mode. Owner-only
                    affordances (edit, danger zone, credits tab) are hidden
                    automatically when the viewed user isn't the signed-in
                    user. Follow / Share become the primary CTAs. */}
                <Route path="/c/:id" element={
                  <RouteContainer fallbackMessage="Loading channel…">
                    <AppShell><ProfileDashboard /></AppShell>
                  </RouteContainer>
                } />
                <Route path="/c/:id/patron" element={
                  <RouteContainer fallbackMessage="Loading patron…">
                    <AppShell><PatronHubPage /></AppShell>
                  </RouteContainer>
                } />
                {/* Channel page removed — public videos live on the profile
                    (/c/:id). Legacy channel links redirect there. */}
                <Route path="/c/:id/channel" element={<Navigate to=".." relative="path" replace />} />
                {/* Market was removed from the app. Legacy links fold to the Lobby. */}
                <Route path="/market" element={<Navigate to="/lobby" replace />} />
                <Route path="/market/*" element={<Navigate to="/lobby" replace />} />
                {/* Crossover is a creation mode — folds into Studio as a tab. */}
                {/* Crossover — standalone VFX template library
                    (50 break-out effects). Distinct from Studio modes. */}
                <Route path="/crossover" element={
                  <RouteContainer fallbackMessage="Loading Crossover...">
                    <Crossover />
                  </RouteContainer>
                } />
                {/* /crews + /crews/:id retired with the social-graph
                    simplification. Redirect any old links into search. */}
                <Route path="/crews" element={<Navigate to="/search?tab=people" replace />} />
                <Route path="/crews/:id" element={<Navigate to="/search?tab=people" replace />} />
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
                    <RedirectBusinessToModule base="/editor" target="/business/editor">
                      <ProtectedRoute>
                        <VideoEditorPage />
                      </ProtectedRoute>
                    </RedirectBusinessToModule>
                  </RouteContainer>
                } />
                <Route path="/editor/:id" element={
                  <RouteContainer fallbackMessage="Loading the cutting room…">
                    <RedirectBusinessToModule base="/editor" target="/business/editor">
                      <ProtectedRoute>
                        <VideoEditorPage />
                      </ProtectedRoute>
                    </RedirectBusinessToModule>
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

                {/* Admin console — compiled in only when ADMIN_ENABLED (dev /
                    internal build). Excluded from the public production bundle so
                    /admin is never served on the public internet. */}
                {ADMIN_ENABLED && AdminApp && (
                  <Route path="/admin/*" element={
                    <RouteContainer fallbackMessage="Booting the bridge…">
                      <AdminApp />
                    </RouteContainer>
                  } />
                )}


                {/* Legacy redirect — extract-thumbnails had no nav entry */}
                <Route path="/extract-thumbnails" element={<Navigate to="/projects" replace />} />
                
                <Route path="*" element={
                  <RouteContainer>
                    <NotFound />
                  </RouteContainer>
                } />
                </Routes>
                {/* Lazy-loaded global widgets — Suspense fallback is
                    null because none of these are needed for initial
                    paint. Each component reads from context internally;
                    they self-gate their UI visibility. */}
                <Suspense fallback={null}>
                  <WelcomeVideoModal />
                  <GlobalPublishWizard />
                  <GlobalConfirmHost />
                  <ConcentrationOverlay />
                  <VoicePalette />
                  <OnThisDayNudge />
                </Suspense>
                {/* Command Center (Cmd+K / "/") — primary navigation surface */}
                <CommandCenter />
              </PageToneProvider>
              </StudioProvider>
              </WorkspaceProvider>
              </CreditsProvider>
              </UserPreferencesProvider>
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
