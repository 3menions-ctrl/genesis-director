import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { StudioProvider } from "@/contexts/StudioContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLoader } from "@/components/ui/app-loader";
import { ErrorBoundary } from "@/components/ui/error-boundary";
// WorldChatButton removed - now a dedicated page
import { WelcomeVideoModal } from "@/components/welcome/WelcomeVideoModal";
import { WelcomeOfferModal } from "@/components/welcome/WelcomeOfferModal";
import { GlobalStabilityBoundary } from "@/components/stability/GlobalStabilityBoundary";
import { RouteContainer } from "@/components/layout/RouteContainer";
import { NavigationLoadingProvider, GlobalLoadingOverlay } from "@/components/navigation";
import { AdminOnlyDiagnostics } from "@/components/diagnostics/AdminOnlyDiagnostics";
import { NavigationGuardProvider, NavigationBridge } from "@/lib/navigation";
import { SafeModeBanner } from "@/components/safeMode";
import { crashForensics } from "@/lib/crashForensics";
import { getSafeModeStatus } from "@/lib/safeMode";
import { AgentTrigger } from "@/components/agent";
import { CommandPalette } from "@/components/agent/CommandPalette";

// Lazy load all pages for code splitting
const Landing = lazy(() => import("./pages/Landing"));
const Projects = lazy(() => import("./pages/Projects"));
const Auth = lazy(() => import("./pages/Auth"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));
// Legacy Admin removed — replaced by Refine admin
const RefineAdminLayout = lazy(() => import("./refine/AdminLayout").then(m => ({ default: m.RefineAdminLayout })));
const AdminDashboardPage = lazy(() => import("./refine/pages/AdminDashboardPage"));
const AdminUsersPage = lazy(() => import("./refine/pages/AdminUsersPage"));
const AdminProjectsPage = lazy(() => import("./refine/pages/AdminProjectsPage"));
const AdminCreditsPage = lazy(() => import("./refine/pages/AdminCreditsPage"));
const AdminMessagesPage = lazy(() => import("./refine/pages/AdminMessagesPage"));
const AdminFinancialsPage = lazy(() => import("./refine/pages/AdminFinancialsPage"));
const AdminCostsPage = lazy(() => import("./refine/pages/AdminCostsPage"));
const AdminPipelinePage = lazy(() => import("./refine/pages/AdminPipelinePage"));
const AdminFailedPage = lazy(() => import("./refine/pages/AdminFailedPage"));
const AdminAuditPage = lazy(() => import("./refine/pages/AdminAuditPage"));
const AdminPackagesPage = lazy(() => import("./refine/pages/AdminPackagesPage"));
const AdminModerationPage = lazy(() => import("./refine/pages/AdminModerationPage"));
const AdminGalleryPage = lazy(() => import("./refine/pages/AdminGalleryPage"));
const AdminAvatarsPage = lazy(() => import("./refine/pages/AdminAvatarsPage"));
const AdminConfigPage = lazy(() => import("./refine/pages/AdminConfigPage"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Contact = lazy(() => import("./pages/Contact"));

const ScriptReview = lazy(() => import("./pages/ScriptReview"));
const Production = lazy(() => import("./pages/Production"));

const HelpCenter = lazy(() => import("./pages/HelpCenter"));
const Templates = lazy(() => import("./pages/Templates"));
const Environments = lazy(() => import("./pages/Environments"));
// Discover removed - redirects to /creators
const Blog = lazy(() => import("./pages/Blog"));
const Press = lazy(() => import("./pages/Press"));
const TrainingVideo = lazy(() => import("./pages/TrainingVideo"));
// ExtractThumbnails removed — orphan utility with no nav entry
const Create = lazy(() => import("./pages/Create"));
const Gallery = lazy(() => import("./pages/Gallery"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Avatars = lazy(() => import("./pages/Avatars"));
const Creators = lazy(() => import("./pages/Creators"));
const UserProfile = lazy(() => import("./pages/UserProfile"));
const VideoDetail = lazy(() => import("./pages/VideoDetail"));
const HowItWorks = lazy(() => import("./pages/HowItWorks"));
const WorldChat = lazy(() => import("./pages/WorldChat"));

const WidgetLanding = lazy(() => import("./pages/WidgetLanding"));
const WidgetEmbed = lazy(() => import("./pages/WidgetEmbed"));
const AppInventory = lazy(() => import("./pages/AppInventory"));

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



const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

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
          <Toaster />
          <Sonner />
          {/* Safe Mode Banner - always visible when active */}
          <SafeModeBanner />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            {/* Boot checkpoint markers */}
            <BootCheckpointMarker />
            {/* Route change tracker for forensics */}
            <RouteChangeTracker />
          <NavigationLoadingProvider>
            <NavigationGuardProvider>
            <NavigationBridge>
            <AuthProvider>
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
                <Route path="/contact" element={
                  <RouteContainer>
                    <Contact />
                  </RouteContainer>
                } />
                <Route path="/discover" element={<Navigate to="/creators" replace />} />
                <Route path="/help" element={
                  <RouteContainer>
                    <HelpCenter />
                  </RouteContainer>
                } />
                <Route path="/blog" element={
                  <RouteContainer>
                    <Blog />
                  </RouteContainer>
                } />
                <Route path="/press" element={
                  <RouteContainer>
                    <Press />
                  </RouteContainer>
                } />
                <Route path="/gallery" element={
                  <RouteContainer fallbackMessage="Loading gallery...">
                    <Gallery />
                  </RouteContainer>
                } />
                <Route path="/pricing" element={
                  <RouteContainer>
                    <Pricing />
                  </RouteContainer>
                } />
                <Route path="/how-it-works" element={
                  <RouteContainer>
                    <HowItWorks />
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
                
                {/* Protected routes - each with isolated error boundary */}
                <Route path="/projects" element={
                  <RouteContainer fallbackMessage="Loading projects...">
                    <ProtectedRoute>
                      <Projects />
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                <Route path="/profile" element={
                  <RouteContainer fallbackMessage="Loading profile...">
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                <Route path="/settings" element={
                  <RouteContainer fallbackMessage="Loading settings...">
                    <ProtectedRoute>
                      <Settings />
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                
                {/* New Premium Creation Hub */}
                <Route path="/create" element={
                  <RouteContainer fallbackMessage="Preparing studio...">
                    <ProtectedRoute>
                      <Create />
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                
                {/* Avatar Selection Page */}
                <Route path="/avatars" element={
                  <RouteContainer fallbackMessage="Loading avatars...">
                    <ProtectedRoute>
                      <Avatars />
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                
                {/* Legacy route - redirect to new Create page */}
                <Route path="/studio" element={<Navigate to="/create" replace />} />
                
                {/* Script Review Route */}
                <Route path="/script-review" element={
                  <RouteContainer fallbackMessage="Loading script review...">
                    <ProtectedRoute>
                      <ScriptReview />
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                
                {/* Production Pipeline Routes - supports both query params and path params */}
                <Route path="/production" element={
                  <RouteContainer fallbackMessage="Loading production...">
                    <ProtectedRoute>
                      <Production />
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                <Route path="/production/:projectId" element={
                  <RouteContainer fallbackMessage="Loading production...">
                    <ProtectedRoute>
                      <Production />
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                
                {/* Keep production route for active productions */}
                
                {/* Legacy clips route - redirect to projects */}
                <Route path="/clips" element={<Navigate to="/projects" replace />} />
                
                {/* Legacy universe routes - redirect to projects */}
                <Route path="/universes" element={<Navigate to="/projects" replace />} />
                <Route path="/universes/:id" element={<Navigate to="/projects" replace />} />
                
                {/* Templates Gallery */}
                <Route path="/templates" element={
                  <RouteContainer fallbackMessage="Loading templates...">
                    <ProtectedRoute>
                      <Templates />
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                
                {/* Training Video Mode */}
                <Route path="/training-video" element={
                  <RouteContainer fallbackMessage="Loading training mode...">
                    <ProtectedRoute>
                      <TrainingVideo />
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                
                {/* Environments DNA */}
                <Route path="/environments" element={
                  <RouteContainer fallbackMessage="Loading environments...">
                    <ProtectedRoute>
                      <Environments />
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                
                {/* Social Hub - Creators & Profiles */}
                <Route path="/creators" element={
                  <RouteContainer fallbackMessage="Loading creators...">
                    <Creators />
                  </RouteContainer>
                } />
                <Route path="/user/:userId" element={
                  <RouteContainer fallbackMessage="Loading profile...">
                    <UserProfile />
                  </RouteContainer>
                } />
                <Route path="/social" element={<Navigate to="/creators" replace />} />
                
                {/* World Chat */}
                <Route path="/chat" element={
                  <RouteContainer fallbackMessage="Loading chat...">
                    <ProtectedRoute>
                      <WorldChat />
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                
                {/* Video Detail Page */}
                <Route path="/video/:videoId" element={
                  <RouteContainer fallbackMessage="Loading video...">
                    <VideoDetail />
                  </RouteContainer>
                } />
                
                {/* Legacy editor route - redirect to projects */}
                <Route path="/editor" element={<Navigate to="/projects" replace />} />
                
                {/* Legacy route redirects */}
                <Route path="/long-video" element={<Navigate to="/create" replace />} />
                <Route path="/pipeline/*" element={<Navigate to="/create" replace />} />
                
                {/* Genesis Scenes - redirect to Create page */}
                <Route path="/scenes" element={<Navigate to="/create" replace />} />
                <Route path="/design-picker" element={<Navigate to="/create" replace />} />
                <Route path="/w/:slug" element={
                  <RouteContainer fallbackMessage="Loading...">
                    <WidgetLanding />
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
                  <Route path="users" element={<AdminUsersPage />} />
                  <Route path="projects" element={<AdminProjectsPage />} />
                  <Route path="credits" element={<AdminCreditsPage />} />
                  <Route path="messages" element={<AdminMessagesPage />} />
                  <Route path="financials" element={<AdminFinancialsPage />} />
                  <Route path="costs" element={<AdminCostsPage />} />
                  <Route path="pipeline" element={<AdminPipelinePage />} />
                  <Route path="failed" element={<AdminFailedPage />} />
                  <Route path="audit" element={<AdminAuditPage />} />
                  <Route path="packages" element={<AdminPackagesPage />} />
                  <Route path="moderation" element={<AdminModerationPage />} />
                  <Route path="gallery" element={<AdminGalleryPage />} />
                  <Route path="avatars" element={<AdminAvatarsPage />} />
                  <Route path="config" element={<AdminConfigPage />} />
                  <Route path="inventory" element={<AppInventory />} />
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
                <AdminOnlyDiagnostics />
                {/* Welcome Offer Modal - shows Mini pack to new users */}
                <WelcomeOfferModal />
                {/* Welcome Video Modal - shows once for new users */}
                <WelcomeVideoModal />
                {/* APEX Agent - AI Creative Director */}
                <AgentTrigger />
                {/* Command Palette (Cmd+K) */}
                <CommandPalette />
              </StudioProvider>
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
