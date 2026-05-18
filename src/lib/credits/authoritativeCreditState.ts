import { supabase } from "@/integrations/supabase/client";

export type AuthoritativeCreditState = {
  balance: number;
  held: number;
  available: number;
};

export async function getAuthoritativeCreditState(): Promise<AuthoritativeCreditState | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return null;

  const { data, error } = await supabase.functions.invoke("reserve-credits", {
    body: { action: "state" },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (error || (data as { success?: boolean } | null)?.success === false) return null;

  const payload = (data || {}) as { balance?: number; held?: number; available?: number };
  const balance = Number(payload.balance ?? 0);
  const held = Number(payload.held ?? 0);
  const available = Number(payload.available ?? Math.max(balance - held, 0));

  return { balance, held, available };
}