/**
 * useStudioLayoutFix
 * 
 * Forces the Twick SDK's internal layout to show the timeline prominently.
 * SDK structure: main > div[scrollable] > div[content] > [Canvas, div(controls), div(timeline)]
 * 
 * The SDK sets canvas.width and canvas.height HTML attributes to large values 
 * (e.g., 720x1280 for portrait), which creates intrinsic sizing that CSS can't 
 * easily override. This hook directly modifies those attributes AND applies CSS.
 */

import { useEffect, useRef } from 'react';

export function useStudioLayoutFix(containerSelector = '.studio-container') {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let logged = false;

    function applyLayoutFix(): boolean {
      const container = document.querySelector(containerSelector) as HTMLElement;
      if (!container) return false;

      // Force container to fill its parent without scrolling
      container.style.setProperty('height', '100%', 'important');
      container.style.setProperty('max-height', '100vh', 'important');
      container.style.setProperty('overflow', 'hidden', 'important');

      const main = container.querySelector('main') as HTMLElement;
      if (!main) return false;

      // Override SDK's 80dvh
      main.style.setProperty('height', '100%', 'important');
      main.style.setProperty('max-height', '100%', 'important');
      main.style.setProperty('min-height', '0', 'important');
      main.style.setProperty('overflow', 'hidden', 'important');

      const canvas = main.querySelector('canvas') as HTMLCanvasElement;
      if (!canvas) return false;

      const contentDiv = canvas.parentElement as HTMLElement;
      if (!contentDiv) return false;
      
      const scrollDiv = contentDiv.parentElement as HTMLElement;
      if (!scrollDiv || scrollDiv === main) return false;

      // Kill scroll on the scrollDiv entirely
      scrollDiv.removeAttribute('data-scrollable');
      scrollDiv.style.setProperty('overflow', 'hidden', 'important');
      scrollDiv.style.setProperty('height', '100%', 'important');
      scrollDiv.style.setProperty('max-height', '100%', 'important');
      scrollDiv.style.setProperty('min-height', '0', 'important');

      // contentDiv — use grid for reliable proportional layout
      contentDiv.style.setProperty('height', '100%', 'important');
      contentDiv.style.setProperty('max-height', '100%', 'important');
      contentDiv.style.setProperty('min-height', '0', 'important');
      contentDiv.style.setProperty('overflow', 'hidden', 'important');
      contentDiv.style.setProperty('display', 'grid', 'important');
      
      // Count children to build grid template
      const children = Array.from(contentDiv.children) as HTMLElement[];
      const canvasIndex = children.indexOf(canvas);
      
      // Build grid-template-rows: canvas gets 35%, everything else shares remaining
      const otherCount = children.length - 1;
      if (otherCount <= 0) return false;
      
      const rows = children.map((child) => {
        if (child === canvas) return '35%';
        return `minmax(40px, 1fr)`;
      }).join(' ');
      contentDiv.style.setProperty('grid-template-rows', rows, 'important');
      contentDiv.style.setProperty('grid-template-columns', '1fr', 'important');

      // Canvas: force it to fit within its grid cell
      canvas.style.setProperty('width', '100%', 'important');
      canvas.style.setProperty('height', '100%', 'important');
      canvas.style.setProperty('max-height', '100%', 'important');
      canvas.style.setProperty('object-fit', 'contain', 'important');
      canvas.style.setProperty('display', 'block', 'important');
      canvas.style.setProperty('overflow', 'hidden', 'important');

      // Timeline siblings — make them scrollable
      for (const child of children) {
        if (child === canvas) continue;
        child.style.setProperty('overflow-y', 'auto', 'important');
        child.style.setProperty('overflow-x', 'hidden', 'important');
        child.style.setProperty('min-height', '0', 'important');
      }

      return true;
    }

    intervalRef.current = setInterval(() => {
      const result = applyLayoutFix();
      if (result && !logged) {
        logged = true;
        console.log('[StudioLayoutFix] Grid layout enforced — canvas 35%, timeline 65%');
      }
    }, 150);

    applyLayoutFix();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [containerSelector]);
}
