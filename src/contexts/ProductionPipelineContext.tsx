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
} from '@/types/production-pipeline';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { extractLastFrame, rewritePromptForCinematic, buildNegativePrompt } from '@/lib/cinematicPromptEngine';
import { CREDIT_COSTS, API_COSTS_CENTS } from '@/hooks/useCreditBilling';
import { useAuth } from '@/contexts/AuthContext';

interface ProductionPipelineContextType {
  state: PipelineState;
  
  // Stage navigation
  goToStage: (stage: WorkflowStage) => void;
  canProceedToStage: (stage: WorkflowStage) => boolean;
  
  // Scripting stage
  setProjectType: (type: ProjectType) => void;
  setProjectTitle: (title: string) => void;
  setProjectId: (id: string) => void;
  setRawScript: (script: string) => void;
  generateStructuredShots: (synopsis?: string) => Promise<void>;
  updateShot: (shotId: string, updates: Partial<Shot>) => void;
  approveScript: () => void;
  rejectAndRegenerate: () => Promise<void>;
  
  // Production stage
  startProduction: () => Promise<void>;
  cancelProduction: () => void;
  retryFailedShots: () => Promise<void>;
  
  // Review stage
  setAudioMixMode: (mode: AudioMixMode) => void;
  exportFinalVideo: () => Promise<string | null>;
  
  // State queries
  isGenerating: boolean;
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
      
