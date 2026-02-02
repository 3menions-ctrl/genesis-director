/**
 * Cross-Browser Compatibility Layer
 * 
 * Provides polyfills, feature detection, and fallbacks for
 * Safari, Firefox, older Chrome, Edge, and mobile browsers.
 */

// ============= FEATURE DETECTION =============

export const browserFeatures = {
  // Check for backdrop-filter support (Safari needs -webkit prefix)
  backdropFilter: (() => {
    if (typeof CSS === 'undefined') return false;
    return CSS.supports('backdrop-filter', 'blur(1px)') || 
           CSS.supports('-webkit-backdrop-filter', 'blur(1px)');
  })(),

  // Check for CSS Grid support
  cssGrid: (() => {
    if (typeof CSS === 'undefined') return false;
    return CSS.supports('display', 'grid');
  })(),

  // Check for CSS Flexbox Gap support
  flexGap: (() => {
    if (typeof CSS === 'undefined') return false;
    return CSS.supports('gap', '1px');
  })(),

  // Check for IntersectionObserver
  intersectionObserver: typeof IntersectionObserver !== 'undefined',

  // Check for ResizeObserver
  resizeObserver: typeof ResizeObserver !== 'undefined',

  // Check for MediaSource Extensions
  mse: (() => {
    if (typeof window === 'undefined') return false;
    return 'MediaSource' in window && 
           typeof MediaSource.isTypeSupported === 'function';
  })(),

  // Check for Web Animations API
  webAnimations: typeof Element !== 'undefined' && 'animate' in Element.prototype,

  // Check for requestIdleCallback
  requestIdleCallback: typeof requestIdleCallback !== 'undefined',

  // Check for touch support
  touch: (() => {
    if (typeof window === 'undefined') return false;
    return 'ontouchstart' in window || 
           navigator.maxTouchPoints > 0;
  })(),

  // Check for pointer events
  pointerEvents: typeof PointerEvent !== 'undefined',

  // Check for scroll behavior smooth
  smoothScroll: (() => {
    if (typeof CSS === 'undefined') return false;
    return CSS.supports('scroll-behavior', 'smooth');
  })(),

  // Check for aspect-ratio CSS property
  aspectRatio: (() => {
    if (typeof CSS === 'undefined') return false;
    return CSS.supports('aspect-ratio', '1/1');
  })(),

  // Check for :has() selector support
  hasSelector: (() => {
    if (typeof CSS === 'undefined') return false;
    try {
      return CSS.supports('selector(:has(*))');
    } catch {
      return false;
    }
  })(),

  // Check for container queries
  containerQueries: (() => {
    if (typeof CSS === 'undefined') return false;
    return CSS.supports('container-type', 'inline-size');
  })(),
};

// ============= BROWSER DETECTION =============

export const browserInfo = (() => {
  if (typeof navigator === 'undefined') {
    return { name: 'unknown', version: 0, isMobile: false, isIOS: false, isSafari: false };
  }

  const ua = navigator.userAgent;
  const isMobile = /Mobile|Android|iPhone|iPad|iPod/.test(ua);
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  const isFirefox = /Firefox/.test(ua);
  const isChrome = /Chrome/.test(ua) && !/Edge|Edg/.test(ua);
  const isEdge = /Edge|Edg/.test(ua);

  let name = 'unknown';
  let version = 0;

  if (isSafari) {
    name = 'safari';
    const match = ua.match(/Version\/(\d+)/);
    version = match ? parseInt(match[1], 10) : 0;
  } else if (isFirefox) {
    name = 'firefox';
    const match = ua.match(/Firefox\/(\d+)/);
    version = match ? parseInt(match[1], 10) : 0;
  } else if (isEdge) {
    name = 'edge';
    const match = ua.match(/(?:Edge|Edg)\/(\d+)/);
    version = match ? parseInt(match[1], 10) : 0;
  } else if (isChrome) {
    name = 'chrome';
    const match = ua.match(/Chrome\/(\d+)/);
    version = match ? parseInt(match[1], 10) : 0;
  }

  return { name, version, isMobile, isIOS, isSafari, isFirefox, isChrome, isEdge };
})();

// ============= POLYFILLS =============

/**
 * RequestIdleCallback polyfill for Safari
 */
