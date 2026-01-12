import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type {
  ContinuityOrchestrationRequest,
  ContinuityOrchestrationResult,
  ContinuityConfig,
  ClipContinuityData,
  TransitionAnalysis,
} from '@/types/continuity-orchestrator';

interface UseContinuityOrchestratorResult {
  // State
  isAnalyzing: boolean;
  isEnhancing: boolean;
  lastResult: ContinuityOrchestrationResult | null;
  overallScore: number | null;
  transitionAnalyses: TransitionAnalysis[];
  clipsToRetry: number[];
  bridgeClipsNeeded: number;
  
  // Actions
  analyzeProject: (projectId: string) => Promise<ContinuityOrchestrationResult | null>;
  enhanceClipPrompt: (
    projectId: string,
    clipIndex: number,
    currentPrompt: string,
    previousClipData?: ContinuityOrchestrationRequest['previousClipData']
  ) => Promise<ContinuityOrchestrationResult | null>;
  postProcessClips: (projectId: string, clips: ClipContinuityData[]) => Promise<ContinuityOrchestrationResult | null>;
  runFullAnalysis: (projectId: string) => Promise<ContinuityOrchestrationResult | null>;
  
  // Config
  config: ContinuityConfig;
  setConfig: (config: Partial<ContinuityConfig>) => void;
}

const DEFAULT_CONFIG: ContinuityConfig = {
  consistencyThreshold: 70,
  enableBridgeClips: true,
  enableMotionChaining: true,
  enableAutoRetry: true,
  maxBridgeClips: 3,
  maxAutoRetries: 2,
};

export function useContinuityOrchestrator(): UseContinuityOrchestratorResult {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [lastResult, setLastResult] = useState<ContinuityOrchestrationResult | null>(null);
  const [overallScore, setOverallScore] = useState<number | null>(null);
  const [transitionAnalyses, setTransitionAnalyses] = useState<TransitionAnalysis[]>([]);
  const [clipsToRetry, setClipsToRetry] = useState<number[]>([]);
  const [bridgeClipsNeeded, setBridgeClipsNeeded] = useState(0);
  const [config, setConfigState] = useState<ContinuityConfig>(DEFAULT_CONFIG);

  const setConfig = useCallback((newConfig: Partial<ContinuityConfig>) => {
    setConfigState(prev => ({ ...prev, ...newConfig }));
  }, []);

  const callOrchestrator = useCallback(async (
    request: ContinuityOrchestrationRequest
  ): Promise<ContinuityOrchestrationResult | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('continuity-orchestrator', {
        body: { ...request, config },
      });

      if (error) {
        console.error('[useContinuityOrchestrator] Error:', error);
        toast.error('Continuity analysis failed');
        return null;
      }

      const result = data as ContinuityOrchestrationResult;
      setLastResult(result);

      if (result.overallContinuityScore !== undefined) {
        setOverallScore(result.overallContinuityScore);
      }
      if (result.transitionAnalyses) {
        setTransitionAnalyses(result.transitionAnalyses);
      }
      if (result.clipsToRetry) {
        setClipsToRetry(result.clipsToRetry);
      }
      if (result.bridgeClipsNeeded !== undefined) {
        setBridgeClipsNeeded(result.bridgeClipsNeeded);
      }

      return result;
    } catch (err) {
      console.error('[useContinuityOrchestrator] Exception:', err);
      toast.error('Continuity analysis failed');
      return null;
    }
  }, [config]);

  const analyzeProject = useCallback(async (projectId: string) => {
    setIsAnalyzing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error('Not authenticated');
        return null;
      }

      return await callOrchestrator({
        projectId,
        userId: session.user.id,
        mode: 'analyze',
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, [callOrchestrator]);

  const enhanceClipPrompt = useCallback(async (
    projectId: string,
    clipIndex: number,
    currentPrompt: string,
    previousClipData?: ContinuityOrchestrationRequest['previousClipData']
  ) => {
    setIsEnhancing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error('Not authenticated');
        return null;
      }

      return await callOrchestrator({
        projectId,
        userId: session.user.id,
        mode: 'enhance-clip',
        clipIndex,
        currentClipPrompt: currentPrompt,
        previousClipData,
      });
    } finally {
      setIsEnhancing(false);
    }
  }, [callOrchestrator]);

  const postProcessClips = useCallback(async (
    projectId: string,
    clips: ClipContinuityData[]
  ) => {
    setIsAnalyzing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error('Not authenticated');
        return null;
      }

      const result = await callOrchestrator({
        projectId,
        userId: session.user.id,
        mode: 'post-process',
        allClips: clips,
      });

      if (result?.success && result.clipsToRetry && result.clipsToRetry.length > 0) {
        toast.info(`${result.clipsToRetry.length} clips recommended for retry`, {
          description: `Clips ${result.clipsToRetry.join(', ')} have low continuity scores`,
        });
      }

      if (result?.success && result.bridgeClipsNeeded && result.bridgeClipsNeeded > 0) {
        toast.info(`${result.bridgeClipsNeeded} bridge clips recommended`, {
          description: 'Transition gaps detected between some clips',
        });
      }

      return result;
    } finally {
      setIsAnalyzing(false);
    }
  }, [callOrchestrator]);

  const runFullAnalysis = useCallback(async (projectId: string) => {
    setIsAnalyzing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error('Not authenticated');
        return null;
      }

      toast.loading('Running full continuity analysis...');

      const result = await callOrchestrator({
        projectId,
        userId: session.user.id,
        mode: 'full',
      });

      if (result?.success) {
        toast.success(`Continuity score: ${result.overallContinuityScore}/100`);
      }

      return result;
    } finally {
      setIsAnalyzing(false);
    }
  }, [callOrchestrator]);

  return {
    isAnalyzing,
    isEnhancing,
    lastResult,
    overallScore,
    transitionAnalyses,
    clipsToRetry,
    bridgeClipsNeeded,
    analyzeProject,
    enhanceClipPrompt,
    postProcessClips,
    runFullAnalysis,
    config,
    setConfig,
  };
}
