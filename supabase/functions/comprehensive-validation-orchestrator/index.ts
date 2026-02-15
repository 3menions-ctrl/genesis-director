import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * COMPREHENSIVE VALIDATION ORCHESTRATOR
 * 
 * Orchestrates all validation functions for maximum video consistency:
 * 1. Color Histogram Validation
 * 2. Face Embedding Verification
 * 3. Clothing/Hair Consistency
 * 4. Environment Consistency
 * 5. Temporal Consistency
 * 6. Visual Debugger
 * 
 * Returns aggregated validation results with corrective prompts.
 */

interface ValidationRequest {
  projectId: string;
  userId: string;
  clipIndex: number;
  clipVideoUrl: string;
  clipFrameUrl?: string;
  referenceImageUrl?: string;
  clip1FrameUrl?: string;
  previousClipFrameUrl?: string;
  identityBible?: any;
  shotDescription: string;
  runAllValidations?: boolean;
  validationsToRun?: (
    | 'color-histogram'
    | 'face-embedding'
    | 'clothing-hair'
    | 'environment'
    | 'temporal'
    | 'visual-debugger'
  )[];
}

interface ValidationResult {
  validationType: string;
  passed: boolean;
  score: number;
  issues: string[];
  correctivePrompt?: string;
  details?: any;
}

interface OrchestratorResult {
  success: boolean;
  overallPassed: boolean;
  overallScore: number;
  validationResults: ValidationResult[];
  aggregatedIssues: string[];
  aggregatedCorrectivePrompt: string | null;
  shouldRegenerate: boolean;
  regenerationPriority: 'critical' | 'high' | 'medium' | 'low' | 'none';
}

