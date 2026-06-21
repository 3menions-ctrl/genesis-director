import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ALL_SCOPES, type OpsScope } from "./scopes";

type Ctx = {
  loading: boolean;
  scopes: ReadonlySet<OpsScope>;
  hasScope: (s: OpsScope) => boolean;
  isSuperAdmin: boolean;
};

const OpsAccessContext = createContext<Ctx>({
  loading: true,
  scopes: new Set(),
  hasScope: () => false,
  isSuperAdmin: false,
});

export function OpsAccessProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) {
        if (!cancelled) { setIsSuperAdmin(false); setLoading(false); }
        return;
      }
      const { data, error } = await supabase.rpc("is_admin", { _user_id: user.id });
      if (cancelled) return;
      setIsSuperAdmin(!error && data === true);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const value = useMemo<Ctx>(() => {
    // Future: merge per-scope grants from a public.admin_scopes table here.
    const scopes = new Set<OpsScope>(isSuperAdmin ? ALL_SCOPES : []);
    return {
      loading,
      scopes,
      hasScope: (s) => scopes.has(s),
      isSuperAdmin,
    };
  }, [loading, isSuperAdmin]);

  return <OpsAccessContext.Provider value={value}>{children}</OpsAccessContext.Provider>;
}

export function useOpsAccess() {
  return useContext(OpsAccessContext);
}