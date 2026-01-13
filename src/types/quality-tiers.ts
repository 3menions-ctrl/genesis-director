// Quality Tier System Types
// Premium: $6 per video (6 clips) = 60 credits total = 10 credits per clip

export type QualityTier = 'standard' | 'professional';

export interface QualityTierConfig {
  id: QualityTier;
  name: string;
  credits: number;
  description: string;
  features: string[];
  maxRetries: number; // Autonomous retries per shot
  includesAudit: boolean;
  includesVisualDebugger: boolean;
}

// All production is premium quality - no cheap tier
export const QUALITY_TIERS: QualityTierConfig[] = [
  {
    id: 'standard',
    name: 'Premium',
    credits: 10, // 10 credits per clip × 6 = 60 credits = $6/video
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
  },
  {
    id: 'professional',
    name: 'Premium',
    credits: 10, // Same - all clips are premium
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
  },
];

// Credit cost breakdown - $6 per video (6 clips at 10 credits each)
export const PROFESSIONAL_CREDIT_BREAKDOWN = {
  PRE_PRODUCTION: 2,    // Script analysis per clip
  PRODUCTION: 6,        // Video generation per clip
  QUALITY_INSURANCE: 2, // Audit + debugger + retries per clip
  TOTAL: 10,            // = 10 credits per clip
} as const;

// All clips are premium quality
export const STANDARD_CREDIT_BREAKDOWN = {
  PRE_PRODUCTION: 2,
  PRODUCTION: 6,
  QUALITY_INSURANCE: 2,
  TOTAL: 10,
} as const;

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
