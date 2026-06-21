import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/**
 * World-separation guard for SHARED creation surfaces that exist in BOTH the
 * consumer app and the business module (Studio/Create, Avatars, Environments,
 * Learning, Editor, Library, Templates).
 *
 * A business/enterprise account that lands on the CONSUMER route (e.g. /editor,
 * /studio) is redirected to its /business equivalent so it always stays
 * attached to the business shell + rail and never falls into the personal
 * world. Personal and admin accounts pass through to the consumer surface
 * unchanged.
 *
 * Combined with <RequireAccountType> (which keeps personal accounts OUT of
 * /business/*), this enforces strict separation in both directions:
 *   - business surfaces → business/enterprise/admin only
 *   - consumer shared surfaces → personal (+ admin) only
 *
 * `base` is the consumer path prefix (e.g. "/editor"); any trailing segment
 * (e.g. a "/:id") and the query string are preserved onto `target`.
 */
/**
 * Pure path mapper: consumer URL → module URL, preserving any trailing path
 * segment (e.g. "/:id") and the query string. Exported for unit testing.
 */
export function computeModuleRedirect(
  base: string,
  target: string,
  pathname: string,
  search: string,
): string {
  const rest = pathname.startsWith(base) ? pathname.slice(base.length) : "";
  return `${target}${rest}${search}`;
}

export function RedirectBusinessToModule({
  base,
  target,
  children,
}: {
  base: string;
  target: string;
  children: ReactNode;
}) {
  const { profile, loading } = useAuth();
  const location = useLocation();

  // Until the profile is known, render the page — no flash for personal users.
  // In-app navigation already has the profile loaded, so the decision is
  // instant; only a hard refresh directly onto a consumer route can briefly
  // show it before the redirect.
  if (loading || !profile) return <>{children}</>;

  const type = profile.account_type;
  if (type === "business" || type === "enterprise") {
    return (
      <Navigate
        to={computeModuleRedirect(base, target, location.pathname, location.search)}
        replace
      />
    );
  }
  return <>{children}</>;
}
