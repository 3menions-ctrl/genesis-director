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

/**
 * Format a seconds count as compact "Xm Ys" / "Ys" for user-facing copy.
 */
export function formatCinemaSeconds(total: number): string {
  const s = Math.max(0, Math.floor(total));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r === 0 ? `${m}m` : `${m}m ${r}s`;
}

export interface CinemaGuardResult {
  allowed: boolean;
  reason: 'ok' | 'no-entitlement' | 'insufficient' | 'loading';
  requiredSeconds: number;
  remainingSeconds: number;
  fairUseSeconds: number;
  message?: string;
}

/**
 * Client-side guard: if the user has an active Cinema entitlement, prevent
 * generation requests that would exceed their remaining fair-use seconds.
 *
 * - When `enforce` is `false` (no Cinema sub), the guard is a no-op and
 *   returns `allowed: true` so credit-based flows can proceed unchanged.
 * - When the entitlement is still loading, we err on the side of allowing
 *   the call (server-side enforcement remains the source of truth).
 * - When insufficient, surfaces a toast with the remaining seconds and an
 *   action to open the Credits page.
 */
export function useCinemaGuard() {
  const { data: entitlement, isLoading } = useCinemaEntitlement();

  const check = useCallback(
    (
      requiredSeconds: number,
      opts: { silent?: boolean; onUpgrade?: () => void } = {},
    ): CinemaGuardResult => {
      const required = Math.max(0, Math.ceil(requiredSeconds || 0));
      const fair = entitlement?.fairUseSeconds ?? 0;
      const remaining = entitlement?.remainingSeconds ?? 0;

      if (isLoading || !entitlement) {
        return {
          allowed: true,
          reason: 'loading',
          requiredSeconds: required,
          remainingSeconds: remaining,
          fairUseSeconds: fair,
        };
      }

      // No Cinema entitlement → not the guard's concern; let credit gating
      // handle the request.
      if (!entitlement.hasEntitlement || !entitlement.isActive) {
        return {
          allowed: true,
          reason: 'no-entitlement',
          requiredSeconds: required,
          remainingSeconds: remaining,
          fairUseSeconds: fair,
        };
      }

      if (required > remaining) {
        const message =
          remaining <= 0
            ? `Cinema-seconds exhausted — you've used your ${formatCinemaSeconds(fair)} for this period.`
            : `Not enough Cinema-seconds — this clip needs ${formatCinemaSeconds(required)} but only ${formatCinemaSeconds(remaining)} remain.`;

        if (!opts.silent) {
          toast.error(message, {
            description: 'Upgrade your tier or wait for renewal to continue.',
            action: {
              label: 'View plan',
              onClick: () => {
                if (opts.onUpgrade) opts.onUpgrade();
                else window.location.assign('/credits');
              },
            },
            duration: 7000,
          });
        }

        return {
          allowed: false,
          reason: 'insufficient',
          requiredSeconds: required,
          remainingSeconds: remaining,
          fairUseSeconds: fair,
          message,
        };
      }

      return {
        allowed: true,
        reason: 'ok',
        requiredSeconds: required,
        remainingSeconds: remaining,
        fairUseSeconds: fair,
      };
    },
    [entitlement, isLoading],
  );

  return {
    entitlement: entitlement ?? null,
    isLoading,
    check,
  };
}