      const shots: Shot[] = (data.scenes || []).map((scene: any, index: number) => ({
        id: `shot_${String(index + 1).padStart(3, '0')}`,
        index,
        title: scene.title || `Shot ${index + 1}`,
        description: scene.visualDescription || scene.description,
        dialogue: scene.dialogue || scene.scriptText || '',
        durationSeconds: scene.durationSeconds || 5,
        mood: scene.mood || 'neutral',
        cameraMovement: scene.cameraMovement || 'steady',
        characters: scene.characters || [],
        status: 'pending' as const,
      }));
      
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
    toast.success('Script approved! Ready for production.');
  }, []);
  
  const rejectAndRegenerate = useCallback(async () => {
    setState(prev => ({ ...prev, scriptApproved: false, structuredShots: [] }));
    await generateStructuredShots();
  }, [generateStructuredShots]);
  
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
  const generateShotVideo = useCallback(async (
    shot: Shot,
    previousFrameUrl?: string
  ): Promise<{ videoUrl?: string; endFrameUrl?: string; taskId?: string; error?: string }> => {
    try {
      // Apply Cameraman Filter
      const { cleanPrompt, negativePrompt } = applyCameramanFilter(shot.description);
      
      // Rewrite for cinematic quality
      const { prompt: cinematicPrompt } = rewritePromptForCinematic(cleanPrompt, {
        includeNegativePrompt: false,
      });
      
      const { data, error } = await supabase.functions.invoke('generate-video', {
        body: {
          prompt: cinematicPrompt,
          duration: shot.durationSeconds,
          seed: state.production.globalSeed,
          negativePrompt,
          startImage: previousFrameUrl, // Frame chaining
          sceneContext: {
            environment: state.production.masterAnchor?.environmentPrompt,
            colorPalette: state.production.masterAnchor?.colorPalette,
            lightingStyle: state.production.masterAnchor?.lightingStyle,
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
  }, [state.production.globalSeed, state.production.masterAnchor, applyCameramanFilter]);
  
  // Poll for video completion
  const pollVideoStatus = useCallback(async (taskId: string): Promise<{ status: string; videoUrl?: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke('check-video-status', {
        body: { taskId },
        signal: abortControllerRef.current?.signal,
      });
      
      if (error) throw error;
      
      return {
        status: data.status,
        videoUrl: data.videoUrl,
      };
    } catch (err) {
      console.error('Status check failed:', err);
      return { status: 'error' };
    }
  }, []);
  
  // Main production orchestration with two-phase billing
  const startProduction = useCallback(async () => {
    if (!state.scriptApproved || state.structuredShots.length === 0) {
      toast.error('Please approve the script first');
      return;
    }
    
    if (!user) {
      toast.error('Please sign in to start production');
      return;
    }
    
    cancelRef.current = false;
    abortControllerRef.current = new AbortController();
    // CRITICAL: Ensure production.shots is initialized from structuredShots
    // This fixes the issue where shots might not have been synced properly
    setState(prev => ({
      ...prev,
      currentStage: 'production',
      production: {
        ...prev.production,
        // Initialize shots from structuredShots to ensure they're in sync
        shots: prev.structuredShots.map(shot => ({ ...shot, status: 'pending' as const })),
        currentShotIndex: 0,
        completedShots: 0,
        failedShots: 0,
        isGeneratingVideo: true,
        isGeneratingAudio: true,
        generationStartedAt: Date.now(),
      },
    }));
    
    toast.info('Starting iron-clad production pipeline...');
    
    try {
      // Step 1: Generate master anchor image
      toast.info('Generating master anchor for visual consistency...');
      const masterAnchor = await generateMasterAnchor();
      if (masterAnchor) {
        setState(prev => ({
          ...prev,
          production: { ...prev.production, masterAnchor },
        }));
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
      
      // Step 3: Generate videos sequentially with frame chaining and TWO-PHASE BILLING
      toast.info('Starting anchor-chain video generation with credit billing...');
      let previousFrameUrl: string | undefined = masterAnchor?.imageUrl;
      
      for (let i = 0; i < state.structuredShots.length; i++) {
        if (cancelRef.current) {
          toast.info('Production cancelled');
          break;
        }
        
        const shot = state.structuredShots[i];
        
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
        
        // PHASE 2: Charge Production Credits (20 credits) before video generation
        toast.info(`Charging production credits for shot ${i + 1}...`);
        const productionCharged = await chargeProduction(shot.id);
        if (!productionCharged) {
          // Refund pre-production credits
          await refundCredits(shot.id, 'Insufficient credits for production phase');
          toast.error(`Insufficient credits for shot ${i + 1}. Production stopped.`);
          break;
        }
        
        toast.info(`Generating shot ${i + 1}/${state.structuredShots.length}: ${shot.title}`);
        
        // Generate video with frame chaining
        const result = await generateShotVideo(shot, previousFrameUrl);
        
        if (result.error) {
          // AUTOMATIC REFUND on failure
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
          continue;
        }
        
        // Poll for completion
        if (result.taskId) {
          let attempts = 0;
          const maxAttempts = 120; // 10 minutes
          let videoCompleted = false;
          
          while (attempts < maxAttempts && !cancelRef.current) {
            await new Promise(r => setTimeout(r, 5000));
            const status = await pollVideoStatus(result.taskId);
            
            if (status.status === 'SUCCEEDED' && status.videoUrl) {
              videoCompleted = true;
              
              // Log successful API cost for profit tracking
              await logApiCost(shot.id, 'replicate', 'video_generation', CREDIT_COSTS.TOTAL_PER_SHOT, API_COSTS_CENTS.REPLICATE_VIDEO_4S);
              
              // Extract last frame for next shot
              let endFrameUrl: string | undefined;
              try {
                endFrameUrl = await extractLastFrame(status.videoUrl);
              } catch {
                console.warn('Could not extract last frame');
              }
              
              previousFrameUrl = endFrameUrl || previousFrameUrl;
              
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
                    } : s
                  ),
                  chainContext: {
                    ...prev.production.chainContext,
                    previousFrameUrl: endFrameUrl,
                  },
                },
              }));
              
              // PERSIST TO DATABASE - Critical for clip retrieval after refresh
              if (state.projectId && status.videoUrl) {
                try {
                  // Fetch current video_clips array and append new one
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
              
              toast.success(`Shot ${i + 1} completed!`);
              break;
            } else if (status.status === 'FAILED') {
              // AUTOMATIC REFUND on API failure
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
              break;
            }
            
            attempts++;
          }
          
          // Timeout handling - refund if timed out
          if (!videoCompleted && attempts >= maxAttempts) {
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
          }
        }
      }
      
      // Production complete - use setState callback to get accurate count
      setState(prev => {
        const completedCount = prev.production.shots.filter(s => s.status === 'completed').length;
        const totalShots = prev.structuredShots.length;
        
        // Show appropriate toast based on completion
        if (completedCount === totalShots && completedCount > 0) {
          setTimeout(() => toast.success('All shots generated! Ready for review.'), 100);
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
    generateMasterAnchor,
    generateVoice,
    generateShotVideo,
    pollVideoStatus,
    goToStage,
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
      setProjectType,
      setProjectTitle,
      setProjectId,
      setRawScript,
      generateStructuredShots,
      updateShot,
      approveScript,
      rejectAndRegenerate,
      startProduction,
      cancelProduction,
      retryFailedShots,
      setAudioMixMode,
      exportFinalVideo,
      isGenerating,
      productionProgress,
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