export const safeRequestIdleCallback = (
  callback: IdleRequestCallback,
  options?: IdleRequestOptions
): number => {
  if (typeof requestIdleCallback !== 'undefined') {
    return requestIdleCallback(callback, options);
  }
  // Fallback for Safari - use setTimeout with low priority
  const start = Date.now();
  return window.setTimeout(() => {
    callback({
      didTimeout: false,
      timeRemaining: () => Math.max(0, 50 - (Date.now() - start)),
    });
  }, 1) as unknown as number;
};

/**
 * CancelIdleCallback polyfill
 */
export const safeCancelIdleCallback = (handle: number): void => {
  if (typeof cancelIdleCallback !== 'undefined') {
    cancelIdleCallback(handle);
  } else {
    clearTimeout(handle);
  }
};

/**
 * Smooth scroll polyfill for Safari
 */
export const smoothScrollTo = (
  element: HTMLElement | Window,
  options: ScrollToOptions
): void => {
  if (browserFeatures.smoothScroll) {
    element.scrollTo(options);
  } else {
    // Fallback for Safari < 15.4
    const target = options.top ?? 0;
    const start = element === window 
      ? window.scrollY 
      : (element as HTMLElement).scrollTop;
    const distance = target - start;
    const duration = 300;
    let startTime: number | null = null;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out quad
      const eased = 1 - (1 - progress) * (1 - progress);
      
      if (element === window) {
        window.scrollTo(0, start + distance * eased);
      } else {
        (element as HTMLElement).scrollTop = start + distance * eased;
      }

      if (elapsed < duration) {
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
  }
};

/**
 * IntersectionObserver with fallback
 */
export const createSafeIntersectionObserver = (
  callback: IntersectionObserverCallback,
  options?: IntersectionObserverInit
): IntersectionObserver | null => {
  if (!browserFeatures.intersectionObserver) {
    console.warn('[BrowserCompat] IntersectionObserver not supported, elements will be treated as visible');
    return null;
  }
  return new IntersectionObserver(callback, options);
};

/**
 * ResizeObserver with fallback
 */
export const createSafeResizeObserver = (
  callback: ResizeObserverCallback
): ResizeObserver | null => {
  if (!browserFeatures.resizeObserver) {
    console.warn('[BrowserCompat] ResizeObserver not supported');
    return null;
  }
  return new ResizeObserver(callback);
};

// ============= CSS INJECTION FOR BROWSER FIXES =============

/**
 * Inject browser-specific CSS fixes
 */
export const injectBrowserFixes = (): void => {
  if (typeof document === 'undefined') return;

  const styleId = 'browser-compat-fixes';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  
  const fixes: string[] = [];

  // Safari backdrop-filter fix
  if (browserInfo.isSafari) {
    fixes.push(`
      /* Safari backdrop-filter hardware acceleration */
      .backdrop-blur-xl, .backdrop-blur-lg, .backdrop-blur-md, .backdrop-blur-sm {
        -webkit-transform: translate3d(0, 0, 0);
        transform: translate3d(0, 0, 0);
      }
      
      /* Safari overflow scroll fix */
      .overflow-auto, .overflow-scroll, .overflow-y-auto, .overflow-x-auto {
        -webkit-overflow-scrolling: touch;
      }
      
      /* Safari 100vh fix */
      .min-h-screen, .h-screen {
        min-height: -webkit-fill-available;
      }
      
      /* SAFARI CRASH FIX: Prevent video element crashes */
      video {
        -webkit-transform: translateZ(0);
        transform: translateZ(0);
        -webkit-backface-visibility: hidden;
        backface-visibility: hidden;
      }
      
      /* SAFARI CRASH FIX: Prevent animation memory leaks */
      @keyframes safari-safe-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
      .animate-pulse {
        animation: safari-safe-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
      }
      
      /* SAFARI CRASH FIX: Force compositing layers */
      .fixed, .sticky, .absolute {
        -webkit-transform: translateZ(0);
        transform: translateZ(0);
      }
    `);
  }

  // iOS Safari specific fixes
  if (browserInfo.isIOS) {
    fixes.push(`
      /* iOS input zoom prevention */
      input, select, textarea {
        font-size: 16px !important;
      }
      
      /* iOS safe area padding */
      .safe-area-bottom {
        padding-bottom: env(safe-area-inset-bottom, 0);
      }
      
      .safe-area-top {
        padding-top: env(safe-area-inset-top, 0);
      }
      
      /* iOS position fixed fix */
      .fixed {
        -webkit-transform: translateZ(0);
        transform: translateZ(0);
      }
    `);
  }

  // Firefox specific fixes
  if (browserInfo.isFirefox) {
    fixes.push(`
      /* Firefox scrollbar styling */
      * {
        scrollbar-width: thin;
        scrollbar-color: hsl(30 15% 50%) transparent;
      }
      
      /* Firefox focus-visible fix */
      *:focus:not(:focus-visible) {
        outline: none;
      }
    `);
  }

  // Add backdrop-filter fallback
  if (!browserFeatures.backdropFilter) {
    fixes.push(`
      /* Fallback for browsers without backdrop-filter */
      .backdrop-blur-xl, .backdrop-blur-lg, .backdrop-blur-md, .backdrop-blur-sm,
      .glass-card, .glass-card-dark, .glass-panel {
        background-color: rgba(10, 10, 10, 0.95) !important;
      }
    `);
  }

  // Add aspect-ratio fallback
  if (!browserFeatures.aspectRatio) {
    fixes.push(`
      /* Aspect ratio fallback using padding-bottom hack */
      .aspect-video::before {
        content: "";
        display: block;
        padding-bottom: 56.25%;
      }
      
      .aspect-square::before {
        content: "";
        display: block;
        padding-bottom: 100%;
      }
      
      .aspect-\\[2\\/3\\]::before {
        content: "";
        display: block;
        padding-bottom: 150%;
      }
    `);
  }

  // Universal touch device improvements
  if (browserFeatures.touch) {
    fixes.push(`
      /* Prevent 300ms tap delay */
      html {
        touch-action: manipulation;
      }
      
      /* Remove tap highlight on touch devices */
      * {
        -webkit-tap-highlight-color: transparent;
      }
      
      /* Larger touch targets */
      button, [role="button"], a {
        min-height: 44px;
        min-width: 44px;
      }
    `);
  }

  // GPU acceleration hints for animations
  fixes.push(`
    /* GPU acceleration for animated elements */
    .animate-fade-in, .animate-scale-in, .animate-slide-up,
    .transition-transform, .transition-all, .transition-opacity {
      will-change: transform, opacity;
      -webkit-backface-visibility: hidden;
      backface-visibility: hidden;
    }
    
    /* Optimize text rendering */
    body {
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
    }
    
    /* Prevent layout shift from scrollbar */
    html {
      scrollbar-gutter: stable;
    }
  `);

  style.textContent = fixes.join('\n');
  document.head.appendChild(style);
};

// ============= MEDIA QUERY HELPERS =============

/**
 * Check if prefers-reduced-motion is enabled
 */
export const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/**
 * Check if high contrast mode is enabled
 */
export const prefersHighContrast = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-contrast: high)').matches;
};

