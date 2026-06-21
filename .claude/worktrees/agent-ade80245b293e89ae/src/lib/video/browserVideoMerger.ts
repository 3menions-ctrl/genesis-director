/**
 * Browser Video Merger (Lightweight)
 * 
 * Downloads clips and packages them as a ZIP file (multi-clip) or direct MP4 (single clip).
 */

export interface MergeProgress {
  stage: 'initializing' | 'loading' | 'downloading' | 'processing' | 'encoding' | 'complete' | 'error' | 'server_stitching';
  progress: number;
  currentClip?: number;
  totalClips?: number;
  message?: string;
}

export interface MergeOptions {
  clipUrls: string[];
  outputFilename?: string;
  projectId?: string;
  projectName?: string;
  masterAudioUrl?: string | null;
  onProgress?: (progress: MergeProgress) => void;
}

export interface MergeResult {
  success: boolean;
  blob?: Blob;
  filename?: string;
  duration?: number;
  error?: string;
  serverStitchedUrl?: string;
}

/**
 * Check if video merging is available (always true — ZIP fallback)
 */
export function canMergeVideos(): boolean {
  return true;
}

/**
 * Build a simple uncompressed ZIP from files
 */
async function buildZip(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const entries: { name: string; data: Uint8Array }[] = [];
  for (const f of files) {
    const buf = await f.blob.arrayBuffer();
    entries.push({ name: f.name, data: new Uint8Array(buf) });
  }

  const parts: Uint8Array[] = [];
  const centralDir: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = new TextEncoder().encode(entry.name);
    const header = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(8, 0, true);
    view.setUint32(18, entry.data.length, true);
    view.setUint32(22, entry.data.length, true);
    view.setUint16(26, nameBytes.length, true);
    header.set(nameBytes, 30);
    parts.push(header);
    parts.push(entry.data);

    const cdEntry = new Uint8Array(46 + nameBytes.length);
    const cdView = new DataView(cdEntry.buffer);
    cdView.setUint32(0, 0x02014b50, true);
    cdView.setUint16(4, 20, true);
    cdView.setUint16(6, 20, true);
    cdView.setUint32(20, entry.data.length, true);
    cdView.setUint32(24, entry.data.length, true);
    cdView.setUint16(28, nameBytes.length, true);
    cdView.setUint32(42, offset, true);
    cdEntry.set(nameBytes, 46);
    centralDir.push(cdEntry);

    offset += header.length + entry.data.length;
  }

  const cdOffset = offset;
  let cdSize = 0;
  for (const cd of centralDir) {
    parts.push(cd);
    cdSize += cd.length;
  }

  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(8, entries.length, true);
  eocdView.setUint16(10, entries.length, true);
  eocdView.setUint32(12, cdSize, true);
  eocdView.setUint32(16, cdOffset, true);
  parts.push(eocd);

  return new Blob(parts as unknown as BlobPart[], { type: 'application/zip' });
}

/**
 * Download clips and package as ZIP (or single MP4)
 */
export async function mergeVideoClips(options: MergeOptions): Promise<MergeResult> {
  const { clipUrls, outputFilename, projectName, onProgress } = options;

  if (!clipUrls || clipUrls.length === 0) {
    return { success: false, error: 'No clips provided' };
  }

  try {
    onProgress?.({ stage: 'initializing', progress: 0, message: 'Preparing download...' });

    const files: { name: string; blob: Blob }[] = [];
    const baseName = projectName || 'video';

    for (let i = 0; i < clipUrls.length; i++) {
      onProgress?.({
        stage: 'downloading',
        progress: (i / clipUrls.length) * 80,
        currentClip: i + 1,
        totalClips: clipUrls.length,
        message: `Downloading clip ${i + 1}/${clipUrls.length}...`,
      });

      try {
        const response = await fetch(clipUrls[i], { mode: 'cors' });
        if (!response.ok) continue;
        const blob = await response.blob();
        files.push({ name: `${baseName}-clip-${i + 1}.mp4`, blob });
      } catch (err) {
        console.warn(`[VideoMerger] Clip ${i + 1} download failed:`, err);
      }
    }

    if (files.length === 0) {
      return { success: false, error: 'Failed to download any clips' };
    }

    // Single clip — return directly as MP4
    if (files.length === 1) {
      onProgress?.({ stage: 'complete', progress: 100, message: 'Done!' });
      return {
        success: true,
        blob: files[0].blob,
        filename: outputFilename || `${baseName}.mp4`,
      };
    }

    // Multiple clips — package as ZIP
    onProgress?.({ stage: 'encoding', progress: 85, message: 'Packaging clips...' });
    const zipBlob = await buildZip(files);

    onProgress?.({ stage: 'complete', progress: 100, message: 'Done!' });
    return {
      success: true,
      blob: zipBlob,
      filename: outputFilename?.replace('.mp4', '.zip') || `${baseName}-clips.zip`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'An unexpected error occurred';
    onProgress?.({ stage: 'error', progress: 0, message: msg });
    return { success: false, error: msg };
  }
}

/**
 * Download a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
