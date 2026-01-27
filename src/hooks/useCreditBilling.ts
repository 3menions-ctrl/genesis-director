import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { QualityTier } from '@/types/quality-tiers';
import { 
  CREDIT_SYSTEM, 
  calculateCreditsPerClip, 
  calculateCreditsRequired 
} from '@/lib/creditSystem';

// Re-export credit constants for backward compatibility
export const CREDIT_COSTS = {
  PRE_PRODUCTION: CREDIT_SYSTEM.COST_PER_CLIP.PRE_PRODUCTION,
  PRODUCTION: CREDIT_SYSTEM.COST_PER_CLIP.PRODUCTION,
  QUALITY_ASSURANCE: CREDIT_SYSTEM.COST_PER_CLIP.QUALITY_ASSURANCE,
  TOTAL_PER_SHOT: CREDIT_SYSTEM.BASE_CREDITS_PER_CLIP,
  BASE_DURATION_THRESHOLD: CREDIT_SYSTEM.BASE_DURATION_THRESHOLD,
  CREDITS_PER_EXTRA_SECOND: CREDIT_SYSTEM.CREDITS_PER_EXTRA_SECOND,
} as const;

// Quality Tier Credits - Premium-only model
// All clips get Zero-Waste quality with autonomous retries
export const TIER_CREDIT_COSTS = {
  standard: {
    PRE_PRODUCTION: 2,
    PRODUCTION: 6,
    QUALITY_INSURANCE: 2,
    TOTAL_PER_SHOT: 10,    // Base 10 credits per clip (up to 6s)
  },
  professional: {
    PRE_PRODUCTION: 2,
    PRODUCTION: 6,
    QUALITY_INSURANCE: 2,
    TOTAL_PER_SHOT: 10,    // Same base - all clips are premium
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
        p_project_id: projectId,
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
        p_project_id: projectId,
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
        p_project_id: projectId,
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
  const canAffordShots = useCallback(async (
    shotCount: number,
    clipDuration: number = 5
  ): Promise<{
    canAfford: boolean;
    requiredCredits: number;
    availableCredits: number;
    shortfall: number;
    creditsPerClip: number;
  }> => {
    const creditsPerClip = calculateCreditsPerClip(clipDuration);
    const requiredCredits = calculateCreditsRequired(shotCount, clipDuration);
    
    if (!user) {
      return { 
        canAfford: false, 
        requiredCredits,
        availableCredits: 0,
        shortfall: requiredCredits,
        creditsPerClip,
      };
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('credits_balance')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      const availableCredits = data?.credits_balance || 0;
      const shortfall = Math.max(0, requiredCredits - availableCredits);

      return {
        canAfford: availableCredits >= requiredCredits,
        requiredCredits,
        availableCredits,
        shortfall,
        creditsPerClip,
      };
    } catch (err) {
      console.error('Balance check failed:', err);
      return { 
        canAfford: false, 
        requiredCredits,
        availableCredits: 0,
        shortfall: requiredCredits,
        creditsPerClip,
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
