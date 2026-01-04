import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { StudioProvider } from "@/contexts/StudioContext";
import { AuthProvider } from "@/contexts/AuthContext";
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
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </StudioProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
