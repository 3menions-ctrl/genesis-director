/**
 * Refine Auth Provider — wraps existing Supabase auth + admin RPC check.
 * 
 * This provider integrates with the existing auth system (AuthContext)
 * and uses the is_admin RPC for access control.
 */
import type { AuthProvider } from "@refinedev/core";
import { supabase } from "@/integrations/supabase/client";

export const refineAuthProvider: AuthProvider = {
  login: async () => {
    // Login is handled by the main app's AuthContext
    return { success: true };
  },

  logout: async () => {
    const { error } = await supabase.auth.signOut();
    return {
      success: !error,
      redirectTo: "/auth",
    };
  },

  check: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return {
        authenticated: false,
        redirectTo: "/auth",
      };
    }

    // Verify admin access via RPC
    const { data: isAdmin, error } = await supabase.rpc("is_admin", {
      _user_id: session.user.id,
    });

    if (error || !isAdmin) {
      return {
        authenticated: false,
        redirectTo: "/projects",
        error: { name: "Unauthorized", message: "Admin access required" },
      };
    }

    return { authenticated: true };
  },

  getPermissions: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const { data: isAdmin } = await supabase.rpc("is_admin", {
      _user_id: session.user.id,
    });

    return isAdmin ? ["admin"] : [];
  },

  getIdentity: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email, display_name, avatar_url")
      .eq("id", session.user.id)
      .single();

    return profile
      ? {
          id: profile.id,
          name: profile.display_name || profile.email,
          avatar: profile.avatar_url,
        }
      : null;
  },

  onError: async (error) => {
    if (error?.status === 401 || error?.status === 403) {
      return { logout: true, redirectTo: "/auth" };
    }
    return { error };
  },
};
