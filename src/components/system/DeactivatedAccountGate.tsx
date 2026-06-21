/**
 * DeactivatedAccountGate — when the authenticated user's profile has
 * a non-null `deactivated_at`, sign them out and bounce them to /auth
 * with a clear notice. Runs once per session change.
 */
import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export function DeactivatedAccountGate() {
  const { user } = useAuth();
  const checked = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    if (checked.current === user.id) return;
    checked.current = user.id;
    (async () => {
      const { data } = await supabase.rpc("my_account_gate" as never);
      const payload = data as { deactivated?: boolean } | null;
      if (payload?.deactivated) {
        await supabase.auth.signOut();
        window.location.href = "/auth?deactivated=1";
      }
    })();
  }, [user?.id]);

  return null;
}
