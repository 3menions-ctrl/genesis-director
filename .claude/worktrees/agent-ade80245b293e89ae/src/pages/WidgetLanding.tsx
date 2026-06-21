import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { LandingPageRenderer } from '@/components/scenes/LandingPageRenderer';
import type { WidgetConfig, WidgetScene } from '@/types/widget';

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

export default function WidgetLanding() {
  const { slug } = useParams<{ slug: string }>();
  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!slug) return;
    
    async function load() {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-widget-config?slug=${slug}`,
          { headers: { 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
        );
        if (!res.ok) { setError(true); return; }
        const data = await res.json();
        setConfig(data.config as WidgetConfig);
        
        // Log view
        logEvent(data.config.id, 'view');
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  const logEvent = useCallback(async (widgetId: string, eventType: string, sceneId?: string) => {
    try {
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/log-widget-event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          widget_id: widgetId,
          event_type: eventType,
          scene_id: sceneId,
          visitor_session: getVisitorSession(),
          page_url: window.location.href,
          referrer: document.referrer,
          device_type: getDeviceType(),
        }),
      });
    } catch { /* silent */ }
  }, []);

  const handleCtaClick = useCallback(() => {
    if (!config?.cta_url) return;
    logEvent(config.id, 'cta_click');
    window.open(config.cta_url, '_blank', 'noopener,noreferrer');
  }, [config, logEvent]);

  const handleScenePlay = useCallback((scene: WidgetScene) => {
    if (config) logEvent(config.id, 'scene_play', scene.id);
  }, [config, logEvent]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Page Not Found</h1>
          <p className="text-white/50">This landing page doesn't exist or has been paused.</p>
        </div>
      </div>
    );
  }

  // Set page title
  document.title = config.headline || config.name;

  return (
    <LandingPageRenderer 
      config={config} 
      onCtaClick={handleCtaClick}
      onScenePlay={handleScenePlay}
    />
  );
}
