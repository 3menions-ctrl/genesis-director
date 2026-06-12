import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "./ProtectedRoute";
import { CinemaLoader } from "@/components/ui/CinemaLoader";

type AccountType = "personal" | "business" | "enterprise" | "admin";

interface RequireAccountTypeProps {
  children: ReactNode;
  /** Account types allowed to access this route. */
  allow: AccountType[];
  /** Path to redirect non-matching users to. Default `/studio`. */
  redirectTo?: string;
}

/**
 * Server-aligned route guard.
 * Composes with ProtectedRoute (auth required) and additionally enforces
 * `profiles.account_type` so /workspace is gated to business/enterprise
 * and /admin is gated to admin accounts. The DB still enforces RLS — this
 * is the UX layer that hides shells the user is not entitled to.
 */
export function RequireAccountType({ children, allow, redirectTo = "/studio" }: RequireAccountTypeProps) {
  const { profile, loading } = useAuth();
  const location = useLocation();
  const [graceElapsed, setGraceElapsed] = useState(false);

  // Grace period to let profile finish hydrating before bouncing the user
  useEffect(() => {
    const t = setTimeout(() => setGraceElapsed(true), 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <ProtectedRoute>
      {(() => {
        if (loading || !profile?.id) {
          return <CinemaLoader message="Verifying access..." showProgress variant="fullscreen" />;
        }
        const type = (profile.account_type ?? "personal") as AccountType;
        if (!allow.includes(type)) {
          if (!graceElapsed) {
            return <CinemaLoader message="Verifying access..." showProgress variant="fullscreen" />;
          }
          return <Navigate to={redirectTo} replace state={{ from: location.pathname }} />;
        }
        return <>{children}</>;
      })()}
    </ProtectedRoute>
  );
}