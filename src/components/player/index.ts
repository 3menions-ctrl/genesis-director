/**
 * Universal Video Player - Unified media playback component
 * 
 * This module exports video players that handle all video playback needs:
 * 
 * ## UniversalVideoPlayer (default)
 * Full-featured player with multi-engine support:
 * - Database-driven clip fetching via projectId
 * - Manifest-based project playback
 * - Fullscreen modal viewing
 * - Thumbnail previews with hover playback
 * - Export/download display
 * 
 * ## UniversalHLSPlayer
 * Cross-browser HLS playback (works everywhere):
 * - Safari/iOS: Native HLS support
 * - Chrome/Firefox/Edge: hls.js library (MSE-based)
 * - Unified playback path for all browsers
 * 
 * Usage:
 * ```tsx
 * import { UniversalVideoPlayer, UniversalHLSPlayer } from '@/components/player';
 * 
 * // Full-featured player with project support
 * <UniversalVideoPlayer 
 *   source={{ projectId: 'uuid-here' }}
 *   mode="inline"
 *   autoPlay
 * />
 * 
 * // Direct HLS playback (works on ALL browsers)
 * <UniversalHLSPlayer 
 *   hlsUrl="https://example.com/playlist.m3u8"
 *   autoPlay
 * />
 * 
 * // Multi-clip stitching with direct URLs
 * <UniversalVideoPlayer 
 *   source={{ urls: ['clip1.mp4', 'clip2.mp4'] }}
 *   mode="inline"
 * />
 * 
 * // Manifest-based
 * <UniversalVideoPlayer 
 *   source={{ manifestUrl: '/project-manifest.json' }}
 *   mode="fullscreen"
 *   onClose={() => setOpen(false)}
 * />
 * 
 * // Thumbnail with hover preview
 * <UniversalVideoPlayer 
 *   source={{ urls: ['video.mp4'] }}
 *   mode="thumbnail"
 *   hoverPreview
 *   onClick={() => openModal()}
 * />
 * ```
 */

// Main player exports
export { 
  UniversalVideoPlayer, 
  default,
  type UniversalVideoPlayerProps,
  type PlayerMode,
  type VideoSource,
  type PlayerControls,
} from './UniversalVideoPlayer';

// Universal HLS Player (cross-browser HLS playback via hls.js)
export { 
  UniversalHLSPlayer,
  detectHLSPlaybackMethod,
  type UniversalHLSPlayerProps,
  type UniversalHLSPlayerHandle,
} from './UniversalHLSPlayer';

// Simple Video Player (drop-in <video> replacement with HLS support)
export {
  SimpleVideoPlayer,
  type SimpleVideoPlayerProps,
  type SimpleVideoPlayerHandle,
} from './SimpleVideoPlayer';

// Legacy HLS Native Player (iOS Safari only - consider using UniversalHLSPlayer instead)
export { HLSNativePlayer } from './HLSNativePlayer';
