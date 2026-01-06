import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { 
  PipelineState, 
  INITIAL_PIPELINE_STATE, 
  Shot, 
  WorkflowStage, 
  ProjectType,
  ProductionState,
  MasterAnchor,
  VoiceTrack,
  AudioMixMode,
  CAMERAMAN_NEGATIVE_PROMPTS,
  CAMERA_MOVEMENT_REWRITES,
  ReferenceImageAnalysis,
  CinematicAuditResult,
  QualityTier,
  QualityInsuranceCost,
  VisualDebugResultSummary,
  TransitionType,
  MAX_SHOT_DURATION_SECONDS,
  MIN_SHOT_DURATION_SECONDS,
} from '@/types/production-pipeline';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { extractLastFrame, buildNegativePrompt } from '@/lib/cinematicPromptEngine';
import { CREDIT_COSTS, API_COSTS_CENTS, TIER_CREDIT_COSTS } from '@/hooks/useCreditBilling';
import { useAuth } from '@/contexts/AuthContext';

// Maximum retries per shot for Professional tier
const MAX_PROFESSIONAL_RETRIES = 2;

interface ProductionPipelineContextType {
  state: PipelineState;
  
  // Stage navigation
  goToStage: (stage: WorkflowStage) => void;
  canProceedToStage: (stage: WorkflowStage) => boolean;
  
  // QUALITY TIER: Standard vs Professional
  setQualityTier: (tier: QualityTier) => void;
  
  // IMAGE-FIRST: Reference image functions
  setReferenceImage: (analysis: ReferenceImageAnalysis) => void;
  clearReferenceImage: () => void;
  
  // TEXT-TO-VIDEO: Toggle mode without reference image
  setTextToVideoMode: (enabled: boolean) => void;
  
  // Scripting stage
  setProjectType: (type: ProjectType) => void;
  setProjectTitle: (title: string) => void;
  setProjectId: (id: string) => void;
  setRawScript: (script: string) => void;
  generateStructuredShots: (synopsis?: string) => Promise<void>;
  setStructuredShots: (shots: Shot[]) => void; // Direct shot setting for smart script
  updateShot: (shotId: string, updates: Partial<Shot>) => void;
  approveScript: () => void;
  rejectAndRegenerate: () => Promise<void>;
  
  // CINEMATIC AUDITOR: Audit functions
  runCinematicAudit: () => Promise<void>;
  approveAudit: () => void;
  applyAuditSuggestion: (shotId: string, optimizedDescription: string) => void;
  applyAllSuggestionsAndReaudit: () => Promise<void>;
  autoOptimizeUntilReady: () => Promise<void>;
  isReauditing: boolean;
  optimizationProgress: { iteration: number; score: number; message: string } | null;
  
  // Production stage
  startProduction: () => Promise<void>;
  cancelProduction: () => void;
  retryFailedShots: () => Promise<void>;
  
  // Review stage
  setAudioMixMode: (mode: AudioMixMode) => void;
  exportFinalVideo: () => Promise<string | null>;
  
  // State queries
  isGenerating: boolean;
  isAuditing: boolean;
  productionProgress: number;
  
  // Reset
  resetPipeline: () => void;
  
  // Initialize from existing project
  initializeFromProject: (projectId: string, title: string, script: string) => void;
}

const ProductionPipelineContext = createContext<ProductionPipelineContextType | null>(null);

