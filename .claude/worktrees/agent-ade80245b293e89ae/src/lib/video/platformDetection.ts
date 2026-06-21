/**
 * Platform Detection Utilities for Video Playback
 * 
 * Provides reliable detection of browser capabilities to select
 * the optimal video playback strategy:
 * - MSE (MediaSource Extensions) for Chromium browsers
 * - Native HLS for iOS Safari
 * - Legacy fallback for older browsers
 */

export interface PlatformCapabilities {
  isIOSSafari: boolean;
  isSafari: boolean;
  safariVersion: number;
  supportsMSE: boolean;
  supportsNativeHLS: boolean;
  preferredPlaybackMode: 'mse' | 'hls_native' | 'legacy';
  userAgent: string;
}

/**
 * Detect platform capabilities for optimal video playback selection
 */
export function detectPlatformCapabilities(): PlatformCapabilities {
  const ua = navigator.userAgent;
  
  // iOS Safari detection (iPhone, iPad, iPod)
  const isIOSSafari = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  
  // Safari desktop detection
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  const safariVersion = isSafari ? parseInt(ua.match(/Version\/(\d+)/)?.[1] || '0', 10) : 0;
  
  // MSE support detection
  let supportsMSE = false;
  try {
    supportsMSE = typeof MediaSource !== 'undefined' && 
      typeof MediaSource.isTypeSupported === 'function' &&
      !isIOSSafari &&
      !(isSafari && safariVersion < 15);
  } catch {
    supportsMSE = false;
  }
  
  // Native HLS support (Safari can play HLS natively)
  const supportsNativeHLS = isSafari || isIOSSafari || 
    // Check for HLS.js compatibility in non-Safari browsers
    (typeof MediaSource !== 'undefined' && 
     MediaSource.isTypeSupported?.('video/mp4; codecs="avc1.42E01E,mp4a.40.2"'));
  
  // Determine preferred playback mode
  let preferredPlaybackMode: 'mse' | 'hls_native' | 'legacy';
  
  if (isIOSSafari) {
    // iOS Safari: MUST use native HLS - MSE is unreliable/unsupported
    preferredPlaybackMode = 'hls_native';
  } else if (supportsMSE) {
    // Desktop Chrome/Firefox/Edge: Use MSE for gapless playback
    preferredPlaybackMode = 'mse';
  } else if (supportsNativeHLS) {
    // Safari desktop: Can use HLS
    preferredPlaybackMode = 'hls_native';
  } else {
    // Fallback for older browsers
    preferredPlaybackMode = 'legacy';
  }
  
  console.log(`[PlatformDetection] Capabilities:`, {
    isIOSSafari,
    isSafari,
    safariVersion,
    supportsMSE,
    supportsNativeHLS,
    preferredPlaybackMode,
  });
  
  return {
    isIOSSafari,
    isSafari,
    safariVersion,
    supportsMSE,
    supportsNativeHLS,
    preferredPlaybackMode,
    userAgent: ua,
  };
}

// Singleton cached result
let cachedCapabilities: PlatformCapabilities | null = null;

export function getPlatformCapabilities(): PlatformCapabilities {
  if (!cachedCapabilities) {
    cachedCapabilities = detectPlatformCapabilities();
  }
  return cachedCapabilities;
}

/**
 * Check if the current platform requires HLS for seamless playback
 */
export function requiresHLSPlayback(): boolean {
  const caps = getPlatformCapabilities();
  return caps.preferredPlaybackMode === 'hls_native';
}

/**
 * Check if MSE is available and preferred
 */
export function prefersMSEPlayback(): boolean {
  const caps = getPlatformCapabilities();
  return caps.preferredPlaybackMode === 'mse';
}

/**
 * Log playback path selection for debugging
 */
export function logPlaybackPath(path: string, details?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  console.log(`[PlaybackPath ${timestamp}] Active: ${path}`, details || {});
}
