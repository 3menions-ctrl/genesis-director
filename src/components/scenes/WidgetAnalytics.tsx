import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Eye, MousePointerClick, Film, TrendingUp, Monitor, Smartphone, Tablet } from 'lucide-react';

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

  const stats = React.useMemo(() => {
    if (!events) return { views: 0, clicks: 0, scenePlays: 0, uniqueSessions: 0, desktop: 0, mobile: 0, tablet: 0 };
    return {
      views: events.filter(e => e.event_type === 'view').length,
      clicks: events.filter(e => e.event_type === 'cta_click').length,
      scenePlays: events.filter(e => e.event_type === 'scene_play').length,
      uniqueSessions: new Set(events.map(e => e.visitor_session).filter(Boolean)).size,
      desktop: events.filter(e => e.device_type === 'desktop').length,
      mobile: events.filter(e => e.device_type === 'mobile').length,
      tablet: events.filter(e => e.device_type === 'tablet').length,
    };
  }, [events]);

  const cvr = stats.views > 0 ? ((stats.clicks / stats.views) * 100).toFixed(1) : '0.0';

  const eventTypeLabels: Record<string, string> = {
    view: 'Page View', scene_play: 'Scene Play', scene_complete: 'Scene Complete',
    cta_click: 'CTA Click', secondary_cta_click: '2nd CTA Click', dismiss: 'Dismissed',
    minimize: 'Minimized', reopen: 'Reopened', exit_intent_fired: 'Exit Intent',
    idle_triggered: 'Idle Trigger', scroll_triggered: 'Scroll Trigger', hover_triggered: 'Hover Trigger',
  };

  const eventDotColors: Record<string, string> = {
    view: 'bg-blue-400', cta_click: 'bg-emerald-400', scene_play: 'bg-violet-400',
    dismiss: 'bg-red-400', exit_intent_fired: 'bg-amber-400', idle_triggered: 'bg-yellow-400',
    scroll_triggered: 'bg-cyan-400',
  };

  const statCards = [
    { label: 'Views', value: stats.views, icon: Eye, gradient: 'from-blue-500/10 to-blue-500/5' },
    { label: 'CTA Clicks', value: stats.clicks, icon: MousePointerClick, gradient: 'from-emerald-500/10 to-emerald-500/5' },
    { label: 'Scene Plays', value: stats.scenePlays, icon: Film, gradient: 'from-violet-500/10 to-violet-500/5' },
    { label: 'Unique Visitors', value: stats.uniqueSessions, icon: TrendingUp, gradient: 'from-cyan-500/10 to-cyan-500/5' },
    { label: 'CVR', value: `${cvr}%`, icon: TrendingUp, gradient: 'from-primary/10 to-primary/5' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {statCards.map(({ label, value, icon: Icon, gradient }) => (
          <div key={label} className={`rounded-2xl bg-gradient-to-b ${gradient} border border-white/[0.06] p-4`}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-white/[0.05] flex items-center justify-center">
                <Icon className="w-3.5 h-3.5 text-white/50" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
            <p className="text-[10px] text-white/30 uppercase tracking-wider mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Device Breakdown */}
      <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-5">
        <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-4">Device Breakdown</h4>
        <div className="flex items-center gap-8">
          {[
            { icon: Monitor, label: 'Desktop', count: stats.desktop },
            { icon: Smartphone, label: 'Mobile', count: stats.mobile },
            { icon: Tablet, label: 'Tablet', count: stats.tablet },
          ].map(({ icon: Icon, label, count }) => (
            <div key={label} className="flex items-center gap-2.5">
              <Icon className="w-4 h-4 text-white/20" />
              <span className="text-sm text-foreground font-medium tabular-nums">{count}</span>
              <span className="text-[11px] text-white/30">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Event Log */}
      <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-white/[0.05] flex items-center justify-between">
          <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider">Recent Events</h4>
          <span className="text-[10px] text-white/20 font-mono">LAST 50</span>
        </div>
        
        {isLoading ? (
          <div className="p-12 text-center text-white/30 text-sm">Loading events...</div>
        ) : !events?.length ? (
          <div className="p-12 text-center text-white/30 text-sm">No events recorded yet. Publish your widget to start tracking.</div>
        ) : (
          <div className="divide-y divide-white/[0.03] max-h-[400px] overflow-y-auto scrollbar-hide">
            {events.map(event => (
              <div key={event.id} className="px-5 py-2.5 flex items-center justify-between text-sm hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-1.5 h-1.5 rounded-full ${eventDotColors[event.event_type] || 'bg-white/20'}`} />
                  <span className="font-medium text-foreground text-xs">
                    {eventTypeLabels[event.event_type] || event.event_type}
                  </span>
                  {event.scene_id && (
                    <span className="text-[10px] text-white/20 bg-white/[0.04] px-2 py-0.5 rounded-md font-mono">
                      {event.scene_id.slice(0, 8)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[11px] text-white/20">
                  {event.device_type && <span className="capitalize">{event.device_type}</span>}
                  <span className="font-mono">
                    {new Date(event.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
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
