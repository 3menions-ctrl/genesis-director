import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { QualityTier } from '@/types/quality-tiers';

// Two-phase billing: 5 credits pre-production + 20 credits production = 25 credits per shot (Standard)
export const CREDIT_COSTS = {
  PRE_PRODUCTION: 5,  // Script analysis, image generation
  PRODUCTION: 20,      // Video generation, voice synthesis
  TOTAL_PER_SHOT: 25,  // Standard tier
} as const;

// Quality Tier Credits (Zero-Waste Premium: 50 credits/unit)
export const TIER_CREDIT_COSTS = {
  standard: {
    PRE_PRODUCTION: 5,
    PRODUCTION: 20,
    QUALITY_INSURANCE: 0,
    TOTAL_PER_SHOT: 25,
  },
  professional: {
    PRE_PRODUCTION: 5,
    PRODUCTION: 20,
    QUALITY_INSURANCE: 25, // Audit + Visual Debugger + 4 retry buffer
    TOTAL_PER_SHOT: 50,
  },
} as const;

// Estimated real API costs in cents for profit tracking
export const API_COSTS_CENTS = {
  REPLICATE_VIDEO_4S: 80,   // ~$0.80 per 4-sec video
  ELEVENLABS_VOICE: 15,     // ~$0.15 per voice clip
  OPENAI_SCRIPT: 5,         // ~$0.05 for script generation
  VISUAL_DEBUGGER: 3,       // ~$0.03 per AI vision analysis
  DIRECTOR_AUDIT: 5,        // ~$0.05 per audit call
  RETRY_GENERATION: 80,     // Same as video generation
} as const;

interface BillingResult {
  success: boolean;
  error?: string;
  creditsCharged?: number;
  remainingBalance?: number;
}

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
  const [isCharging, setIsCharging] = useState(false);

  // Charge pre-production credits (5 credits) - called when script/image generation starts
  const chargePreProduction = useCallback(async (
    projectId: string,
    shotId: string
  ): Promise<BillingResult> => {
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    setIsCharging(true);
    try {
      const { data, error } = await supabase.rpc('charge_preproduction_credits', {
        p_user_id: user.id,
        p_project_id: projectId || null,
        p_shot_id: shotId,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; credits_charged?: number; remaining_balance?: number };
      
      if (!result.success) {
        toast.error(result.error || 'Insufficient credits for pre-production');
        return { 
          success: false, 
          error: result.error || 'Insufficient credits'
        };
      }

      return {
        success: true,
        creditsCharged: result.credits_charged,
        remainingBalance: result.remaining_balance,
      };
    } catch (err) {
      console.error('Pre-production billing error:', err);
      return { success: false, error: 'Billing failed' };
    } finally {
      setIsCharging(false);
    }
  }, [user]);

  // Charge production credits (20 credits) - called when user approves and video generation starts
  const chargeProduction = useCallback(async (
    projectId: string,
    shotId: string
  ): Promise<BillingResult> => {
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    setIsCharging(true);
    try {
      const { data, error } = await supabase.rpc('charge_production_credits', {
        p_user_id: user.id,
        p_project_id: projectId || null,
        p_shot_id: shotId,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; credits_charged?: number; remaining_balance?: number };
      
      if (!result.success) {
        toast.error(result.error || 'Insufficient credits for production');
        return { 
          success: false, 
          error: result.error || 'Insufficient credits'
        };
      }

      return {
        success: true,
        creditsCharged: result.credits_charged,
        remainingBalance: result.remaining_balance,
      };
    } catch (err) {
      console.error('Production billing error:', err);
      return { success: false, error: 'Billing failed' };
    } finally {
      setIsCharging(false);
    }
  }, [user]);

  // Refund credits on API failure
  const refundCredits = useCallback(async (
    projectId: string,
    shotId: string,
    reason: string
  ): Promise<BillingResult> => {
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      const { data, error } = await supabase.rpc('refund_production_credits', {
        p_user_id: user.id,
        p_project_id: projectId || null,
        p_shot_id: shotId,
        p_reason: reason,
      });

      if (error) throw error;

      const result = data as { success: boolean; credits_refunded?: number };
      
      if (result.credits_refunded && result.credits_refunded > 0) {
        toast.info(`${result.credits_refunded} credits refunded due to: ${reason}`);
      }

      return {
        success: true,
        creditsCharged: result.credits_refunded,
      };
    } catch (err) {
      console.error('Refund error:', err);
      return { success: false, error: 'Refund failed' };
    }
  }, [user]);

  // Log API cost for profit tracking
  const logApiCost = useCallback(async (
    projectId: string,
    params: CostLogParams
  ): Promise<void> => {
    if (!user) return;

    try {
      await supabase.rpc('log_api_cost', {
        p_user_id: user.id,
        p_project_id: projectId || null,
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
  const canAffordShots = useCallback(async (shotCount: number): Promise<{
    canAfford: boolean;
    requiredCredits: number;
    availableCredits: number;
    shortfall: number;
  }> => {
    if (!user) {
      return { 
        canAfford: false, 
        requiredCredits: shotCount * CREDIT_COSTS.TOTAL_PER_SHOT,
        availableCredits: 0,
        shortfall: shotCount * CREDIT_COSTS.TOTAL_PER_SHOT,
      };
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('credits_balance')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      const requiredCredits = shotCount * CREDIT_COSTS.TOTAL_PER_SHOT;
      const availableCredits = data?.credits_balance || 0;
      const shortfall = Math.max(0, requiredCredits - availableCredits);

      return {
        canAfford: availableCredits >= requiredCredits,
        requiredCredits,
        availableCredits,
        shortfall,
      };
    } catch (err) {
      console.error('Balance check failed:', err);
      return { 
        canAfford: false, 
        requiredCredits: shotCount * CREDIT_COSTS.TOTAL_PER_SHOT,
        availableCredits: 0,
        shortfall: shotCount * CREDIT_COSTS.TOTAL_PER_SHOT,
      };
    }
  }, [user]);

  return {
    chargePreProduction,
    chargeProduction,
    refundCredits,
    logApiCost,
    canAffordShots,
    isCharging,
    CREDIT_COSTS,
    API_COSTS_CENTS,
  };
}
