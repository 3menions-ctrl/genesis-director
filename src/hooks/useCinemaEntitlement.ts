import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type CinemaTier = 'cinema_lite' | 'cinema_pro' | 'cinema_studio';

export interface CinemaEntitlement {
  hasEntitlement: boolean;
  tier: CinemaTier | null;
  status: string | null;
  isActive: boolean;
  cancelAtPeriodEnd: boolean;
  priceId: string | null;
  subscriptionId: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  fairUseSeconds: number;
  usedSeconds: number;
  remainingSeconds: number;
}

const EMPTY: CinemaEntitlement = {
  hasEntitlement: false,
  tier: null,
  status: null,
  isActive: false,
  cancelAtPeriodEnd: false,
  priceId: null,
  subscriptionId: null,
  periodStart: null,
  periodEnd: null,
  fairUseSeconds: 0,
  usedSeconds: 0,
  remainingSeconds: 0,
};

export async function fetchCinemaEntitlement(
  userId?: string,
): Promise<CinemaEntitlement> {
  const { data, error } = await supabase.rpc('get_cinema_entitlement', {
    _user_id: userId ?? undefined,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return EMPTY;
  return {
    hasEntitlement: !!row.has_entitlement,
    tier: (row.tier as CinemaTier | null) ?? null,
    status: row.status ?? null,
    isActive: !!row.is_active,
    cancelAtPeriodEnd: !!row.cancel_at_period_end,
    priceId: row.price_id ?? null,
    subscriptionId: row.subscription_id ?? null,
    periodStart: row.period_start ?? null,
    periodEnd: row.period_end ?? null,
    fairUseSeconds: row.fair_use_seconds ?? 0,
    usedSeconds: row.used_seconds ?? 0,
    remainingSeconds: row.remaining_seconds ?? 0,
  };
}

export const CINEMA_ENTITLEMENT_QUERY_KEY = ['cinema-entitlement'] as const;

export function useCinemaEntitlement() {
  return useQuery({
    queryKey: CINEMA_ENTITLEMENT_QUERY_KEY,
    queryFn: () => fetchCinemaEntitlement(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Invalidate the entitlement cache and poll the RPC until it reflects the
 * updated subscription. Use after a successful Stripe checkout return — the
 * webhook may take a few seconds to upsert the subscription row, so we poll
 * with backoff instead of relying on a single refetch.
 *
 * Resolves once `predicate` returns true (default: a Cinema entitlement is
 * active) OR after `maxMs` elapses.
 */
export function useRefreshCinemaEntitlement() {
  const qc = useQueryClient();

  return useCallback(
    async (
      opts: {
        predicate?: (e: CinemaEntitlement) => boolean;
        maxMs?: number;
        intervalMs?: number;
      } = {},
    ): Promise<CinemaEntitlement> => {
      const predicate = opts.predicate ?? ((e) => e.isActive);
      const maxMs = opts.maxMs ?? 25_000;
      const intervalMs = opts.intervalMs ?? 1500;
      const started = Date.now();

      // First pass — invalidate any cached value and fetch fresh.
      await qc.invalidateQueries({ queryKey: CINEMA_ENTITLEMENT_QUERY_KEY });
      let latest = await qc.fetchQuery({
        queryKey: CINEMA_ENTITLEMENT_QUERY_KEY,
        queryFn: () => fetchCinemaEntitlement(),
        staleTime: 0,
      });
      if (predicate(latest)) return latest;

      // Poll with backoff until predicate passes or timeout.
      while (Date.now() - started < maxMs) {
        await new Promise((r) => setTimeout(r, intervalMs));
        try {
          latest = await fetchCinemaEntitlement();
          qc.setQueryData(CINEMA_ENTITLEMENT_QUERY_KEY, latest);
          if (predicate(latest)) return latest;
        } catch {
          /* swallow transient errors and keep polling */
        }
      }
      return latest;
    },
    [qc],
  );
}
