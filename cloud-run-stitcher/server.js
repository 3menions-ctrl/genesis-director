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
const path = require('path');
const https = require('https');
const http = require('http');

const app = express();
app.use(express.json({ limit: '10mb' }));

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

// Initialize Supabase client
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing Supabase credentials');
  }
  return createClient(url, key);
}

// Download file from URL
async function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = require('fs').createWriteStream(destPath);
    
    protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // Follow redirect
        return downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(destPath);
      });
    }).on('error', (err) => {
      require('fs').unlink(destPath, () => {});
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

// Main stitching logic
async function stitchVideos(request) {
  const {
    projectId,
    projectTitle,
    clips,
    audioMixMode = 'full',
    backgroundMusicUrl,
    voiceTrackUrl,           // Voice narration track
    outputFormat = 'mp4',
    notifyOnError = true,
    colorGrading = 'cinematic',
    customColorProfile = null
  } = request;
  
  const jobId = uuidv4();
  const workDir = path.join(TEMP_DIR, jobId);
  
  console.log(`[Stitch] Starting job ${jobId} for project ${projectId}`);
  console.log(`[Stitch] Processing ${clips.length} clips with color grading: ${colorGrading}`);
  
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
        
        validClips.push({
          ...clip,
          localPath: clipPath,
          index: i
        });
        console.log(`[Stitch] Clip ${i + 1} validated successfully`);
        
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
    
    // Step 2: Create concat file for lossless merging
    console.log('[Stitch] Step 2: Creating concat manifest...');
    
    const concatFilePath = path.join(workDir, 'concat.txt');
    const concatContent = validClips
      .sort((a, b) => a.index - b.index)
      .map(c => `file '${c.localPath}'`)
      .join('\n');
    
    await fs.writeFile(concatFilePath, concatContent);
    
    // Step 3: Concatenation with color grading
    console.log('[Stitch] Step 3: Concatenating with color grading...');
    
    const concatenatedPath = path.join(workDir, 'concatenated.mp4');
    
    // Get color profile
    const colorProfile = customColorProfile || COLOR_PRESETS[colorGrading] || COLOR_PRESETS.cinematic;
    
    // Build color filter chain
    const colorFilter = `eq=${colorProfile.eq},colorbalance=${colorProfile.colorbalance}`;
    
    await runFFmpeg([
      '-f', 'concat',
      '-safe', '0',
      '-i', concatFilePath,
      '-vf', colorFilter,  // Apply color grading
      '-c:v', 'libx264',   // Re-encode with color grading
      '-preset', 'fast',
      '-crf', '18',        // High quality
      '-c:a', 'copy',      // Keep audio lossless
      '-movflags', '+faststart',
      concatenatedPath
    ], `Concatenation with ${colorGrading} color grading`);
    
    // Step 4: Audio injection (voice + music if provided)
    let finalPath = concatenatedPath;
    const totalDuration = validClips.reduce((sum, c) => sum + (c.durationSeconds || 4), 0);
    
    const hasVoice = voiceTrackUrl && audioMixMode !== 'mute';
    const hasMusic = backgroundMusicUrl && audioMixMode !== 'mute';
    
    if (hasVoice || hasMusic) {
      console.log('[Stitch] Step 4: Audio mixing...');
      console.log(`[Stitch] Voice: ${hasVoice ? 'yes' : 'no'}, Music: ${hasMusic ? 'yes' : 'no'}`);
      
      const audioInputs = ['-i', concatenatedPath];
      let filterParts = [];
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
      
      const withAudioPath = path.join(workDir, 'final_with_audio.mp4');
      
      // Build filter complex based on what we have
      let ffmpegArgs = [...audioInputs, '-t', totalDuration.toString()];
      
      if (hasVoice && hasMusic) {
        // Mix video audio + voice (front) + music (background, lower volume)
        ffmpegArgs.push(
          '-filter_complex',
          `[${musicInputIdx}:a]volume=0.3[music];[${voiceInputIdx}:a]volume=1.0[voice];[0:a][voice][music]amix=inputs=3:duration=first:dropout_transition=2[aout]`,
          '-map', '0:v',
          '-map', '[aout]'
        );
      } else if (hasVoice) {
        // Mix video audio + voice
        ffmpegArgs.push(
          '-filter_complex',
          `[0:a][${voiceInputIdx}:a]amix=inputs=2:duration=first:dropout_transition=2[aout]`,
          '-map', '0:v',
          '-map', '[aout]'
        );
      } else if (hasMusic) {
        // Mix video audio + music (lower volume)
        const musicMode = audioMixMode === 'music-only';
        if (musicMode) {
          ffmpegArgs.push('-map', '0:v', '-map', `${musicInputIdx}:a`);
        } else {
          ffmpegArgs.push(
            '-filter_complex',
            `[${musicInputIdx}:a]volume=0.4[music];[0:a][music]amix=inputs=2:duration=first:dropout_transition=2[aout]`,
            '-map', '0:v',
            '-map', '[aout]'
          );
        }
      }
      
      ffmpegArgs.push(
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-movflags', '+faststart',
        withAudioPath
      );
      
      await runFFmpeg(ffmpegArgs, 'Audio mixing (voice + music)');
      finalPath = withAudioPath;
    }
    
    // Step 5: Upload to Supabase Storage
    console.log('[Stitch] Step 5: Uploading to Supabase Storage...');
    
    const supabase = getSupabase();
    const finalFileName = `stitched_${projectId}_${Date.now()}.mp4`;
    
    const fileBuffer = await fs.readFile(finalPath);
    
    // Ensure bucket exists (create if needed)
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(b => b.name === 'final-videos');
    
    if (!bucketExists) {
      await supabase.storage.createBucket('final-videos', { public: true });
      console.log('[Stitch] Created final-videos bucket');
    }
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('final-videos')
      .upload(finalFileName, fileBuffer, {
        contentType: 'video/mp4',
        upsert: true
      });
    
    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('final-videos')
      .getPublicUrl(finalFileName);
    
    const finalVideoUrl = urlData.publicUrl;
    
    // Step 6: Update project in database
    console.log('[Stitch] Step 6: Updating project dashboard...');
    
    const { error: updateError } = await supabase
      .from('movie_projects')
      .update({
        video_url: finalVideoUrl,
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId);
    
    if (updateError) {
      console.warn(`[Stitch] Failed to update project: ${updateError.message}`);
    }
    
    // Calculate final duration
    const totalDuration = validClips.reduce((sum, c) => sum + (c.durationSeconds || 4), 0);
    
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

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`[Stitcher] Cloud Run FFmpeg Stitcher listening on port ${PORT}`);
  console.log(`[Stitcher] Environment: ${process.env.NODE_ENV || 'development'}`);
});
