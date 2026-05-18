/**
 * CreditsContext — single source of truth for credit balance, held, and
 * available across the entire app. Every credit display MUST read from
 * `useCredits()` so the sidebar, the studio header, the billing page, the
 * profile, and the create page all show the exact same numbers at all times.
 *
 * Authoritative pipeline:
 *   1. On mount + on auth change, call `reconcile_user_credits()` which
 *      recomputes the balance from the credit_transactions ledger and
 *      corrects any drift on `profiles.credits_balance`.
 *   2. Then read live state via `get_credit_state` RPC (balance/held/available).
 *   3. Subscribe to realtime postgres_changes on profiles + credit_holds +
 *      credit_transactions for this user and refetch whenever anything moves.
 */
import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface CreditsState {
  /** Stored profile balance, after ledger reconciliation. */
  balance: number;
  /** Sum of active pipeline reservations. */
  held: number;
  /** balance − held; this is what the user can spend right now. */
  available: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  reconcile: () => Promise<void>;
}

const DEFAULT_STATE: CreditsState = {
  balance: 0,
  held: 0,
  available: 0,
  loading: true,
  error: null,
  refresh: async () => {},
  reconcile: async () => {},
};

const CreditsContext = createContext<CreditsState>(DEFAULT_STATE);

export function CreditsProvider({ children }: { children: React.ReactNode }) {
  const { user, refreshProfile } = useAuth();
  const [balance, setBalance] = useState(0);
  const [held, setHeld] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef<Promise<void> | null>(null);

  const readState = useCallback(async (uid: string) => {
    const { data, error: rpcErr } = await supabase.rpc('get_credit_state', { p_user_id: uid });
    if (rpcErr) throw rpcErr;
    const payload = (data as { success?: boolean; balance?: number; held?: number }) || {};
    if (payload.success === false) throw new Error('get_credit_state failed');
    setBalance(Number(payload.balance ?? 0));
    setHeld(Number(payload.held ?? 0));
  }, []);

  const refresh = useCallback(async () => {
    if (!user) {
      setBalance(0); setHeld(0); setLoading(false); return;
    }
    if (inflight.current) return inflight.current;
    const uid = user.id;
    const p = (async () => {
      try {
        setError(null);
        await readState(uid);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
    inflight.current = p;
    try { await p; } finally { inflight.current = null; }
  }, [user, readState]);

  const reconcile = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error: rpcErr } = await supabase.rpc('reconcile_user_credits' as never);
      if (rpcErr) throw rpcErr;
      const payload = (data as { success?: boolean; balance?: number; held?: number; drift_corrected?: number }) || {};
      if (payload.success) {
        setBalance(Number(payload.balance ?? 0));
        setHeld(Number(payload.held ?? 0));
        if (Number(payload.drift_corrected ?? 0) !== 0) {
          // The stored profile balance changed — refresh AuthContext so any
          // legacy reads of `profile.credits_balance` also reflect the truth.
          void refreshProfile();
        }
      } else {
        await refresh();
      }
    } catch {
      await refresh();
    } finally {
      setLoading(false);
    }
  }, [user, refresh, refreshProfile]);

  // Initial reconcile + read whenever the signed-in user changes.
  useEffect(() => {
    if (!user) { setBalance(0); setHeld(0); setLoading(false); return; }
    setLoading(true);
    void reconcile();
  }, [user, reconcile]);

  // Realtime: any change to this user's profile, holds, or ledger → refetch.
  useEffect(() => {
    if (!user) return;
    const uid = user.id;
    const channel = supabase
      .channel(`credits-${uid}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${uid}` },
        () => { void refresh(); })
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'credit_holds', filter: `user_id=eq.${uid}` },
        () => { void refresh(); })
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'credit_transactions', filter: `user_id=eq.${uid}` },
        () => { void refresh(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user, refresh]);

  // Refetch when the tab becomes visible again — guards against missed events.
  useEffect(() => {
    if (!user) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [user, refresh]);

  const available = Math.max(balance - held, 0);

  return (
    <CreditsContext.Provider value={{
      balance, held, available, loading, error, refresh, reconcile,
    }}>
      {children}
    </CreditsContext.Provider>
  );
}

export function useCredits(): CreditsState {
  return useContext(CreditsContext);
}