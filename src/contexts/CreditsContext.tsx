/**
 * CreditsContext — single source of truth for credit balance, held, and
 * available across the entire app. Every credit display MUST read from
 * `useCredits()` so the sidebar, the studio header, the billing page, the
 * profile, and the create page all show the exact same numbers at all times.
 *
 * Authoritative pipeline:
 *   1. Every read calls `get_credit_state()`, which derives balance directly
 *      from the credit_transactions ledger and subtracts active credit_holds.
 *   2. `profiles.credits_balance` is only a synced display cache, never the
 *      source used for spending decisions.
 *   3. Subscribe to realtime postgres_changes on profiles + credit_holds +
 *      credit_transactions for this user and refetch whenever anything moves.
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
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
  refresh: () => Promise<{ balance: number; held: number; available: number }>;
  reconcile: () => Promise<{ balance: number; held: number; available: number }>;
}

const DEFAULT_STATE: CreditsState = {
  balance: 0,
  held: 0,
  available: 0,
  loading: true,
  error: null,
  refresh: async () => ({ balance: 0, held: 0, available: 0 }),
  reconcile: async () => ({ balance: 0, held: 0, available: 0 }),
};

const CreditsContext = createContext<CreditsState>(DEFAULT_STATE);

export function CreditsProvider({ children }: { children: React.ReactNode }) {
  const { user, refreshProfile } = useAuth();
  const [balance, setBalance] = useState(0);
  const [held, setHeld] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const readState = useCallback(async (uid: string) => {
    const { data, error: rpcErr } = await supabase.rpc('get_credit_state' as never, { p_user_id: uid } as never);
    if (rpcErr) throw rpcErr;
    const payload = (data as { success?: boolean; balance?: number; held?: number; available?: number }) || {};
    if (payload.success === false) throw new Error('get_credit_state failed');
    const b = Number(payload.balance ?? 0);
    const h = Number(payload.held ?? 0);
    setBalance(b); setHeld(h);
    return { balance: b, held: h, available: Number(payload.available ?? Math.max(b - h, 0)) };
  }, []);

  // Hold balance/held in refs so the `refresh` callback identity doesn't
  // change on every ledger event. The old code had balance + held in
  // useCallback deps, which made `refresh` re-fire downstream effects
  // (notably the realtime subscription) every time credits changed —
  // each ledger event tore down + recreated the channel.
  const balanceRef = useRef(balance);
  const heldRef = useRef(held);
  useEffect(() => { balanceRef.current = balance; }, [balance]);
  useEffect(() => { heldRef.current = held; }, [held]);

  // Stabilize the callbacks by depending on user.id (string, stable
  // across AuthContext re-renders) instead of the full `user` object
  // (which churns identity every auth re-render). Was forcing the
  // useMemo `value` reference to change every render of CreditsProvider,
  // cascading re-renders to Workspace + Studio + PageTone consumers.
  const userId = user?.id ?? null;
  const refresh = useCallback(async () => {
    if (!userId) {
      setBalance(0); setHeld(0); setLoading(false);
      return { balance: 0, held: 0, available: 0 };
    }
    try {
      setError(null);
      const s = await readState(userId);
      return s;
    } catch (e) {
      setError((e as Error).message);
      const b = balanceRef.current, h = heldRef.current;
      return { balance: b, held: h, available: Math.max(b - h, 0) };
    } finally {
      setLoading(false);
    }
  }, [userId, readState]);

  const reconcile = useCallback(async () => {
    if (!userId) return { balance: 0, held: 0, available: 0 };
    try {
      const { data, error: rpcErr } = await supabase.rpc('reconcile_user_credits' as never);
      if (rpcErr) throw rpcErr;
      const payload = (data as { success?: boolean; balance?: number; held?: number; available?: number }) || {};
      if (payload.success) {
        const b = Number(payload.balance ?? 0);
        const h = Number(payload.held ?? 0);
        setBalance(b); setHeld(h);
        void refreshProfile();
        return { balance: b, held: h, available: Number(payload.available ?? Math.max(b - h, 0)) };
      } else {
        return await refresh();
      }
    } catch {
      return await refresh();
    } finally {
      setLoading(false);
    }
  }, [userId, refresh, refreshProfile]);

  // Initial reconcile + read whenever the signed-in user changes.
  useEffect(() => {
    if (!user) { setBalance(0); setHeld(0); setLoading(false); return; }
    setLoading(true);
    void reconcile();
  }, [userId, reconcile]);

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
  }, [userId, refresh]);

  // Refetch when the tab becomes visible again — guards against missed events.
  useEffect(() => {
    if (!user) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [userId, refresh]);

  const available = Math.max(balance - held, 0);

  // Memoize the context value so consumers don't re-render on every
  // CreditsProvider parent render. The audit flagged this as a primary
  // re-render storm source.
  const value = useMemo(
    () => ({ balance, held, available, loading, error, refresh, reconcile }),
    [balance, held, available, loading, error, refresh, reconcile],
  );

  return (
    <CreditsContext.Provider value={value}>
      {children}
    </CreditsContext.Provider>
  );
}

export function useCredits(): CreditsState {
  return useContext(CreditsContext);
}