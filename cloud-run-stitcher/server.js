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

// Main stitching logic
async function stitchVideos(request) {
  const {
    projectId,
    projectTitle,
    clips,
    audioMixMode = 'full',
    backgroundMusicUrl,
    outputFormat = 'mp4',
    notifyOnError = true
  } = request;
  
  const jobId = uuidv4();
  const workDir = path.join(TEMP_DIR, jobId);
  
  console.log(`[Stitch] Starting job ${jobId} for project ${projectId}`);
  console.log(`[Stitch] Processing ${clips.length} clips`);
  
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
    
    // Step 3: Lossless concatenation using concat demuxer
    console.log('[Stitch] Step 3: Performing lossless concatenation...');
    
    const concatenatedPath = path.join(workDir, 'concatenated.mp4');
    
    await runFFmpeg([
      '-f', 'concat',
      '-safe', '0',
      '-i', concatFilePath,
      '-c', 'copy', // Lossless copy - no re-encoding
      '-movflags', '+faststart', // Optimize for web streaming
      concatenatedPath
    ], 'Lossless video concatenation');
    
    // Step 4: Audio injection (if background music provided)
    let finalPath = concatenatedPath;
    
    if (backgroundMusicUrl && audioMixMode !== 'mute') {
      console.log('[Stitch] Step 4: Injecting background audio...');
      
      const audioPath = path.join(workDir, 'background_audio.mp3');
      await downloadFile(backgroundMusicUrl, audioPath);
      
      const withAudioPath = path.join(workDir, 'final_with_audio.mp4');
      
      // Calculate total duration for audio loop/trim
      const totalDuration = validClips.reduce((sum, c) => sum + (c.durationSeconds || 4), 0);
      
      const audioFilterArgs = audioMixMode === 'music-only' 
        ? ['-map', '0:v', '-map', '1:a', '-shortest']
        : [
            '-filter_complex', 
            `[0:a][1:a]amix=inputs=2:duration=first:dropout_transition=2[aout]`,
            '-map', '0:v',
            '-map', '[aout]'
          ];
      
      await runFFmpeg([
        '-i', concatenatedPath,
        '-i', audioPath,
        '-t', totalDuration.toString(),
        ...audioFilterArgs,
        '-c:v', 'copy', // Keep video lossless
        '-c:a', 'aac',
        '-b:a', '192k',
        '-movflags', '+faststart',
        withAudioPath
      ], 'Audio injection');
      
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

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`[Stitcher] Cloud Run FFmpeg Stitcher listening on port ${PORT}`);
  console.log(`[Stitcher] Environment: ${process.env.NODE_ENV || 'development'}`);
});
