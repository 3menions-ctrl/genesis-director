/**
 * useStudioLayoutFix
 * 
 * Forces the Twick SDK's internal layout to show the timeline prominently.
 * SDK structure: main > div (scrollable) > div (content) > [Canvas, div (timeline)]
 * This hook converts the scrollable wrapper to a constrained flex layout.
 */

import { useEffect, useRef } from 'react';

export function useStudioLayoutFix(containerSelector = '.studio-container') {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let applied = false;

    function applyLayoutFix(): boolean {
      const container = document.querySelector(containerSelector);
      if (!container) return false;

      const main = container.querySelector('main');
      if (!main) return false;

      // Force main to fill container
      main.style.setProperty('height', '100%', 'important');
      main.style.setProperty('overflow', 'hidden', 'important');

      // Find the <canvas> element — it's the SDK's preview
      const canvas = main.querySelector('canvas');
      if (!canvas) return false;

      // Walk up from canvas to find the content structure
      // canvas is inside: main > scrollDiv > contentDiv > canvas
      const contentDiv = canvas.parentElement;
      if (!contentDiv) return false;
      
      const scrollDiv = contentDiv.parentElement;
      if (!scrollDiv || scrollDiv === main) {
        // canvas is directly in main's child — simpler structure
        // main > contentDiv > [canvas, timeline]
        contentDiv.style.setProperty('height', '100%', 'important');
        contentDiv.style.setProperty('display', 'flex', 'important');
        contentDiv.style.setProperty('flex-direction', 'column', 'important');
        contentDiv.style.setProperty('overflow', 'hidden', 'important');
      } else {
        // main > scrollDiv > contentDiv > [canvas, timeline]
        scrollDiv.style.setProperty('height', '100%', 'important');
        scrollDiv.style.setProperty('max-height', '100%', 'important');
        scrollDiv.style.setProperty('overflow', 'hidden', 'important');
        scrollDiv.style.setProperty('display', 'flex', 'important');
        scrollDiv.style.setProperty('flex-direction', 'column', 'important');

        contentDiv.style.setProperty('flex', '1', 'important');
        contentDiv.style.setProperty('height', '100%', 'important');
        contentDiv.style.setProperty('display', 'flex', 'important');
        contentDiv.style.setProperty('flex-direction', 'column', 'important');
        contentDiv.style.setProperty('overflow', 'hidden', 'important');
      }

      // Constrain the canvas — use pixel-based height since canvas elements
      // don't respect percentage max-height well due to intrinsic dimensions
      const availableHeight = main.getBoundingClientRect().height;
      const canvasMaxHeight = Math.floor(availableHeight * 0.55);
      canvas.style.setProperty('flex', '0 1 auto', 'important');
      canvas.style.setProperty('max-height', `${canvasMaxHeight}px`, 'important');
      canvas.style.setProperty('min-height', '60px', 'important');
      canvas.style.setProperty('width', '100%', 'important');
      canvas.style.setProperty('object-fit', 'contain', 'important');

      // Find sibling elements of canvas (timeline section)
      const siblings = Array.from(contentDiv.children) as HTMLElement[];
      let hasTimeline = false;
      
      for (const sibling of siblings) {
        if (sibling === canvas) continue;
        
        // This is the timeline/controls section
        sibling.style.setProperty('flex', '1 1 auto', 'important');
        sibling.style.setProperty('min-height', '200px', 'important');
        sibling.style.setProperty('overflow-y', 'auto', 'important');
        sibling.style.setProperty('overflow-x', 'hidden', 'important');
        sibling.style.setProperty('border-top', '2px solid hsla(263, 84%, 58%, 0.25)', 'important');
        sibling.style.setProperty('background', 'hsl(240, 20%, 6%)', 'important');
        hasTimeline = true;
      }

      return hasTimeline;
    }

    // Poll to apply and re-apply
    intervalRef.current = setInterval(() => {
      const result = applyLayoutFix();
      if (result && !applied) {
        applied = true;
        console.log('[StudioLayoutFix] Timeline layout enforced — canvas 50%, timeline 50%');
      }
    }, 300);

    applyLayoutFix();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [containerSelector]);
}