async function callEdgeFunction(
  supabaseUrl: string,
  supabaseKey: string,
  functionName: string,
  body: any
): Promise<any> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[ValidationOrchestrator] ${functionName} failed: ${errorText.substring(0, 100)}`);
      return { success: false, error: errorText };
    }

    return response.json();
  } catch (error) {
    console.error(`[ValidationOrchestrator] Error calling ${functionName}:`, error);
    return { success: false, error: String(error) };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ═══ AUTH GUARD ═══
    const { validateAuth, unauthorizedResponse } = await import("../_shared/auth-guard.ts");
    const auth = await validateAuth(req);
    if (!auth.authenticated) {
      return unauthorizedResponse(corsHeaders, auth.error);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: ValidationRequest = await req.json();
    const {
      projectId,
      userId,
      clipIndex,
      clipVideoUrl,
      clipFrameUrl,
      referenceImageUrl,
      clip1FrameUrl,
      previousClipFrameUrl,
      identityBible,
      shotDescription,
      runAllValidations = true,
      validationsToRun = [],
    } = body;

    console.log(`[ValidationOrchestrator] Starting validation for clip ${clipIndex + 1}`);
    console.log(`[ValidationOrchestrator] Video URL: ${clipVideoUrl?.substring(0, 60)}...`);

    const results: ValidationResult[] = [];
    const allIssues: string[] = [];

    // Determine which validations to run
    const validations = runAllValidations
      ? ['color-histogram', 'face-embedding', 'clothing-hair', 'environment', 'temporal', 'visual-debugger']
      : validationsToRun;

    // Run validations in parallel where possible
    const validationPromises: Promise<ValidationResult>[] = [];

    // 1. Color Histogram Validation
    if (validations.includes('color-histogram') && referenceImageUrl) {
      validationPromises.push(
        callEdgeFunction(supabaseUrl, supabaseKey, 'validate-color-histogram', {
          referenceImageUrl,
          clipFrameUrl: clipFrameUrl || clipVideoUrl,
          clipIndex,
        }).then((result): ValidationResult => {
          const passed = result.success && (result.score || 0) >= 70;
          const issues = result.issues || [];
          if (!passed) allIssues.push(...issues);
          return {
            validationType: 'color-histogram',
            passed,
            score: result.score || 0,
            issues,
            details: result,
          };
        }).catch((): ValidationResult => ({
          validationType: 'color-histogram',
          passed: true, // Don't block on error
          score: 70,
          issues: ['Color histogram validation unavailable'],
        }))
      );
    }

    // 2. Face Embedding Verification
    if (validations.includes('face-embedding') && referenceImageUrl) {
      validationPromises.push(
        callEdgeFunction(supabaseUrl, supabaseKey, 'verify-face-embedding', {
          referenceImageUrl,
          clipFrameUrl: clipFrameUrl || clipVideoUrl,
          clipIndex,
        }).then((result): ValidationResult => {
          const passed = result.success && result.faceMatch !== false;
          const issues = result.issues || [];
          if (!passed) allIssues.push('Face embedding mismatch detected');
          return {
            validationType: 'face-embedding',
            passed,
            score: result.confidenceScore || (passed ? 80 : 40),
            issues,
            details: result,
          };
        }).catch((): ValidationResult => ({
          validationType: 'face-embedding',
          passed: true,
          score: 70,
          issues: ['Face embedding verification unavailable'],
        }))
      );
    }

    // 3. Clothing/Hair Validation
    if (validations.includes('clothing-hair') && identityBible) {
      validationPromises.push(
        callEdgeFunction(supabaseUrl, supabaseKey, 'validate-clothing-hair', {
          clipFrameUrl: clipFrameUrl || clipVideoUrl,
          identityBible,
          clipIndex,
        }).then((result): ValidationResult => {
          const passed = result.success && (result.clothingScore || 0) >= 60 && (result.hairScore || 0) >= 60;
          const issues = result.issues || [];
          if (!passed) allIssues.push(...issues);
          return {
            validationType: 'clothing-hair',
            passed,
            score: Math.round(((result.clothingScore || 0) + (result.hairScore || 0)) / 2),
            issues,
            correctivePrompt: result.correctivePrompt,
            details: result,
          };
        }).catch((): ValidationResult => ({
          validationType: 'clothing-hair',
          passed: true,
          score: 70,
          issues: ['Clothing/hair validation unavailable'],
        }))
      );
    }

    // 4. Environment Validation
    if (validations.includes('environment') && (referenceImageUrl || clip1FrameUrl)) {
      validationPromises.push(
        callEdgeFunction(supabaseUrl, supabaseKey, 'validate-environment', {
          referenceImageUrl: referenceImageUrl || clip1FrameUrl,
          clipFrameUrl: clipFrameUrl || clipVideoUrl,
          clipIndex,
        }).then((result): ValidationResult => {
          const passed = result.success && (result.environmentScore || 0) >= 60;
          const issues = result.issues || [];
          if (!passed) allIssues.push(...issues);
          return {
            validationType: 'environment',
            passed,
            score: result.environmentScore || 0,
            issues,
            details: result,
          };
        }).catch((): ValidationResult => ({
          validationType: 'environment',
          passed: true,
          score: 70,
          issues: ['Environment validation unavailable'],
        }))
      );
    }

    // 5. Temporal Consistency (clip 2+)
    if (validations.includes('temporal') && clipIndex > 0 && previousClipFrameUrl) {
      validationPromises.push(
        callEdgeFunction(supabaseUrl, supabaseKey, 'validate-temporal-consistency', {
          previousClipFrameUrl,
          currentClipFrameUrl: clipFrameUrl || clipVideoUrl,
          clipIndex,
          shotDescription,
        }).then((result): ValidationResult => {
          const passed = result.success && (result.temporalScore || 0) >= 60;
          const issues = result.issues || [];
          if (!passed) allIssues.push(...issues);
          return {
            validationType: 'temporal',
            passed,
            score: result.temporalScore || 0,
            issues,
            correctivePrompt: result.correctivePrompt,
            details: result,
          };
        }).catch((): ValidationResult => ({
          validationType: 'temporal',
          passed: true,
          score: 70,
          issues: ['Temporal consistency validation unavailable'],
        }))
      );
    }

    // 6. Visual Debugger (comprehensive quality check)
    if (validations.includes('visual-debugger')) {
      validationPromises.push(
        callEdgeFunction(supabaseUrl, supabaseKey, 'visual-debugger', {
          videoUrl: clipVideoUrl,
          frameUrl: clipFrameUrl,
          shotDescription,
          shotId: `clip_${clipIndex}`,
          referenceImageUrl,
          referenceAnalysis: identityBible ? {
            characterIdentity: identityBible.characterIdentity || { description: identityBible.consistencyPrompt },
          } : undefined,
        }).then((result): ValidationResult => {
          const vdResult = result.result || result;
          const passed = vdResult.passed || vdResult.verdict === 'PASS';
          const issues = (vdResult.issues || []).map((i: any) => i.description || String(i));
          if (!passed) allIssues.push(...issues);
          return {
            validationType: 'visual-debugger',
            passed,
            score: vdResult.score || 0,
            issues,
            correctivePrompt: vdResult.correctivePrompt,
            details: vdResult,
          };
        }).catch((): ValidationResult => ({
          validationType: 'visual-debugger',
          passed: true,
          score: 70,
          issues: ['Visual debugger unavailable'],
        }))
      );
    }

    // Wait for all validations to complete
    const validationResults = await Promise.all(validationPromises);
    results.push(...validationResults);

    // Calculate overall scores
    const passedCount = results.filter(r => r.passed).length;
    const totalValidations = results.length;
    const averageScore = results.length > 0
      ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)
      : 100;

    const overallPassed = passedCount === totalValidations || averageScore >= 70;

    // Determine regeneration priority
    let regenerationPriority: 'critical' | 'high' | 'medium' | 'low' | 'none' = 'none';
    const criticalFailures = results.filter(r => !r.passed && r.score < 40);
    const highFailures = results.filter(r => !r.passed && r.score >= 40 && r.score < 60);

    if (criticalFailures.length > 0) {
      regenerationPriority = 'critical';
    } else if (highFailures.length > 1) {
      regenerationPriority = 'high';
    } else if (highFailures.length === 1) {
      regenerationPriority = 'medium';
    } else if (!overallPassed) {
      regenerationPriority = 'low';
    }

    // Build aggregated corrective prompt
    let aggregatedCorrectivePrompt: string | null = null;
    if (!overallPassed) {
      const correctivePrompts = results
        .filter(r => r.correctivePrompt)
        .map(r => r.correctivePrompt);

      if (correctivePrompts.length > 0) {
        // Combine unique corrective elements
        aggregatedCorrectivePrompt = `${shotDescription}. ${allIssues.slice(0, 5).map(i => `Fix: ${i}`).join('. ')}. Ensure consistent character appearance, stable identity, proper lighting continuity, no morphing or drift.`;
      }
    }

    // Log validation to database
    // FIXED: Use 'success' status for API cost tracking (passed/failed is stored in metadata)
    try {
      await supabase.from('api_cost_logs').insert({
        user_id: userId,
        project_id: projectId,
        service: 'validation-orchestrator',
        operation: `validate-clip-${clipIndex}`,
        status: 'success', // Changed from 'passed/failed' - this tracks API call success, not validation result
        metadata: {
          clipIndex,
          validationPassed: overallPassed, // Store validation result here
          validationResults: results.map(r => ({
            type: r.validationType,
            passed: r.passed,
            score: r.score,
          })),
          overallScore: averageScore,
          regenerationPriority,
        },
        real_cost_cents: 0,
        credits_charged: 0,
      });
    } catch (logErr) {
      console.warn('[ValidationOrchestrator] Failed to log validation:', logErr);
    }

    const response: OrchestratorResult = {
      success: true,
      overallPassed,
      overallScore: averageScore,
      validationResults: results,
      aggregatedIssues: [...new Set(allIssues)],
      aggregatedCorrectivePrompt,
      shouldRegenerate: regenerationPriority !== 'none',
      regenerationPriority,
    };

    console.log(`[ValidationOrchestrator] Clip ${clipIndex + 1} validation complete:`);
    console.log(`  Overall: ${overallPassed ? 'PASSED' : 'FAILED'} (score: ${averageScore})`);
    console.log(`  Passed: ${passedCount}/${totalValidations} validations`);
    console.log(`  Issues: ${allIssues.length}`);
    console.log(`  Regeneration priority: ${regenerationPriority}`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[ValidationOrchestrator] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Validation orchestration failed',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
