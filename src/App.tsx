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
import { WorldChatButton } from "@/components/social/WorldChatButton";
import { GlobalStabilityBoundary } from "@/components/stability/GlobalStabilityBoundary";
import { RouteContainer } from "@/components/layout/RouteContainer";
import { NavigationLoadingProvider, GlobalLoadingOverlay } from "@/components/navigation";
import { DebugOverlay } from "@/components/diagnostics/DebugOverlay";
import { CrashForensicsOverlay } from "@/components/diagnostics/CrashForensicsOverlay";
import { NavigationGuardProvider, NavigationBridge } from "@/lib/navigation";
import { SafeModeBanner } from "@/components/safeMode";
import { crashForensics } from "@/lib/crashForensics";
import { getSafeModeStatus } from "@/lib/safeMode";

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
const Admin = lazy(() => import("./pages/Admin"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Contact = lazy(() => import("./pages/Contact"));

const ScriptReview = lazy(() => import("./pages/ScriptReview"));
const Production = lazy(() => import("./pages/Production"));
const Clips = lazy(() => import("./pages/Clips"));
const HelpCenter = lazy(() => import("./pages/HelpCenter"));
const Universes = lazy(() => import("./pages/Universes"));
const UniverseDetail = lazy(() => import("./pages/UniverseDetail"));
const Templates = lazy(() => import("./pages/Templates"));
const Environments = lazy(() => import("./pages/Environments"));
const Discover = lazy(() => import("./pages/Discover"));
const Blog = lazy(() => import("./pages/Blog"));
const Press = lazy(() => import("./pages/Press"));
const TrainingVideo = lazy(() => import("./pages/TrainingVideo"));
const ExtractThumbnails = lazy(() => import("./pages/ExtractThumbnails"));
const Create = lazy(() => import("./pages/Create"));
const Gallery = lazy(() => import("./pages/Gallery"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Avatars = lazy(() => import("./pages/Avatars"));
const Creators = lazy(() => import("./pages/Creators"));
const UserProfile = lazy(() => import("./pages/UserProfile"));
const VideoDetail = lazy(() => import("./pages/VideoDetail"));

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
                <Route path="/discover" element={
                  <RouteContainer fallbackMessage="Loading discover...">
                    <ProtectedRoute>
                      <Discover />
                    </ProtectedRoute>
                  </RouteContainer>
                } />
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
                
                {/* Clips Gallery */}
                <Route path="/clips" element={
                  <RouteContainer fallbackMessage="Loading clips...">
                    <ProtectedRoute>
                      <Clips />
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                
                {/* Story Universes */}
                <Route path="/universes" element={
                  <RouteContainer fallbackMessage="Loading universes...">
                    <ProtectedRoute>
                      <Universes />
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                <Route path="/universes/:id" element={
                  <RouteContainer fallbackMessage="Loading universe...">
                    <ProtectedRoute>
                      <UniverseDetail />
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                
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
                
                {/* Video Detail Page */}
                <Route path="/video/:videoId" element={
                  <RouteContainer fallbackMessage="Loading video...">
                    <VideoDetail />
                  </RouteContainer>
                } />
                
                {/* Legacy route redirects */}
                <Route path="/long-video" element={<Navigate to="/create" replace />} />
                <Route path="/pipeline/*" element={<Navigate to="/create" replace />} />
                
                {/* Admin Dashboard */}
                <Route path="/admin" element={
                  <RouteContainer fallbackMessage="Loading admin...">
                    <ProtectedRoute>
                      <Admin />
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                
                {/* Thumbnail extraction utility */}
                <Route path="/extract-thumbnails" element={
                  <RouteContainer>
                    <ProtectedRoute>
                      <ExtractThumbnails />
                    </ProtectedRoute>
                  </RouteContainer>
                } />
                
                <Route path="*" element={
                  <RouteContainer>
                    <NotFound />
                  </RouteContainer>
                } />
                </Routes>
                {/* Debug Overlay - Development only */}
                <DebugOverlay />
                {/* Crash Forensics Overlay - Always available */}
                <CrashForensicsOverlay alwaysShow={getSafeModeStatus()} />
                {/* Global World Chat Button */}
                <WorldChatButton />
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
