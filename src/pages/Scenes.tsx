import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Plus, ExternalLink, Copy, BarChart3, Settings2, Trash2, Play, Pause, Eye, MousePointerClick, Film, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AppHeader } from '@/components/layout/AppHeader';
import { WidgetBuilderForm } from '@/components/scenes/WidgetBuilderForm';
import { WidgetAnalytics } from '@/components/scenes/WidgetAnalytics';
import type { WidgetConfig } from '@/types/widget';

export default function Scenes() {
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

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Sparkles className="w-8 h-8 text-primary" />
              Genesis Scenes
            </h1>
            <p className="text-muted-foreground mt-1">
              Create video conversion widgets & landing pages
            </p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" /> New Widget</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create New Widget</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-4">
                <Input placeholder="Widget name (e.g., Product Launch)" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && newName.trim() && createMutation.mutate(newName.trim())} />
                <Button className="w-full" disabled={!newName.trim() || createMutation.isPending} onClick={() => createMutation.mutate(newName.trim())}>
                  {createMutation.isPending ? 'Creating...' : 'Create Widget'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {selectedWidget ? (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <Button variant="ghost" size="sm" onClick={() => { setSelectedWidget(null); setActiveTab('list'); }}>← Back</Button>
              <h2 className="text-xl font-semibold text-foreground">{selectedWidget.name}</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${selectedWidget.status === 'published' ? 'bg-green-500/20 text-green-400' : selectedWidget.status === 'paused' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-muted text-muted-foreground'}`}>{selectedWidget.status}</span>
            </div>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'builder' | 'analytics')}>
              <TabsList>
                <TabsTrigger value="builder"><Settings2 className="w-4 h-4 mr-1.5" /> Builder</TabsTrigger>
                <TabsTrigger value="analytics"><BarChart3 className="w-4 h-4 mr-1.5" /> Analytics</TabsTrigger>
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
          <div>
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1,2,3].map(i => (<div key={i} className="h-48 rounded-xl bg-muted animate-pulse" />))}
              </div>
            ) : !widgets?.length ? (
              <div className="text-center py-20 border border-dashed border-border rounded-2xl">
                <Film className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No widgets yet</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">Create your first video conversion widget. Embed it on any site or share as a landing page.</p>
                <Button onClick={() => setCreateDialogOpen(true)} className="gap-2"><Plus className="w-4 h-4" /> Create Your First Widget</Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {widgets.map((widget) => (
                  <div key={widget.id} className="rounded-xl border border-border bg-card p-5 hover:border-primary/30 transition-colors group">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-foreground">{widget.name}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{widget.widget_type === 'both' ? 'Embed + Landing' : widget.widget_type}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${widget.status === 'published' ? 'bg-green-500/20 text-green-400' : widget.status === 'paused' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-muted text-muted-foreground'}`}>{widget.status}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="text-center">
                        <p className="text-lg font-bold text-foreground">{widget.total_views}</p>
                        <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1"><Eye className="w-3 h-3" /> Views</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-foreground">{widget.total_cta_clicks}</p>
                        <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1"><MousePointerClick className="w-3 h-3" /> Clicks</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-foreground">{widget.total_views > 0 ? ((widget.total_cta_clicks / widget.total_views) * 100).toFixed(1) : '0'}%</p>
                        <p className="text-[10px] text-muted-foreground">CVR</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-4">{(widget.scenes as unknown[])?.length || 0} scenes configured</p>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => { setSelectedWidget(widget); setActiveTab('builder'); }}><Settings2 className="w-3.5 h-3.5 mr-1" /> Edit</Button>
                      <Button variant="outline" size="sm" onClick={() => togglePublish.mutate({ id: widget.id, status: widget.status })}>{widget.status === 'published' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}</Button>
                      <Button variant="outline" size="sm" onClick={() => copyEmbedCode(widget)}><Copy className="w-3.5 h-3.5" /></Button>
                      {widget.slug && (<Button variant="outline" size="sm" onClick={() => copyLandingUrl(widget)}><ExternalLink className="w-3.5 h-3.5" /></Button>)}
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => { if (confirm('Delete this widget?')) deleteMutation.mutate(widget.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
