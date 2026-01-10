/**
 * Cloud Run FFmpeg Video Stitcher
 * 
 * Production-grade video processing service that:
 * 1. Validates all input clips (checks for missing/corrupted files)
 * 2. Uses FFmpeg concat demuxer for lossless video merging
 * 3. Injects background audio spanning full duration
 * 4. Uploads final MP4 to Supabase Storage
 * 5. Returns signed URL and triggers dashboard update
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const app = express();
app.use(express.json({ limit: '10mb' }));

// Health check endpoint - must be first before any other logic
app.get('/', (req, res) => {
  res.status(200).json({ status: 'healthy', service: 'ffmpeg-stitcher' });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', service: 'ffmpeg-stitcher' });
});

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Apply CORS to all routes
app.use((req, res, next) => {
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.header(key, value);
  });
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Temp directory for processing
const TEMP_DIR = '/tmp/stitcher';

// Supabase configuration - uses service role key for backend operations
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ahlikyhgcqvrdvbtkghh.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

// Defer logging until after server starts
let startupLogged = false;
function logStartup() {
  if (startupLogged) return;
  startupLogged = true;
  console.log('[Startup] SUPABASE_URL:', SUPABASE_URL);
  console.log('[Startup] SUPABASE_SERVICE_KEY:', SUPABASE_SERVICE_KEY ? 'SET (length: ' + SUPABASE_SERVICE_KEY.length + ')' : 'NOT SET');
  if (!SUPABASE_SERVICE_KEY) {
    console.warn('[Startup] WARNING: SUPABASE_SERVICE_KEY not set - stitch operations will fail');
  }
}

// Create Supabase client helper - only when needed
function getSupabase() {
  if (!SUPABASE_SERVICE_KEY) {
    throw new Error('SUPABASE_SERVICE_KEY not configured');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// Get signed upload URL from edge function
async function getSignedUploadUrl(projectId, filename) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-upload-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'apikey': SUPABASE_SERVICE_KEY
    },
    body: JSON.stringify({ projectId, filename })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get upload URL: ${error}`);
  }
  
  return response.json();
}

// Finalize stitch by calling edge function
async function finalizeStitch(projectId, videoUrl, durationSeconds, clipsProcessed, status = 'completed', errorMessage = null) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/finalize-stitch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'apikey': SUPABASE_SERVICE_KEY
    },
    body: JSON.stringify({ projectId, videoUrl, durationSeconds, clipsProcessed, status, errorMessage })
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.warn(`[Stitch] Failed to finalize: ${error}`);
    return { success: false, error };
  }
  
  return response.json();
}

// Upload file to signed URL
async function uploadToSignedUrl(signedUrl, fileBuffer, contentType = 'video/mp4') {
  const response = await fetch(signedUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType
    },
    body: fileBuffer
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Upload failed: ${response.status} - ${error}`);
  }
  
  return true;
}

// Download file from URL
async function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fsSync.createWriteStream(destPath);
    
    protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // Follow redirect
        file.close();
        return downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        file.close();
        fsSync.unlink(destPath, () => {});
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(destPath);
      });
    }).on('error', (err) => {
      file.close();
      fsSync.unlink(destPath, () => {});
      reject(err);
    });
  });
}

// Validate video file with FFprobe
async function validateVideo(filePath) {
  return new Promise((resolve) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'stream=codec_type,duration',
      '-of', 'json',
      filePath
    ]);
    
    let output = '';
    ffprobe.stdout.on('data', (data) => output += data);
    
    ffprobe.on('close', (code) => {
      if (code !== 0) {
        resolve({ valid: false, error: 'FFprobe failed' });
        return;
      }
      
      try {
        const data = JSON.parse(output);
        const hasVideo = data.streams?.some(s => s.codec_type === 'video');
        resolve({ valid: hasVideo, data });
      } catch {
        resolve({ valid: false, error: 'Invalid FFprobe output' });
      }
    });
  });
}

// Run FFmpeg command
async function runFFmpeg(args, description) {
  return new Promise((resolve, reject) => {
    console.log(`[FFmpeg] ${description}`);
    console.log(`[FFmpeg] Command: ffmpeg ${args.join(' ')}`);
    
    const ffmpeg = spawn('ffmpeg', args);
    
    let stderr = '';
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        console.error(`[FFmpeg] Error output: ${stderr}`);
        reject(new Error(`FFmpeg failed with code ${code}: ${stderr.slice(-500)}`));
      } else {
        console.log(`[FFmpeg] ${description} completed successfully`);
        resolve();
      }
    });
    
    ffmpeg.on('error', (err) => {
      reject(new Error(`FFmpeg spawn error: ${err.message}`));
    });
  });
}

// Color grading presets for visual consistency
const COLOR_PRESETS = {
  cinematic: {
    // Cinematic orange-teal look
    eq: 'gamma=1.1:contrast=1.05:saturation=1.1',
    colorbalance: 'rs=0.05:gs=-0.02:bs=-0.08:rm=0.03:gm=0.01:bm=-0.05',
  },
  warm: {
    eq: 'gamma=1.0:contrast=1.02:saturation=1.15',
    colorbalance: 'rs=0.08:gs=0.02:bs=-0.05:rm=0.05:gm=0.02:bm=-0.03',
  },
  cool: {
    eq: 'gamma=1.05:contrast=1.03:saturation=0.95',
    colorbalance: 'rs=-0.03:gs=0.0:bs=0.08:rm=-0.02:gm=0.01:bm=0.05',
  },
  neutral: {
    eq: 'gamma=1.0:contrast=1.0:saturation=1.0',
    colorbalance: 'rs=0:gs=0:bs=0:rm=0:gm=0:bm=0',
  },
  documentary: {
    eq: 'gamma=0.95:contrast=1.08:saturation=0.9',
    colorbalance: 'rs=0.02:gs=0.02:bs=0.02:rm=0.01:gm=0.01:bm=0.01',
  }
};

// Crossfade transition types
const TRANSITION_TYPES = {
  fade: 'fade',
  fadeblack: 'fadeblack',
  fadewhite: 'fadewhite',
  dissolve: 'dissolve',
  wipeleft: 'wipeleft',
  wiperight: 'wiperight',
  slideup: 'slideup',
  slidedown: 'slidedown',
  circlecrop: 'circlecrop',
  smoothleft: 'smoothleft',
  smoothright: 'smoothright',
};

// Music mood to tempo and fade timing
const MOOD_TEMPO_MAP = {
  epic: { bpm: 120, fadeIn: 2, fadeOut: 3 },
  tension: { bpm: 100, fadeIn: 1, fadeOut: 2 },
  emotional: { bpm: 70, fadeIn: 3, fadeOut: 4 },
  action: { bpm: 140, fadeIn: 0.5, fadeOut: 1 },
  peaceful: { bpm: 60, fadeIn: 4, fadeOut: 5 },
  mysterious: { bpm: 80, fadeIn: 2, fadeOut: 3 },
  triumphant: { bpm: 110, fadeIn: 1, fadeOut: 3 },
  melancholic: { bpm: 65, fadeIn: 3, fadeOut: 4 }
};

// Build dynamic volume filter from music sync timing markers
function buildMusicVolumeFilter(timingMarkers, totalDuration, baseVolume = 0.3) {
  if (!timingMarkers || timingMarkers.length === 0) {
    return `volume=${baseVolume}`;
  }

  // Sort markers by timestamp
  const sorted = [...timingMarkers].sort((a, b) => a.timestamp - b.timestamp);
  
  // Build volume expression with time-based adjustments
  let volumeExpr = '';
  
  for (let i = 0; i < sorted.length; i++) {
    const marker = sorted[i];
    const start = marker.timestamp;
    const end = start + (marker.duration || 0.5);
    
    let targetVolume = baseVolume;
    
    switch (marker.type) {
      case 'duck':
        targetVolume = baseVolume * (1 - marker.intensity * 0.7); // Duck down
        break;
      case 'swell':
        targetVolume = baseVolume * (1 + marker.intensity * 0.5); // Swell up
        break;
      case 'accent':
        targetVolume = baseVolume * (1 + marker.intensity * 0.3); // Slight boost
        break;
      case 'pause':
        targetVolume = baseVolume * 0.1; // Near silence
        break;
    }
    
    if (volumeExpr) volumeExpr += '+';
    volumeExpr += `(between(t,${start},${end})*${targetVolume - baseVolume})`;
  }
  
  if (volumeExpr) {
    return `volume='${baseVolume}${volumeExpr ? '+' + volumeExpr : ''}':eval=frame`;
  }
  
  return `volume=${baseVolume}`;
}

// Download SFX files and prepare for mixing
async function downloadSFXFiles(sfxPlan, workDir) {
  const sfxTracks = [];
  
  if (!sfxPlan) return sfxTracks;
  
  // Download SFX cues
  if (sfxPlan.cues && sfxPlan.cues.length > 0) {
    for (let i = 0; i < sfxPlan.cues.length; i++) {
      const cue = sfxPlan.cues[i];
      if (cue.audioUrl) {
        const sfxPath = path.join(workDir, `sfx_${i}.mp3`);
        try {
          console.log(`[Stitch] Downloading SFX cue ${i + 1}: ${cue.type}`);
          await downloadFile(cue.audioUrl, sfxPath);
          sfxTracks.push({
            type: 'sfx',
            path: sfxPath,
            startMs: cue.startMs || 0,
            durationMs: cue.durationMs,
            volume: cue.volume || 0.8,
            panning: cue.panning || 0,
            category: cue.category
          });
        } catch (err) {
          console.warn(`[Stitch] Failed to download SFX cue ${i}: ${err.message}`);
        }
      }
    }
  }
  
  // Download ambient beds
  if (sfxPlan.ambientBeds && sfxPlan.ambientBeds.length > 0) {
    for (let i = 0; i < sfxPlan.ambientBeds.length; i++) {
      const ambient = sfxPlan.ambientBeds[i];
      if (ambient.audioUrl) {
        const ambientPath = path.join(workDir, `ambient_${i}.mp3`);
        try {
          console.log(`[Stitch] Downloading ambient bed ${i + 1}: ${ambient.type}`);
          await downloadFile(ambient.audioUrl, ambientPath);
          sfxTracks.push({
            type: 'ambient',
            path: ambientPath,
            startMs: ambient.startMs || 0,
            durationMs: ambient.durationMs,
            volume: ambient.volume || 0.3,
            fadeInMs: ambient.fadeInMs || 1000,
            fadeOutMs: ambient.fadeOutMs || 2000,
            loop: true
          });
        } catch (err) {
          console.warn(`[Stitch] Failed to download ambient bed ${i}: ${err.message}`);
        }
      }
    }
  }
  
  return sfxTracks;
}

// Main stitching logic
async function stitchVideos(request) {
  const {
    projectId,
    projectTitle,
    clips,
    audioMixMode = 'full',
    backgroundMusicUrl,
    voiceTrackUrl,
    outputFormat = 'mp4',
    notifyOnError = true,
    colorGrading = 'cinematic',
    customColorProfile = null,
    transitionType = 'fade',      // Default crossfade transition
    transitionDuration = 0.5,     // Seconds for each transition
    // NEW: Music sync and SFX parameters
    musicSyncPlan = null,
    sfxPlan = null,
    audioMixParams = null
  } = request;
  
  const jobId = uuidv4();
  const workDir = path.join(TEMP_DIR, jobId);
  
  console.log(`[Stitch] Starting job ${jobId} for project ${projectId}`);
  console.log(`[Stitch] Processing ${clips.length} clips with ${transitionType} transitions (${transitionDuration}s)`);
  console.log(`[Stitch] Color grading: ${colorGrading}`);
  
  try {
    // Create work directory
    await fs.mkdir(workDir, { recursive: true });
    
    const validClips = [];
    const invalidClips = [];
    
    // Step 1: Download and validate all clips
    console.log('[Stitch] Step 1: Downloading and validating clips...');
    
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      const clipPath = path.join(workDir, `clip_${i.toString().padStart(3, '0')}.mp4`);
      
      try {
        console.log(`[Stitch] Downloading clip ${i + 1}/${clips.length}: ${clip.shotId}`);
        await downloadFile(clip.videoUrl, clipPath);
        
        const validation = await validateVideo(clipPath);
        if (!validation.valid) {
          throw new Error(validation.error || 'Invalid video');
        }
        
        // Get actual duration from probe
        let duration = clip.durationSeconds || 4;
        if (validation.data?.streams) {
          const videoStream = validation.data.streams.find(s => s.codec_type === 'video');
          if (videoStream?.duration) {
            duration = parseFloat(videoStream.duration);
          }
        }
        
        validClips.push({
          ...clip,
          localPath: clipPath,
          index: i,
          actualDuration: duration
        });
        console.log(`[Stitch] Clip ${i + 1} validated (duration: ${duration.toFixed(2)}s)`);
        
      } catch (err) {
        console.error(`[Stitch] Clip ${i + 1} (${clip.shotId}) failed: ${err.message}`);
        invalidClips.push({
          shotId: clip.shotId,
          index: i,
          error: err.message
        });
      }
    }
    
    // Check for missing clips
    if (invalidClips.length > 0) {
      console.warn(`[Stitch] ${invalidClips.length} clips failed validation`);
      
      if (notifyOnError) {
        return {
          success: false,
          error: 'Some clips failed validation',
          invalidClips,
          validClipCount: validClips.length,
          requiresRegeneration: invalidClips.map(c => c.shotId)
        };
      }
    }
    
    if (validClips.length === 0) {
      throw new Error('No valid clips to stitch');
    }
    
    // Sort clips by index
    validClips.sort((a, b) => a.index - b.index);
    
    // Step 2: Normalize all clips to same resolution/fps for crossfade
    console.log('[Stitch] Step 2: Normalizing clips for smooth transitions...');
    
    const normalizedClips = [];
    for (let i = 0; i < validClips.length; i++) {
      const clip = validClips[i];
      const normalizedPath = path.join(workDir, `normalized_${i.toString().padStart(3, '0')}.mp4`);
      
      await runFFmpeg([
        '-i', clip.localPath,
        '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=30',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '18',
        '-c:a', 'aac',
        '-ar', '48000',
        '-ac', '2',
        '-y',
        normalizedPath
      ], `Normalizing clip ${i + 1}/${validClips.length}`);
      
      normalizedClips.push({
        ...clip,
        normalizedPath,
      });
    }
    
    // Step 3: Apply crossfade transitions between clips
    console.log(`[Stitch] Step 3: Applying ${transitionType} crossfades...`);
    
    const transition = TRANSITION_TYPES[transitionType] || 'fade';
    const xfadeDuration = Math.min(transitionDuration, 1.0); // Cap at 1 second
    
    let currentPath = normalizedClips[0].normalizedPath;
    let accumulatedOffset = normalizedClips[0].actualDuration - xfadeDuration;
    
    // Chain xfade filters for each pair of clips
    for (let i = 1; i < normalizedClips.length; i++) {
      const nextClip = normalizedClips[i];
      const outputPath = path.join(workDir, `xfade_${i.toString().padStart(3, '0')}.mp4`);
      
      // Calculate offset (where in the timeline the transition starts)
      const offset = accumulatedOffset;
      
      console.log(`[Stitch] Crossfading clip ${i} -> ${i + 1} at offset ${offset.toFixed(2)}s`);
      
      await runFFmpeg([
        '-i', currentPath,
        '-i', nextClip.normalizedPath,
        '-filter_complex',
        `[0:v][1:v]xfade=transition=${transition}:duration=${xfadeDuration}:offset=${offset}[outv];[0:a][1:a]acrossfade=d=${xfadeDuration}[outa]`,
        '-map', '[outv]',
        '-map', '[outa]',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '18',
        '-c:a', 'aac',
        '-y',
        outputPath
      ], `Crossfade transition ${i}/${normalizedClips.length - 1}`);
      
      currentPath = outputPath;
      // Add duration of next clip minus overlap
      accumulatedOffset += nextClip.actualDuration - xfadeDuration;
    }
    
    // Step 4: Apply color grading to final merged video
    console.log(`[Stitch] Step 4: Applying ${colorGrading} color grading...`);
    
    const concatenatedPath = path.join(workDir, 'concatenated.mp4');
    const colorProfile = customColorProfile || COLOR_PRESETS[colorGrading] || COLOR_PRESETS.cinematic;
    const colorFilter = `eq=${colorProfile.eq},colorbalance=${colorProfile.colorbalance}`;
    
    await runFFmpeg([
      '-i', currentPath,
      '-vf', colorFilter,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '18',
      '-c:a', 'copy',
      '-movflags', '+faststart',
      '-y',
      concatenatedPath
    ], `Color grading with ${colorGrading}`);
    
    // Step 4: Audio injection (voice + music if provided)
    let finalPath = concatenatedPath;
    const totalDuration = validClips.reduce((sum, c) => sum + (c.durationSeconds || 4), 0);
    
    const hasVoice = voiceTrackUrl && audioMixMode !== 'mute';
    const hasMusic = backgroundMusicUrl && audioMixMode !== 'mute';
    
    // Download SFX tracks
    const sfxTracks = await downloadSFXFiles(sfxPlan, workDir);
    const hasSFX = sfxTracks.length > 0;
    
    if (hasVoice || hasMusic || hasSFX) {
      console.log('[Stitch] Step 4: Audio mixing with music sync and SFX...');
      console.log(`[Stitch] Voice: ${hasVoice ? 'yes' : 'no'}, Music: ${hasMusic ? 'yes' : 'no'}, SFX tracks: ${sfxTracks.length}`);
      
      const audioInputs = ['-i', concatenatedPath];
      let inputIndex = 1;
      
      // Download and add voice track
      let voiceInputIdx = null;
      if (hasVoice) {
        const voicePath = path.join(workDir, 'voice_track.mp3');
        await downloadFile(voiceTrackUrl, voicePath);
        audioInputs.push('-i', voicePath);
        voiceInputIdx = inputIndex++;
      }
      
      // Download and add music track  
      let musicInputIdx = null;
      if (hasMusic) {
        const musicPath = path.join(workDir, 'background_music.mp3');
        await downloadFile(backgroundMusicUrl, musicPath);
        audioInputs.push('-i', musicPath);
        musicInputIdx = inputIndex++;
      }
      
      // Add SFX inputs
      const sfxInputIndices = [];
      for (const sfx of sfxTracks) {
        audioInputs.push('-i', sfx.path);
        sfxInputIndices.push({ index: inputIndex++, ...sfx });
      }
      
      const withAudioPath = path.join(workDir, 'final_with_audio.mp4');
      let ffmpegArgs = [...audioInputs, '-t', totalDuration.toString()];
      
      // Build complex filter for mixing all audio tracks
      let filterParts = [];
      let mixInputs = [];
      
      // Voice processing
      if (voiceInputIdx !== null) {
        filterParts.push(`[${voiceInputIdx}:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,volume=1.0[voice]`);
        mixInputs.push('[voice]');
      }
      
      // Music processing with sync timing markers
      if (musicInputIdx !== null) {
        const baseVolume = audioMixParams?.musicVolume || 0.3;
        const timingMarkers = audioMixParams?.timingMarkers || musicSyncPlan?.timingMarkers;
        const volumeFilter = buildMusicVolumeFilter(timingMarkers, totalDuration, baseVolume);
        
        const fadeIn = audioMixParams?.fadeIn || 1;
        const fadeOut = audioMixParams?.fadeOut || 2;
        const fadeOutStart = Math.max(0, totalDuration - fadeOut);
        
        filterParts.push(`[${musicInputIdx}:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,${volumeFilter},afade=t=in:st=0:d=${fadeIn},afade=t=out:st=${fadeOutStart}:d=${fadeOut},atrim=0:${totalDuration}[music]`);
        mixInputs.push('[music]');
        console.log(`[Stitch] Applied music sync with ${timingMarkers?.length || 0} timing markers`);
      }
      
      // SFX processing
      for (let i = 0; i < sfxInputIndices.length; i++) {
        const sfx = sfxInputIndices[i];
        const label = `sfx${i}`;
        
        let sfxFilter = `[${sfx.index}:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,volume=${sfx.volume}`;
        
        if (sfx.startMs > 0) {
          sfxFilter += `,adelay=${sfx.startMs}|${sfx.startMs}`;
        }
        
        if (sfx.type === 'ambient' && sfx.loop) {
          sfxFilter += `,aloop=loop=-1:size=48000*${totalDuration},atrim=0:${totalDuration}`;
        }
        
        sfxFilter += `,apad=whole_dur=${totalDuration}[${label}]`;
        filterParts.push(sfxFilter);
        mixInputs.push(`[${label}]`);
      }
      
      // Include original video audio
      filterParts.push(`[0:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[orig]`);
      mixInputs.unshift('[orig]');
      
      // Mix all streams
      const mixFilter = `${mixInputs.join('')}amix=inputs=${mixInputs.length}:duration=first:dropout_transition=2[aout]`;
      filterParts.push(mixFilter);
      
      ffmpegArgs.push(
        '-filter_complex', filterParts.join(';'),
        '-map', '0:v',
        '-map', '[aout]',
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-movflags', '+faststart',
        withAudioPath
      );
      
      await runFFmpeg(ffmpegArgs, 'Audio mixing (voice + music sync + SFX)');
      finalPath = withAudioPath;
      
      console.log(`[Stitch] Audio mixing complete: ${mixInputs.length} tracks mixed`);
    }
    
    // Step 5: Get signed upload URL from edge function
    console.log('[Stitch] Step 5: Getting signed upload URL...');
    
    const finalFileName = `stitched_${projectId}_${Date.now()}.mp4`;
    const uploadUrlData = await getSignedUploadUrl(projectId, finalFileName);
    
    if (!uploadUrlData.success || !uploadUrlData.signedUrl) {
      throw new Error(`Failed to get upload URL: ${JSON.stringify(uploadUrlData)}`);
    }
    
    console.log(`[Stitch] Got signed URL, uploading ${finalFileName}...`);
    
    // Read the final video file
    const fileBuffer = await fs.readFile(finalPath);
    
    // Upload directly to signed URL
    await uploadToSignedUrl(uploadUrlData.signedUrl, fileBuffer);
    
    const finalVideoUrl = uploadUrlData.publicUrl;
    console.log(`[Stitch] Upload complete: ${finalVideoUrl}`);
    
    // Step 6: Finalize via edge function (updates database)
    console.log('[Stitch] Step 6: Finalizing project...');
    
    await finalizeStitch(projectId, finalVideoUrl, totalDuration, validClips.length);
    
    // Cleanup
    await fs.rm(workDir, { recursive: true, force: true });
    
    console.log(`[Stitch] Job ${jobId} completed successfully!`);
    
    return {
      success: true,
      finalVideoUrl,
      durationSeconds: totalDuration,
      clipsProcessed: validClips.length,
      invalidClips: invalidClips.length > 0 ? invalidClips : undefined
    };
    
  } catch (error) {
    console.error(`[Stitch] Job ${jobId} failed:`, error);
    
    // Cleanup on error
    try {
      await fs.rm(workDir, { recursive: true, force: true });
    } catch {}
    
    return {
      success: false,
      error: error.message
    };
  }
}

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'cloud-run-ffmpeg-stitcher',
    version: '1.0.0'
  });
});

// Main stitch endpoint
app.post('/stitch', async (req, res) => {
  try {
    const result = await stitchVideos(req.body);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(result.requiresRegeneration ? 422 : 500).json(result);
    }
  } catch (error) {
    console.error('[Stitch] Unhandled error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

// Validation-only endpoint (check clips without processing)
app.post('/validate', async (req, res) => {
  const { clips } = req.body;
  
  if (!clips || !Array.isArray(clips)) {
    return res.status(400).json({ error: 'clips array required' });
  }
  
  const results = [];
  
  for (const clip of clips) {
    try {
      // Just do a HEAD request to check availability
      const response = await fetch(clip.videoUrl, { method: 'HEAD' });
      results.push({
        shotId: clip.shotId,
        valid: response.ok,
        status: response.status
      });
    } catch (err) {
      results.push({
        shotId: clip.shotId,
        valid: false,
        error: err.message
      });
    }
  }
  
  res.json({
    totalClips: clips.length,
    validClips: results.filter(r => r.valid).length,
    results
  });
});

// Frame extraction endpoint for long video chaining
app.post('/extract-frame', async (req, res) => {
  const { clipUrl, clipIndex, projectId } = req.body;
  
  if (!clipUrl) {
    return res.status(400).json({ error: 'clipUrl is required' });
  }
  
  const jobId = uuidv4();
  const workDir = path.join(TEMP_DIR, `frame_${jobId}`);
  
  console.log(`[ExtractFrame] Starting frame extraction for clip ${clipIndex}`);
  
  try {
    await fs.mkdir(workDir, { recursive: true });
    
    // Download the video clip
    const clipPath = path.join(workDir, 'input.mp4');
    await downloadFile(clipUrl, clipPath);
    
    // Validate the video
    const validation = await validateVideo(clipPath);
    if (!validation.valid) {
      throw new Error('Invalid video file');
    }
    
    // Extract the last frame using FFmpeg
    const framePath = path.join(workDir, 'last_frame.jpg');
    
    await runFFmpeg([
      '-sseof', '-0.1',  // Seek to 0.1 seconds before end
      '-i', clipPath,
      '-frames:v', '1',  // Extract 1 frame
      '-q:v', '2',       // High quality JPEG
      '-y',              // Overwrite output
      framePath
    ], `Extract last frame from clip ${clipIndex}`);
    
    // Upload frame to Supabase storage
    const supabase = getSupabase();
    const frameFileName = `frame_${projectId || 'unknown'}_clip_${clipIndex}_${Date.now()}.jpg`;
    
    const frameBuffer = await fs.readFile(framePath);
    
    const { error: uploadError } = await supabase.storage
      .from('temp-frames')
      .upload(frameFileName, frameBuffer, {
        contentType: 'image/jpeg',
        upsert: true
      });
    
    if (uploadError) {
      throw new Error(`Frame upload failed: ${uploadError.message}`);
    }
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const lastFrameUrl = `${supabaseUrl}/storage/v1/object/public/temp-frames/${frameFileName}`;
    
    // Cleanup
    await fs.rm(workDir, { recursive: true, force: true });
    
    console.log(`[ExtractFrame] Frame extracted successfully: ${lastFrameUrl}`);
    
    res.json({
      success: true,
      lastFrameUrl,
      clipIndex
    });
    
  } catch (error) {
    console.error(`[ExtractFrame] Error:`, error);
    
    // Cleanup on error
    try {
      await fs.rm(workDir, { recursive: true, force: true });
    } catch {}
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start server - bind to 0.0.0.0 for Cloud Run
const PORT = process.env.PORT || 8080;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Stitcher] Cloud Run FFmpeg Stitcher listening on 0.0.0.0:${PORT}`);
  console.log(`[Stitcher] Environment: ${process.env.NODE_ENV || 'development'}`);
  logStartup();
});

// Handle startup errors gracefully
server.on('error', (err) => {
  console.error('[Stitcher] Server error:', err);
  process.exit(1);
});

// Handle uncaught exceptions to prevent silent crashes
process.on('uncaughtException', (err) => {
  console.error('[Stitcher] Uncaught exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Stitcher] Unhandled rejection at:', promise, 'reason:', reason);
});
