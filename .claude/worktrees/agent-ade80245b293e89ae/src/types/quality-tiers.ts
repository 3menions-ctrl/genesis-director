// Quality Tier System Types
// Pricing:
// - Standard 10s: 50 credits per clip ($5.00)
// - Standard 15s: 75 credits per clip ($7.50)
// - Avatar 10s: 60 credits per clip ($6.00)
// - Avatar 15s: 90 credits per clip ($9.00)
// 1 credit = $0.10

// Single unified tier - all production is premium quality
export type QualityTier = 'standard' | 'professional';

export interface QualityTierConfig {
  id: QualityTier;
  name: string;
  baseCredits: number;
  extendedCredits: number;
  description: string;
  features: string[];
  maxRetries: number;
  includesAudit: boolean;
  includesVisualDebugger: boolean;
}

const PREMIUM_TIER_CONFIG: Omit<QualityTierConfig, 'id'> = {
  name: 'Premium',
  baseCredits: 50,     // 10s clips
  extendedCredits: 75,  // 15s clips
  description: 'Zero-Waste quality with autonomous retries',
  features: [
    'Script-to-video generation',
    'Voice synthesis with emotion',
    'Frame chaining with motion vectors',
    'Director Audit analysis',
    'Visual Debugger loop',
    'Up to 4 autonomous retries',
    'Physics & identity validation',
    'Zero-Waste guarantee',
  ],
  maxRetries: 4,
  includesAudit: true,
  includesVisualDebugger: true,
};

// Both tiers use identical config (legacy compatibility)
export const QUALITY_TIERS: QualityTierConfig[] = [
  { id: 'standard', ...PREMIUM_TIER_CONFIG },
  { id: 'professional', ...PREMIUM_TIER_CONFIG },
];

// Helper to get tier config (always returns the same premium config)
export function getTierConfig(tier: QualityTier = 'standard'): QualityTierConfig {
  return QUALITY_TIERS.find(t => t.id === tier) ?? QUALITY_TIERS[0];
}

// Credit cost breakdown — Standard T2V/I2V 10s rate
export const BASE_CREDIT_BREAKDOWN = {
  PRE_PRODUCTION: 8,
  PRODUCTION: 34,
  QUALITY_INSURANCE: 8,
  TOTAL: 50,
} as const;

// Extended rate (15s clips)
export const EXTENDED_CREDIT_BREAKDOWN = {
  PRE_PRODUCTION: 12,
  PRODUCTION: 51,
  QUALITY_INSURANCE: 12,
  TOTAL: 75,
} as const;

// Legacy exports for backward compatibility
export const PROFESSIONAL_CREDIT_BREAKDOWN = BASE_CREDIT_BREAKDOWN;
export const STANDARD_CREDIT_BREAKDOWN = BASE_CREDIT_BREAKDOWN;

// Visual Debugger result interface
export interface VisualDebugResult {
  passed: boolean;
  verdict: 'PASS' | 'FAIL';
  score: number;
  issues: {
    category: 'physics' | 'identity' | 'lighting' | 'composition' | 'cinematic';
    severity: 'critical' | 'warning';
    description: string;
  }[];
  correctivePrompt?: string;
  analysisDetails: {
    physicsPlausibility: number;
    identityConsistency: number;
    lightingConsistency: number;
    cinematicQuality: number;
  };
}

// Shot retry tracking
export interface ShotRetryState {
  shotId: string;
  attempts: number;
  maxAttempts: number;
  debugResults: VisualDebugResult[];
  lastCorrectivePrompt?: string;
}

// Quality Insurance ledger entry
export interface QualityInsuranceCost {
  shotId: string;
  operation: 'audit' | 'visual_debug' | 'retry_generation';
  creditsCharged: number;
  realCostCents: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}
