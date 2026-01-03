import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { StudioProvider } from "@/contexts/StudioContext";
import { StudioLayout } from "@/components/layout/StudioLayout";
import Projects from "./pages/Projects";
import Script from "./pages/Script";
import Production from "./pages/Production";
import Export from "./pages/Export";
import CreateMovie from "./pages/CreateMovie";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <StudioProvider>
          <StudioLayout>
            <Routes>
              <Route path="/" element={<Navigate to="/projects" replace />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/script" element={<Script />} />
              <Route path="/production" element={<Production />} />
              <Route path="/create-movie" element={<CreateMovie />} />
              <Route path="/export" element={<Export />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </StudioLayout>
        </StudioProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