/**
 * Get the current color scheme preference
 */
export const getColorSchemePreference = (): 'light' | 'dark' | 'no-preference' => {
  if (typeof window === 'undefined') return 'no-preference';
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
  return 'no-preference';
};

// ============= PERFORMANCE HELPERS =============

/**
 * Safe requestAnimationFrame with fallback
 */
export const safeRAF = (callback: FrameRequestCallback): number => {
  if (typeof requestAnimationFrame !== 'undefined') {
    return requestAnimationFrame(callback);
  }
  return window.setTimeout(callback, 16) as unknown as number;
};

/**
 * Safe cancelAnimationFrame with fallback
 */
export const safeCancelRAF = (handle: number): void => {
  if (typeof cancelAnimationFrame !== 'undefined') {
    cancelAnimationFrame(handle);
  } else {
    clearTimeout(handle);
  }
};

/**
 * Debounced ResizeObserver for performance
 */
export const createDebouncedResizeObserver = (
  callback: ResizeObserverCallback,
  delay = 100
): ResizeObserver | null => {
  if (!browserFeatures.resizeObserver) return null;
  
  let timeoutId: ReturnType<typeof setTimeout>;
  
  return new ResizeObserver((entries, observer) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => callback(entries, observer), delay);
  });
};

// Auto-inject browser fixes on module load
if (typeof window !== 'undefined') {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectBrowserFixes);
  } else {
    injectBrowserFixes();
  }
}

export default {
  browserFeatures,
  browserInfo,
  safeRequestIdleCallback,
  safeCancelIdleCallback,
  smoothScrollTo,
  createSafeIntersectionObserver,
  createSafeResizeObserver,
  prefersReducedMotion,
  prefersHighContrast,
  getColorSchemePreference,
  safeRAF,
  safeCancelRAF,
  createDebouncedResizeObserver,
  injectBrowserFixes,
};
