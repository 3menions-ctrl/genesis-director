import { useState, useEffect, useCallback, useRef } from 'react';
import type { EngineState, BehaviorEvent, WidgetConfig, WidgetScene, WidgetTriggers } from '@/types/widget';

interface BehaviorEngineOptions {
  config: WidgetConfig | null;
  onSceneChange: (scene: WidgetScene | null) => void;
  onEvent: (event: BehaviorEvent) => void;
  enabled?: boolean;
}

const SENSITIVITY_MAP = {
  low: { debounce: 1000, idleMultiplier: 1.5 },
  medium: { debounce: 500, idleMultiplier: 1.0 },
  high: { debounce: 200, idleMultiplier: 0.7 },
} as const;

export function useWidgetBehaviorEngine({ config, onSceneChange, onEvent, enabled = true }: BehaviorEngineOptions) {
  const [state, setState] = useState<EngineState>('BOOTING');
  const [currentScene, setCurrentScene] = useState<WidgetScene | null>(null);
  const [sceneQueue, setSceneQueue] = useState<WidgetScene[]>([]);
  
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollFiredRef = useRef(false);
  const pageViewFiredRef = useRef(false);
  const lastActivityRef = useRef(Date.now());

  const sensitivity = config?.sensitivity || 'medium';
  const sensConfig = SENSITIVITY_MAP[sensitivity];

  // Find scene by type from config
  const findScene = useCallback((type: string): WidgetScene | null => {
    if (!config?.scenes) return null;
    const scenes = config.scenes as WidgetScene[];
    return scenes.find(s => s.type === type) || null;
  }, [config]);

  // Find scene by rule match
  const findSceneByRule = useCallback((eventType: string): WidgetScene | null => {
    if (!config?.rules || !config?.scenes) return null;
    const rules = config.rules;
    const scenes = config.scenes as WidgetScene[];
    
    const rule = rules.find(r => r.event === eventType);
    if (!rule || !rule.scene_id) return null;
    
    return scenes.find(s => s.id === rule.scene_id) || null;
  }, [config]);

  // Play a scene with priority check
  const playScene = useCallback((scene: WidgetScene, force = false) => {
    if (state === 'DISMISSED' && !force) return;
    
    // Don't interrupt higher priority scenes unless forced
    if (currentScene && currentScene.priority > scene.priority && !force) {
      setSceneQueue(prev => [...prev, scene]);
      return;
    }
    
    setCurrentScene(scene);
    onSceneChange(scene);
    setState('ENGAGING');
  }, [state, currentScene, onSceneChange]);

  // Emit a behavior event
  const emitEvent = useCallback((type: BehaviorEvent['type'], data?: Record<string, unknown>) => {
    const event: BehaviorEvent = { type, timestamp: Date.now(), data };
    onEvent(event);
  }, [onEvent]);

  // Dismiss the widget
  const dismiss = useCallback(() => {
    setState('DISMISSED');
    setCurrentScene(null);
    onSceneChange(null);
    emitEvent('DISMISS');
  }, [onSceneChange, emitEvent]);

  // Minimize
  const minimize = useCallback(() => {
    setState('MINIMIZED');
    emitEvent('MINIMIZE');
  }, [emitEvent]);

  // Reopen from minimized
  const reopen = useCallback(() => {
    setState('IDLE_LOOP');
    emitEvent('REOPEN');
  }, [emitEvent]);

  // Show CTA
  const showCta = useCallback(() => {
    setState('CTA_PUSH');
    emitEvent('CTA_HOVER');
  }, [emitEvent]);

  // Reset idle timer
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    lastActivityRef.current = Date.now();
    
    const triggers = config?.triggers as WidgetTriggers | undefined;
    if (!triggers?.idle_seconds || state === 'DISMISSED') return;
    
    const idleMs = triggers.idle_seconds * 1000 * sensConfig.idleMultiplier;
    
    idleTimerRef.current = setTimeout(() => {
      if (state === 'IDLE_LOOP' || state === 'BOOTING') {
        emitEvent('IDLE');
        const scene = findSceneByRule('IDLE') || findScene('idle') || findScene('engage');
        if (scene) playScene(scene);
      }
    }, idleMs);
  }, [config, state, sensConfig, emitEvent, findScene, findSceneByRule, playScene]);

  // Initialize - PAGE_VIEW event
  useEffect(() => {
    if (!enabled || !config || pageViewFiredRef.current) return;
    
    pageViewFiredRef.current = true;
    setState('IDLE_LOOP');
    emitEvent('PAGE_VIEW');
    
    // Check for hero scene on page view
    const heroScene = findSceneByRule('PAGE_VIEW') || findScene('hero');
    if (heroScene) {
      // Delay hero scene slightly for smoother UX
      setTimeout(() => playScene(heroScene), 1500);
    }
  }, [enabled, config, emitEvent, findScene, findSceneByRule, playScene]);

  // Idle detection
  useEffect(() => {
    if (!enabled || !config || state === 'DISMISSED') return;
    
    const handler = () => resetIdleTimer();
    
    // Debounced listeners
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedHandler = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(handler, sensConfig.debounce);
    };
    
    window.addEventListener('mousemove', debouncedHandler, { passive: true });
    window.addEventListener('scroll', debouncedHandler, { passive: true });
    window.addEventListener('keydown', debouncedHandler, { passive: true });
    window.addEventListener('touchstart', debouncedHandler, { passive: true });
    
    // Start initial idle timer
    resetIdleTimer();
    
    return () => {
      window.removeEventListener('mousemove', debouncedHandler);
      window.removeEventListener('scroll', debouncedHandler);
      window.removeEventListener('keydown', debouncedHandler);
      window.removeEventListener('touchstart', debouncedHandler);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [enabled, config, state, resetIdleTimer, sensConfig]);

  // Scroll depth detection
  useEffect(() => {
    if (!enabled || !config || scrollFiredRef.current || state === 'DISMISSED') return;
    
    const triggers = config.triggers as WidgetTriggers | undefined;
    if (!triggers?.scroll_percent) return;
    
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercent = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      
      if (scrollPercent >= (triggers.scroll_percent || 35) && !scrollFiredRef.current) {
        scrollFiredRef.current = true;
        emitEvent('SCROLL_DEPTH', { percent: scrollPercent });
        const scene = findSceneByRule('SCROLL_DEPTH') || findScene('engage');
        if (scene) playScene(scene);
      }
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [enabled, config, state, emitEvent, findScene, findSceneByRule, playScene]);

  // Exit intent detection (desktop only)
  useEffect(() => {
    if (!enabled || !config || state === 'DISMISSED') return;
    
    const triggers = config.triggers as WidgetTriggers | undefined;
    if (!triggers?.exit_intent) return;
    
    // Only on desktop
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    if (isMobile) return;
    
    let exitFired = false;
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !exitFired) {
        exitFired = true;
        emitEvent('EXIT_INTENT');
        const scene = findSceneByRule('EXIT_INTENT') || findScene('exit_save');
        if (scene) playScene(scene, true); // Force on exit intent
      }
    };
    
    document.addEventListener('mouseleave', handleMouseLeave);
    return () => document.removeEventListener('mouseleave', handleMouseLeave);
  }, [enabled, config, state, emitEvent, findScene, findSceneByRule, playScene]);

  // Scene queue processing
  useEffect(() => {
    if (!currentScene && sceneQueue.length > 0 && state !== 'DISMISSED') {
      const next = sceneQueue[0];
      setSceneQueue(prev => prev.slice(1));
      playScene(next);
    }
  }, [currentScene, sceneQueue, state, playScene]);

  // Prefers reduced motion
  const prefersReducedMotion = typeof window !== 'undefined' 
    ? window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches 
    : false;

  return {
    state,
    currentScene,
    dismiss,
    minimize,
    reopen,
    showCta,
    playScene,
    prefersReducedMotion,
  };
}
