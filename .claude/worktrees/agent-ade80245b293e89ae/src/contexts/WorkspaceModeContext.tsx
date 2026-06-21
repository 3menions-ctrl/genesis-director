/**
 * WorkspaceModeContext - Adaptive Workspace System
 * 
 * Manages switching between:
 * - Quick Create: Simplified interface for fast video creation
 * - Advanced Editor: Professional interface with frame-by-frame control
 * 
 * Features:
 * - Persistent mode preference (localStorage)
 * - Mode-specific feature flags
 * - Smooth transitions between modes
 */

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

export type WorkspaceMode = 'quick' | 'advanced';

export interface WorkspaceModeFeatures {
  // Quick Create features
  simplePromptInput: boolean;
  oneClickGenerate: boolean;
  autoSettings: boolean;
  
  // Advanced Editor features
  frameByFrameScrubbing: boolean;
  timelineWithCuts: boolean;
  audioWaveforms: boolean;
  layerCompositing: boolean;
  multiTrackAudio: boolean;
  keyframeEditor: boolean;
  colorGrading: boolean;
  exportPresets: boolean;
}

interface WorkspaceModeContextType {
  mode: WorkspaceMode;
  setMode: (mode: WorkspaceMode) => void;
  toggleMode: () => void;
  features: WorkspaceModeFeatures;
  isFeatureEnabled: (feature: keyof WorkspaceModeFeatures) => boolean;
}

const QUICK_MODE_FEATURES: WorkspaceModeFeatures = {
  simplePromptInput: true,
  oneClickGenerate: true,
  autoSettings: true,
  frameByFrameScrubbing: false,
  timelineWithCuts: false,
  audioWaveforms: false,
  layerCompositing: false,
  multiTrackAudio: false,
  keyframeEditor: false,
  colorGrading: false,
  exportPresets: false,
};

const ADVANCED_MODE_FEATURES: WorkspaceModeFeatures = {
  simplePromptInput: false,
  oneClickGenerate: false,
  autoSettings: false,
  frameByFrameScrubbing: true,
  timelineWithCuts: true,
  audioWaveforms: true,
  layerCompositing: true,
  multiTrackAudio: true,
  keyframeEditor: true,
  colorGrading: true,
  exportPresets: true,
};

const STORAGE_KEY = 'workspace-mode-preference';

const WorkspaceModeContext = createContext<WorkspaceModeContextType | null>(null);

export function WorkspaceModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<WorkspaceMode>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      return (stored === 'quick' || stored === 'advanced') ? stored : 'quick';
    }
    return 'quick';
  });
  
  const features = mode === 'quick' ? QUICK_MODE_FEATURES : ADVANCED_MODE_FEATURES;
  
  // Persist mode preference
  const setMode = useCallback((newMode: WorkspaceMode) => {
    setModeState(newMode);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, newMode);
    }
  }, []);
  
  const toggleMode = useCallback(() => {
    setMode(mode === 'quick' ? 'advanced' : 'quick');
  }, [mode, setMode]);
  
  const isFeatureEnabled = useCallback((feature: keyof WorkspaceModeFeatures): boolean => {
    return features[feature];
  }, [features]);
  
  return (
    <WorkspaceModeContext.Provider
      value={{
        mode,
        setMode,
        toggleMode,
        features,
        isFeatureEnabled,
      }}
    >
      {children}
    </WorkspaceModeContext.Provider>
  );
}

export function useWorkspaceMode(): WorkspaceModeContextType {
  const context = useContext(WorkspaceModeContext);
  if (!context) {
    // Return safe fallback for SSR or missing provider
    return {
      mode: 'quick',
      setMode: () => {},
      toggleMode: () => {},
      features: QUICK_MODE_FEATURES,
      isFeatureEnabled: () => false,
    };
  }
  return context;
}

// Hook for checking if advanced features are available
export function useAdvancedFeature(feature: keyof WorkspaceModeFeatures): boolean {
  const { isFeatureEnabled } = useWorkspaceMode();
  return isFeatureEnabled(feature);
}
