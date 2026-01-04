import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { StudioProvider } from "@/contexts/StudioContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { StudioLayout } from "@/components/layout/StudioLayout";
import Projects from "./pages/Projects";
import Create from "./pages/Create";
import Script from "./pages/Script";
import Production from "./pages/Production";
import Export from "./pages/Export";
import Auth from "./pages/Auth";
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
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={<Navigate to="/projects" replace />} />
              <Route path="/projects" element={<StudioLayout><Projects /></StudioLayout>} />
              <Route path="/create" element={<StudioLayout><Create /></StudioLayout>} />
              <Route path="/script" element={<StudioLayout><Script /></StudioLayout>} />
              <Route path="/production" element={<StudioLayout><Production /></StudioLayout>} />
              <Route path="/export" element={<StudioLayout><Export /></StudioLayout>} />
              <Route path="/profile" element={<StudioLayout><Profile /></StudioLayout>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </StudioProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
