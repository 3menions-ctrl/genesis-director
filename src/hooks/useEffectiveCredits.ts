/**
 * useEffectiveCredits — the credit wallet that applies to the CURRENT context.
 *
 * - Business/enterprise account with a selected workspace → the ORG credit pool
 *   (organizations.credits_balance − active org holds), because org generations
 *   consume the org pool (see migration 20260704000700).
 * - Everyone else → the member's personal credits (CreditsContext).
 *
 * Used by every balance display + pre-flight affordability check so the top bar,
 * the studio/editor, and the business surfaces all read the SAME number (fixes
 * the top-bar-vs-studio discrepancy) and the right wallet (fixes org-awareness).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCredits } from '@/contexts/CreditsContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';

export interface CreditTotals { balance: number; held: number; available: number }

export interface EffectiveCredits extends CreditTotals {
  loading: boolean;
  /** True when the active wallet is an organization pool. */
  isOrg: boolean;
  /** Org name when isOrg, else null. */
  walletName: string | null;
  refresh: () => Promise<CreditTotals>;
}

export function useEffectiveCredits(): EffectiveCredits {
  const personal = useCredits();
  const { currentOrg } = useWorkspace();
  const { profile } = useAuth();

  const isBusiness = profile?.account_type === 'business' || profile?.account_type === 'enterprise';
  const orgId = isBusiness && currentOrg ? currentOrg.id : null;
  const orgCachedBalance = currentOrg?.credits_balance ?? 0;

  const [org, setOrg] = useState<CreditTotals | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const loadOrg = useCallback(async (): Promise<CreditTotals | null> => {
    if (!orgId) { setOrg(null); return null; }
    try {
      const { data } = await (supabase.rpc as unknown as (
        fn: string, args: Record<string, unknown>,
      ) => Promise<{ data: { success?: boolean; balance?: number; held?: number; available?: number } | null }>
      )('get_org_credit_state', { p_org_id: orgId });
      if (data && data.success !== false) {
        const s: CreditTotals = {
          balance: Number(data.balance ?? 0),
          held: Number(data.held ?? 0),
          available: Number(data.available ?? 0),
        };
        if (mountedRef.current) setOrg(s);
        return s;
      }
    } catch {
      /* RPC not deployed yet / transient → caller falls back to the cached org balance */
    }
    return null;
  }, [orgId]);

  useEffect(() => { void loadOrg(); }, [loadOrg]);

  // Refetch after a generation/spend (the studio dispatches this).
  useEffect(() => {
    const onUpdated = () => { void loadOrg(); };
    window.addEventListener('credits-updated', onUpdated);
    return () => window.removeEventListener('credits-updated', onUpdated);
  }, [loadOrg]);

  const refresh = useCallback(async (): Promise<CreditTotals> => {
    if (orgId) {
      const s = await loadOrg();
      return s ?? { balance: orgCachedBalance, held: 0, available: orgCachedBalance };
    }
    return personal.refresh();
  }, [orgId, loadOrg, orgCachedBalance, personal]);

  return useMemo<EffectiveCredits>(() => {
    if (orgId) {
      // Fall back to the org row's cached balance until the RPC resolves (or if
      // the RPC isn't deployed yet) — held defaults to 0 in that window.
      const balance = org?.balance ?? orgCachedBalance;
      const held = org?.held ?? 0;
      const available = org?.available ?? Math.max(balance - held, 0);
      return {
        balance, held, available,
        loading: personal.loading && org === null,
        isOrg: true,
        walletName: currentOrg?.name ?? 'Workspace',
        refresh,
      };
    }
    return {
      balance: personal.balance,
      held: personal.held,
      available: personal.available,
      loading: personal.loading,
      isOrg: false,
      walletName: null,
      refresh,
    };
  }, [orgId, org, orgCachedBalance, currentOrg?.name, personal.balance, personal.held, personal.available, personal.loading, refresh]);
}
