/**
 * useGaplessPlayback - Rock-solid dual-video A/B slot gapless playback engine
 * 
 * Architecture:
 * - Two <video> elements (slot A / slot B) alternate as active/standby
 * - Standby slot eagerly preloads the NEXT clip as soon as the active clip starts
 * - Transition happens atomically: standby starts playing, active pauses
 * - canplaythrough (not canplay) ensures buffer is deep enough for gapless swap
 * - Clip boundary detection uses both RAF polling AND video 'ended' event as dual trigger
 * - All source URLs are aggressively cached via preload on timeline change
 */

import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import type { TimelineTrack, TimelineClip } from './types';

interface GaplessPlaybackState {
  activeSlot: 'A' | 'B';
  activeClip: TimelineClip | null;
  videoReady: boolean;
}

interface GaplessPlaybackReturn extends GaplessPlaybackState {
  videoARef: React.RefObject<HTMLVideoElement>;
  videoBRef: React.RefObject<HTMLVideoElement>;
  sortedVideoClips: TimelineClip[];
  activeTextClips: TimelineClip[];
}

// How early (seconds) to begin preloading the next clip into the standby slot
const PRELOAD_AHEAD_SEC = 2.0;
// Tolerance for clip-end detection in RAF loop
const END_TOLERANCE_SEC = 0.08;

