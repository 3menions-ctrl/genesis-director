/**
 * Cinematic Orchestrator Hook
 * 
 * Manages the complete video generation workflow:
 * 1. Master Image Generation - Creates anchor image for visual consistency
 * 2. Sequential Frame-Chaining - Extracts last frame for next clip input
 * 3. Persistent Seeding - Same seed across all scene clips
 * 4. Prompt Rewriting - Strips camera refs, adds perspective language
 */

import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  generateSceneSeed,
  extractLastFrame,
  rewritePromptForCinematic,
  buildChainedPrompt,
  buildNegativePrompt,
  FrameChainContext,
} from '@/lib/cinematicPromptEngine';
import type { SceneBreakdown, CharacterProfile, VisualStylePreset } from '@/types/studio';

export interface CinematicClip {
  index: number;
  prompt: string;
  rewrittenPrompt: string;
  negativePrompt: string;
  taskId?: string;
  videoUrl?: string;
  startImageUrl?: string; // Frame from previous clip or master image
  status: 'pending' | 'generating' | 'succeeded' | 'failed';
  error?: string;
}

export interface CinematicWorkflow {
  projectId: string;
  sceneSeed: number;
  masterImageUrl?: string;
  clips: CinematicClip[];
  currentPhase: 'idle' | 'master-image' | 'generating' | 'concatenating' | 'completed' | 'failed';
  progress: number;
  error?: string;
}

interface OrchestratorOptions {
  projectId: string;
  scenes: SceneBreakdown[];
  characters?: CharacterProfile[];
  visualStyle?: VisualStylePreset;
  clipDuration?: number;
  useFrameChaining?: boolean;
  useMasterImage?: boolean;
  onProgress?: (workflow: CinematicWorkflow) => void;
  onClipComplete?: (clip: CinematicClip) => void;
  onComplete?: (workflow: CinematicWorkflow) => void;
  onError?: (error: string) => void;
}

