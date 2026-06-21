/**
 * Replicate Recovery Utility
 * 
 * Shared logic for recovering completed predictions from Replicate
 * that were missed due to watchdog timeouts, zombie detection, or stale state.
 * 
 * THE CORE PROBLEM: Replicate predictions can complete AFTER our system marks them
 * as failed/timed-out. Without re-checking Replicate, we lose completed work and
 * charge users for videos that actually exist.
 * 
 * This utility provides a single source of truth for "check Replicate before giving up".
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

export interface ReplicateRecoveryResult {
  recovered: boolean;
  videoUrl?: string;
  storagePath?: string;
  predictionStatus: string;
  error?: string;
}

export interface PredictionRecovery {
  clipIndex: number;
  predictionId: string;
  videoUrl?: string;
  status: string;
  recovered: boolean;
}

/**
 * Check a single Replicate prediction and recover its output if completed.
 * Downloads the video to permanent storage if available.
 */
export async function recoverReplicatePrediction(
  supabase: SupabaseClient,
  predictionId: string,
  projectId: string,
  options: {
    clipIndex?: number;
    saveToStorage?: boolean;
    logPrefix?: string;
  } = {}
): Promise<ReplicateRecoveryResult> {
  const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
  const prefix = options.logPrefix || '[ReplicateRecovery]';
  
  if (!REPLICATE_API_KEY) {
    return { recovered: false, predictionStatus: 'unknown', error: 'No REPLICATE_API_KEY' };
  }

  try {
    const response = await fetch(
      `https://api.replicate.com/v1/predictions/${predictionId}`,
      { headers: { "Authorization": `Bearer ${REPLICATE_API_KEY}` } }
    );

    if (!response.ok) {
      console.warn(`${prefix} Failed to poll prediction ${predictionId}: HTTP ${response.status}`);
      return { recovered: false, predictionStatus: 'poll_failed', error: `HTTP ${response.status}` };
    }

    const prediction = await response.json();
    
    if (prediction.status === 'succeeded' && prediction.output) {
      const rawVideoUrl = Array.isArray(prediction.output)
        ? prediction.output[0]
        : prediction.output;
      
      console.log(`${prefix} 🔥 RECOVERED prediction ${predictionId} (status: succeeded): ${rawVideoUrl?.substring(0, 60)}...`);
      
      let finalUrl = rawVideoUrl;
      
      // Save to permanent storage
      if (options.saveToStorage !== false && rawVideoUrl) {
        try {
          const videoResp = await fetch(rawVideoUrl);
          if (videoResp.ok) {
            const videoBlob = await videoResp.blob();
            const videoBytes = new Uint8Array(await videoBlob.arrayBuffer());
            const clipSuffix = options.clipIndex !== undefined ? `_clip${options.clipIndex + 1}` : '';
            const fileName = `recovered${clipSuffix}_${predictionId.substring(0, 8)}_${Date.now()}.mp4`;
            const storagePath = `avatar-videos/${projectId}/${fileName}`;
            
            const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
            const { error: uploadError } = await supabase.storage
              .from('video-clips')
              .upload(storagePath, videoBytes, { contentType: 'video/mp4', upsert: true });
            
            if (!uploadError) {
              finalUrl = `${supabaseUrl}/storage/v1/object/public/video-clips/${storagePath}`;
              console.log(`${prefix} ✅ Saved recovered video to storage: ${storagePath}`);
            } else {
              console.warn(`${prefix} Storage upload failed, using Replicate URL:`, uploadError.message);
            }
          }
        } catch (storageErr) {
          console.warn(`${prefix} Storage save failed (using Replicate URL):`, storageErr);
        }
      }
      
      return {
        recovered: true,
        videoUrl: finalUrl,
        predictionStatus: 'succeeded',
      };
    }
    
    return {
      recovered: false,
      predictionStatus: prediction.status,
      error: prediction.status === 'failed' ? (prediction.error || 'Prediction failed') : undefined,
    };
  } catch (err) {
    console.warn(`${prefix} Error polling prediction ${predictionId}:`, err);
    return { recovered: false, predictionStatus: 'error', error: String(err) };
  }
}

/**
 * Check ALL predictions in a multi-clip avatar project's pending_video_tasks.
 * Recovers any predictions that Replicate says succeeded but our system missed.
 * 
 * Returns the updated predictions array and count of recovered clips.
 */
export async function recoverMultiClipPredictions(
  supabase: SupabaseClient,
  projectId: string,
  predictions: Array<{
    clipIndex: number;
    predictionId?: string;
    videoUrl?: string;
    status: string;
    [key: string]: unknown;
  }>,
  options: {
    logPrefix?: string;
    saveToStorage?: boolean;
  } = {}
): Promise<{
  predictions: typeof predictions;
  recoveredCount: number;
  totalWithVideo: number;
}> {
  const prefix = options.logPrefix || '[ReplicateRecovery]';
  let recoveredCount = 0;

  for (const pred of predictions) {
    // Only try to recover predictions that have a predictionId but no video
    if (!pred.predictionId || (pred.videoUrl && pred.videoUrl.length > 0)) continue;
    
    // Only recover processing/pending/failed-but-might-have-succeeded predictions
    if (pred.status === 'completed') continue;

    const result = await recoverReplicatePrediction(
      supabase,
      pred.predictionId,
      projectId,
      {
        clipIndex: pred.clipIndex,
        saveToStorage: options.saveToStorage,
        logPrefix: prefix,
      }
    );

    if (result.recovered && result.videoUrl) {
      pred.videoUrl = result.videoUrl;
      pred.status = 'completed';
      recoveredCount++;
      console.log(`${prefix} 🔥 Clip ${pred.clipIndex + 1} RECOVERED from Replicate`);
    } else if (result.predictionStatus === 'failed') {
      pred.status = 'failed';
      console.log(`${prefix} Clip ${pred.clipIndex + 1} confirmed failed on Replicate`);
    }
  }

  const totalWithVideo = predictions.filter(p => p.videoUrl && p.videoUrl.length > 0).length;

  if (recoveredCount > 0) {
    console.log(`${prefix} 🔥 RECOVERED ${recoveredCount} clips from Replicate (total with video: ${totalWithVideo}/${predictions.length})`);
  }

  return { predictions, recoveredCount, totalWithVideo };
}

/**
 * Recover a single video_clip row by checking its veo_operation_name (which stores predictionId for Replicate)
 */
export async function recoverStuckVideoClip(
  supabase: SupabaseClient,
  clip: {
    id: string;
    project_id: string;
    shot_index: number;
    veo_operation_name?: string | null;
  },
  logPrefix = '[ReplicateRecovery]'
): Promise<boolean> {
  if (!clip.veo_operation_name) return false;
  
  const result = await recoverReplicatePrediction(
    supabase,
    clip.veo_operation_name,
    clip.project_id,
    {
      clipIndex: clip.shot_index,
      saveToStorage: true,
      logPrefix,
    }
  );

  if (result.recovered && result.videoUrl) {
    const { error } = await supabase
      .from('video_clips')
      .update({
        status: 'completed',
        video_url: result.videoUrl,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', clip.id);
    
    if (!error) {
      console.log(`${logPrefix} ✅ Clip ${clip.shot_index + 1} recovered and saved to video_clips`);
      return true;
    }
  }
  
  return false;
}
