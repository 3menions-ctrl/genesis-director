// Quality Tier System Types
// Premium-Only: $6 per clip (60 credits) - Zero-Waste guarantee on every clip

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
    credits: 60, // $6.00 per clip
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
    credits: 60, // Same - all clips are premium
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

// Credit cost breakdown - $6 per clip (60 credits at $0.10/credit)
export const PROFESSIONAL_CREDIT_BREAKDOWN = {
  PRE_PRODUCTION: 10,   // Script analysis, scene optimization
  PRODUCTION: 35,       // Video generation, voice synthesis
  QUALITY_INSURANCE: 15, // Director audit + Visual debugger + 4 retry buffer
  TOTAL: 60,            // = $6.00 per clip
} as const;

// All clips are premium quality
export const STANDARD_CREDIT_BREAKDOWN = {
  PRE_PRODUCTION: 10,
  PRODUCTION: 35,
  QUALITY_INSURANCE: 15,
  TOTAL: 60,
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
