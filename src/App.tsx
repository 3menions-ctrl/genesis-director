import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { StudioProvider } from "@/contexts/StudioContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLoader } from "@/components/ui/app-loader";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { GlobalStabilityBoundary } from "@/components/stability/GlobalStabilityBoundary";
import { RouteContainer } from "@/components/layout/RouteContainer";
import { NavigationLoadingProvider, GlobalLoadingOverlay } from "@/components/navigation";
import { DebugOverlay } from "@/components/diagnostics/DebugOverlay";

// Lazy load all pages for code splitting
const Landing = lazy(() => import("./pages/Landing"));
const Projects = lazy(() => import("./pages/Projects"));
const Auth = lazy(() => import("./pages/Auth"));
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

const App = () => (
  <GlobalStabilityBoundary>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <NavigationLoadingProvider>
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
                
                {/* Social Hub - Redirect to Profile */}
                <Route path="/social" element={<Navigate to="/profile" replace />} />
                
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
              </StudioProvider>
            </AuthProvider>
          </NavigationLoadingProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
  </GlobalStabilityBoundary>
);

export default App;
