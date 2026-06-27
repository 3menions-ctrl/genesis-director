import { type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AppLoader } from "@/components/ui/app-loader";
import { isPublicPath } from "@/lib/publicRoutes";

/**
 * Global authentication gate — the app is GATED BY DEFAULT.
 *
 * Every route is behind login unless its path is in the public allowlist
 * (`src/lib/publicRoutes.ts`: the landing page + marketing / legal / auth
 * surfaces). A newly-added app route is gated automatically; it cannot leak by
 * forgetting a per-route <ProtectedRoute>.
 *
 * This is the single wrapper around <Routes>, so on a gated path the matched
 * page is NEVER mounted until the session is verified — no content flash and no
 * stray data fetches fired before the auth check.
 *
 * Composes with the existing per-route <ProtectedRoute> wrappers, which still
 * handle onboarding completion and the admin-console bounce for authed users.
 */
export function GatedRoutes({ children }: { children: ReactNode }) {
  const { user, session, loading, isSessionVerified } = useAuth();
  const location = useLocation();

  // Public surfaces render with no auth requirement.
  if (isPublicPath(location.pathname)) {
    return <>{children}</>;
  }

  // Gated path — wait for the session check to resolve before deciding, so an
  // authed user hard-refreshing a deep link isn't bounced mid-verification.
  if (loading || !isSessionVerified) {
    return <AppLoader message="Verifying session…" />;
  }

  const authed = Boolean(session?.user?.id || user?.id);
  if (!authed) {
    // Preserve the intended destination so /auth can return the user after
    // login (Auth reads ?next= and only honors same-origin "/" paths).
    const next = `${location.pathname}${location.search}`;
    const dest =
      next && next !== "/" ? `/auth?next=${encodeURIComponent(next)}` : "/auth";
    return <Navigate to={dest} replace />;
  }

  return <>{children}</>;
}
