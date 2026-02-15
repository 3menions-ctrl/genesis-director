import { describe, it, expect } from 'vitest';
import {
  generateHLSPlaylist,
  createHLSBlobUrl,
  generateEditorManifest,
  type EditorClip,
} from '@/lib/editor/generateEditorHLS';

// --- Test fixtures ---
const singleClip: EditorClip[] = [
  { id: 'shot-1', sourceUrl: 'https://cdn.example.com/clip1.mp4', duration: 5, start: 0, end: 5 },
];

const threeClips: EditorClip[] = [
  { id: 'shot-1', sourceUrl: 'https://cdn.example.com/clip1.mp4', duration: 4, start: 0, end: 4 },
  { id: 'shot-2', sourceUrl: 'https://cdn.example.com/clip2.mp4', duration: 6, start: 4, end: 10 },
  { id: 'shot-3', sourceUrl: 'https://cdn.example.com/clip3.mp4', duration: 3, start: 10, end: 13 },
];

// --- generateHLSPlaylist ---
describe('generateHLSPlaylist', () => {
  it('returns empty string for zero clips', () => {
    expect(generateHLSPlaylist([])).toBe('');
  });

  it('generates valid M3U8 header with correct version and type', () => {
    const playlist = generateHLSPlaylist(singleClip);
    expect(playlist).toContain('#EXTM3U');
    expect(playlist).toContain('#EXT-X-VERSION:3');
    expect(playlist).toContain('#EXT-X-PLAYLIST-TYPE:VOD');
    expect(playlist).toContain('#EXT-X-MEDIA-SEQUENCE:0');
  });

  it('includes EXT-X-ENDLIST tag (VOD requirement)', () => {
    const playlist = generateHLSPlaylist(singleClip);
    expect(playlist.trim().endsWith('#EXT-X-ENDLIST')).toBe(true);
  });

  it('sets TARGETDURATION to ceil of longest clip', () => {
    const playlist = generateHLSPlaylist(threeClips);
    // Longest clip is 6s → ceil = 6
    expect(playlist).toContain('#EXT-X-TARGETDURATION:6');
  });

  it('emits correct EXTINF duration for single clip', () => {
    const playlist = generateHLSPlaylist(singleClip);
    expect(playlist).toContain('#EXTINF:5.000000,');
    expect(playlist).toContain('https://cdn.example.com/clip1.mp4');
  });

  it('inserts EXT-X-DISCONTINUITY between clips (simple-stitch parity)', () => {
    const playlist = generateHLSPlaylist(threeClips);
    const discontinuities = (playlist.match(/#EXT-X-DISCONTINUITY/g) || []).length;
    // N clips → N-1 discontinuities
    expect(discontinuities).toBe(2);
  });

  it('does NOT insert DISCONTINUITY before first clip', () => {
    const playlist = generateHLSPlaylist(threeClips);
    const firstExtinf = playlist.indexOf('#EXTINF');
    const firstDisc = playlist.indexOf('#EXT-X-DISCONTINUITY');
    expect(firstExtinf).toBeLessThan(firstDisc);
  });

  it('preserves clip order and URLs', () => {
    const playlist = generateHLSPlaylist(threeClips);
    const url1Pos = playlist.indexOf('clip1.mp4');
    const url2Pos = playlist.indexOf('clip2.mp4');
    const url3Pos = playlist.indexOf('clip3.mp4');
    expect(url1Pos).toBeLessThan(url2Pos);
    expect(url2Pos).toBeLessThan(url3Pos);
  });

  it('calculates per-clip duration from end - start', () => {
    const playlist = generateHLSPlaylist(threeClips);
    expect(playlist).toContain('#EXTINF:4.000000,');
    expect(playlist).toContain('#EXTINF:6.000000,');
    expect(playlist).toContain('#EXTINF:3.000000,');
  });
});

// --- createHLSBlobUrl ---
describe('createHLSBlobUrl', () => {
  it('creates a blob URL from playlist content', () => {
    const playlist = generateHLSPlaylist(singleClip);
    const blobUrl = createHLSBlobUrl(playlist);
    expect(blobUrl).toBeTruthy();
    // Our mock returns 'blob:mock-url'
    expect(typeof blobUrl).toBe('string');
  });
});

// --- generateEditorManifest ---
describe('generateEditorManifest', () => {
  it('returns correct version and mode', () => {
    const manifest = generateEditorManifest(threeClips);
    expect(manifest.version).toBe('2.3');
    expect(manifest.mode).toBe('editor_stitch');
  });

  it('calculates correct totalDuration', () => {
    const manifest = generateEditorManifest(threeClips);
    // 4 + 6 + 3 = 13
    expect(manifest.totalDuration).toBe(13);
  });

  it('maps clips with correct indices and startTimes', () => {
    const manifest = generateEditorManifest(threeClips);
    expect(manifest.clips).toHaveLength(3);

    expect(manifest.clips[0].index).toBe(0);
    expect(manifest.clips[0].startTime).toBe(0);
    expect(manifest.clips[0].duration).toBe(4);
    expect(manifest.clips[0].shotId).toBe('shot-1');

    expect(manifest.clips[1].index).toBe(1);
    expect(manifest.clips[1].startTime).toBe(4);
    expect(manifest.clips[1].duration).toBe(6);

    expect(manifest.clips[2].index).toBe(2);
    expect(manifest.clips[2].startTime).toBe(10);
    expect(manifest.clips[2].duration).toBe(3);
  });

  it('includes videoUrl for each clip', () => {
    const manifest = generateEditorManifest(threeClips);
    expect(manifest.clips[0].videoUrl).toBe('https://cdn.example.com/clip1.mp4');
    expect(manifest.clips[2].videoUrl).toBe('https://cdn.example.com/clip3.mp4');
  });

  it('sets transitionOut to fade for all clips', () => {
    const manifest = generateEditorManifest(threeClips);
    manifest.clips.forEach(c => {
      expect(c.transitionOut).toBe('fade');
    });
  });

  it('includes audio config with embedded audio', () => {
    const manifest = generateEditorManifest(threeClips);
    expect(manifest.audioConfig.muteClipAudio).toBe(false);
    expect(manifest.audioConfig.embeddedAudioOnly).toBe(true);
  });

  it('attaches HLS blob URL when provided', () => {
    const manifest = generateEditorManifest(threeClips, 'blob:test-url');
    expect(manifest.hlsPlaylistUrl).toBe('blob:test-url');
  });

  it('sets hlsPlaylistUrl to null when not provided', () => {
    const manifest = generateEditorManifest(threeClips);
    expect(manifest.hlsPlaylistUrl).toBeNull();
  });

  it('includes createdAt ISO timestamp', () => {
    const manifest = generateEditorManifest(singleClip);
    expect(manifest.createdAt).toBeTruthy();
    // Should be valid ISO date
    expect(new Date(manifest.createdAt).toISOString()).toBe(manifest.createdAt);
  });
});
