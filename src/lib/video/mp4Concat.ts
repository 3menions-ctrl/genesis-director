/**
 * MP4 Concatenation using mp4box.js (pure JavaScript, no SharedArrayBuffer needed)
 * 
 * Downloads multiple MP4 clips and concatenates them into a single seamless MP4 file.
 * Works on ALL browsers including those without COOP/COEP headers.
 */

// @ts-ignore - mp4box doesn't have perfect types
import MP4Box from 'mp4box';

export interface ConcatProgress {
  stage: 'downloading' | 'parsing' | 'writing' | 'complete' | 'error';
  progress: number;
  message: string;
  currentClip?: number;
  totalClips?: number;
}

export interface ConcatResult {
  success: boolean;
  blob?: Blob;
  error?: string;
}

/**
 * Parse an MP4 ArrayBuffer and extract track info + samples
 */
function parseMP4(buffer: ArrayBuffer): Promise<{
  info: any;
  file: any;
}> {
  return new Promise((resolve, reject) => {
    const file = MP4Box.createFile();
    
    file.onReady = (info: any) => {
      resolve({ info, file });
    };
    
    file.onError = (e: any) => {
      reject(new Error(`MP4 parse error: ${e}`));
    };
    
    // mp4box requires fileStart property on the buffer
    (buffer as any).fileStart = 0;
    file.appendBuffer(buffer);
    file.flush();
  });
}

/**
 * Extract all samples from a parsed MP4 file for a specific track
 */
function extractSamples(file: any, trackId: number): Promise<any[]> {
  return new Promise((resolve) => {
    const samples: any[] = [];
    
    file.onSamples = (_id: number, _user: any, extractedSamples: any[]) => {
      samples.push(...extractedSamples);
    };
    
    file.setExtractionOptions(trackId, null, { nbSamples: 1000000 });
    file.start();
    
    // mp4box extracts synchronously after start()
    // Use a small timeout to ensure extraction completes
    setTimeout(() => {
      file.stop();
      resolve(samples);
    }, 100);
  });
}

/**
 * Concatenate multiple MP4 clips into a single MP4 file.
 * All clips must share the same codec parameters (resolution, codec, etc.)
 */
