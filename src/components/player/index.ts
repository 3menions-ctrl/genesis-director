/**
 * Universal Video Player - Unified media playback component
 * 
 * This module exports a single player that handles all video playback needs:
 * - Multi-clip stitching with MSE gapless playback
 * - Database-driven clip fetching via projectId
 * - Manifest-based project playback
 * - Fullscreen modal viewing
 * - Thumbnail previews with hover playback
 * - Export/download display
 * 
 * Usage:
 * ```tsx
 * import { UniversalVideoPlayer } from '@/components/player';
 * 
 * // Fetch clips from database by project ID
 * <UniversalVideoPlayer 
 *   source={{ projectId: 'uuid-here' }}
 *   mode="inline"
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
 * 
 * // Export display
 * <UniversalVideoPlayer 
 *   source={{ urls: ['final.mp4'] }}
 *   mode="export"
 *   onDownload={() => downloadVideo()}
 * />
 * ```
 */

export { 
  UniversalVideoPlayer, 
  default,
  type UniversalVideoPlayerProps,
  type PlayerMode,
  type VideoSource,
  type PlayerControls,
} from './UniversalVideoPlayer';
