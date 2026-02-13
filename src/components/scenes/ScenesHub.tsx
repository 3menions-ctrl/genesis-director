import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Plus, ExternalLink, Copy, BarChart3, Settings2, Trash2, Play, Pause, Eye, MousePointerClick, Film, Sparkles, ArrowLeft, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WidgetBuilderForm } from '@/components/scenes/WidgetBuilderForm';
import { WidgetAnalytics } from '@/components/scenes/WidgetAnalytics';
import type { WidgetConfig } from '@/types/widget';

export function ScenesHub() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedWidget, setSelectedWidget] = useState<WidgetConfig | null>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'builder' | 'analytics'>('list');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');

  // Fetch widgets
  const { data: widgets, isLoading } = useQuery({
    queryKey: ['widgets', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('widget_configs')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as WidgetConfig[];
    },
    enabled: !!user,
  });

  // Create widget
  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const { data, error } = await supabase
        .from('widget_configs')
        .insert({
          name,
          slug,
          user_id: user!.id,
          widget_type: 'both',
          scenes: [],
          triggers: { idle_seconds: 6, scroll_percent: 35, exit_intent: true },
          rules: [],
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as WidgetConfig;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['widgets'] });
      setSelectedWidget(data);
      setActiveTab('builder');
      setCreateDialogOpen(false);
      setNewName('');
      toast.success('Widget created!');
    },
    onError: () => toast.error('Failed to create widget'),
  });

  // Delete widget
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('widget_configs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['widgets'] });
      if (selectedWidget) setSelectedWidget(null);
      setActiveTab('list');
      toast.success('Widget deleted');
    },
  });

  // Toggle publish
  const togglePublish = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const newStatus = status === 'published' ? 'paused' : 'published';
      const { error } = await supabase
        .from('widget_configs')
        .update({ 
          status: newStatus, 
          published_at: newStatus === 'published' ? new Date().toISOString() : null 
        })
        .eq('id', id);
      if (error) throw error;
      return newStatus;
    },
    onSuccess: (newStatus) => {
      queryClient.invalidateQueries({ queryKey: ['widgets'] });
      toast.success(newStatus === 'published' ? 'Widget published!' : 'Widget paused');
    },
  });

  const copyEmbedCode = useCallback((widget: WidgetConfig) => {
    const code = `<iframe src="https://genesis-director.lovable.app/widget/${widget.public_key}" style="position:fixed;bottom:20px;right:20px;width:${widget.widget_width}px;height:${widget.widget_height}px;border:none;z-index:${widget.z_index};pointer-events:auto;" allow="autoplay"></iframe>`;
    navigator.clipboard.writeText(code);
    toast.success('Embed code copied!');
  }, []);

  const copyLandingUrl = useCallback((widget: WidgetConfig) => {
    const url = `https://genesis-director.lovable.app/w/${widget.slug}`;
    navigator.clipboard.writeText(url);
    toast.success('Landing page URL copied!');
  }, []);

  const statusBadge = (status: string) => {
    const styles = {
      published: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
      paused: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
      draft: 'bg-white/[0.05] text-white/40 border border-white/[0.08]',
    };
    return styles[status as keyof typeof styles] || styles.draft;
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 animate-fade-in">
      {selectedWidget ? (
        /* ══════════ BUILDER / ANALYTICS VIEW ══════════ */
        <div className="space-y-6">
          {/* Back bar */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => { setSelectedWidget(null); setActiveTab('list'); }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white/50 hover:text-white/80 hover:bg-white/[0.05] transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <div className="h-5 w-px bg-white/[0.08]" />
            <h2 className="text-lg font-semibold text-foreground tracking-tight">{selectedWidget.name}</h2>
            <span className={`text-[10px] px-2.5 py-1 rounded-full font-medium uppercase tracking-wider ${statusBadge(selectedWidget.status)}`}>
              {selectedWidget.status}
            </span>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'builder' | 'analytics')}>
            <TabsList className="bg-white/[0.03] border border-white/[0.08] p-1 rounded-xl">
              <TabsTrigger value="builder" className="data-[state=active]:bg-white/[0.08] data-[state=active]:text-foreground rounded-lg gap-2">
                <Settings2 className="w-4 h-4" /> Builder
              </TabsTrigger>
              <TabsTrigger value="analytics" className="data-[state=active]:bg-white/[0.08] data-[state=active]:text-foreground rounded-lg gap-2">
                <BarChart3 className="w-4 h-4" /> Analytics
              </TabsTrigger>
            </TabsList>
            <TabsContent value="builder" className="mt-6">
              <WidgetBuilderForm widget={selectedWidget} onUpdate={(updated) => { setSelectedWidget(updated); queryClient.invalidateQueries({ queryKey: ['widgets'] }); }} />
            </TabsContent>
            <TabsContent value="analytics" className="mt-6">
              <WidgetAnalytics widgetId={selectedWidget.id} />
            </TabsContent>
          </Tabs>
        </div>
      ) : (
        /* ══════════ LIST VIEW ══════════ */
        <div className="space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-white/[0.08] flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-foreground tracking-tight">Scenes</h2>
              </div>
              <p className="text-sm text-white/40 pl-12">Video conversion widgets & landing pages</p>
            </div>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.15] transition-all text-sm font-medium text-foreground">
                  <Plus className="w-4 h-4" /> New Widget
                </button>
              </DialogTrigger>
              <DialogContent className="bg-black/95 backdrop-blur-xl border-white/[0.08]">
                <DialogHeader>
                  <DialogTitle className="text-foreground">Create New Widget</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <Input 
                    placeholder="Widget name (e.g., Product Launch)" 
                    value={newName} 
                    onChange={(e) => setNewName(e.target.value)} 
                    onKeyDown={(e) => e.key === 'Enter' && newName.trim() && createMutation.mutate(newName.trim())}
                    className="bg-white/[0.03] border-white/[0.08] text-foreground placeholder:text-white/30"
                  />
                  <Button 
                    className="w-full" 
                    disabled={!newName.trim() || createMutation.isPending} 
                    onClick={() => createMutation.mutate(newName.trim())}
                  >
                    {createMutation.isPending ? 'Creating...' : 'Create Widget'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3].map(i => (
                <div key={i} className="h-52 rounded-2xl bg-white/[0.02] border border-white/[0.05] animate-pulse" />
              ))}
            </div>
          ) : !widgets?.length ? (
            /* Empty state */
            <div className="text-center py-24 rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.01]">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center mb-6">
                <Layers className="w-7 h-7 text-white/20" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No widgets yet</h3>
              <p className="text-white/40 mb-8 max-w-sm mx-auto text-sm leading-relaxed">
                Create your first video conversion widget. Embed it on any site or share as a hosted landing page.
              </p>
              <button
                onClick={() => setCreateDialogOpen(true)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.15] transition-all text-sm font-medium text-foreground"
              >
                <Plus className="w-4 h-4" /> Create Your First Widget
              </button>
            </div>
          ) : (
            /* Widget cards */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {widgets.map((widget) => (
                <div 
                  key={widget.id} 
                  className="group relative rounded-2xl bg-white/[0.02] backdrop-blur-sm border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.04] transition-all duration-300 overflow-hidden"
                >
                  {/* Subtle top accent line */}
                  <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="p-5 space-y-4">
                    {/* Title row */}
                    <div className="flex items-start justify-between">
                      <div className="space-y-0.5 min-w-0">
                        <h3 className="font-semibold text-foreground truncate">{widget.name}</h3>
                        <p className="text-[11px] text-white/30 font-medium tracking-wide">
                          {widget.widget_type === 'both' ? 'EMBED + LANDING' : widget.widget_type?.toUpperCase()}
                        </p>
                      </div>
                      <span className={`text-[10px] px-2.5 py-1 rounded-full font-medium uppercase tracking-wider shrink-0 ${statusBadge(widget.status)}`}>
                        {widget.status}
                      </span>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { value: widget.total_views, label: 'Views', icon: Eye },
                        { value: widget.total_cta_clicks, label: 'Clicks', icon: MousePointerClick },
                        { value: widget.total_views > 0 ? `${((widget.total_cta_clicks / widget.total_views) * 100).toFixed(1)}%` : '—', label: 'CVR', icon: null },
                      ].map(({ value, label, icon: Icon }) => (
                        <div key={label} className="text-center py-2 rounded-lg bg-white/[0.02]">
                          <p className="text-base font-bold text-foreground tabular-nums">{value}</p>
                          <p className="text-[10px] text-white/30 flex items-center justify-center gap-1 mt-0.5">
                            {Icon && <Icon className="w-3 h-3" />}
                            {label}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Scenes indicator */}
                    <div className="flex items-center gap-2">
                      <Film className="w-3 h-3 text-white/20" />
                      <span className="text-[11px] text-white/30">{(widget.scenes as unknown[])?.length || 0} scenes</span>
                    </div>

                    {/* Hairline divider */}
                    <div className="h-px bg-white/[0.05]" />

                    {/* Actions */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => { setSelectedWidget(widget); setActiveTab('builder'); }}
                        className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.12] text-xs text-white/60 hover:text-white/90 transition-all"
                      >
                        <Settings2 className="w-3 h-3" /> Configure
                      </button>
                      <button
                        onClick={() => togglePublish.mutate({ id: widget.id, status: widget.status })}
                        className="h-8 w-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.12] flex items-center justify-center text-white/40 hover:text-white/80 transition-all"
                      >
                        {widget.status === 'published' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => copyEmbedCode(widget)}
                        className="h-8 w-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.12] flex items-center justify-center text-white/40 hover:text-white/80 transition-all"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      {widget.slug && (
                        <button
                          onClick={() => copyLandingUrl(widget)}
                          className="h-8 w-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.12] flex items-center justify-center text-white/40 hover:text-white/80 transition-all"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => { if (confirm('Delete this widget?')) deleteMutation.mutate(widget.id); }}
                        className="h-8 w-8 rounded-lg hover:bg-destructive/10 border border-transparent hover:border-destructive/20 flex items-center justify-center text-white/20 hover:text-destructive transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
