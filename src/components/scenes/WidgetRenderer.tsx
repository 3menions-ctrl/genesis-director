import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { WidgetOverlay } from './WidgetOverlay';
import { useWidgetBehaviorEngine } from '@/hooks/useWidgetBehaviorEngine';
import type { WidgetConfig, WidgetScene, BehaviorEvent } from '@/types/widget';

interface WidgetRendererProps {
  widgetId?: string;
  publicKey?: string;
  slug?: string;
  mode?: 'embed' | 'landing';
}

// Generate a session ID for anonymous visitor tracking
function getVisitorSession(): string {
  const key = 'fw_session';
  let session = sessionStorage.getItem(key);
  if (!session) {
    session = crypto.randomUUID();
    sessionStorage.setItem(key, session);
  }
  return session;
}

function getDeviceType(): 'desktop' | 'mobile' | 'tablet' {
  const ua = navigator.userAgent;
  if (/Tablet|iPad/i.test(ua)) return 'tablet';
  if (/Mobi|Android|iPhone/i.test(ua)) return 'mobile';
  return 'desktop';
}

export function WidgetRenderer({ widgetId, publicKey, slug, mode = 'embed' }: WidgetRendererProps) {
  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch config
  useEffect(() => {
    async function fetchConfig() {
      try {
        let url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-widget-config?`;
        if (publicKey) url += `key=${publicKey}`;
        else if (slug) url += `slug=${slug}`;
        else return;

        const res = await fetch(url, {
          headers: { 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        });

        if (!res.ok) {
          if (res.status === 404) setError('not_found');
          else setError('fetch_failed');
          return;
        }

        const data = await res.json();
        if (data.config) {
          setConfig(data.config as WidgetConfig);
        }
      } catch {
        setError('fetch_failed');
      } finally {
        setLoading(false);
      }
    }

    fetchConfig();
  }, [publicKey, slug]);

  // Log events to backend
  const logEvent = useCallback(async (eventType: string, sceneId?: string) => {
    if (!config) return;
    
    try {
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/log-widget-event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          widget_id: config.id,
          event_type: eventType,
          scene_id: sceneId,
          visitor_session: getVisitorSession(),
          page_url: window.location.href,
          referrer: document.referrer,
          device_type: getDeviceType(),
        }),
      });
    } catch {
      // Fail silently - don't break the widget for analytics
    }
  }, [config]);

  // Behavior engine callbacks
  const handleSceneChange = useCallback((scene: WidgetScene | null) => {
    if (scene) {
      logEvent('scene_play', scene.id);
    }
  }, [logEvent]);

  const handleEvent = useCallback((event: BehaviorEvent) => {
    const eventMap: Record<string, string> = {
      'IDLE': 'idle_triggered',
      'SCROLL_DEPTH': 'scroll_triggered',
      'EXIT_INTENT': 'exit_intent_fired',
      'DISMISS': 'dismiss',
      'MINIMIZE': 'minimize',
      'REOPEN': 'reopen',
      'PAGE_VIEW': 'view',
    };
    const mapped = eventMap[event.type];
    if (mapped) logEvent(mapped);
  }, [logEvent]);

  const engine = useWidgetBehaviorEngine({
    config,
    onSceneChange: handleSceneChange,
    onEvent: handleEvent,
    enabled: !!config && !loading && !error,
  });

  const handleCtaClick = useCallback(() => {
    if (!config?.cta_url) return;
    logEvent('cta_click');
    window.open(config.cta_url, '_blank', 'noopener,noreferrer');
  }, [config, logEvent]);

  const handleSceneEnd = useCallback(() => {
    if (engine.currentScene) {
      logEvent('scene_complete', engine.currentScene.id);
    }
  }, [engine.currentScene, logEvent]);

  // Fail silently for embeds
  if (loading || error || !config) {
    if (mode === 'landing' && error === 'not_found') {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center">
          <p className="text-white/50 text-lg">Page not found</p>
        </div>
      );
    }
    return null;
  }

  return (
    <WidgetOverlay
      config={config}
      currentScene={engine.currentScene}
      engineState={engine.state}
      onDismiss={engine.dismiss}
      onMinimize={engine.minimize}
      onReopen={engine.reopen}
      onCtaClick={handleCtaClick}
      onSceneEnd={handleSceneEnd}
      prefersReducedMotion={engine.prefersReducedMotion}
    />
  );
}
