/**
 * useTimelineOnlyLayout
 * 
 * Replaces the SDK canvas with a native <video> player element and
 * forces the timeline to permanently occupy more space.
 * Polls the DOM because the SDK re-renders frequently.
 */

import { useEffect, useRef } from 'react';

export function useTimelineOnlyLayout(containerSelector = '.apex-timeline-only') {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoInserted = useRef(false);

  useEffect(() => {
    function apply(): boolean {
      const container = document.querySelector(containerSelector) as HTMLElement;
      if (!container) return false;

      // Force container to fill
      container.style.setProperty('height', '100%', 'important');
      container.style.setProperty('overflow', 'hidden', 'important');

      const main = container.querySelector('main') as HTMLElement;
      if (!main) return false;

      main.style.setProperty('height', '100%', 'important');
      main.style.setProperty('max-height', '100%', 'important');
      main.style.setProperty('min-height', '0', 'important');
      main.style.setProperty('overflow', 'hidden', 'important');

      const canvas = main.querySelector('canvas') as HTMLCanvasElement;
      if (!canvas) return false;

      const contentDiv = canvas.parentElement as HTMLElement;
      if (!contentDiv) return false;

      const scrollDiv = contentDiv.parentElement as HTMLElement;
      if (scrollDiv && scrollDiv !== main) {
        scrollDiv.removeAttribute('data-scrollable');
        scrollDiv.style.setProperty('overflow', 'hidden', 'important');
        scrollDiv.style.setProperty('height', '100%', 'important');
        scrollDiv.style.setProperty('max-height', '100%', 'important');
      }

      // Hide the original canvas
      canvas.style.setProperty('display', 'none', 'important');
      canvas.style.setProperty('width', '0', 'important');
      canvas.style.setProperty('height', '0', 'important');
      canvas.style.setProperty('position', 'absolute', 'important');

      // Override canvas HTML attributes to prevent it from taking space
      canvas.width = 1;
      canvas.height = 1;

      // Insert a native video player in place of the canvas
      if (!videoInserted.current) {
        const playerDiv = document.createElement('div');
        playerDiv.id = 'apex-native-player';
        playerDiv.style.cssText = `
          width: 100%;
          background: hsl(240, 28%, 4%);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
        `;

        const video = document.createElement('video');
        video.id = 'apex-player-video';
        video.style.cssText = `
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        `;
        video.muted = true;
        video.playsInline = true;
        video.controls = true;

        const emptyState = document.createElement('div');
        emptyState.id = 'apex-player-empty';
        emptyState.style.cssText = `
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: hsla(240, 5%, 55%, 0.4);
          font-size: 12px;
          gap: 8px;
          user-select: none;
        `;
        emptyState.innerHTML = `
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          <span>Drag clips to the timeline to preview</span>
        `;

        playerDiv.appendChild(emptyState);
        playerDiv.appendChild(video);
        video.style.display = 'none';

        // Insert before the canvas
        contentDiv.insertBefore(playerDiv, canvas);
        videoInserted.current = true;
      }

      // Layout: use grid — player gets 35%, rest gets remaining
      contentDiv.style.setProperty('display', 'grid', 'important');
      contentDiv.style.setProperty('height', '100%', 'important');
      contentDiv.style.setProperty('max-height', '100%', 'important');
      contentDiv.style.setProperty('overflow', 'hidden', 'important');

      const children = Array.from(contentDiv.children) as HTMLElement[];
      const rows = children.map((child) => {
        if (child === canvas) return '0px'; // hidden canvas
        if (child.id === 'apex-native-player') return '35%';
        return 'minmax(40px, 1fr)';
      }).join(' ');
      contentDiv.style.setProperty('grid-template-rows', rows, 'important');
      contentDiv.style.setProperty('grid-template-columns', '1fr', 'important');

      // Make timeline siblings scrollable
      for (const child of children) {
        if (child === canvas || child.id === 'apex-native-player') continue;
        child.style.setProperty('overflow-y', 'auto', 'important');
        child.style.setProperty('overflow-x', 'hidden', 'important');
        child.style.setProperty('min-height', '0', 'important');
      }

      return true;
    }

    apply();
    intervalRef.current = setInterval(apply, 200);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      // Clean up inserted player
      const player = document.getElementById('apex-native-player');
      if (player) player.remove();
      videoInserted.current = false;
    };
  }, [containerSelector]);
}

/**
 * Utility: Set the video source on the native player from outside.
 * Call this when timeline playhead changes or clip selection changes.
 */
export function setNativePlayerSrc(src: string | null) {
  const video = document.getElementById('apex-player-video') as HTMLVideoElement;
  const empty = document.getElementById('apex-player-empty') as HTMLElement;
  if (!video) return;
  
  if (src) {
    video.src = src;
    video.style.display = 'block';
    if (empty) empty.style.display = 'none';
  } else {
    video.removeAttribute('src');
    video.style.display = 'none';
    if (empty) empty.style.display = 'flex';
  }
}