export function useCinematicOrchestrator() {
  const [workflow, setWorkflow] = useState<CinematicWorkflow | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const cancelRef = useRef(false);
  
  const updateWorkflow = useCallback((updates: Partial<CinematicWorkflow>) => {
    setWorkflow(prev => prev ? { ...prev, ...updates } : null);
  }, []);
  
  /**
   * Generates a master/anchor image for the scene using the first scene description
   */
  const generateMasterImage = async (
    scenes: SceneBreakdown[],
    characters: CharacterProfile[] = [],
    visualStyle?: VisualStylePreset
  ): Promise<string | null> => {
    if (scenes.length === 0) return null;
    
    const firstScene = scenes[0];
    
    // Build a comprehensive prompt for the master image
    const characterDescriptions = characters.map(c => {
      const parts = [c.name];
      if (c.appearance) parts.push(c.appearance);
      if (c.clothing) parts.push(`wearing ${c.clothing}`);
      return parts.join(', ');
    }).join('; ');
    
    let masterPrompt = `Establishing shot for cinematic scene. ${firstScene.visualDescription || firstScene.scriptText}`;
    if (characterDescriptions) {
      masterPrompt += ` Characters: ${characterDescriptions}`;
    }
    masterPrompt += ` High quality, photorealistic, film still, ${visualStyle || 'cinematic'} style.`;
    
    // Rewrite the prompt
    const { prompt: rewrittenPrompt, negativePrompt } = rewritePromptForCinematic(masterPrompt);
    
    try {
      // Use the scene image generation endpoint
      const { data, error } = await supabase.functions.invoke('generate-scene-images', {
        body: {
          scenes: [{ 
            sceneNumber: 0, 
            title: 'Master Image', 
            visualDescription: rewrittenPrompt,
            mood: firstScene.mood || 'cinematic',
          }],
          projectId: workflow?.projectId || 'temp',
          globalStyle: visualStyle,
          negativePrompt,
        },
      });
      
      if (error || !data?.success) {
        console.error('Failed to generate master image:', error || data?.error);
        return null;
      }
      
      // Return the generated image URL
      return data.images?.[0]?.imageUrl || null;
    } catch (error) {
      console.error('Master image generation error:', error);
      return null;
    }
  };
  
  /**
   * Starts the cinematic video generation workflow
   */
  const startWorkflow = useCallback(async (options: OrchestratorOptions) => {
    const {
      projectId,
      scenes,
      characters = [],
      visualStyle,
      clipDuration = 6,
      useFrameChaining = true,
      useMasterImage = true,
      onProgress,
      onClipComplete,
      onComplete,
      onError,
    } = options;
    
    if (scenes.length === 0) {
      onError?.('No scenes provided');
      return null;
    }
    
    cancelRef.current = false;
    setIsRunning(true);
    
    // Initialize workflow
    const sceneSeed = generateSceneSeed(projectId, 0);
    const initialWorkflow: CinematicWorkflow = {
      projectId,
      sceneSeed,
      clips: scenes.map((scene, index) => {
        const rawPrompt = scene.visualDescription || scene.scriptText || scene.title;
        const { prompt: rewrittenPrompt, negativePrompt } = rewritePromptForCinematic(rawPrompt);
        
        return {
          index,
          prompt: rawPrompt,
          rewrittenPrompt,
          negativePrompt,
          status: 'pending' as const,
        };
      }),
      currentPhase: 'idle',
      progress: 0,
    };
    
    setWorkflow(initialWorkflow);
    onProgress?.(initialWorkflow);
    
    try {
      let masterImageUrl: string | undefined;
      
      // Phase 1: Generate master image (optional)
      if (useMasterImage) {
        updateWorkflow({ currentPhase: 'master-image', progress: 5 });
        toast.info('Generating master reference image for visual consistency...');
        
        masterImageUrl = (await generateMasterImage(scenes, characters, visualStyle)) || undefined;
        
        if (masterImageUrl) {
          updateWorkflow({ masterImageUrl, progress: 15 });
          toast.success('Master image generated!');
        }
      }
      
      // Phase 2: Generate clips with frame chaining
      updateWorkflow({ currentPhase: 'generating', progress: 20 });
      
      const completedClips: CinematicClip[] = [...initialWorkflow.clips];
      let previousFrameUrl: string | undefined = masterImageUrl;
      
      for (let i = 0; i < scenes.length; i++) {
        if (cancelRef.current) {
          throw new Error('Generation cancelled');
        }
        
        const scene = scenes[i];
        const clip = completedClips[i];
        
        // Build frame chain context
        const chainContext: FrameChainContext = {
          isFirstClip: i === 0,
          previousFrameUrl: useFrameChaining ? previousFrameUrl : undefined,
          masterImageUrl,
          sceneSeed,
          clipIndex: i,
          totalClips: scenes.length,
        };
        
        // Build the chained prompt with perspective rewrites
        const chainedPrompt = buildChainedPrompt(clip.prompt, chainContext);
        
        // Update clip status
        completedClips[i] = { ...clip, status: 'generating', rewrittenPrompt: chainedPrompt };
        updateWorkflow({ 
          clips: [...completedClips], 
          progress: 20 + (i / scenes.length) * 60 
        });
        
        toast.info(`Generating clip ${i + 1}/${scenes.length}...`);
        
        try {
          // Call generate-video with frame chaining support
          const { data: videoData, error: videoError } = await supabase.functions.invoke('generate-video', {
            body: {
              prompt: chainedPrompt,
              duration: clipDuration,
              negativePrompt: clip.negativePrompt,
              seed: sceneSeed,
              startImage: useFrameChaining ? previousFrameUrl : undefined,
              sceneContext: {
                clipIndex: i,
                totalClips: scenes.length,
                sceneTitle: scene.title,
              },
            },
          });
          
          if (videoError || !videoData?.success) {
            throw new Error(videoData?.error || videoError?.message || 'Video generation failed');
          }
          
          // Poll for completion
          const taskId = videoData.taskId;
          completedClips[i] = { ...completedClips[i], taskId };
          
          let videoUrl: string | null = null;
          let pollAttempts = 0;
          const maxPolls = 60; // 5 minutes
          
          while (!videoUrl && pollAttempts < maxPolls) {
            if (cancelRef.current) throw new Error('Generation cancelled');
            
            await new Promise(resolve => setTimeout(resolve, 5000));
            pollAttempts++;
            
            const { data: statusData } = await supabase.functions.invoke('check-video-status', {
              body: { taskId },
            });
            
            if (statusData?.status === 'SUCCEEDED' && statusData?.videoUrl) {
              videoUrl = statusData.videoUrl;
            } else if (statusData?.status === 'FAILED') {
              throw new Error(statusData?.error || 'Video generation failed');
            }
            
            // Update progress
            const clipProgress = 20 + ((i + pollAttempts / maxPolls) / scenes.length) * 60;
            updateWorkflow({ progress: Math.min(clipProgress, 80) });
          }
          
          if (!videoUrl) {
            throw new Error('Video generation timed out');
          }
          
          // Mark clip as complete
          completedClips[i] = { 
            ...completedClips[i], 
            status: 'succeeded', 
            videoUrl,
            startImageUrl: previousFrameUrl,
          };
          updateWorkflow({ clips: [...completedClips] });
          onClipComplete?.(completedClips[i]);
          
          toast.success(`Clip ${i + 1}/${scenes.length} complete!`);
          
          // Extract last frame for next clip (frame chaining)
          if (useFrameChaining && i < scenes.length - 1) {
            try {
              previousFrameUrl = await extractLastFrame(videoUrl);
            } catch (frameError) {
              console.warn('Failed to extract frame, continuing without chaining:', frameError);
              // Continue without frame chaining for this clip
            }
          }
          
        } catch (clipError) {
          console.error(`Clip ${i + 1} failed:`, clipError);
          completedClips[i] = { 
            ...completedClips[i], 
            status: 'failed', 
            error: clipError instanceof Error ? clipError.message : 'Unknown error',
          };
          updateWorkflow({ clips: [...completedClips] });
          
          // Continue with other clips even if one fails
          toast.error(`Clip ${i + 1} failed: ${clipError instanceof Error ? clipError.message : 'Unknown error'}`);
        }
      }
      
      // Phase 3: Complete
      const successfulClips = completedClips.filter(c => c.status === 'succeeded');
      const allSucceeded = successfulClips.length === scenes.length;
      
      const finalWorkflow: CinematicWorkflow = {
        ...initialWorkflow,
        masterImageUrl,
        clips: completedClips,
        currentPhase: allSucceeded ? 'completed' : (successfulClips.length > 0 ? 'completed' : 'failed'),
        progress: 100,
        error: allSucceeded ? undefined : `${scenes.length - successfulClips.length} clips failed`,
      };
      
      setWorkflow(finalWorkflow);
      onComplete?.(finalWorkflow);
      
      if (allSucceeded) {
        toast.success(`All ${scenes.length} clips generated successfully!`);
      } else if (successfulClips.length > 0) {
        toast.warning(`${successfulClips.length}/${scenes.length} clips completed. Some clips failed.`);
      } else {
        toast.error('All clips failed to generate.');
      }
      
      return finalWorkflow;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Workflow error:', error);
      
      updateWorkflow({ 
        currentPhase: 'failed', 
        error: errorMessage,
      });
      
      onError?.(errorMessage);
      toast.error(`Generation failed: ${errorMessage}`);
      
      return null;
    } finally {
      setIsRunning(false);
    }
  }, [updateWorkflow]);
  
  /**
   * Cancels the current workflow
   */
  const cancelWorkflow = useCallback(() => {
    cancelRef.current = true;
    setIsRunning(false);
    updateWorkflow({ currentPhase: 'failed', error: 'Cancelled by user' });
    toast.info('Generation cancelled');
  }, [updateWorkflow]);
  
  /**
   * Retries failed clips in the workflow
   */
  const retryFailedClips = useCallback(async (options: OrchestratorOptions) => {
    if (!workflow) return null;
    
    const failedClips = workflow.clips.filter(c => c.status === 'failed');
    if (failedClips.length === 0) {
      toast.info('No failed clips to retry');
      return workflow;
    }
    
    // Create new scenes array with only failed clips
    const failedScenes = failedClips.map(clip => 
      options.scenes[clip.index]
    ).filter(Boolean);
    
    toast.info(`Retrying ${failedClips.length} failed clips...`);
    
    return startWorkflow({
      ...options,
      scenes: failedScenes,
    });
  }, [workflow, startWorkflow]);
  
  return {
    workflow,
    isRunning,
    startWorkflow,
    cancelWorkflow,
    retryFailedClips,
  };
}