export async function concatMP4Clips(
  clipUrls: string[],
  onProgress?: (progress: ConcatProgress) => void
): Promise<ConcatResult> {
  if (clipUrls.length === 0) {
    return { success: false, error: 'No clips provided' };
  }

  // Single clip - just download directly
  if (clipUrls.length === 1) {
    try {
      onProgress?.({ stage: 'downloading', progress: 50, message: 'Downloading video...', currentClip: 1, totalClips: 1 });
      const response = await fetch(clipUrls[0], { mode: 'cors' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      onProgress?.({ stage: 'complete', progress: 100, message: 'Done!' });
      return { success: true, blob };
    } catch (err) {
      return { success: false, error: `Download failed: ${err}` };
    }
  }

  try {
    // Step 1: Download all clips
    const clipBuffers: ArrayBuffer[] = [];
    for (let i = 0; i < clipUrls.length; i++) {
      onProgress?.({
        stage: 'downloading',
        progress: Math.round((i / clipUrls.length) * 40),
        message: `Downloading clip ${i + 1} of ${clipUrls.length}...`,
        currentClip: i + 1,
        totalClips: clipUrls.length,
      });

      const response = await fetch(clipUrls[i], { mode: 'cors' });
      if (!response.ok) {
        console.warn(`[MP4Concat] Clip ${i + 1} fetch failed: ${response.status}`);
        continue;
      }
      const buffer = await response.arrayBuffer();
      clipBuffers.push(buffer);
    }

    if (clipBuffers.length === 0) {
      return { success: false, error: 'Failed to download any clips' };
    }

    if (clipBuffers.length === 1) {
      onProgress?.({ stage: 'complete', progress: 100, message: 'Done!' });
      return { success: true, blob: new Blob([clipBuffers[0]], { type: 'video/mp4' }) };
    }

    // Step 2: Parse first clip to get track configuration
    onProgress?.({ stage: 'parsing', progress: 45, message: 'Analyzing video format...' });
    
    const firstParsed = await parseMP4(clipBuffers[0]);
    const videoTrack = firstParsed.info.tracks.find((t: any) => t.type === 'video');
    const audioTrack = firstParsed.info.tracks.find((t: any) => t.type === 'audio');

    if (!videoTrack) {
      return { success: false, error: 'No video track found in clips' };
    }

    // Step 3: Create output MP4 file
    onProgress?.({ stage: 'writing', progress: 50, message: 'Creating merged video...' });
    
    const outputFile = MP4Box.createFile();

    // Add video track
    const videoTrackOptions: any = {
      timescale: videoTrack.timescale,
      width: videoTrack.video?.width || videoTrack.track_width,
      height: videoTrack.video?.height || videoTrack.track_height,
      nb_samples: 0,
      brands: ['isom', 'iso2', 'avc1', 'mp41'],
    };

    // Get codec description (avcC/hvcC box) from the source
    const firstFile = firstParsed.file;
    const srcVideoTrak = firstFile.getTrackById(videoTrack.id);
    if (srcVideoTrak) {
      const stsd = srcVideoTrak.mdia?.minf?.stbl?.stsd;
      if (stsd?.entries?.length > 0) {
        const entry = stsd.entries[0];
        // Extract codec-specific description box (avcC for H.264, hvcC for H.265)
        const descBox = entry.avcC || entry.hvcC || entry.vpcC || entry.av1C;
        if (descBox) {
          // Serialize the description box
          const stream = new MP4Box.DataStream(undefined, 0, MP4Box.DataStream.BIG_ENDIAN);
          descBox.write(stream);
          videoTrackOptions.avcDecoderConfigRecord = stream.buffer;
        }
        // Copy codec string
        videoTrackOptions.type = entry.type || 'avc1';
      }
    }

    const outputVideoTrackId = outputFile.addTrack(videoTrackOptions);

    // Add audio track if present
    let outputAudioTrackId: number | null = null;
    if (audioTrack) {
      const audioTrackOptions: any = {
        timescale: audioTrack.timescale,
        samplerate: audioTrack.audio?.sample_rate || 44100,
        channel_count: audioTrack.audio?.channel_count || 2,
        samplesize: audioTrack.audio?.sample_size || 16,
        nb_samples: 0,
      };

      const srcAudioTrak = firstFile.getTrackById(audioTrack.id);
      if (srcAudioTrak) {
        const stsd = srcAudioTrak.mdia?.minf?.stbl?.stsd;
        if (stsd?.entries?.length > 0) {
          const entry = stsd.entries[0];
          const descBox = entry.esds || entry.dOps;
          if (descBox) {
            const stream = new MP4Box.DataStream(undefined, 0, MP4Box.DataStream.BIG_ENDIAN);
            descBox.write(stream);
            audioTrackOptions.description = stream.buffer;
          }
          audioTrackOptions.type = entry.type || 'mp4a';
        }
      }

      outputAudioTrackId = outputFile.addTrack(audioTrackOptions);
    }

    // Step 4: Extract and add samples from each clip
    let videoDtsOffset = 0;
    let audioDtsOffset = 0;

    for (let clipIdx = 0; clipIdx < clipBuffers.length; clipIdx++) {
      onProgress?.({
        stage: 'writing',
        progress: 50 + Math.round((clipIdx / clipBuffers.length) * 45),
        message: `Processing clip ${clipIdx + 1} of ${clipBuffers.length}...`,
        currentClip: clipIdx + 1,
        totalClips: clipBuffers.length,
      });

      // Parse this clip
      const parsed = clipIdx === 0 ? firstParsed : await parseMP4(clipBuffers[clipIdx]);
      const clipVideoTrack = parsed.info.tracks.find((t: any) => t.type === 'video');
      const clipAudioTrack = parsed.info.tracks.find((t: any) => t.type === 'audio');

      // Extract video samples
      if (clipVideoTrack) {
        const videoSamples = await extractSamples(parsed.file, clipVideoTrack.id);
        let maxVideoDts = 0;
        
        for (const sample of videoSamples) {
          outputFile.addSample(outputVideoTrackId, sample.data, {
            duration: sample.duration,
            dts: sample.dts + videoDtsOffset,
            cts: sample.cts + videoDtsOffset,
            is_sync: sample.is_sync,
          });
          maxVideoDts = Math.max(maxVideoDts, sample.dts + sample.duration);
        }
        
        videoDtsOffset += maxVideoDts;
      }

      // Extract audio samples
      if (clipAudioTrack && outputAudioTrackId !== null) {
        const audioSamples = await extractSamples(parsed.file, clipAudioTrack.id);
        let maxAudioDts = 0;
        
        for (const sample of audioSamples) {
          outputFile.addSample(outputAudioTrackId, sample.data, {
            duration: sample.duration,
            dts: sample.dts + audioDtsOffset,
            cts: sample.cts + audioDtsOffset,
            is_sync: sample.is_sync,
          });
          maxAudioDts = Math.max(maxAudioDts, sample.dts + sample.duration);
        }
        
        audioDtsOffset += maxAudioDts;
      }
    }

    // Step 5: Generate the output file
    onProgress?.({ stage: 'writing', progress: 95, message: 'Finalizing video...' });

    // Get the complete MP4 as an ArrayBuffer
    const outputBuffer = outputFile.getBuffer();
    const blob = new Blob([outputBuffer], { type: 'video/mp4' });

    onProgress?.({ stage: 'complete', progress: 100, message: 'Video merged successfully!' });

    return { success: true, blob };

  } catch (err) {
    console.error('[MP4Concat] Concatenation failed:', err);
    return { success: false, error: `Merge failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}
