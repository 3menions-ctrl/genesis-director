import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  CREDIT_SYSTEM, 
  calculateCreditsPerClip, 
  calculateCreditsRequired,
  getCreditBreakdown,
} from '@/lib/creditSystem';

// Re-export credit constants from SINGLE SOURCE OF TRUTH (creditSystem.ts)
// These match the Kling V3 pricing: 50/75 standard, 60/90 avatar per clip
export const CREDIT_COSTS = {
  PRE_PRODUCTION: CREDIT_SYSTEM.COST_PER_CLIP.PRE_PRODUCTION,
  PRODUCTION: CREDIT_SYSTEM.COST_PER_CLIP.PRODUCTION,
  QUALITY_ASSURANCE: CREDIT_SYSTEM.COST_PER_CLIP.QUALITY_ASSURANCE,
  TOTAL_PER_SHOT: CREDIT_SYSTEM.BASE_CREDITS_PER_CLIP,           // 50 credits (10s standard)
  TOTAL_PER_SHOT_EXTENDED: CREDIT_SYSTEM.EXTENDED_CREDITS_PER_CLIP, // 75 credits (15s standard)
  AVATAR_PER_SHOT: CREDIT_SYSTEM.AVATAR_BASE_CREDITS_PER_CLIP,      // 60 credits (10s avatar)
  AVATAR_PER_SHOT_EXTENDED: CREDIT_SYSTEM.AVATAR_EXTENDED_CREDITS_PER_CLIP, // 90 credits (15s avatar)
  BASE_DURATION_THRESHOLD: CREDIT_SYSTEM.BASE_DURATION_THRESHOLD,
  BASE_CLIP_COUNT_THRESHOLD: CREDIT_SYSTEM.BASE_CLIP_COUNT_THRESHOLD,
} as const;

// DEPRECATED: Legacy tier costs removed — all pricing now from CREDIT_SYSTEM
// The old 10/15 per-clip model is obsolete (Kling V3 = 50/60/75/90 per clip)
export const TIER_CREDIT_COSTS = {
  standard: {
    PRE_PRODUCTION: CREDIT_SYSTEM.COST_PER_CLIP.PRE_PRODUCTION,
    PRODUCTION: CREDIT_SYSTEM.COST_PER_CLIP.PRODUCTION,
    QUALITY_INSURANCE: CREDIT_SYSTEM.COST_PER_CLIP.QUALITY_ASSURANCE,
    TOTAL_PER_SHOT: CREDIT_SYSTEM.BASE_CREDITS_PER_CLIP,
    TOTAL_PER_SHOT_EXTENDED: CREDIT_SYSTEM.EXTENDED_CREDITS_PER_CLIP,
  },
  professional: {
    PRE_PRODUCTION: CREDIT_SYSTEM.COST_PER_CLIP.PRE_PRODUCTION,
    PRODUCTION: CREDIT_SYSTEM.COST_PER_CLIP.PRODUCTION,
    QUALITY_INSURANCE: CREDIT_SYSTEM.COST_PER_CLIP.QUALITY_ASSURANCE,
    TOTAL_PER_SHOT: CREDIT_SYSTEM.BASE_CREDITS_PER_CLIP,
    TOTAL_PER_SHOT_EXTENDED: CREDIT_SYSTEM.EXTENDED_CREDITS_PER_CLIP,
  },
} as const;

// Estimated real API costs in cents for profit tracking
export const API_COSTS_CENTS = {
  KLING_VIDEO_5S: 40,        // ~$0.40 per 5-sec video (Kling 2.6)
  ELEVENLABS_VOICE: 15,     // ~$0.15 per voice clip
  OPENAI_SCRIPT: 5,         // ~$0.05 for script generation
  VISUAL_DEBUGGER: 3,       // ~$0.03 per AI vision analysis
  DIRECTOR_AUDIT: 5,        // ~$0.05 per audit call
  RETRY_GENERATION: 80,     // Same as video generation
} as const;

interface CostLogParams {
  shotId: string;
  service: 'replicate' | 'elevenlabs' | 'openai';
  operation: string;
  creditsCharged: number;
  realCostCents: number;
  durationSeconds?: number;
  status?: 'pending' | 'completed' | 'failed' | 'refunded';
  metadata?: Record<string, unknown>;
}

export function useCreditBilling() {
  const { user } = useAuth();
  const [isCharging] = useState(false);

  // NOTE: Direct client-side charge/refund of production credits has been
  // removed. Charging and refunding are server-authoritative only: edge
  // functions reserve/consume/release credit holds (reserve_credits ->
  // consume_credit_hold / release_credit_hold) with the service-role key.
  // The legacy client RPCs (charge_preproduction_credits,
  // charge_production_credits, refund_production_credits) trusted a
  // client-supplied amount and allowed self-refund of already-delivered
  // shots; they are now revoked from anon/authenticated (see migration
  // 20260706001000_lock_legacy_client_credit_rpcs.sql). Do NOT re-add a
  // client charge/refund path here.

  // Log API cost for profit tracking
  const logApiCost = useCallback(async (
    projectId: string,
    params: CostLogParams
  ): Promise<void> => {
    if (!user) return;

    try {
      await supabase.rpc('log_api_cost', {
        p_project_id: projectId,
        p_shot_id: params.shotId,
        p_service: params.service,
        p_operation: params.operation,
        p_credits_charged: params.creditsCharged,
        p_real_cost_cents: params.realCostCents,
        p_duration_seconds: params.durationSeconds ?? null,
        p_status: params.status ?? 'completed',
        p_metadata: JSON.stringify(params.metadata ?? {}),
      });
    } catch (err) {
      console.error('Failed to log API cost:', err);
    }
  }, [user]);

  // Check if user can afford a full production cycle
  // Uses per-clip pricing: 10 credits for clips 1-6, 15 for clips 7+ or >6s duration
  const canAffordShots = useCallback(async (
    shotCount: number,
    clipDuration: number = 5
  ): Promise<{
    canAfford: boolean;
    requiredCredits: number;
    availableCredits: number;
    shortfall: number;
    breakdown: ReturnType<typeof getCreditBreakdown>;
  }> => {
    const breakdown = getCreditBreakdown(shotCount, clipDuration);
    const requiredCredits = breakdown.totalCredits;
    
    if (!user) {
      return { 
        canAfford: false, 
        requiredCredits,
        availableCredits: 0,
        shortfall: requiredCredits,
        breakdown,
      };
    }

    try {
      // LOGIC FIX L-2: use the authoritative held-aware balance
      // (available = balance − active holds) from get_credit_state, NOT the
      // profiles.credits_balance display cache — otherwise this over-promises
      // affordability while pipelines hold credits (the cache ignores holds).
      const { data, error } = await supabase.rpc('get_credit_state' as never, { p_user_id: user.id } as never);

      if (error) throw error;

      const payload = (data as { available?: number; balance?: number; held?: number }) || {};
      const availableCredits = Number(payload.available ?? payload.balance ?? 0);
      const shortfall = Math.max(0, requiredCredits - availableCredits);

      return {
        canAfford: availableCredits >= requiredCredits,
        requiredCredits,
        availableCredits,
        shortfall,
        breakdown,
      };
    } catch (err) {
      console.error('Balance check failed:', err);
      return { 
        canAfford: false, 
        requiredCredits,
        availableCredits: 0,
        shortfall: requiredCredits,
        breakdown,
      };
    }
  }, [user]);

  return {
    logApiCost,
    canAffordShots,
    isCharging,
    CREDIT_COSTS,
    API_COSTS_CENTS,
  };
}
