/**
 * AdminBounce — keeps the admin confined to the admin console.
 *
 * The admin role "lives" in /admin. Most authed surfaces enforce this via
 * ProtectedRoute's admin-lockdown, but the /business chain uses RequireAccountType
 * (not ProtectedRoute), so an admin with a business account would otherwise land
 * in /business after login (the is_admin check resolves a tick after the post-login
 * redirect picks a destination). Wrapping the business routes in AdminBounce sends
 * admins to /admin and self-corrects once isAdmin resolves. No-op when the admin
 * module isn't in this build (ADMIN_ENABLED false).
 */
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ADMIN_ENABLED } from "@/admin/adminEnabled";

export function AdminBounce({ children }: { children: JSX.Element }) {
  const { isAdmin } = useAuth();
  if (ADMIN_ENABLED && isAdmin) return <Navigate to="/admin" replace />;
  return children;
}
