// Type definition for pending_video_tasks JSON field in movie_projects table

export interface PendingVideoTasksScript {
  shots: Array<{
    id: string;
    title: string;
    description: string;
    durationSeconds: number;
    sceneType?: string;
    cameraScale?: string;
    cameraAngle?: string;
    movementType?: string;
    transitionOut?: {
      type: string;
      hint?: string;
    };
    visualAnchors?: string[];
    motionDirection?: string;
    lightingHint?: string;
    dialogue?: string;
    mood?: string;
  }>;
}

export interface PendingVideoTasksStages {
  preproduction?: {
    shotCount?: number;
    charactersExtracted?: number;
  };
  qualitygate?: {
    auditScore?: number;
  };
  assets?: {
    hasVoice?: boolean;
    hasMusic?: boolean;
  };
  production?: {
    clipsCompleted?: number;
  };
  postproduction?: {
    finalVideoUrl?: string;
  };
}

// Degradation flags for quality compromise notifications
export interface PendingVideoTasksDegradation {
  identityBibleFailed?: boolean;
  identityBibleRetries?: number;
  musicGenerationFailed?: boolean;
  sceneImagePartialFail?: number;
  voiceGenerationFailed?: boolean;
  auditFailed?: boolean;
  characterExtractionFailed?: boolean;
  sfxGenerationFailed?: boolean;
  reducedConsistencyMode?: boolean;
  frameExtractionFailed?: boolean;
  continuityCheckFailed?: boolean;
}

export interface PendingVideoTasks {
  // Pipeline stage tracking
  stage?: 'initializing' | 'preproduction' | 'awaiting_approval' | 'qualitygate' | 'assets' | 'production' | 'postproduction' | 'complete' | 'error';
  progress?: number;
  error?: string;

  // Script data
  script?: PendingVideoTasksScript;
  scriptGenerated?: boolean;
  shotCount?: number;
  clipCount?: number;
  clipDuration?: number; // 5 or 10 seconds per clip - CRITICAL for callback chain continuity

  // Quality audit
  auditScore?: number;

  // Character/Identity data
  charactersExtracted?: number;

  // Asset generation status
  hasVoice?: boolean;
  hasMusic?: boolean;

  // Production progress
  clipsCompleted?: number;

  // Final output
  finalVideoUrl?: string;
  manifestUrl?: string;
  mode?: string; // 'manifest_playback', 'text-to-video', etc.

  // Detailed stage info
  stages?: PendingVideoTasksStages;
  
  // SAFEGUARD: Degradation flags for quality compromise notifications
  degradation?: PendingVideoTasksDegradation;
}

// Type guard to check if an unknown value is PendingVideoTasks
export function isPendingVideoTasks(value: unknown): value is PendingVideoTasks {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  return true;
}

// Safe parser that returns typed object or null
export function parsePendingVideoTasks(value: unknown): PendingVideoTasks | null {
  if (isPendingVideoTasks(value)) {
    return value;
  }
  return null;
}
