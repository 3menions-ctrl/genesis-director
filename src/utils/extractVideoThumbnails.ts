import { supabase } from '@/integrations/supabase/client';

const VIDEOS = [
  { id: 'a1b6f181-26fa-4306-a663-d5892977b3fc', url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_a1b6f181-26fa-4306-a663-d5892977b3fc_1768451441287.mp4' },
  { id: 'a0016bb1-34ea-45e3-a173-da9441a84bda', url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_a0016bb1-34ea-45e3-a173-da9441a84bda_1768449857055.mp4' },
  { id: '71e83837-9ae4-4e79-a4f2-599163741b03', url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_71e83837-9ae4-4e79-a4f2-599163741b03_1768354737035.mp4' },
  { id: 'c09f52b7-442c-41cd-be94-2895e78bd0ba', url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_c09f52b7-442c-41cd-be94-2895e78bd0ba_1768330950513.mp4' },
  { id: '72e42238-ddfc-4ce1-8bae-dce8d8fc6bba', url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_72e42238-ddfc-4ce1-8bae-dce8d8fc6bba_1768263824409.mp4' },
  { id: 'f6b90eb8-fc54-4a82-b8db-7592a601a0f6', url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_f6b90eb8-fc54-4a82-b8db-7592a601a0f6_1768205766918.mp4' },
  { id: '099597a1-0cbf-4d71-b000-7d140ab896d1', url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_099597a1-0cbf-4d71-b000-7d140ab896d1_1768171807679.mp4' },
  { id: '1b0ac63f-643a-4d43-b8ed-44b8083257ed', url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_1b0ac63f-643a-4d43-b8ed-44b8083257ed_1768157346652.mp4' },
  { id: 'dc255261-7bc3-465f-a9ec-ef2acd47b4fb', url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_dc255261-7bc3-465f-a9ec-ef2acd47b4fb_1768124786072.mp4' },
  { id: '7434c756-78d3-4f68-8107-b205930027c4', url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_7434c756-78d3-4f68-8107-b205930027c4_1768120634478.mp4' },
  { id: '5bd6da17-734b-452b-b8b0-3381e7c710e3', url: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_5bd6da17-734b-452b-b8b0-3381e7c710e3_1768069835550.mp4' },
];

// Extract a frame from video at specified time
async function extractFrame(videoUrl: string, timeInSeconds: number = 1): Promise<Blob | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    // STABILITY FIX: crossOrigin removed - CDNs don't support CORS headers for media
    video.muted = true;
    video.preload = 'auto';
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(timeInSeconds, video.duration - 0.1);
    };
    
    video.onseeked = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          video.src = '';
          resolve(blob);
        }, 'image/jpeg', 0.9);
      } else {
        resolve(null);
      }
    };
    
    video.onerror = () => {
      console.debug('[extractFrame] Video load error for:', videoUrl?.substring(0, 60));
      resolve(null);
    };
    
    // Timeout after 30 seconds
    setTimeout(() => {
      video.src = '';
      resolve(null);
    }, 30000);
    
    video.src = videoUrl;
    video.load();
  });
}

// Upload thumbnail to storage
async function uploadThumbnail(videoId: string, blob: Blob): Promise<string | null> {
  const fileName = `${videoId}.jpg`;
  
  const { error } = await supabase.storage
    .from('video-thumbnails')
    .upload(fileName, blob, {
      contentType: 'image/jpeg',
      upsert: true
    });
    
  if (error) {
    console.error('Upload error:', error);
    return null;
  }
  
  const { data } = supabase.storage
    .from('video-thumbnails')
    .getPublicUrl(fileName);
    
  return data.publicUrl;
}

// Extract and upload all thumbnails
export async function extractAllThumbnails(
  onProgress?: (current: number, total: number, videoId: string) => void
): Promise<Record<string, string>> {
  const results: Record<string, string> = {};
  
  for (let i = 0; i < VIDEOS.length; i++) {
    const video = VIDEOS[i];
    onProgress?.(i + 1, VIDEOS.length, video.id);
    
    console.log(`Processing ${i + 1}/${VIDEOS.length}: ${video.id}`);
    
    const blob = await extractFrame(video.url, 1);
    if (blob) {
      const url = await uploadThumbnail(video.id, blob);
      if (url) {
        results[video.id] = url;
        console.log(`✓ Uploaded thumbnail for ${video.id}`);
      }
    } else {
      console.warn(`✗ Failed to extract frame for ${video.id}`);
    }
    
    // Small delay between videos
    await new Promise(r => setTimeout(r, 500));
  }
  
  return results;
}

// Get existing thumbnail URLs from storage
export function getThumbnailUrl(videoId: string): string {
  return `https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-thumbnails/${videoId}.jpg`;
}

export const VIDEO_THUMBNAIL_URLS: Record<string, string> = VIDEOS.reduce((acc, v) => {
  acc[v.id] = getThumbnailUrl(v.id);
  return acc;
}, {} as Record<string, string>);
