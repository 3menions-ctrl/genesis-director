import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { StudioProvider } from "@/contexts/StudioContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProductionPipelineProvider } from "@/contexts/ProductionPipelineContext";
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
// Iron-Clad Pipeline Pages
import ScriptingStage from "./pages/pipeline/ScriptingStage";
import ProductionStage from "./pages/pipeline/ProductionStage";
import ReviewStage from "./pages/pipeline/ReviewStage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <StudioProvider>
            <ProductionPipelineProvider>
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
                    <StudioLayout><Projects /></StudioLayout>
                  </ProtectedRoute>
                } />
                <Route path="/profile" element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                } />
                
                {/* Iron-Clad Production Pipeline Routes */}
                <Route path="/pipeline/scripting" element={
                  <ProtectedRoute>
                    <StudioLayout><ScriptingStage /></StudioLayout>
                  </ProtectedRoute>
                } />
                <Route path="/pipeline/production" element={
                  <ProtectedRoute>
                    <StudioLayout><ProductionStage /></StudioLayout>
                  </ProtectedRoute>
                } />
                <Route path="/pipeline/review" element={
                  <ProtectedRoute>
                    <StudioLayout><ReviewStage /></StudioLayout>
                  </ProtectedRoute>
                } />
                
                {/* Legacy route redirects to pipeline */}
                <Route path="/create" element={<Navigate to="/pipeline/scripting" replace />} />
                <Route path="/script" element={<Navigate to="/pipeline/scripting" replace />} />
                <Route path="/production" element={<Navigate to="/pipeline/production" replace />} />
                <Route path="/export" element={<Navigate to="/pipeline/review" replace />} />
                
                {/* Admin Dashboard (protected, admin-only in component) */}
                <Route path="/admin" element={
                  <ProtectedRoute>
                    <Admin />
                  </ProtectedRoute>
                } />
                
                <Route path="*" element={<NotFound />} />
              </Routes>
            </ProductionPipelineProvider>
          </StudioProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
