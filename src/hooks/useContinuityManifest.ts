import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { 
  ShotContinuityManifest, 
  ProjectContinuityChain,
  buildContinuityInjection 
} from '@/types/continuity-manifest';

interface UseContinuityManifestOptions {
  projectId: string;
  onManifestExtracted?: (manifest: ShotContinuityManifest) => void;
}

interface ManifestSummary {
  spatialPosition?: string;
  lightingType?: string;
  emotion?: string;
  propsCount?: number;
  microDetailsCount?: number;
  criticalAnchorsCount?: number;
}

export function useContinuityManifest({ projectId, onManifestExtracted }: UseContinuityManifestOptions) {
  const [isExtracting, setIsExtracting] = useState(false);
  const [manifests, setManifests] = useState<ShotContinuityManifest[]>([]);
  const [currentManifest, setCurrentManifest] = useState<ShotContinuityManifest | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Extract continuity manifest from a frame
   */
  const extractManifest = useCallback(async (
    frameUrl: string,
    shotIndex: number,
    options?: {
      shotDescription?: string;
      characterNames?: string[];
      previousManifest?: ShotContinuityManifest;
    }
  ): Promise<ShotContinuityManifest | null> => {
    setIsExtracting(true);
    setError(null);

    try {
      console.log(`[ContinuityManifest] Extracting for shot ${shotIndex}...`);

      const { data, error: fnError } = await supabase.functions.invoke('extract-continuity-manifest', {
        body: {
          frameUrl,
          projectId,
          shotIndex,
          shotDescription: options?.shotDescription,
          characterNames: options?.characterNames,
          previousManifest: options?.previousManifest,
        },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to extract continuity manifest');
      }

      const manifest = data.manifest as ShotContinuityManifest;
      
      // Update local state
      setCurrentManifest(manifest);
      setManifests(prev => {
        const existing = prev.findIndex(m => m.shotIndex === shotIndex);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = manifest;
          return updated;
        }
        return [...prev, manifest].sort((a, b) => a.shotIndex - b.shotIndex);
      });

      // Callback
      onManifestExtracted?.(manifest);

      console.log(`[ContinuityManifest] Extracted ${manifest.criticalAnchors?.length || 0} anchors`);
      
      return manifest;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('[ContinuityManifest] Extraction failed:', message);
      toast.error(`Continuity extraction failed: ${message}`);
      return null;
    } finally {
      setIsExtracting(false);
    }
  }, [projectId, onManifestExtracted]);

  /**
   * Get manifest for a specific shot
   */
  const getManifestForShot = useCallback((shotIndex: number): ShotContinuityManifest | undefined => {
    return manifests.find(m => m.shotIndex === shotIndex);
  }, [manifests]);

  /**
   * Get the previous shot's manifest for continuity chaining
   */
  const getPreviousManifest = useCallback((shotIndex: number): ShotContinuityManifest | undefined => {
    return manifests.find(m => m.shotIndex === shotIndex - 1);
  }, [manifests]);

  /**
   * Build injection prompts for a shot using previous manifest
   */
  const buildInjectionForShot = useCallback((
    shotIndex: number,
    nextShotDescription?: string
  ): { prompt: string; negative: string } | null => {
    const previousManifest = getPreviousManifest(shotIndex);
    if (!previousManifest) {
      return null;
    }

    // Use the buildContinuityInjection utility
    const sections: string[] = [];
    
    // Spatial continuity
    const sp = previousManifest.spatial;
    if (sp?.primaryCharacter) {
      sections.push(
        `[SPATIAL: Character ${sp.primaryCharacter.screenPosition} of frame, ` +
        `${sp.primaryCharacter.depth}, facing ${sp.primaryCharacter.facingDirection}, ` +
        `${sp.cameraDistance} shot]`
      );
    }
    
    // Lighting continuity
    const lt = previousManifest.lighting;
    if (lt?.primarySource) {
      sections.push(
        `[LIGHTING: ${lt.primarySource.type} ${lt.primarySource.direction} light, ` +
        `${lt.primarySource.quality} shadows, ${lt.colorTemperature} temperature]`
      );
    }
    
    // Props
    if (previousManifest.props?.characterProps?.length > 0) {
      const propList = previousManifest.props.characterProps
        .flatMap(cp => cp.props?.map(p => `${p.name} ${p.state}`) || [])
        .slice(0, 3)
        .join(', ');
      if (propList) {
        sections.push(`[PROPS: ${propList}]`);
      }
    }
    
    // Emotional state
    const em = previousManifest.emotional;
    if (em) {
      sections.push(
        `[EMOTION: ${em.intensity} ${em.primaryEmotion}, ${em.facialExpression}]`
      );
    }
    
    // Action momentum
    const ac = previousManifest.action;
    if (ac?.movementType && ac.movementType !== 'still') {
      sections.push(
        `[ACTION: continuing ${ac.movementType} ${ac.movementDirection}]`
      );
    }
    
    // Micro-details
    const md = previousManifest.microDetails;
    const microList: string[] = [];
    if (md?.skin?.scars?.length > 0) {
      microList.push(...md.skin.scars.map(s => `scar ${s.location}`));
    }
    if (md?.skin?.wounds?.length > 0) {
      microList.push(...md.skin.wounds.map(w => `${w.freshness} wound ${w.location}`));
    }
    if (md?.skin?.dirt?.length > 0) {
      md.skin.dirt.forEach(d => {
        microList.push(`${d.intensity} dirt on ${d.areas?.join(', ') || 'visible areas'}`);
      });
    }
    if (md?.clothing?.stains?.length > 0) {
      microList.push(...md.clothing.stains.slice(0, 2).map(s => `${s.type} on ${s.location}`));
    }
    if (microList.length > 0) {
      sections.push(`[MICRO-DETAILS: ${microList.slice(0, 5).join(', ')}]`);
    }
    
    // Critical anchors
    if (previousManifest.criticalAnchors?.length > 0) {
      sections.push(`[CRITICAL: ${previousManifest.criticalAnchors.slice(0, 4).join(', ')}]`);
    }
    
    // Build negative prompt
    const negatives: string[] = [
      'character morphing',
      'identity change', 
      'clothing change',
      'lighting direction reversal',
      'prop disappearance',
      'scar removal',
      'wound healing between shots',
      'sudden cleanliness',
      '180 degree rule violation',
    ];
    
    // Add position-specific negatives
    if (sp?.primaryCharacter?.screenPosition === 'left') {
      negatives.push('character on right side');
    } else if (sp?.primaryCharacter?.screenPosition === 'right') {
      negatives.push('character on left side');
    }
    
    return {
      prompt: sections.join(' '),
      negative: negatives.join(', '),
    };
  }, [getPreviousManifest]);

  /**
   * Get summary of all tracked continuity elements
   */
  const getContinuitySummary = useCallback((): {
    totalShots: number;
    trackedElements: {
      spatial: number;
      lighting: number;
      props: number;
      emotional: number;
      microDetails: number;
    };
  } => {
    const summary = {
      totalShots: manifests.length,
      trackedElements: {
        spatial: 0,
        lighting: 0,
        props: 0,
        emotional: 0,
        microDetails: 0,
      },
    };

    manifests.forEach(m => {
      if (m.spatial?.primaryCharacter) summary.trackedElements.spatial++;
      if (m.lighting?.primarySource) summary.trackedElements.lighting++;
      if (m.props?.characterProps?.length > 0) summary.trackedElements.props++;
      if (m.emotional?.primaryEmotion) summary.trackedElements.emotional++;
      if (m.microDetails?.persistentMarkers?.length > 0) summary.trackedElements.microDetails++;
    });

    return summary;
  }, [manifests]);

  /**
   * Clear all manifests
   */
  const clearManifests = useCallback(() => {
    setManifests([]);
    setCurrentManifest(null);
    setError(null);
  }, []);

  return {
    // State
    isExtracting,
    manifests,
    currentManifest,
    error,

    // Actions
    extractManifest,
    getManifestForShot,
    getPreviousManifest,
    buildInjectionForShot,
    getContinuitySummary,
    clearManifests,
  };
}
