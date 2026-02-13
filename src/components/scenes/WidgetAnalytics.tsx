import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Eye, MousePointerClick, Film, Clock, TrendingUp, Monitor, Smartphone, Tablet } from 'lucide-react';

interface WidgetAnalyticsProps {
  widgetId: string;
}

interface WidgetEvent {
  id: string;
  event_type: string;
  scene_id: string | null;
  visitor_session: string | null;
  page_url: string | null;
  device_type: string | null;
  created_at: string;
}

export function WidgetAnalytics({ widgetId }: WidgetAnalyticsProps) {
  // Fetch recent events
  const { data: events, isLoading } = useQuery({
    queryKey: ['widget-events', widgetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('widget_events')
        .select('*')
        .eq('widget_id', widgetId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as unknown as WidgetEvent[];
    },
  });

  // Compute stats from events
  const stats = React.useMemo(() => {
    if (!events) return { views: 0, clicks: 0, scenePlays: 0, uniqueSessions: 0, desktop: 0, mobile: 0, tablet: 0 };
    
    const views = events.filter(e => e.event_type === 'view').length;
    const clicks = events.filter(e => e.event_type === 'cta_click').length;
    const scenePlays = events.filter(e => e.event_type === 'scene_play').length;
    const uniqueSessions = new Set(events.map(e => e.visitor_session).filter(Boolean)).size;
    const desktop = events.filter(e => e.device_type === 'desktop').length;
    const mobile = events.filter(e => e.device_type === 'mobile').length;
    const tablet = events.filter(e => e.device_type === 'tablet').length;
    
    return { views, clicks, scenePlays, uniqueSessions, desktop, mobile, tablet };
  }, [events]);

  const cvr = stats.views > 0 ? ((stats.clicks / stats.views) * 100).toFixed(1) : '0.0';

  const eventTypeLabels: Record<string, string> = {
    view: 'Page View',
    scene_play: 'Scene Play',
    scene_complete: 'Scene Complete',
    cta_click: 'CTA Click',
    secondary_cta_click: '2nd CTA Click',
    dismiss: 'Dismissed',
    minimize: 'Minimized',
    reopen: 'Reopened',
    exit_intent_fired: 'Exit Intent',
    idle_triggered: 'Idle Trigger',
    scroll_triggered: 'Scroll Trigger',
    hover_triggered: 'Hover Trigger',
  };

  const eventTypeColors: Record<string, string> = {
    view: 'text-blue-400',
    cta_click: 'text-green-400',
    scene_play: 'text-purple-400',
    dismiss: 'text-red-400',
    exit_intent_fired: 'text-orange-400',
    idle_triggered: 'text-yellow-400',
    scroll_triggered: 'text-cyan-400',
  };

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Views', value: stats.views, icon: Eye, color: 'text-blue-400' },
          { label: 'CTA Clicks', value: stats.clicks, icon: MousePointerClick, color: 'text-green-400' },
          { label: 'Scene Plays', value: stats.scenePlays, icon: Film, color: 'text-purple-400' },
          { label: 'Unique Visitors', value: stats.uniqueSessions, icon: TrendingUp, color: 'text-cyan-400' },
          { label: 'CVR', value: `${cvr}%`, icon: TrendingUp, color: 'text-emerald-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="border border-border rounded-xl p-4 bg-card">
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {/* Device Breakdown */}
      <div className="border border-border rounded-xl p-4 bg-card">
        <h4 className="text-sm font-medium text-foreground mb-3">Device Breakdown (last 50 events)</h4>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-foreground">{stats.desktop} Desktop</span>
          </div>
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-foreground">{stats.mobile} Mobile</span>
          </div>
          <div className="flex items-center gap-2">
            <Tablet className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-foreground">{stats.tablet} Tablet</span>
          </div>
        </div>
      </div>

      {/* Event Log */}
      <div className="border border-border rounded-xl bg-card">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h4 className="text-sm font-medium text-foreground">Recent Events</h4>
          <span className="text-xs text-muted-foreground">Last 50</span>
        </div>
        
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading events...</div>
        ) : !events?.length ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No events recorded yet. Publish your widget to start tracking.</div>
        ) : (
          <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
            {events.map(event => (
              <div key={event.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <span className={`font-medium ${eventTypeColors[event.event_type] || 'text-foreground'}`}>
                    {eventTypeLabels[event.event_type] || event.event_type}
                  </span>
                  {event.scene_id && (
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      Scene: {event.scene_id.slice(0, 8)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {event.device_type && (
                    <span className="capitalize">{event.device_type}</span>
                  )}
                  <span>
                    {new Date(event.created_at).toLocaleString(undefined, { 
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
