/**
 * Generate an HLS .m3u8 playlist from editor timeline clips (client-side)
 * 
 * This mirrors the exact same format used by simple-stitch edge function,
 * ensuring the editor uses the SAME stitching configuration as production.
 */

export interface EditorClip {
  id: string;
  sourceUrl: string;
  duration: number; // seconds
  start: number;    // timeline start position
  end: number;      // timeline end position
}

/**
 * Generate an HLS m3u8 playlist string from ordered clips.
 * Uses #EXT-X-DISCONTINUITY between clips (same as simple-stitch).
 */
export function generateHLSPlaylist(clips: EditorClip[]): string {
  if (clips.length === 0) return '';

  const maxDuration = Math.ceil(Math.max(...clips.map(c => c.end - c.start)));

  let content = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:${maxDuration}
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-PLAYLIST-TYPE:VOD
`;

  clips.forEach((clip, index) => {
    if (index > 0) {
      content += `#EXT-X-DISCONTINUITY\n`;
    }
    const clipDuration = clip.end - clip.start;
    content += `#EXTINF:${clipDuration.toFixed(6)},\n`;
    content += `${clip.sourceUrl}\n`;
  });

  content += `#EXT-X-ENDLIST\n`;
  return content;
}

/**
 * Create a blob URL for the HLS playlist (for use with hls.js / native HLS)
 */
export function createHLSBlobUrl(playlistContent: string): string {
  const blob = new Blob([playlistContent], { type: 'application/vnd.apple.mpegurl' });
  return URL.createObjectURL(blob);
}

/**
 * Generate a JSON manifest matching simple-stitch format
 */
export function generateEditorManifest(clips: EditorClip[], hlsBlobUrl?: string) {
  const totalDuration = clips.reduce((sum, c) => sum + (c.end - c.start), 0);
  
  return {
    version: '2.3',
    mode: 'editor_stitch',
    createdAt: new Date().toISOString(),
    hlsPlaylistUrl: hlsBlobUrl || null,
    clips: clips.map((clip, index) => {
      const clipDuration = clip.end - clip.start;
      const startTime = clips.slice(0, index).reduce((sum, c) => sum + (c.end - c.start), 0);
      return {
        index,
        shotId: clip.id,
        videoUrl: clip.sourceUrl,
        duration: clipDuration,
        startTime,
        transitionOut: 'fade',
      };
    }),
    totalDuration,
    audioConfig: {
      muteClipAudio: false,
      embeddedAudioOnly: true,
    },
  };
}
