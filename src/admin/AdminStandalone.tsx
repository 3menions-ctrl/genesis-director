/**
 * AdminStandalone — the root for the admin console as its OWN deployable app
 * (e.g. admin.smallbridges.co), separate from the public site.
 *
 * Why a separate entry: the public production build tree-shakes the admin out
 * entirely (see adminEnabled.ts). This entry does the opposite — it IS the
 * admin and nothing else. Built via `npm run build:admin` (ADMIN_BUILD=1), it
 * emits an isolated `dist-admin/` whose only surface is the console.
 *
 * Routing: the admin keeps its `/admin/*` base even on the subdomain, so every
 * absolute `/admin/...` link (sidebar NAV, command palette, OPS_PAGES) keeps
 * working UNCHANGED. The subdomain root just redirects to `/admin`. Net result:
 * zero changes to AdminApp or any admin page — this is pure packaging.
 *
 * Providers mirror src/App.tsx's nest so every admin page (and any shared
 * component) sees the exact same context it does inside the public app.
 */
import { Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { AuthProvider } from "@/contexts/AuthContext";
import { UserPreferencesProvider } from "@/contexts/UserPreferencesContext";
import { CreditsProvider } from "@/contexts/CreditsContext";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { StudioProvider } from "@/contexts/StudioContext";
import { PageToneProvider } from "@/lib/page-tone";
import { Spinner } from "@/components/ui/Spinner";
import AdminApp from "./AdminApp";

export default function AdminStandalone() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AuthProvider>
              <UserPreferencesProvider>
                <CreditsProvider>
                  <WorkspaceProvider>
                    <StudioProvider>
                      <PageToneProvider>
                        <Suspense
                          fallback={
                            <div className="flex min-h-[100dvh] items-center justify-center bg-[#070a12]">
                              <Spinner />
                            </div>
                          }
                        >
                          <Routes>
                            <Route path="/admin/*" element={<AdminApp />} />
                            {/* The subdomain root is the console — send it in. */}
                            <Route path="*" element={<Navigate to="/admin" replace />} />
                          </Routes>
                        </Suspense>
                      </PageToneProvider>
                    </StudioProvider>
                  </WorkspaceProvider>
                </CreditsProvider>
              </UserPreferencesProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
        <Sonner />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
