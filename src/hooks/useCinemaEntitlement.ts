import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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

export function useCinemaEntitlement() {
  return useQuery({
    queryKey: ['cinema-entitlement'],
    queryFn: () => fetchCinemaEntitlement(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
