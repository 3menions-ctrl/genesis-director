/**
 * Video Persistence Utility
 * 
 * Provides reusable functions to persist temporary Replicate delivery URLs
 * to permanent Supabase storage. This prevents video expiration issues.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * Check if a URL is a temporary Replicate delivery URL
 */
export function isTemporaryReplicateUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes('replicate.delivery');
}

/**
 * Download video from URL and store in Supabase storage
 * Returns the permanent public URL or null if failed
 */
export async function persistVideoToStorage(
  supabase: SupabaseClient,
  videoUrl: string,
  projectId: string,
  options: {
    prefix?: string;
    bucket?: string;
    clipIndex?: number;
  } = {}
): Promise<string | null> {
  const { prefix = 'video', bucket = 'video-clips', clipIndex } = options;
  
  // Skip if already a permanent URL
  if (!isTemporaryReplicateUrl(videoUrl)) {
    console.log(`[VideoPersistence] URL is already permanent, skipping`);
    return videoUrl;
  }
  
  try {
    console.log(`[VideoPersistence] Downloading from ${videoUrl.substring(0, 60)}...`);
    
    const response = await fetch(videoUrl, {
      headers: { 'Accept': 'video/*' },
    });
    
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }
    
    const contentType = response.headers.get('content-type') || 'video/mp4';
    const videoData = await response.arrayBuffer();
    
    if (videoData.byteLength < 1000) {
      throw new Error(`Video too small: ${videoData.byteLength} bytes`);
    }
    
    // Generate unique filename
    const timestamp = Date.now();
    const extension = contentType.includes('webm') ? 'webm' : 'mp4';
    const clipSuffix = clipIndex !== undefined ? `_clip${clipIndex}` : '';
    const fileName = `${prefix}_${projectId}${clipSuffix}_${timestamp}.${extension}`;
    const storagePath = `${projectId}/${fileName}`;
    
    console.log(`[VideoPersistence] Uploading ${videoData.byteLength} bytes to ${bucket}/${storagePath}...`);
    
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, new Uint8Array(videoData), {
        contentType,
        upsert: true,
      });
    
    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(storagePath);
    
    console.log(`[VideoPersistence] ✅ Video persisted: ${publicUrl}`);
    return publicUrl;
    
  } catch (err) {
    console.error(`[VideoPersistence] Error:`, err);
    return null;
  }
}

/**
 * Persist audio to storage (for voice/TTS audio files)
 */
export async function persistAudioToStorage(
  supabase: SupabaseClient,
  audioUrl: string,
  projectId: string,
  options: {
    prefix?: string;
    bucket?: string;
  } = {}
): Promise<string | null> {
  const { prefix = 'audio', bucket = 'video-clips' } = options;
  
  // Skip if already a permanent URL or not a Replicate URL
  if (!isTemporaryReplicateUrl(audioUrl)) {
    return audioUrl;
  }
  
  try {
    console.log(`[AudioPersistence] Downloading from ${audioUrl.substring(0, 60)}...`);
    
    const response = await fetch(audioUrl);
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }
    
    const audioData = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'audio/mpeg';
    const extension = contentType.includes('wav') ? 'wav' : 'mp3';
    
    const fileName = `${prefix}_${projectId}_${Date.now()}.${extension}`;
    const storagePath = `${projectId}/${fileName}`;
    
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, new Uint8Array(audioData), {
        contentType,
        upsert: true,
      });
    
    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }
    
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(storagePath);
    
    console.log(`[AudioPersistence] ✅ Audio persisted: ${publicUrl}`);
    return publicUrl;
    
  } catch (err) {
    console.error(`[AudioPersistence] Error:`, err);
    return null;
  }
}
