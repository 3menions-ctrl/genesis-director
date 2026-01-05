// Quality Tier System Types
// Standard (25 credits) vs Iron-Clad Professional (40 credits)

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

export const QUALITY_TIERS: QualityTierConfig[] = [
  {
    id: 'standard',
    name: 'Standard',
    credits: 25,
    description: 'Fast production with standard quality checks',
    features: [
      'Script-to-video generation',
      'Voice synthesis',
      'Frame chaining',
      'Basic quality validation',
    ],
    maxRetries: 0,
    includesAudit: false,
    includesVisualDebugger: false,
  },
  {
    id: 'professional',
    name: 'Zero-Waste Premium',
    credits: 50,
    description: 'Premium 4s units with Zero-Waste guarantee',
    features: [
      'Everything in Standard',
      'Director Audit analysis',
      'Visual Debugger loop',
      'Up to 4 autonomous retries',
      'Physics & identity validation',
      'Character-First pacing',
      '1.5s static scenery cap',
      'Quality Insurance guarantee',
    ],
    maxRetries: 4,
    includesAudit: true,
    includesVisualDebugger: true,
  },
];

// Credit cost breakdown for Professional tier (Zero-Waste Premium)
export const PROFESSIONAL_CREDIT_BREAKDOWN = {
  PRE_PRODUCTION: 5,    // Script analysis
  PRODUCTION: 20,       // Video generation
  QUALITY_INSURANCE: 25, // Director audit + Visual debugger + 4 retry buffer
  TOTAL: 50,
} as const;

// Standard tier uses original billing
export const STANDARD_CREDIT_BREAKDOWN = {
  PRE_PRODUCTION: 5,
  PRODUCTION: 20,
  TOTAL: 25,
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
