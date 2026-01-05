import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { StudioProvider } from "@/contexts/StudioContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProductionPipelineProvider } from "@/contexts/ProductionPipelineContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { StudioLayout } from "@/components/layout/StudioLayout";
import Landing from "./pages/Landing";
import Projects from "./pages/Projects";
import Create from "./pages/Create";
import Script from "./pages/Script";
import Production from "./pages/Production";
import Export from "./pages/Export";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import Admin from "./pages/Admin";
// New Pipeline Pages
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
                <Route path="/create" element={
                  <ProtectedRoute>
                    <StudioLayout><Create /></StudioLayout>
                  </ProtectedRoute>
                } />
                <Route path="/script" element={
                  <ProtectedRoute>
                    <StudioLayout><Script /></StudioLayout>
                  </ProtectedRoute>
                } />
                <Route path="/production" element={
                  <ProtectedRoute>
                    <StudioLayout><Production /></StudioLayout>
                  </ProtectedRoute>
                } />
                <Route path="/export" element={
                  <ProtectedRoute>
                    <StudioLayout><Export /></StudioLayout>
                  </ProtectedRoute>
                } />
                <Route path="/profile" element={
                  <ProtectedRoute>
                    <StudioLayout><Profile /></StudioLayout>
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
