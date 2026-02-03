// Quality Tier System Types
// Pricing: 
// - Base: 10 credits per clip (clips 1-6, up to 6 seconds)
// - Extended: 15 credits per clip (clips 7+ OR duration >6 seconds)
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
  maxRetries: number; // Autonomous retries per shot
  includesAudit: boolean;
  includesVisualDebugger: boolean;
}

// Single premium tier configuration - all users get the same quality
const PREMIUM_TIER_CONFIG: Omit<QualityTierConfig, 'id'> = {
  name: 'Premium',
  baseCredits: 10, // Clips 1-6, ≤6 seconds
  extendedCredits: 15, // Clips 7+ OR >6 seconds
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

// Credit cost breakdown - Base rate (clips 1-6, ≤6 seconds)
export const BASE_CREDIT_BREAKDOWN = {
  PRE_PRODUCTION: 2,    // Script analysis per clip
  PRODUCTION: 6,        // Video generation per clip
  QUALITY_INSURANCE: 2, // Audit + debugger + retries per clip
  TOTAL: 10,            // = 10 credits per clip
} as const;

// Extended rate (clips 7+ OR >6 seconds)
export const EXTENDED_CREDIT_BREAKDOWN = {
  PRE_PRODUCTION: 3,
  PRODUCTION: 9,
  QUALITY_INSURANCE: 3,
  TOTAL: 15,
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