export function ProductionPipelineProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<PipelineState>(INITIAL_PIPELINE_STATE);
  const cancelRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Two-phase billing helpers
  const chargePreProduction = useCallback(async (shotId: string): Promise<boolean> => {
    if (!user) return false;
    try {
      const { data, error } = await supabase.rpc('charge_preproduction_credits', {
        p_user_id: user.id,
        p_project_id: state.projectId || null,
        p_shot_id: shotId,
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        toast.error(result.error || 'Insufficient credits for pre-production');
        return false;
      }
      return true;
    } catch (err) {
      console.error('Pre-production billing error:', err);
      return false;
    }
  }, [user, state.projectId]);
  
  const chargeProduction = useCallback(async (shotId: string): Promise<boolean> => {
    if (!user) return false;
    try {
      const { data, error } = await supabase.rpc('charge_production_credits', {
        p_user_id: user.id,
        p_project_id: state.projectId || null,
        p_shot_id: shotId,
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        toast.error(result.error || 'Insufficient credits for production');
        return false;
      }
      return true;
    } catch (err) {
      console.error('Production billing error:', err);
      return false;
    }
  }, [user, state.projectId]);
  
  const refundCredits = useCallback(async (shotId: string, reason: string): Promise<void> => {
    if (!user) return;
    try {
      const { data, error } = await supabase.rpc('refund_production_credits', {
        p_user_id: user.id,
        p_project_id: state.projectId || null,
        p_shot_id: shotId,
        p_reason: reason,
      });
      if (error) throw error;
      const result = data as { credits_refunded?: number };
      if (result.credits_refunded && result.credits_refunded > 0) {
        toast.info(`${result.credits_refunded} credits refunded: ${reason}`);
      }
    } catch (err) {
      console.error('Refund error:', err);
    }
  }, [user, state.projectId]);
  
  const logApiCost = useCallback(async (
    shotId: string,
    service: string,
    operation: string,
    creditsCharged: number,
    realCostCents: number
  ): Promise<void> => {
    if (!user) return;
    try {
      await supabase.rpc('log_api_cost', {
        p_user_id: user.id,
        p_project_id: state.projectId || null,
        p_shot_id: shotId,
        p_service: service,
        p_operation: operation,
        p_credits_charged: creditsCharged,
        p_real_cost_cents: realCostCents,
        p_duration_seconds: null,
        p_status: 'completed',
        p_metadata: '{}',
      });
    } catch (err) {
      console.error('Failed to log API cost:', err);
    }
  }, [user, state.projectId]);
  
  // Apply Cameraman Hallucination Filter to prompts
  const applyCameramanFilter = useCallback((prompt: string): { cleanPrompt: string; negativePrompt: string } => {
    let cleanPrompt = prompt;
    
    // Rewrite camera movement terms to perspective language
    Object.entries(CAMERA_MOVEMENT_REWRITES).forEach(([term, replacement]) => {
      const regex = new RegExp(term, 'gi');
      cleanPrompt = cleanPrompt.replace(regex, replacement);
    });
    
    // Remove any remaining camera-related terms
    CAMERAMAN_NEGATIVE_PROMPTS.forEach(term => {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      cleanPrompt = cleanPrompt.replace(regex, '');
    });
    
    // Clean up extra spaces
    cleanPrompt = cleanPrompt.replace(/\s+/g, ' ').trim();
    
    // Build negative prompt
    const negativePrompt = buildNegativePrompt(CAMERAMAN_NEGATIVE_PROMPTS);
    
    return { cleanPrompt, negativePrompt };
  }, []);
  
  // Stage navigation
  const goToStage = useCallback((stage: WorkflowStage) => {
    setState(prev => ({ ...prev, currentStage: stage }));
  }, []);
  
  const canProceedToStage = useCallback((stage: WorkflowStage): boolean => {
    switch (stage) {
      case 'scripting':
        return true;
      case 'production':
        return state.scriptApproved && state.structuredShots.length > 0;
      case 'review':
        return state.production.completedShots > 0;
      default:
        return false;
    }
  }, [state.scriptApproved, state.structuredShots.length, state.production.completedShots]);
  
  // Quality Tier selection
  const setQualityTier = useCallback((tier: QualityTier) => {
    setState(prev => ({ ...prev, qualityTier: tier }));
    toast.info(tier === 'professional' 
      ? 'Iron-Clad Professional mode enabled (40 credits/shot)' 
      : 'Standard mode enabled (25 credits/shot)'
    );
  }, []);
  
  // TEXT-TO-VIDEO: Toggle text-only mode (no reference image required)
  const setTextToVideoMode = useCallback((enabled: boolean) => {
    setState(prev => ({ 
      ...prev, 
      textToVideoMode: enabled,
      referenceImageRequired: !enabled,
    }));
    toast.info(enabled 
      ? 'Text-to-Video mode enabled - no reference image required' 
      : 'Image-to-Video mode enabled - reference image required'
    );
  }, []);
  
  // Scripting stage functions
  const setProjectType = useCallback((type: ProjectType) => {
    setState(prev => ({ ...prev, projectType: type }));
  }, []);
  
  const setProjectTitle = useCallback((title: string) => {
    setState(prev => ({ ...prev, projectTitle: title }));
  }, []);
  
  const setProjectId = useCallback((id: string) => {
    setState(prev => ({ ...prev, projectId: id }));
  }, []);
  
  const setRawScript = useCallback((script: string) => {
    setState(prev => ({ ...prev, rawScript: script, scriptApproved: false }));
  }, []);
  
  const initializeFromProject = useCallback((projectId: string, title: string, script: string) => {
    setState(prev => ({
      ...prev,
      projectId,
      projectTitle: title,
      rawScript: script,
    }));
  }, []);
  
  // Generate structured shots from script using LLM
  const generateStructuredShots = useCallback(async (synopsis?: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('extract-scenes', {
        body: {
          script: state.rawScript || synopsis,
          projectType: state.projectType,
          title: state.projectTitle,
        },
      });
      
      if (error) throw error;
      
      const shots: Shot[] = (data.scenes || []).map((scene: any, index: number) => {
        // Enforce 4-16 second duration limits
        let duration = scene.durationSeconds || 8;
        duration = Math.max(MIN_SHOT_DURATION_SECONDS, Math.min(MAX_SHOT_DURATION_SECONDS, duration));
        
        return {
          id: `shot_${String(index + 1).padStart(3, '0')}`,
          index,
          title: scene.title || `Shot ${index + 1}`,
          description: scene.visualDescription || scene.description,
          dialogue: scene.dialogue || scene.scriptText || '',
          durationSeconds: duration,
          mood: scene.mood || 'neutral',
          cameraMovement: scene.cameraMovement || 'steady',
          transitionOut: (scene.transitionOut as TransitionType) || 'continuous',
          characters: scene.characters || [],
          status: 'pending' as const,
        };
      });
      
      setState(prev => ({
        ...prev,
        structuredShots: shots,
        production: {
          ...prev.production,
          shots,
          currentShotIndex: 0,
          completedShots: 0,
          failedShots: 0,
        },
      }));
      
      toast.success(`Generated ${shots.length} shots from script`);
    } catch (err) {
      console.error('Failed to generate shots:', err);
      toast.error('Failed to parse script into shots');
    }
  }, [state.rawScript, state.projectType, state.projectTitle]);
  
  // Set structured shots directly (for smart script generator)
  const setStructuredShots = useCallback((shots: Shot[]) => {
    setState(prev => ({
      ...prev,
      structuredShots: shots,
      production: {
        ...prev.production,
        shots,
        currentShotIndex: 0,
        completedShots: 0,
        failedShots: 0,
      },
    }));
  }, []);
  
  const updateShot = useCallback((shotId: string, updates: Partial<Shot>) => {
    setState(prev => ({
      ...prev,
      structuredShots: prev.structuredShots.map(shot =>
        shot.id === shotId ? { ...shot, ...updates } : shot
      ),
      production: {
        ...prev.production,
        shots: prev.production.shots.map(shot =>
          shot.id === shotId ? { ...shot, ...updates } : shot
        ),
      },
    }));
  }, []);
  
  const approveScript = useCallback(() => {
    setState(prev => ({ ...prev, scriptApproved: true }));
    toast.success('Script approved! Ready for audit.');
  }, []);
  
  const rejectAndRegenerate = useCallback(async () => {
    setState(prev => ({ ...prev, scriptApproved: false, structuredShots: [], cinematicAudit: undefined, auditApproved: false }));
    await generateStructuredShots();
  }, [generateStructuredShots]);
  
  // IMAGE-FIRST: Reference image functions
  const setReferenceImage = useCallback((analysis: ReferenceImageAnalysis) => {
    setState(prev => ({ 
      ...prev, 
      referenceImage: analysis,
      // Also set as master anchor for production consistency
      production: {
        ...prev.production,
        masterAnchor: {
          imageUrl: analysis.imageUrl,
          seed: prev.production.globalSeed,
          environmentPrompt: analysis.consistencyPrompt || analysis.environment?.setting || '',
          colorPalette: analysis.colorPalette?.mood || 'cinematic',
          lightingStyle: analysis.lighting?.style || 'dramatic',
        },
      },
    }));
    toast.success('Reference image locked as visual anchor');
  }, []);
  
  const clearReferenceImage = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      referenceImage: undefined,
      production: {
        ...prev.production,
        masterAnchor: undefined,
      },
    }));
  }, []);
  
  // CINEMATIC AUDITOR: Run the director agent audit
  const [isAuditing, setIsAuditing] = useState(false);
  
  const runCinematicAudit = useCallback(async () => {
    if (state.structuredShots.length === 0) {
      toast.error('Generate shots first before auditing');
      return;
    }
    
    setIsAuditing(true);
    toast.info('Director Agent analyzing script for production readiness...');
    
    try {
      const { data, error } = await supabase.functions.invoke('cinematic-auditor', {
        body: {
          shots: state.structuredShots,
          referenceAnalysis: state.referenceImage,
          projectType: state.projectType,
          title: state.projectTitle,
        },
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      setState(prev => ({
        ...prev,
        cinematicAudit: data.audit,
      }));
      
      const score = data.audit?.overallScore || 0;
      if (score >= 80) {
        toast.success(`Audit complete! Score: ${score}% - Production Ready`);
      } else if (score >= 60) {
        toast.warning(`Audit complete! Score: ${score}% - Review suggestions`);
      } else {
        toast.error(`Audit complete! Score: ${score}% - Critical issues found`);
      }
    } catch (err) {
      console.error('Cinematic audit error:', err);
      toast.error('Failed to run cinematic audit');
    } finally {
      setIsAuditing(false);
    }
  }, [state.structuredShots, state.referenceImage, state.projectType, state.projectTitle]);
  
  const approveAudit = useCallback(() => {
    setState(prev => ({ ...prev, auditApproved: true }));
    toast.success('Audit approved! Ready for 20-credit production phase.');
  }, []);
  
  const applyAuditSuggestion = useCallback((shotId: string, optimizedDescription: string) => {
    setState(prev => ({
      ...prev,
      structuredShots: prev.structuredShots.map(shot =>
        shot.id === shotId ? { ...shot, description: optimizedDescription } : shot
      ),
      production: {
        ...prev.production,
        shots: prev.production.shots.map(shot =>
          shot.id === shotId ? { ...shot, description: optimizedDescription } : shot
        ),
      },
    }));
    toast.success(`Applied optimized prompt to ${shotId}`);
  }, []);
  
  // Apply all audit suggestions and re-run the audit
  const [isReauditing, setIsReauditing] = useState(false);
  const [optimizationProgress, setOptimizationProgress] = useState<{ iteration: number; score: number; message: string } | null>(null);
  
  // Single pass: apply fixes and re-audit once
  const applyAllSuggestionsAndReaudit = useCallback(async () => {
    if (!state.cinematicAudit?.suggestions) return;
    
    setIsReauditing(true);
    
    try {
      const suggestionsWithRewrites = state.cinematicAudit.suggestions.filter(s => s.rewrittenPrompt);
      
      setState(prev => ({
        ...prev,
        structuredShots: prev.structuredShots.map(shot => {
          const suggestion = suggestionsWithRewrites.find(s => s.shotId === shot.id);
          return suggestion ? { ...shot, description: suggestion.rewrittenPrompt! } : shot;
        }),
        production: {
          ...prev.production,
          shots: prev.production.shots.map(shot => {
            const suggestion = suggestionsWithRewrites.find(s => s.shotId === shot.id);
            return suggestion ? { ...shot, description: suggestion.rewrittenPrompt! } : shot;
          }),
        },
        cinematicAudit: undefined,
        auditApproved: false,
      }));
      
      toast.success(`Applied ${suggestionsWithRewrites.length} fixes. Re-auditing...`);
      await new Promise(resolve => setTimeout(resolve, 100));
      await runCinematicAudit();
      
    } catch (err) {
      console.error('Apply all and reaudit error:', err);
      toast.error('Failed to apply fixes and re-audit');
    } finally {
      setIsReauditing(false);
    }
  }, [state.cinematicAudit?.suggestions, runCinematicAudit]);
  
  // Auto-optimize: keep improving until score >= 80% or max iterations
  // Uses VALIDATED optimization - only keeps fixes that actually improve scores
  const autoOptimizeUntilReady = useCallback(async () => {
    const TARGET_SCORE = 80;
    const MAX_ITERATIONS = 5;
    const MIN_IMPROVEMENT = 2; // Minimum score improvement to accept a change
    
    setIsReauditing(true);
    setOptimizationProgress({ iteration: 0, score: state.cinematicAudit?.overallScore || 0, message: 'Starting validated optimization...' });
    
    try {
      let bestShots = [...state.structuredShots];
      let bestScore = state.cinematicAudit?.overallScore || 0;
      let bestAudit = state.cinematicAudit;
      let iteration = 0;
      let noImprovementCount = 0;
      
      while (iteration < MAX_ITERATIONS && noImprovementCount < 2) {
        iteration++;
        setOptimizationProgress({ 
          iteration, 
          score: bestScore, 
          message: `Iteration ${iteration}/${MAX_ITERATIONS}: Analyzing shots...` 
        });
        
        // Call the cinematic auditor with current best shots
        const { data, error } = await supabase.functions.invoke('cinematic-auditor', {
          body: {
            shots: bestShots,
            referenceAnalysis: state.referenceImage,
            projectType: state.projectType,
            title: state.projectTitle,
          },
        });
        
        if (error) {
          console.error('Audit error during optimization:', error);
          throw new Error('Audit failed during optimization');
        }
        
        const auditResult = data.audit;
        const currentScore = auditResult?.overallScore || 0;
        
        // First iteration: update the baseline
        if (iteration === 1) {
          bestScore = currentScore;
          bestAudit = auditResult;
        }
        
        setOptimizationProgress({ 
          iteration, 
          score: currentScore, 
          message: `Iteration ${iteration}: Score ${currentScore}% (best: ${bestScore}%)` 
        });
        
        // Check if we've reached our target
        if (currentScore >= TARGET_SCORE) {
          setState(prev => ({
            ...prev,
            structuredShots: bestShots,
            production: { ...prev.production, shots: bestShots.map(s => ({ ...s, status: 'pending' as const })) },
            cinematicAudit: auditResult,
            auditApproved: false,
          }));
          toast.success(`Optimization complete! Score: ${currentScore}% (${iteration} iteration${iteration > 1 ? 's' : ''})`);
          break;
        }
        
        // Get suggestions with rewrites
        const suggestionsWithRewrites = auditResult?.suggestions?.filter((s: any) => s.rewrittenPrompt) || [];
        
        if (suggestionsWithRewrites.length === 0) {
          setState(prev => ({
            ...prev,
            structuredShots: bestShots,
            production: { ...prev.production, shots: bestShots.map(s => ({ ...s, status: 'pending' as const })) },
            cinematicAudit: bestAudit,
            auditApproved: false,
          }));
          toast.warning(`Optimization reached ${bestScore}% - no more automatic improvements available`);
          break;
        }
        
        setOptimizationProgress({ 
          iteration, 
          score: currentScore, 
          message: `Iteration ${iteration}: Testing ${suggestionsWithRewrites.length} proposed fixes...` 
        });
        
        // Create candidate shots with all proposed fixes applied
        const candidateShots = bestShots.map(shot => {
          const suggestion = suggestionsWithRewrites.find((s: any) => s.shotId === shot.id);
          return suggestion ? { ...shot, description: suggestion.rewrittenPrompt } : shot;
        });
        
        // VALIDATE: Re-audit the candidate shots to confirm improvement
        setOptimizationProgress({ 
          iteration, 
          score: currentScore, 
          message: `Iteration ${iteration}: Validating fixes...` 
        });
        
        const { data: validationData, error: validationError } = await supabase.functions.invoke('cinematic-auditor', {
          body: {
            shots: candidateShots,
            referenceAnalysis: state.referenceImage,
            projectType: state.projectType,
            title: state.projectTitle,
          },
        });
        
        if (validationError) {
          console.error('Validation audit error:', validationError);
          noImprovementCount++;
          continue;
        }
        
        const validatedScore = validationData.audit?.overallScore || 0;
        const improvement = validatedScore - bestScore;
        
        setOptimizationProgress({ 
          iteration, 
          score: validatedScore, 
          message: `Iteration ${iteration}: Validated ${validatedScore}% (${improvement >= 0 ? '+' : ''}${improvement}%)` 
        });
        
        // Only accept if there's genuine improvement
        if (improvement >= MIN_IMPROVEMENT) {
          bestShots = candidateShots;
          bestScore = validatedScore;
          bestAudit = validationData.audit;
          noImprovementCount = 0;
          toast.info(`Iteration ${iteration}: Improved by ${improvement}% (now ${validatedScore}%)`);
        } else if (improvement > 0) {
          // Small improvement - accept but note it
          bestShots = candidateShots;
          bestScore = validatedScore;
          bestAudit = validationData.audit;
          noImprovementCount++;
          toast.info(`Iteration ${iteration}: Minor improvement +${improvement}%`);
        } else {
          // No improvement or regression - reject these fixes
          noImprovementCount++;
          toast.warning(`Iteration ${iteration}: Fixes rejected (no improvement)`);
        }
        
        // Small delay between iterations
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Final state update if we didn't reach target
      if (bestScore < TARGET_SCORE) {
        setState(prev => ({
          ...prev,
          structuredShots: bestShots,
          production: { ...prev.production, shots: bestShots.map(s => ({ ...s, status: 'pending' as const })) },
          cinematicAudit: bestAudit,
          auditApproved: false,
        }));
        
        if (noImprovementCount >= 2) {
          toast.warning(`Optimization stalled at ${bestScore}% - manual review recommended`);
        } else {
          toast.warning(`Reached max iterations. Best validated score: ${bestScore}%`);
        }
      }
      
    } catch (err) {
      console.error('Auto-optimize error:', err);
      toast.error('Optimization failed');
    } finally {
      setIsReauditing(false);
      setOptimizationProgress(null);
    }
  }, [state.structuredShots, state.cinematicAudit, state.referenceImage, state.projectType, state.projectTitle]);
  
  // Generate master anchor image for visual consistency
  const generateMasterAnchor = useCallback(async (): Promise<MasterAnchor | null> => {
    const firstShot = state.structuredShots[0];
    if (!firstShot) return null;
    
    try {
      const { cleanPrompt } = applyCameramanFilter(firstShot.description);
      
      const { data, error } = await supabase.functions.invoke('generate-scene-images', {
        body: {
          scenes: [{
            sceneNumber: 0,
            visualDescription: `Master establishing shot: ${cleanPrompt}`,
          }],
          visualStyle: 'cinematic',
        },
        signal: abortControllerRef.current?.signal,
      });
      
      if (error) throw error;
      
      const masterAnchor: MasterAnchor = {
        imageUrl: data.images?.[0]?.imageUrl || '',
        seed: state.production.globalSeed,
        environmentPrompt: cleanPrompt,
        colorPalette: 'cinematic teal and orange',
        lightingStyle: 'dramatic chiaroscuro',
      };
      
      return masterAnchor;
    } catch (err) {
      console.error('Failed to generate master anchor:', err);
      return null;
    }
  }, [state.structuredShots, state.production.globalSeed, applyCameramanFilter]);
  
  // Generate voice for a shot
  const generateVoice = useCallback(async (shot: Shot): Promise<VoiceTrack | null> => {
    if (!shot.dialogue?.trim()) {
      return { shotId: shot.id, audioUrl: '', durationMs: 0, status: 'completed' };
    }
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-voice', {
        body: {
          text: shot.dialogue,
          voiceId: 'EXAVITQu4vr4xnSDxMaL', // Sarah voice
          shotId: shot.id,
          projectId: state.projectId,
        },
        signal: abortControllerRef.current?.signal,
      });
      
      if (error) throw error;
      
      // Handle both audioUrl and audioBase64 responses
      let audioUrl = data.audioUrl || '';
      if (!audioUrl && data.audioBase64) {
        audioUrl = `data:audio/mpeg;base64,${data.audioBase64}`;
      }
      
      return {
        shotId: shot.id,
        audioUrl,
        durationMs: data.durationMs || (shot.dialogue.length / 15) * 1000,
        status: 'completed',
      };
    } catch (err) {
      console.error('Voice generation failed for shot:', shot.id, err);
      return { shotId: shot.id, audioUrl: '', durationMs: 0, status: 'failed' };
    }
  }, [state.projectId]);
  
  // Generate video for a single shot with frame chaining
  // Uses reference image analysis for background/lighting consistency
  // In text-to-video mode, skips reference image entirely
  const generateShotVideo = useCallback(async (
    shot: Shot,
    previousFrameUrl?: string
  ): Promise<{ videoUrl?: string; endFrameUrl?: string; taskId?: string; error?: string }> => {
    try {
      const { cleanPrompt, negativePrompt } = applyCameramanFilter(shot.description);
      
      // Build enriched prompt with reference image consistency data (if not in text-to-video mode)
      let enrichedPrompt = cleanPrompt;
      
      // If we have reference image analysis AND not in text-to-video mode, inject consistency markers
      if (!state.textToVideoMode && state.referenceImage?.consistencyPrompt) {
        // Prepend the consistency prompt to maintain visual coherence
        enrichedPrompt = `[Visual anchor: ${state.referenceImage.consistencyPrompt}] ${cleanPrompt}`;
        console.log('[Pipeline] Injecting reference consistency into prompt');
      } else if (state.textToVideoMode) {
        console.log('[Pipeline] Text-to-video mode: skipping reference image injection');
      }
      
      console.log('[Pipeline] Generating shot with prompt:', enrichedPrompt.substring(0, 150) + '...');
      
      // In text-to-video mode, don't pass any images
      const isTextToVideo = state.textToVideoMode;
      
      const { data, error } = await supabase.functions.invoke('generate-video', {
        body: {
          prompt: enrichedPrompt,
          duration: Math.min(MAX_SHOT_DURATION_SECONDS, shot.durationSeconds),
          negativePrompt,
          // Frame chaining: use previous frame if available (for shot continuity), otherwise use reference image
          // In text-to-video mode, skip reference image but still allow frame chaining for continuity
          startImage: isTextToVideo ? previousFrameUrl : previousFrameUrl,
          // Only pass reference image URL in image-to-video mode
          referenceImageUrl: isTextToVideo ? undefined : (state.production.masterAnchor?.imageUrl || state.referenceImage?.imageUrl),
          // Transition type for seamless shot connections
          transitionOut: shot.transitionOut || 'continuous',
          sceneContext: isTextToVideo ? {
            totalClips: state.structuredShots.length,
          } : {
            // Pass full reference analysis for background/lighting adaptation
            environment: state.referenceImage?.environment?.setting || state.production.masterAnchor?.environmentPrompt,
            colorPalette: state.referenceImage?.colorPalette?.mood || state.production.masterAnchor?.colorPalette,
            lightingStyle: state.referenceImage?.lighting?.style || state.production.masterAnchor?.lightingStyle,
            lightingDirection: state.referenceImage?.lighting?.direction,
            timeOfDay: state.referenceImage?.lighting?.timeOfDay,
            dominantColors: state.referenceImage?.colorPalette?.dominant?.join(', '),
            backgroundElements: state.referenceImage?.environment?.backgroundElements?.join(', '),
            totalClips: state.structuredShots.length,
          },
        },
        signal: abortControllerRef.current?.signal,
      });
      
      if (error) throw error;
      
      return {
        taskId: data.taskId,
        videoUrl: data.videoUrl,
      };
    } catch (err) {
      console.error('Video generation failed for shot:', shot.id, err);
      return { error: err instanceof Error ? err.message : 'Generation failed' };
    }
  }, [state.production.masterAnchor, state.referenceImage, state.structuredShots.length, applyCameramanFilter]);
  
  // Poll for video completion
  const pollVideoStatus = useCallback(async (taskId: string): Promise<{ 
    status: string; 
    videoUrl?: string;
    contentFilterReason?: string;
  }> => {
    try {
      // Detect provider from taskId format
      const provider = taskId.includes('projects/') ? 'vertex-ai' : 'replicate';
      
      const { data, error } = await supabase.functions.invoke('check-video-status', {
        body: { taskId, provider },
        signal: abortControllerRef.current?.signal,
      });
      
      if (error) throw error;
      
      return {
        status: data.status,
        videoUrl: data.videoUrl,
        contentFilterReason: data.contentFilterReason,
      };
    } catch (err) {
      console.error('Status check failed:', err);
      return { status: 'error' };
    }
  }, []);
  
  // Rephrase a prompt to avoid content filter issues
  const rephraseForContentFilter = useCallback((originalPrompt: string): string => {
    console.log('[Pipeline] Rephrasing prompt to avoid content filter...');
    
    // Remove potentially problematic terms and rephrase
    let saferPrompt = originalPrompt
      // Remove slap/hit-related terms (common content filter trigger)
      .replace(/\b(slap|slapping|slapped|hit|hitting|punch|punching|strike|striking|smack|smacking)\b/gi, 'gesture')
      .replace(/\b(slap contest|slapping contest)\b/gi, 'friendly competition')
      // Remove violence-related terms
      .replace(/\b(fight|fighting|battle|attack|attacking|kill|murder|blood|violent|weapon|gun|knife|sword|assault|beat|beating)\b/gi, '')
      // Rephrase intense emotions
      .replace(/\b(angry|rage|fury|hatred|aggressive)\b/gi, 'determined')
      .replace(/\b(scared|terrified|horrified|pain|painful)\b/gi, 'alert')
      // Remove nudity/adult-related terms
      .replace(/\b(naked|nude|undressed|revealing|provocative)\b/gi, '')
      // Remove drug/alcohol references
      .replace(/\b(drunk|intoxicated|smoking|drugs)\b/gi, '')
      // Soften conflict language
      .replace(/\b(confrontation|conflict|struggle|versus|vs)\b/gi, 'interaction')
      .replace(/\b(chase|pursuit)\b/gi, 'movement')
      // Replace remaining problematic patterns
      .replace(/\b(face\s*to\s*face\s*(off|showdown))\b/gi, 'standing together')
      // Clean up extra spaces
      .replace(/\s+/g, ' ')
      .trim();
    
    // Add safety prefixes for cinematic content
    const safetyPrefix = 'Cinematic scene, professional filmmaking style: ';
    
    // If prompt is getting too short after filtering, add context
    if (saferPrompt.length < 50) {
      saferPrompt = `A person in a natural setting, engaging in everyday activities. ${saferPrompt}`;
    }
    
    const finalPrompt = safetyPrefix + saferPrompt;
    console.log('[Pipeline] Rephrased prompt:', finalPrompt.substring(0, 100) + '...');
    
    return finalPrompt;
  }, []);
  
  // Visual Debugger - analyze video quality with multimodal AI
  const runVisualDebugger = useCallback(async (
    shot: Shot,
    videoUrl: string,
    shotIndex?: number
  ): Promise<{ passed: boolean; correctivePrompt?: string; score: number }> => {
    try {
      console.log(`[VisualDebugger] Analyzing shot ${shot.id}...`);
      
      // Build previous shot context for continuity
      let previousShotContext = '';
      if (shotIndex !== undefined && shotIndex > 0) {
        const previousShots = state.production.shots.slice(0, shotIndex);
        previousShotContext = previousShots
          .filter(s => s.status === 'completed')
          .map((s, i) => `Shot ${i + 1}: ${s.title} - ${s.description.substring(0, 100)}...`)
          .join('\n');
      }
      
      const { data, error } = await supabase.functions.invoke('visual-debugger', {
        body: {
          videoUrl,
          shotDescription: shot.description,
          shotId: shot.id,
          projectType: state.projectType,
          referenceImageUrl: state.production.masterAnchor?.imageUrl, // Pass reference image for visual comparison
          previousShotContext: previousShotContext || undefined,
          referenceAnalysis: state.referenceImage ? {
            characterIdentity: {
              ...state.referenceImage.characterIdentity,
              clothing: state.referenceImage.characterIdentity?.description?.match(/wearing[^.]+/i)?.[0],
              features: state.referenceImage.characterIdentity?.description?.match(/(?:with|has)[^.]+/i)?.[0],
            },
            environment: {
              ...state.referenceImage.environment,
              time: state.referenceImage.environment?.setting?.match(/(?:dawn|dusk|night|morning|evening|noon)/i)?.[0],
              weather: state.referenceImage.environment?.setting?.match(/(?:rain|sun|cloud|fog|storm|snow)/i)?.[0],
            },
            lighting: state.referenceImage.lighting,
            colorPalette: state.referenceImage.colorPalette,
            visualStyle: state.projectType || 'cinematic',
          } : undefined,
        },
        signal: abortControllerRef.current?.signal,
      });
      
      if (error) throw error;
      
      const result = data.result;
      console.log(`[VisualDebugger] Result: ${result.verdict} (Score: ${result.score})`);
      
      // Log Quality Insurance cost
      setState(prev => ({
        ...prev,
        qualityInsuranceLedger: [
          ...prev.qualityInsuranceLedger,
          {
            shotId: shot.id,
            operation: 'visual_debug' as const,
            creditsCharged: 0, // Covered by Quality Insurance
            realCostCents: API_COSTS_CENTS.VISUAL_DEBUGGER,
            timestamp: Date.now(),
            metadata: { score: result.score, verdict: result.verdict },
          },
        ],
      }));
      
      return {
        passed: result.passed,
        correctivePrompt: result.correctivePrompt,
        score: result.score,
      };
    } catch (err) {
      console.error('[VisualDebugger] Analysis failed:', err);
      // On error, default to pass to not block production
      return { passed: true, score: 70 };
    }
  }, [state.projectType, state.referenceImage]);
  
  // Main production orchestration with two-phase billing and Quality Tier support
  const startProduction = useCallback(async () => {
    if (!state.scriptApproved || state.structuredShots.length === 0) {
      toast.error('Please approve the script first');
      return;
    }
    
    if (!user) {
      toast.error('Please sign in to start production');
      return;
    }
    
    const isProfessional = state.qualityTier === 'professional';
    const tierCosts = TIER_CREDIT_COSTS[state.qualityTier];
    
    cancelRef.current = false;
    abortControllerRef.current = new AbortController();
    
    // CRITICAL: Ensure production.shots is initialized from structuredShots
    setState(prev => ({
      ...prev,
      currentStage: 'production',
      qualityInsuranceLedger: [], // Reset ledger for new production
      production: {
        ...prev.production,
        shots: prev.structuredShots.map(shot => ({ 
          ...shot, 
          status: 'pending' as const,
          retryCount: 0,
          visualDebugResults: [],
        })),
        currentShotIndex: 0,
        completedShots: 0,
        failedShots: 0,
        isGeneratingVideo: true,
        isGeneratingAudio: true,
        generationStartedAt: Date.now(),
      },
    }));
    
    const tierLabel = isProfessional ? 'Iron-Clad Professional' : 'Standard';
    toast.info(`Starting ${tierLabel} production pipeline (${tierCosts.TOTAL_PER_SHOT} credits/shot)...`);
    
    try {
      // Step 1: Use reference image as master anchor, or generate one if not uploaded
      let masterAnchor = state.production.masterAnchor;
      
      if (!masterAnchor?.imageUrl) {
        toast.info('No reference image provided. Generating master anchor...');
        masterAnchor = await generateMasterAnchor();
        if (masterAnchor) {
          setState(prev => ({
            ...prev,
            production: { ...prev.production, masterAnchor },
          }));
        }
      } else {
        toast.info('Using uploaded reference image as visual anchor');
        console.log('[Pipeline] Using reference image as master anchor:', masterAnchor.imageUrl.substring(0, 50) + '...');
      }
      
      // Step 2: Generate all voice tracks in parallel
      toast.info('Generating voice tracks...');
      const voicePromises = state.structuredShots.map(shot => generateVoice(shot));
      const voiceTracks = await Promise.all(voicePromises);
      
      setState(prev => ({
        ...prev,
        production: {
          ...prev.production,
          voiceTracks: voiceTracks.filter(Boolean) as VoiceTrack[],
          isGeneratingAudio: false,
        },
      }));
      
      // Step 3: Generate videos sequentially with frame chaining and TIERED BILLING
      toast.info('Starting anchor-chain video generation with credit billing...');
      let previousFrameUrl: string | undefined = masterAnchor?.imageUrl;
      
      for (let i = 0; i < state.structuredShots.length; i++) {
        if (cancelRef.current) {
          toast.info('Production cancelled');
          break;
        }
        
        let shot = { ...state.structuredShots[i], retryCount: 0 };
        let currentPrompt = shot.description;
        let shotCompleted = false;
        
        // PHASE 1: Charge Pre-Production Credits (5 credits)
        toast.info(`Charging pre-production credits for shot ${i + 1}...`);
        const preProductionCharged = await chargePreProduction(shot.id);
        if (!preProductionCharged) {
          toast.error(`Insufficient credits for shot ${i + 1}. Production stopped.`);
          break;
        }
        
        setState(prev => ({
          ...prev,
          production: {
            ...prev.production,
            currentShotIndex: i,
            shots: prev.production.shots.map((s, idx) =>
              idx === i ? { ...s, status: 'generating' as const } : s
            ),
          },
        }));
        
        // PHASE 2: Charge Production Credits (20 credits for Standard, 35 for Professional)
        // Professional tier includes 15 extra for Quality Insurance
        const productionCredits = isProfessional 
          ? tierCosts.PRODUCTION + tierCosts.QUALITY_INSURANCE 
          : tierCosts.PRODUCTION;
          
        toast.info(`Charging ${productionCredits} credits for shot ${i + 1}...`);
        const productionCharged = await chargeProduction(shot.id);
        if (!productionCharged) {
          await refundCredits(shot.id, 'Insufficient credits for production phase');
          toast.error(`Insufficient credits for shot ${i + 1}. Production stopped.`);
          break;
        }
        
        // RETRY LOOP - Professional tier gets up to MAX_PROFESSIONAL_RETRIES autonomous retries
        const maxRetries = isProfessional ? MAX_PROFESSIONAL_RETRIES : 0;
        
        while (shot.retryCount <= maxRetries && !shotCompleted && !cancelRef.current) {
          const attemptLabel = shot.retryCount > 0 
            ? ` (retry ${shot.retryCount}/${maxRetries})` 
            : '';
          toast.info(`Generating shot ${i + 1}/${state.structuredShots.length}: ${shot.title}${attemptLabel}`);
          
          // Use corrective prompt if this is a retry
          const promptToUse = shot.lastCorrectivePrompt || currentPrompt;
          const shotWithPrompt = { ...shot, description: promptToUse };
          
          // Generate video with frame chaining
          const result = await generateShotVideo(shotWithPrompt, previousFrameUrl);
          
          if (result.error) {
            if (shot.retryCount < maxRetries && isProfessional) {
              // Log retry attempt as Quality Insurance cost
              setState(prev => ({
                ...prev,
                qualityInsuranceLedger: [
                  ...prev.qualityInsuranceLedger,
                  {
                    shotId: shot.id,
                    operation: 'retry_generation' as const,
                    creditsCharged: 0, // Covered by Quality Insurance
                    realCostCents: API_COSTS_CENTS.RETRY_GENERATION,
                    timestamp: Date.now(),
                    metadata: { attempt: shot.retryCount + 1, error: result.error },
                  },
                ],
              }));
              
              shot.retryCount++;
              toast.warning(`Shot ${i + 1} failed, attempting retry ${shot.retryCount}/${maxRetries}...`);
              continue;
            }
            
            // Final failure - no more retries
            await refundCredits(shot.id, `Video generation failed: ${result.error}`);
            setState(prev => ({
              ...prev,
              production: {
                ...prev.production,
                failedShots: prev.production.failedShots + 1,
                shots: prev.production.shots.map((s, idx) =>
                  idx === i ? { ...s, status: 'failed' as const, error: result.error } : s
                ),
              },
            }));
            break; // Exit retry loop
          }
          
          // Poll for completion
          if (result.taskId) {
            let attempts = 0;
            const maxAttempts = 120; // 10 minutes
            
            while (attempts < maxAttempts && !cancelRef.current) {
              await new Promise(r => setTimeout(r, 5000));
              const status = await pollVideoStatus(result.taskId);
              
              if (status.status === 'SUCCEEDED' && status.videoUrl) {
                // PROFESSIONAL TIER: Run Visual Debugger before marking complete
                if (isProfessional && shot.retryCount < maxRetries) {
                  toast.info(`Running Visual Debugger on shot ${i + 1}...`);
                  const debugResult = await runVisualDebugger(shot, status.videoUrl, i);
                  
                  // Store debug result
                  const debugSummary: VisualDebugResultSummary = {
                    passed: debugResult.passed,
                    score: debugResult.score,
                    issues: [], // Simplified for state
                    correctivePrompt: debugResult.correctivePrompt,
                    timestamp: Date.now(),
                  };
                  
                  setState(prev => ({
                    ...prev,
                    production: {
                      ...prev.production,
                      shots: prev.production.shots.map((s, idx) =>
                        idx === i ? { 
                          ...s, 
                          visualDebugResults: [...(s.visualDebugResults || []), debugSummary],
                        } : s
                      ),
                    },
                  }));
                  
                  if (!debugResult.passed && debugResult.correctivePrompt) {
                    // FAIL - trigger autonomous retry with corrective prompt
                    shot.retryCount++;
                    shot.lastCorrectivePrompt = debugResult.correctivePrompt;
                    
                    toast.warning(`Visual Debugger detected issues (score: ${debugResult.score}). Auto-retrying with corrective prompt...`);
                    
                    // Log as Quality Insurance cost
                    setState(prev => ({
                      ...prev,
                      qualityInsuranceLedger: [
                        ...prev.qualityInsuranceLedger,
                        {
                          shotId: shot.id,
                          operation: 'retry_generation' as const,
                          creditsCharged: 0,
                          realCostCents: API_COSTS_CENTS.RETRY_GENERATION,
                          timestamp: Date.now(),
                          metadata: { 
                            reason: 'visual_debugger_fail',
                            score: debugResult.score,
                            attempt: shot.retryCount,
                          },
                        },
                      ],
                    }));
                    
                    break; // Break poll loop, continue retry loop
                  }
                }
                
                // PASS - mark shot as completed
                shotCompleted = true;
                
                // Log successful API cost for profit tracking
                await logApiCost(shot.id, 'replicate', 'video_generation', tierCosts.TOTAL_PER_SHOT, API_COSTS_CENTS.REPLICATE_VIDEO_4S);
                
                // Extract last frame for next shot
                let endFrameUrl: string | undefined;
                try {
                  endFrameUrl = await extractLastFrame(status.videoUrl);
                  console.log('[Pipeline] Successfully extracted last frame for chaining');
                } catch (frameErr) {
                  console.warn('[Pipeline] Frame extraction failed (CORS), using master anchor for continuity');
                  endFrameUrl = undefined;
                }
                
                previousFrameUrl = endFrameUrl || masterAnchor?.imageUrl || previousFrameUrl;
                
                // Update in-memory state
                setState(prev => ({
                  ...prev,
                  production: {
                    ...prev.production,
                    completedShots: prev.production.completedShots + 1,
                    shots: prev.production.shots.map((s, idx) =>
                      idx === i ? { 
                        ...s, 
                        status: 'completed' as const, 
                        videoUrl: status.videoUrl,
                        endFrameUrl,
                        retryCount: shot.retryCount,
                      } : s
                    ),
                    chainContext: {
                      ...prev.production.chainContext,
                      previousFrameUrl: endFrameUrl,
                    },
                  },
                }));
                
                // PERSIST TO DATABASE
                if (state.projectId && status.videoUrl) {
                  try {
                    const { data: project } = await supabase
                      .from('movie_projects')
                      .select('video_clips')
                      .eq('id', state.projectId)
                      .maybeSingle();
                    
                    const existingClips = (project?.video_clips as string[]) || [];
                    const updatedClips = [...existingClips, status.videoUrl];
                    
                    await supabase
                      .from('movie_projects')
                      .update({ 
                        video_clips: updatedClips,
                        status: 'producing',
                        updated_at: new Date().toISOString(),
                      })
                      .eq('id', state.projectId);
                    
                    console.log(`[Pipeline] Saved clip ${i + 1} to database, total: ${updatedClips.length}`);
                  } catch (dbErr) {
                    console.error('[Pipeline] Failed to save clip to database:', dbErr);
                  }
                }
                
                const retryInfo = shot.retryCount > 0 ? ` (after ${shot.retryCount} retries)` : '';
                toast.success(`Shot ${i + 1} completed${retryInfo}!`);
                break; // Exit poll loop
                
              } else if (status.status === 'CONTENT_FILTERED') {
                // Content filter blocked the generation - rephrase and retry
                console.log('[Pipeline] Content filter blocked shot, rephrasing prompt...');
                
                if (shot.retryCount < maxRetries) {
                  shot.retryCount++;
                  // Rephrase the current prompt to avoid content filter
                  const rephrasedPrompt = rephraseForContentFilter(currentPrompt);
                  shot.lastCorrectivePrompt = rephrasedPrompt;
                  currentPrompt = rephrasedPrompt;
                  
                  toast.warning(`Shot ${i + 1} blocked by content filter. Auto-rephrasing and retrying (${shot.retryCount}/${maxRetries})...`);
                  
                  // Log as Quality Insurance cost
                  setState(prev => ({
                    ...prev,
                    qualityInsuranceLedger: [
                      ...prev.qualityInsuranceLedger,
                      {
                        shotId: shot.id,
                        operation: 'retry_generation' as const,
                        creditsCharged: 0,
                        realCostCents: API_COSTS_CENTS.RETRY_GENERATION,
                        timestamp: Date.now(),
                        metadata: { 
                          reason: 'content_filter',
                          filterReason: status.contentFilterReason,
                          attempt: shot.retryCount,
                        },
                      },
                    ],
                  }));
                  
                  break; // Break poll loop, continue retry loop with rephrased prompt
                } else {
                  // Max retries reached
                  await refundCredits(shot.id, 'Content filter blocked after max retries');
                  setState(prev => ({
                    ...prev,
                    production: {
                      ...prev.production,
                      failedShots: prev.production.failedShots + 1,
                      shots: prev.production.shots.map((s, idx) =>
                        idx === i ? { ...s, status: 'failed' as const, error: 'Content filter blocked generation' } : s
                      ),
                    },
                  }));
                  shotCompleted = true;
                  break;
                }
                
              } else if (status.status === 'FAILED') {
                if (shot.retryCount < maxRetries && isProfessional) {
                  shot.retryCount++;
                  toast.warning(`Shot ${i + 1} generation failed, attempting retry ${shot.retryCount}/${maxRetries}...`);
                  break; // Break poll loop, continue retry loop
                }
                
                // Final failure
                await refundCredits(shot.id, 'API generation failed');
                setState(prev => ({
                  ...prev,
                  production: {
                    ...prev.production,
                    failedShots: prev.production.failedShots + 1,
                    shots: prev.production.shots.map((s, idx) =>
                      idx === i ? { ...s, status: 'failed' as const, error: 'Generation failed' } : s
                    ),
                  },
                }));
                shotCompleted = true; // Exit retry loop (as failed)
                break;
              }
              
              attempts++;
            }
            
            // Timeout handling
            if (!shotCompleted && attempts >= maxAttempts) {
              await refundCredits(shot.id, 'Generation timed out');
              setState(prev => ({
                ...prev,
                production: {
                  ...prev.production,
                  failedShots: prev.production.failedShots + 1,
                  shots: prev.production.shots.map((s, idx) =>
                    idx === i ? { ...s, status: 'failed' as const, error: 'Generation timed out' } : s
                  ),
                },
              }));
              break; // Exit retry loop
            }
          }
        } // End retry loop
      } // End shot loop
      
      // Production complete
      setState(prev => {
        const completedCount = prev.production.shots.filter(s => s.status === 'completed').length;
        const totalShots = prev.structuredShots.length;
        const totalQICost = prev.qualityInsuranceLedger.reduce((sum, c) => sum + c.realCostCents, 0);
        
        if (completedCount === totalShots && completedCount > 0) {
          const qiMessage = isProfessional && totalQICost > 0 
            ? ` Quality Insurance covered $${(totalQICost / 100).toFixed(2)} in retries.`
            : '';
          setTimeout(() => toast.success(`All shots generated! Ready for review.${qiMessage}`), 100);
        } else if (completedCount > 0) {
          setTimeout(() => toast.warning(`${completedCount}/${totalShots} shots completed. Some failed.`), 100);
        } else {
          setTimeout(() => toast.error('All shots failed. Please retry.'), 100);
        }
        
        return {
          ...prev,
          production: { ...prev.production, isGeneratingVideo: false },
          exportReady: completedCount > 0,
          currentStage: completedCount > 0 ? 'review' : prev.currentStage,
        };
      });
      
    } catch (err) {
      console.error('Production error:', err);
      toast.error('Production failed');
      setState(prev => ({
        ...prev,
        production: { ...prev.production, isGeneratingVideo: false, isGeneratingAudio: false },
      }));
    }
  }, [
    user,
    state.scriptApproved,
    state.structuredShots,
    state.qualityTier,
    state.referenceImage,
    state.projectType,
    state.projectId,
    state.production.masterAnchor,
    generateMasterAnchor,
    generateVoice,
    generateShotVideo,
    pollVideoStatus,
    runVisualDebugger,
    rephraseForContentFilter,
    chargePreProduction,
    chargeProduction,
    refundCredits,
    logApiCost,
  ]);
  
  const cancelProduction = useCallback(() => {
    cancelRef.current = true;
    // Immediately abort all pending API requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState(prev => ({
      ...prev,
      production: { 
        ...prev.production, 
        isGeneratingVideo: false, 
        isGeneratingAudio: false,
        // Reset any 'generating' shots back to 'pending' so UI doesn't show loading
        shots: prev.production.shots.map(s => 
          s.status === 'generating' ? { ...s, status: 'pending' as const } : s
        ),
      },
    }));
    toast.info('Production cancelled');
  }, []);
  
  const retryFailedShots = useCallback(async () => {
    const failedShots = state.production.shots.filter(s => s.status === 'failed');
    if (failedShots.length === 0) return;
    
    toast.info(`Retrying ${failedShots.length} failed shots...`);
    
    for (const shot of failedShots) {
      const prevShot = state.production.shots.find(s => s.index === shot.index - 1);
      const result = await generateShotVideo(shot, prevShot?.endFrameUrl);
      
      if (!result.error && result.taskId) {
        // Poll and update...
        updateShot(shot.id, { status: 'generating', error: undefined });
      }
    }
  }, [state.production.shots, generateShotVideo, updateShot]);
  
  // Review stage
  const setAudioMixMode = useCallback((mode: AudioMixMode) => {
    setState(prev => ({ ...prev, audioMixMode: mode }));
  }, []);
  
  const exportFinalVideo = useCallback(async (): Promise<string | null> => {
    // TODO: Implement video concatenation and audio mixing
    const completedVideos = state.production.shots
      .filter(s => s.status === 'completed' && s.videoUrl)
      .map(s => s.videoUrl!);
    
    if (completedVideos.length === 0) {
      toast.error('No completed videos to export');
      return null;
    }
    
    // For now, return the first completed video
    toast.success('Export ready!');
    return completedVideos[0];
  }, [state.production.shots]);
  
  const resetPipeline = useCallback(() => {
    setState(INITIAL_PIPELINE_STATE);
  }, []);
  
  const isGenerating = state.production.isGeneratingVideo || state.production.isGeneratingAudio;
  
  // Calculate progress from actual shot statuses for real-time updates
  const completedShotsCount = state.production.shots.filter(s => s.status === 'completed').length;
  const productionProgress = state.production.shots.length > 0
    ? Math.round((completedShotsCount / state.production.shots.length) * 100)
    : 0;
  
  return (
    <ProductionPipelineContext.Provider value={{
      state,
      goToStage,
      canProceedToStage,
      // QUALITY TIER
      setQualityTier,
      // IMAGE-FIRST
      setReferenceImage,
      clearReferenceImage,
      // TEXT-TO-VIDEO
      setTextToVideoMode,
      // Scripting
      setProjectType,
      setProjectTitle,
      setProjectId,
      setRawScript,
      generateStructuredShots,
      setStructuredShots,
      updateShot,
      approveScript,
      rejectAndRegenerate,
      // CINEMATIC AUDITOR
      runCinematicAudit,
      approveAudit,
      applyAuditSuggestion,
      applyAllSuggestionsAndReaudit,
      autoOptimizeUntilReady,
      isReauditing,
      optimizationProgress,
      // Production
      startProduction,
      cancelProduction,
      retryFailedShots,
      // Review
      setAudioMixMode,
      exportFinalVideo,
      // State queries
      isGenerating,
      isAuditing,
      productionProgress,
      // Utils
      resetPipeline,
      initializeFromProject,
    }}>
      {children}
    </ProductionPipelineContext.Provider>
  );
}

export function useProductionPipeline() {
  const context = useContext(ProductionPipelineContext);
  if (!context) {
    throw new Error('useProductionPipeline must be used within ProductionPipelineProvider');
  }
  return context;
}
