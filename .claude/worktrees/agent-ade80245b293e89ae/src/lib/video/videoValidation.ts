/**
 * Video Validation Utilities
 * 
 * Programmatic validation for video playback readiness:
 * - File existence and size validation
 * - Manifest structure validation
 * - Duration and clip count verification
 * - Accessibility checks for all clip URLs
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metrics: {
    clipCount: number;
    totalDuration: number;
    totalSize: number;
    averageClipDuration: number;
  };
}

export interface VideoManifest {
  version: string;
  projectId: string;
  mode: string;
  createdAt: string;
  clips: ManifestClip[];
  totalDuration: number;
  voiceUrl?: string | null;
  musicUrl?: string | null;
  audioConfig?: {
    includeNarration?: boolean;
    musicVolume?: number;
    fadeIn?: number;
    fadeOut?: number;
  };
}

export interface ManifestClip {
  index: number;
  shotId: string;
  videoUrl: string;
  duration: number;
  startTime: number;
  transitionOut?: string;
}

/**
 * Validate a video manifest for playback readiness
 */
export async function validateVideoManifest(
  manifestUrl: string,
  options: {
    expectedClipCount?: number;
    expectedMinDuration?: number;
    expectedMaxDuration?: number;
    validateClipUrls?: boolean;
  } = {}
): Promise<ValidationResult> {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    metrics: {
      clipCount: 0,
      totalDuration: 0,
      totalSize: 0,
      averageClipDuration: 0,
    },
  };
  
  try {
    // Step 1: Fetch manifest
    const manifestResponse = await fetch(manifestUrl);
    
    if (!manifestResponse.ok) {
      result.valid = false;
      result.errors.push(`Manifest fetch failed: ${manifestResponse.status} ${manifestResponse.statusText}`);
      return result;
    }
    
    const manifest: VideoManifest = await manifestResponse.json();
    
    // Step 2: Validate manifest structure
    if (!manifest.version) {
      result.warnings.push('Manifest missing version field');
    }
    
    if (!manifest.projectId) {
      result.valid = false;
      result.errors.push('Manifest missing projectId');
    }
    
    if (!manifest.clips || !Array.isArray(manifest.clips)) {
      result.valid = false;
      result.errors.push('Manifest missing or invalid clips array');
      return result;
    }
    
    result.metrics.clipCount = manifest.clips.length;
    result.metrics.totalDuration = manifest.totalDuration || 0;
    
    // Step 3: Validate clip count
    if (options.expectedClipCount && manifest.clips.length !== options.expectedClipCount) {
      result.warnings.push(
        `Expected ${options.expectedClipCount} clips, got ${manifest.clips.length}`
      );
    }
    
    if (manifest.clips.length === 0) {
      result.valid = false;
      result.errors.push('Manifest contains no clips');
      return result;
    }
    
    // Step 4: Validate duration
    if (options.expectedMinDuration && manifest.totalDuration < options.expectedMinDuration) {
      result.valid = false;
      result.errors.push(
        `Duration ${manifest.totalDuration}s below minimum ${options.expectedMinDuration}s`
      );
    }
    
    if (options.expectedMaxDuration && manifest.totalDuration > options.expectedMaxDuration) {
      result.warnings.push(
        `Duration ${manifest.totalDuration}s exceeds expected max ${options.expectedMaxDuration}s`
      );
    }
    
    // Step 5: Validate individual clips
    let calculatedDuration = 0;
    
    for (let i = 0; i < manifest.clips.length; i++) {
      const clip = manifest.clips[i];
      
      // Validate clip structure
      if (!clip.videoUrl) {
        result.valid = false;
        result.errors.push(`Clip ${i} missing videoUrl`);
        continue;
      }
      
      if (!clip.duration || clip.duration <= 0) {
        result.warnings.push(`Clip ${i} has invalid duration: ${clip.duration}`);
      } else {
        calculatedDuration += clip.duration;
      }
      
      // Validate clip URL accessibility
      if (options.validateClipUrls !== false) {
        try {
          const videoResponse = await fetch(clip.videoUrl, { method: 'HEAD' });
          
          if (!videoResponse.ok) {
            result.valid = false;
            result.errors.push(`Clip ${i} video inaccessible: ${videoResponse.status}`);
          } else {
            const contentLength = parseInt(videoResponse.headers.get('content-length') || '0');
            result.metrics.totalSize += contentLength;
            
            if (contentLength === 0) {
              result.warnings.push(`Clip ${i} has zero content-length`);
            }
          }
        } catch (fetchError) {
          result.valid = false;
          result.errors.push(`Clip ${i} fetch error: ${fetchError}`);
        }
      }
    }
    
    result.metrics.averageClipDuration = calculatedDuration / manifest.clips.length;
    
    // Warn if calculated duration differs significantly from manifest total
    const durationDiff = Math.abs(calculatedDuration - manifest.totalDuration);
    if (durationDiff > 1) {
      result.warnings.push(
        `Calculated duration (${calculatedDuration}s) differs from manifest total (${manifest.totalDuration}s)`
      );
    }
    
    return result;
    
  } catch (error) {
    result.valid = false;
    result.errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown'}`);
    return result;
  }
}

/**
 * Quick validation that just checks manifest accessibility and structure
 */
export async function quickValidateManifest(manifestUrl: string): Promise<boolean> {
  try {
    const response = await fetch(manifestUrl);
    if (!response.ok) return false;
    
    const manifest = await response.json();
    return !!(
      manifest.projectId &&
      manifest.clips &&
      Array.isArray(manifest.clips) &&
      manifest.clips.length > 0 &&
      manifest.totalDuration > 0
    );
  } catch {
    return false;
  }
}

/**
 * Validate that all clip URLs in a manifest are accessible
 */
export async function validateClipAccessibility(
  clips: ManifestClip[],
  options: { parallel?: boolean; timeout?: number } = {}
): Promise<{ accessible: number; failed: number; errors: string[] }> {
  const { parallel = true, timeout = 10000 } = options;
  const errors: string[] = [];
  let accessible = 0;
  let failed = 0;
  
  const validateClip = async (clip: ManifestClip, index: number) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(clip.videoUrl, {
        method: 'HEAD',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        accessible++;
      } else {
        failed++;
        errors.push(`Clip ${index}: HTTP ${response.status}`);
      }
    } catch (error) {
      failed++;
      errors.push(`Clip ${index}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
  
  if (parallel) {
    await Promise.all(clips.map((clip, i) => validateClip(clip, i)));
  } else {
    for (let i = 0; i < clips.length; i++) {
      await validateClip(clips[i], i);
    }
  }
  
  return { accessible, failed, errors };
}
