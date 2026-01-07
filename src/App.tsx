import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { StudioProvider } from "@/contexts/StudioContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { StudioLayout } from "@/components/layout/StudioLayout";
import Landing from "./pages/Landing";
import Projects from "./pages/Projects";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import Admin from "./pages/Admin";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Contact from "./pages/Contact";
import LongVideo from "./pages/LongVideo";
import ScriptReview from "./pages/ScriptReview";
import Production from "./pages/Production";
import Studio from "./pages/Studio";
import Clips from "./pages/Clips";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <StudioProvider>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/contact" element={<Contact />} />
              
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
              
              {/* Video Generator Route */}
              <Route path="/create" element={
                <ProtectedRoute>
                  <StudioLayout><LongVideo /></StudioLayout>
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
              
              {/* Studio - In Progress & Failed */}
              <Route path="/studio" element={
                <ProtectedRoute>
                  <Studio />
                </ProtectedRoute>
              } />
              
              {/* Clips Gallery */}
              <Route path="/clips" element={
                <ProtectedRoute>
                  <Clips />
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
          </StudioProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
