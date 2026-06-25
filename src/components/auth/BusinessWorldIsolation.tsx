import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Hard account-world isolation.
 *
 * A business/enterprise account lives entirely inside /business/*. This guard
 * keeps it out of the CONSUMER-ACCOUNT app surfaces (the personal world: the
 * social lobby, personal profile/settings, inbox, etc.), redirecting any such
 * visit to /business.
 *
 * Deliberately a DENY-LIST of personal-app page surfaces rather than a blanket
 * "redirect everything", so neutral / shared-infra routes that a business user
 * legitimately needs are NOT blocked:
 *   - /business/*            (their own world)
 *   - /production, /production/:id   (the business Projects page links here)
 *   - /invite/:token         (joining a workspace)
 *   - /auth, /onboarding, /start, /welcome, /reset-password, /unsubscribe
 *   - /enterprise/*          (enterprise lead funnel)
 *   - /help, /search, /r/:id (reels), legal/marketing, the landing "/"
 *
 * The shared CREATION surfaces (/studio, /editor, /avatars, /environments,
 * /training-video, /templates, /library) are intentionally NOT listed here —
 * they have their own <RedirectBusinessToModule> guards that map each to its
 * specific /business equivalent (e.g. /editor → /business/editor), which is a
 * better landing than the /business overview.
 *
 * Personal, admin, and signed-out users are unaffected.
 */
// NOTE: "/profile" is intentionally NOT in this deny-list. It's a signed-in
// user's personal identity page (the /profile route is deliberately reachable
// by any account type — see App.tsx), and "/c/:id" renders the same
// ProfileDashboard without being blocked, so denying "/profile" was an
// asymmetric oversight that made the Profile menu link feel broken for business
// accounts.
const CONSUMER_ACCOUNT_PREFIXES = [
  "/lobby",
  "/me",
  "/account",
  "/settings",
  "/inbox",
];

/** True when `pathname` is a consumer-account page surface a business user must not see. */
export function isConsumerAccountPath(pathname: string): boolean {
  return CONSUMER_ACCOUNT_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

export function BusinessWorldIsolation() {
  const { profile, loading } = useAuth();
  const location = useLocation();

  if (loading || !profile) return null;
  const isBusiness = profile.account_type === "business" || profile.account_type === "enterprise";
  if (isBusiness && isConsumerAccountPath(location.pathname)) {
    return <Navigate to="/business" replace />;
  }
  return null;
}
