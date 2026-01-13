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
const LongVideo = lazy(() => import("./pages/LongVideo"));
const ScriptReview = lazy(() => import("./pages/ScriptReview"));
const Production = lazy(() => import("./pages/Production"));
const Clips = lazy(() => import("./pages/Clips"));
const HelpCenter = lazy(() => import("./pages/HelpCenter"));
const Universes = lazy(() => import("./pages/Universes"));
const Templates = lazy(() => import("./pages/Templates"));
const Environments = lazy(() => import("./pages/Environments"));
const Feed = lazy(() => import("./pages/Feed"));
const StudioLayout = lazy(() => import("@/components/layout/StudioLayout").then(m => ({ default: m.StudioLayout })));

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
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <StudioProvider>
            <Suspense fallback={<AppLoader message="Starting Apex Studio..." />}>
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<Landing />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/feed" element={
                  <ProtectedRoute>
                    <Feed />
                  </ProtectedRoute>
                } />
                <Route path="/help" element={<HelpCenter />} />
                
                {/* Onboarding - protected but no layout */}
                <Route path="/onboarding" element={
                  <ProtectedRoute>
                    <Onboarding />
                  </ProtectedRoute>
                } />
                
                {/* Protected routes */}
                <Route path="/projects" element={
                  <ProtectedRoute>
                    <Projects />
                  </ProtectedRoute>
                } />
                <Route path="/profile" element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                } />
                <Route path="/settings" element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                } />
                
                {/* Video Generator Route */}
                <Route path="/create" element={
                  <ProtectedRoute>
                    <Suspense fallback={<AppLoader message="Loading studio..." />}>
                      <StudioLayout><LongVideo /></StudioLayout>
                    </Suspense>
                  </ProtectedRoute>
                } />
                
                {/* Script Review Route */}
                <Route path="/script-review" element={
                  <ProtectedRoute>
                    <ScriptReview />
                  </ProtectedRoute>
                } />
                
                {/* Production Pipeline Route */}
                <Route path="/production" element={
                  <ProtectedRoute>
                    <Production />
                  </ProtectedRoute>
                } />
                
                {/* Legacy studio route redirects to production */}
                <Route path="/studio" element={<Navigate to="/production" replace />} />
                
                {/* Clips Gallery */}
                <Route path="/clips" element={
                  <ProtectedRoute>
                    <Clips />
                  </ProtectedRoute>
                } />
                
                {/* Story Universes */}
                <Route path="/universes" element={
                  <ProtectedRoute>
                    <Universes />
                  </ProtectedRoute>
                } />
                
                {/* Templates Gallery */}
                <Route path="/templates" element={
                  <ProtectedRoute>
                    <Templates />
                  </ProtectedRoute>
                } />
                
                {/* Environments DNA */}
                <Route path="/environments" element={
                  <ProtectedRoute>
                    <Environments />
                  </ProtectedRoute>
                } />
                
                {/* Legacy route redirects */}
                <Route path="/long-video" element={<Navigate to="/create" replace />} />
                <Route path="/pipeline/*" element={<Navigate to="/create" replace />} />
                
                {/* Admin Dashboard */}
                <Route path="/admin" element={
                  <ProtectedRoute>
                    <Admin />
                  </ProtectedRoute>
                } />
                
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </StudioProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
