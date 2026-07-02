/**
 * DeactivatedAccountGate — the deactivation UX promises "sign back in to
 * reactivate", and a successful sign-in IS the identity proof, so a fresh
 * authenticated session on a deactivated profile REACTIVATES it (clears
 * `deactivated_at` via update_my_profile) and welcomes the user back.
 *
 * The previous behavior signed the user out and bounced to /auth — but
 * nothing ever cleared `deactivated_at`, so signing back in just bounced
 * again: deactivation was a permanent lockout despite the promised
 * reactivation. Runs once per session change.
 */
import { useEffect, useRef } from "react";
import { toast } from "sonner";
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
        const { error } = await supabase.rpc("update_my_profile" as never, {
          p_patch: { deactivate: false },
        } as never);
        if (error) {
          // Reactivation failed (e.g. RPC not yet deployed) — fall back to
          // the old lockout rather than letting a deactivated session roam.
          await supabase.auth.signOut();
          window.location.href = "/auth?deactivated=1";
          return;
        }
        toast.success("Welcome back — your account has been reactivated.");
      }
    })();
  }, [user?.id]);

  return null;
}