export function useGaplessPlayback(
  tracks: TimelineTrack[],
  currentTime: number,
  isPlaying: boolean,
  duration: number,
  playbackSpeed: number,
  volume: number,
  isMuted: boolean,
  isLooping: boolean,
  onTimeChange: (time: number) => void,
  onPlayPause: () => void,
): GaplessPlaybackReturn {
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number>(0);

  // Mutable refs for hot-path performance (RAF loop reads these without re-renders)
  const activeSlotRef = useRef<'A' | 'B'>('A');
  const activeClipIdRef = useRef<string | null>(null);
  const preloadedClipIdRef = useRef<string | null>(null);
  const isSyncingRef = useRef(false);
  const isLoopingRef = useRef(isLooping);
  const isPlayingRef = useRef(isPlaying);
  const currentTimeRef = useRef(currentTime);

  // React state for UI rendering
  const [activeSlot, setActiveSlot] = useState<'A' | 'B'>('A');
  const [videoReady, setVideoReady] = useState(false);

  // Keep refs in sync
  isLoopingRef.current = isLooping;
  isPlayingRef.current = isPlaying;
  currentTimeRef.current = currentTime;

  // ── Derived clip data ──
  const sortedVideoClips = useMemo(() => {
    return tracks
      .filter((t) => t.type === 'video')
      .flatMap((t) => t.clips)
      .sort((a, b) => a.start - b.start);
  }, [tracks]);

  const activeClip = useMemo(() => {
    return sortedVideoClips.find((c) => currentTime >= c.start && currentTime < c.end) || null;
  }, [sortedVideoClips, currentTime]);

  const nextClip = useMemo(() => {
    if (!activeClip) return null;
    return sortedVideoClips.find((c) => c.start >= activeClip.end - 0.01) || null;
  }, [sortedVideoClips, activeClip]);

  const activeTextClips = useMemo(() => {
    return tracks
      .filter((t) => t.type === 'text')
      .flatMap((t) => t.clips)
      .filter((c) => currentTime >= c.start && currentTime < c.end);
  }, [tracks, currentTime]);

  // ── Helpers ──
  const getSlotVideo = useCallback((slot: 'A' | 'B') => {
    return slot === 'A' ? videoARef.current : videoBRef.current;
  }, []);

  const getActiveVideo = useCallback(() => getSlotVideo(activeSlotRef.current), [getSlotVideo]);
  const getStandbyVideo = useCallback(() => getSlotVideo(activeSlotRef.current === 'A' ? 'B' : 'A'), [getSlotVideo]);

  const safePlay = useCallback((video: HTMLVideoElement) => {
    if (video.readyState >= 2) {
      video.play().catch(() => {});
    } else {
      const handler = () => {
        video.play().catch(() => {});
        video.removeEventListener('canplay', handler);
      };
      video.addEventListener('canplay', handler);
    }
  }, []);

  // ── Atomic slot swap ──
  const swapToStandby = useCallback(() => {
    const newSlot = activeSlotRef.current === 'A' ? 'B' : 'A';
    const newVideo = getSlotVideo(newSlot);
    const oldVideo = getSlotVideo(activeSlotRef.current);

    activeSlotRef.current = newSlot;
    setActiveSlot(newSlot);
    preloadedClipIdRef.current = null;

    if (newVideo && isPlayingRef.current) {
      safePlay(newVideo);
    }
    if (oldVideo && !oldVideo.paused) {
      oldVideo.pause();
    }

    setVideoReady(true);
    isSyncingRef.current = false;
  }, [getSlotVideo, safePlay]);

  // ── Preload next clip into standby slot ──
  const preloadNextClip = useCallback((clip: TimelineClip) => {
    if (preloadedClipIdRef.current === clip.id) return;
    const standby = getStandbyVideo();
    if (!standby) return;

    preloadedClipIdRef.current = clip.id;
    standby.src = clip.sourceUrl;
    standby.preload = 'auto';
    standby.load();

    // Seek to trim start once enough is buffered
    const onReady = () => {
      standby.currentTime = clip.trimStart || 0;
      standby.removeEventListener('canplaythrough', onReady);
    };
    standby.addEventListener('canplaythrough', onReady);
  }, [getStandbyVideo]);

  // ── Eagerly preload next clip as soon as active clip is identified ──
  useEffect(() => {
    if (nextClip && activeClip) {
      const timeToEnd = activeClip.end - currentTime;
      // Preload immediately if within threshold, or if clip just started
      if (timeToEnd <= PRELOAD_AHEAD_SEC || timeToEnd >= (activeClip.end - activeClip.start) - 0.1) {
        preloadNextClip(nextClip);
      }
    }
  }, [nextClip?.id, activeClip?.id, currentTime, preloadNextClip]);

  // ── Source switching: load active clip into active slot ──
  useEffect(() => {
    const video = getActiveVideo();
    if (!video) return;

    if (!activeClip) {
      if (!video.paused) video.pause();
      activeClipIdRef.current = null;
      setVideoReady(false);
      return;
    }

    if (activeClipIdRef.current === activeClip.id) {
      // Same clip — just seek if paused and drifted
      const clipLocalTime = currentTime - activeClip.start + (activeClip.trimStart || 0);
      if (!isPlaying && Math.abs(video.currentTime - clipLocalTime) > 0.15) {
        video.currentTime = clipLocalTime;
      }
      return;
    }

    // New clip transition
    activeClipIdRef.current = activeClip.id;
    isSyncingRef.current = true;

    // FAST PATH: standby already has this clip preloaded → atomic swap
    if (preloadedClipIdRef.current === activeClip.id) {
      const standby = getStandbyVideo();
      if (standby) {
        const clipLocalTime = currentTime - activeClip.start + (activeClip.trimStart || 0);
        standby.currentTime = clipLocalTime;
        swapToStandby();
        // Immediately start preloading the NEXT next clip
        if (nextClip) preloadNextClip(nextClip);
        return;
      }
    }

    // SLOW PATH: cold load into current active slot
    const clipLocalTime = currentTime - activeClip.start + (activeClip.trimStart || 0);
    video.src = activeClip.sourceUrl;
    video.preload = 'auto';
    video.load();

    const onReady = () => {
      video.currentTime = clipLocalTime;
      setVideoReady(true);
      if (isPlayingRef.current) safePlay(video);
      isSyncingRef.current = false;
      video.removeEventListener('canplaythrough', onReady);
      // Fallback: also listen for canplay in case canplaythrough never fires
      video.removeEventListener('canplay', onFallback);
    };
    const onFallback = () => {
      // canplay fires sooner — use as fallback if canplaythrough is slow
      setTimeout(() => {
        if (isSyncingRef.current) {
          video.currentTime = clipLocalTime;
          setVideoReady(true);
          if (isPlayingRef.current) safePlay(video);
          isSyncingRef.current = false;
        }
      }, 50);
      video.removeEventListener('canplay', onFallback);
    };

    video.addEventListener('canplaythrough', onReady);
    video.addEventListener('canplay', onFallback);

    return () => {
      video.removeEventListener('canplaythrough', onReady);
      video.removeEventListener('canplay', onFallback);
    };
  }, [activeClip?.id, currentTime, isPlaying, getActiveVideo, getStandbyVideo, swapToStandby, nextClip, preloadNextClip, safePlay]);

  // ── Play/Pause sync ──
  useEffect(() => {
    const video = getActiveVideo();
    if (!video || !activeClip || !videoReady) return;
    if (isPlaying && video.paused) safePlay(video);
    else if (!isPlaying && !video.paused) video.pause();
  }, [isPlaying, videoReady, activeClip, getActiveVideo, safePlay]);

  // ── Playback rate ──
  useEffect(() => {
    [videoARef.current, videoBRef.current].forEach((v) => {
      if (v) v.playbackRate = playbackSpeed;
    });
  }, [playbackSpeed]);

  // ── Volume ──
  useEffect(() => {
    [videoARef.current, videoBRef.current].forEach((v) => {
      if (!v) return;
      v.muted = isMuted;
      v.volume = volume / 100;
    });
  }, [volume, isMuted]);

  // ── RAF Playback Loop — clip boundary detection + time sync ──
  useEffect(() => {
    if (!isPlaying) {
      cancelAnimationFrame(rafRef.current);
      return;
    }

    const tick = () => {
      const video = getActiveVideo();
      const clip = activeClip;

      if (!video || isSyncingRef.current || !clip) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      // Sync editor time from video position
      const clipStart = clip.start;
      const trimStart = clip.trimStart || 0;
      const editorTime = clipStart + video.currentTime - trimStart;

      if (Math.abs(editorTime - currentTimeRef.current) > 0.03) {
        onTimeChange(Math.min(editorTime, duration));
      }

      // Clip-end boundary detection
      const clipMediaEnd = (clip.end - clip.start) + trimStart;
      const timeRemaining = clipMediaEnd - video.currentTime;

      if (timeRemaining <= END_TOLERANCE_SEC) {
        // Trigger transition to next clip
        const idx = sortedVideoClips.findIndex((c) => c.id === clip.id);
        const next = idx >= 0 ? sortedVideoClips[idx + 1] : null;

        if (next) {
          onTimeChange(next.start);
        } else if (isLoopingRef.current) {
          onTimeChange(0);
        } else {
          onTimeChange(duration);
          onPlayPause();
        }
      } else if (timeRemaining <= PRELOAD_AHEAD_SEC) {
        // Ensure next clip is preloading
        const idx = sortedVideoClips.findIndex((c) => c.id === clip.id);
        const next = idx >= 0 ? sortedVideoClips[idx + 1] : null;
        if (next) preloadNextClip(next);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, activeClip, sortedVideoClips, duration, onTimeChange, onPlayPause, getActiveVideo, preloadNextClip]);

  // ── Dual-trigger: also listen for 'ended' event as backup boundary detection ──
  useEffect(() => {
    const handleEnded = () => {
      if (!activeClip || !isPlayingRef.current) return;
      const idx = sortedVideoClips.findIndex((c) => c.id === activeClip.id);
      const next = idx >= 0 ? sortedVideoClips[idx + 1] : null;
      if (next) {
        onTimeChange(next.start);
      } else if (isLoopingRef.current) {
        onTimeChange(0);
      } else {
        onTimeChange(duration);
        onPlayPause();
      }
    };

    const vA = videoARef.current;
    const vB = videoBRef.current;
    vA?.addEventListener('ended', handleEnded);
    vB?.addEventListener('ended', handleEnded);

    return () => {
      vA?.removeEventListener('ended', handleEnded);
      vB?.removeEventListener('ended', handleEnded);
    };
  }, [activeClip, sortedVideoClips, duration, onTimeChange, onPlayPause]);

  return {
    videoARef: videoARef as React.RefObject<HTMLVideoElement>,
    videoBRef: videoBRef as React.RefObject<HTMLVideoElement>,
    activeSlot,
    activeClip,
    videoReady,
    sortedVideoClips,
    activeTextClips,
  };
}
