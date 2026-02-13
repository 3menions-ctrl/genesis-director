import React, { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, GripVertical, Copy, ExternalLink, Save } from 'lucide-react';
import type { WidgetConfig, WidgetScene, WidgetTriggers, WidgetRule, WidgetPosition, WidgetSensitivity, WidgetTone } from '@/types/widget';

interface WidgetBuilderFormProps {
  widget: WidgetConfig;
  onUpdate: (widget: WidgetConfig) => void;
}

export function WidgetBuilderForm({ widget, onUpdate }: WidgetBuilderFormProps) {
  const [config, setConfig] = useState<WidgetConfig>(widget);
  const [scenes, setScenes] = useState<WidgetScene[]>((widget.scenes || []) as WidgetScene[]);
  const [triggers, setTriggers] = useState<WidgetTriggers>((widget.triggers || {}) as WidgetTriggers);
  const [rules, setRules] = useState<WidgetRule[]>((widget.rules || []) as WidgetRule[]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('widget_configs')
        .update({
          name: config.name,
          slug: config.slug,
          widget_type: config.widget_type,
          primary_color: config.primary_color,
          logo_url: config.logo_url,
          background_color: config.background_color,
          font_family: config.font_family,
          position: config.position,
          z_index: config.z_index,
          widget_width: config.widget_width,
          widget_height: config.widget_height,
          cta_text: config.cta_text,
          cta_url: config.cta_url,
          cta_color: config.cta_color,
          secondary_cta_text: config.secondary_cta_text,
          secondary_cta_url: config.secondary_cta_url,
          headline: config.headline,
          subheadline: config.subheadline,
          scenes: JSON.parse(JSON.stringify(scenes)),
          triggers: JSON.parse(JSON.stringify(triggers)),
          rules: JSON.parse(JSON.stringify(rules)),
          sensitivity: config.sensitivity,
          allowed_domains: config.allowed_domains,
          tone: config.tone,
        })
        .eq('id', config.id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as WidgetConfig;
    },
    onSuccess: (data) => {
      onUpdate(data);
      toast.success('Widget saved!');
    },
    onError: () => toast.error('Failed to save'),
  });

  const updateConfig = useCallback(<K extends keyof WidgetConfig>(key: K, value: WidgetConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  }, []);

  const addScene = useCallback(() => {
    const newScene: WidgetScene = {
      id: crypto.randomUUID(),
      name: `Scene ${scenes.length + 1}`,
      type: 'engage',
      src_mp4: '',
      loop: false,
      priority: scenes.length + 1,
    };
    setScenes(prev => [...prev, newScene]);
  }, [scenes.length]);

  const updateScene = useCallback((idx: number, updates: Partial<WidgetScene>) => {
    setScenes(prev => prev.map((s, i) => i === idx ? { ...s, ...updates } : s));
  }, []);

  const removeScene = useCallback((idx: number) => {
    setScenes(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const addRule = useCallback(() => {
    setRules(prev => [...prev, { event: 'IDLE', action: 'play_scene' }]);
  }, []);

  const embedCode = `<iframe src="https://genesis-director.lovable.app/widget/${config.public_key}" style="position:fixed;bottom:20px;right:20px;width:${config.widget_width}px;height:${config.widget_height}px;border:none;z-index:${config.z_index};" allow="autoplay"></iframe>`;
  const landingUrl = `https://genesis-director.lovable.app/w/${config.slug}`;

  return (
    <div className="space-y-6">
      {/* Save button */}
      <div className="flex justify-end">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-2">
          <Save className="w-4 h-4" />
          {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <Tabs defaultValue="content">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="scenes">Scenes</TabsTrigger>
          <TabsTrigger value="triggers">Triggers</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="embed">Embed</TabsTrigger>
        </TabsList>

        {/* Content Tab */}
        <TabsContent value="content" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Widget Name</Label>
              <Input value={config.name} onChange={e => updateConfig('name', e.target.value)} />
            </div>
            <div>
              <Label>URL Slug</Label>
              <Input value={config.slug || ''} onChange={e => updateConfig('slug', e.target.value)} placeholder="my-product" />
              <p className="text-xs text-muted-foreground mt-1">Landing page: /w/{config.slug || '...'}</p>
            </div>
            <div>
              <Label>Headline</Label>
              <Input value={config.headline || ''} onChange={e => updateConfig('headline', e.target.value)} placeholder="Transform your workflow" />
            </div>
            <div>
              <Label>Subheadline</Label>
              <Input value={config.subheadline || ''} onChange={e => updateConfig('subheadline', e.target.value)} placeholder="See how it works in 30 seconds" />
            </div>
            <div>
              <Label>CTA Text</Label>
              <Input value={config.cta_text} onChange={e => updateConfig('cta_text', e.target.value)} placeholder="Get Started" />
            </div>
            <div>
              <Label>CTA URL</Label>
              <Input value={config.cta_url || ''} onChange={e => updateConfig('cta_url', e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <Label>Secondary CTA Text</Label>
              <Input value={config.secondary_cta_text || ''} onChange={e => updateConfig('secondary_cta_text', e.target.value)} placeholder="Learn more" />
            </div>
            <div>
              <Label>Secondary CTA URL</Label>
              <Input value={config.secondary_cta_url || ''} onChange={e => updateConfig('secondary_cta_url', e.target.value)} placeholder="https://..." />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Widget Type</Label>
              <Select value={config.widget_type} onValueChange={v => updateConfig('widget_type', v as WidgetConfig['widget_type'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="embed">Embed Only</SelectItem>
                  <SelectItem value="landing_page">Landing Page Only</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tone</Label>
              <Select value={config.tone} onValueChange={v => updateConfig('tone', v as WidgetTone)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="friendly">Friendly</SelectItem>
                  <SelectItem value="bold">Bold</SelectItem>
                  <SelectItem value="funny">Funny</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sensitivity</Label>
              <Select value={config.sensitivity} onValueChange={v => updateConfig('sensitivity', v as WidgetSensitivity)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low (less aggressive)</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High (more triggers)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </TabsContent>

        {/* Scenes Tab */}
        <TabsContent value="scenes" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">Video Scenes ({scenes.length})</h3>
            <Button variant="outline" size="sm" onClick={addScene} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add Scene
            </Button>
          </div>

          {scenes.length === 0 ? (
            <div className="border border-dashed border-border rounded-xl p-8 text-center">
              <p className="text-muted-foreground text-sm">No scenes yet. Add your first video scene.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {scenes.map((scene, idx) => (
                <div key={scene.id} className="border border-border rounded-xl p-4 bg-card">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <GripVertical className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">{scene.name}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeScene(idx)} className="text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Name</Label>
                      <Input value={scene.name} onChange={e => updateScene(idx, { name: e.target.value })} className="h-9 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs">Type</Label>
                      <Select value={scene.type} onValueChange={v => updateScene(idx, { type: v as WidgetScene['type'] })}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hero">Hero (on load)</SelectItem>
                          <SelectItem value="idle">Idle</SelectItem>
                          <SelectItem value="engage">Engage</SelectItem>
                          <SelectItem value="cta">CTA Push</SelectItem>
                          <SelectItem value="exit_save">Exit Save</SelectItem>
                          <SelectItem value="testimonial">Testimonial</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Priority</Label>
                      <Input type="number" value={scene.priority} onChange={e => updateScene(idx, { priority: parseInt(e.target.value) || 1 })} className="h-9 text-sm" />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-xs">Video URL (MP4)</Label>
                      <Input value={scene.src_mp4} onChange={e => updateScene(idx, { src_mp4: e.target.value })} placeholder="https://...mp4" className="h-9 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs">Subtitle</Label>
                      <Input value={scene.subtitle_text || ''} onChange={e => updateScene(idx, { subtitle_text: e.target.value })} placeholder="Optional text" className="h-9 text-sm" />
                    </div>
                    <div className="flex items-center gap-2 pt-5">
                      <Switch checked={scene.loop} onCheckedChange={v => updateScene(idx, { loop: v })} />
                      <Label className="text-xs">Loop</Label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Triggers Tab */}
        <TabsContent value="triggers" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4 p-4 border border-border rounded-xl">
              <h4 className="font-medium text-foreground text-sm">Trigger Thresholds</h4>
              <div>
                <Label className="text-xs">Idle Seconds (trigger after inactivity)</Label>
                <Input type="number" value={triggers.idle_seconds || ''} onChange={e => setTriggers(t => ({ ...t, idle_seconds: parseInt(e.target.value) || undefined }))} placeholder="6" className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Scroll Depth % (trigger after scrolling)</Label>
                <Input type="number" value={triggers.scroll_percent || ''} onChange={e => setTriggers(t => ({ ...t, scroll_percent: parseInt(e.target.value) || undefined }))} placeholder="35" className="h-9" />
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={triggers.exit_intent || false} onCheckedChange={v => setTriggers(t => ({ ...t, exit_intent: v }))} />
                <Label className="text-xs">Exit Intent Detection (desktop)</Label>
              </div>
              <div>
                <Label className="text-xs">Pricing Hover Selector (CSS)</Label>
                <Input value={triggers.pricing_hover_selector || ''} onChange={e => setTriggers(t => ({ ...t, pricing_hover_selector: e.target.value || undefined }))} placeholder=".pricing-card" className="h-9" />
              </div>
            </div>

            <div className="space-y-4 p-4 border border-border rounded-xl">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-foreground text-sm">Event → Scene Rules</h4>
                <Button variant="outline" size="sm" onClick={addRule} className="gap-1">
                  <Plus className="w-3 h-3" /> Add Rule
                </Button>
              </div>
              {rules.map((rule, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Select value={rule.event} onValueChange={v => setRules(r => r.map((x, i) => i === idx ? { ...x, event: v as WidgetRule['event'] } : x))}>
                    <SelectTrigger className="h-8 text-xs w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PAGE_VIEW">Page View</SelectItem>
                      <SelectItem value="IDLE">Idle</SelectItem>
                      <SelectItem value="SCROLL_DEPTH">Scroll</SelectItem>
                      <SelectItem value="EXIT_INTENT">Exit Intent</SelectItem>
                      <SelectItem value="CTA_HOVER">CTA Hover</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground">→</span>
                  <Select value={rule.scene_id || ''} onValueChange={v => setRules(r => r.map((x, i) => i === idx ? { ...x, scene_id: v } : x))}>
                    <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Select scene" /></SelectTrigger>
                    <SelectContent>
                      {scenes.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="sm" onClick={() => setRules(r => r.filter((_, i) => i !== idx))} className="text-destructive h-8 w-8 p-0">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
              {rules.length === 0 && (
                <p className="text-xs text-muted-foreground">No rules. Scenes will play based on their type automatically.</p>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Branding Tab */}
        <TabsContent value="branding" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label>Primary Color</Label>
              <div className="flex gap-2">
                <input type="color" value={config.primary_color} onChange={e => updateConfig('primary_color', e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0" />
                <Input value={config.primary_color} onChange={e => updateConfig('primary_color', e.target.value)} className="flex-1" />
              </div>
            </div>
            <div>
              <Label>CTA Button Color</Label>
              <div className="flex gap-2">
                <input type="color" value={config.cta_color} onChange={e => updateConfig('cta_color', e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0" />
                <Input value={config.cta_color} onChange={e => updateConfig('cta_color', e.target.value)} className="flex-1" />
              </div>
            </div>
            <div>
              <Label>Background Color</Label>
              <div className="flex gap-2">
                <input type="color" value={config.background_color} onChange={e => updateConfig('background_color', e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0" />
                <Input value={config.background_color} onChange={e => updateConfig('background_color', e.target.value)} className="flex-1" />
              </div>
            </div>
            <div>
              <Label>Logo URL</Label>
              <Input value={config.logo_url || ''} onChange={e => updateConfig('logo_url', e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <Label>Font Family</Label>
              <Select value={config.font_family} onValueChange={v => updateConfig('font_family', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Inter">Inter</SelectItem>
                  <SelectItem value="system-ui">System UI</SelectItem>
                  <SelectItem value="Georgia">Georgia</SelectItem>
                  <SelectItem value="monospace">Monospace</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Position</Label>
              <Select value={config.position} onValueChange={v => updateConfig('position', v as WidgetPosition)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bottom-right">Bottom Right</SelectItem>
                  <SelectItem value="bottom-left">Bottom Left</SelectItem>
                  <SelectItem value="top-right">Top Right</SelectItem>
                  <SelectItem value="top-left">Top Left</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Widget Width (px)</Label>
              <Input type="number" value={config.widget_width} onChange={e => updateConfig('widget_width', parseInt(e.target.value) || 320)} />
            </div>
            <div>
              <Label>Widget Height (px)</Label>
              <Input type="number" value={config.widget_height} onChange={e => updateConfig('widget_height', parseInt(e.target.value) || 400)} />
            </div>
          </div>

          <div>
            <Label>Allowed Domains (one per line, empty = allow all)</Label>
            <textarea 
              value={(config.allowed_domains || []).join('\n')}
              onChange={e => updateConfig('allowed_domains', e.target.value.split('\n').map(d => d.trim()).filter(Boolean))}
              className="w-full h-24 rounded-xl border border-border bg-background px-4 py-3 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-foreground/10"
              placeholder="example.com&#10;shop.example.com"
            />
          </div>
        </TabsContent>

        {/* Embed Tab */}
        <TabsContent value="embed" className="space-y-6 mt-4">
          <div className="p-4 border border-border rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-foreground text-sm">Embed Code (iframe)</h4>
              <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(embedCode); toast.success('Copied!'); }} className="gap-1.5">
                <Copy className="w-3.5 h-3.5" /> Copy
              </Button>
            </div>
            <pre className="bg-muted rounded-lg p-3 text-xs font-mono text-foreground overflow-x-auto whitespace-pre-wrap break-all">
              {embedCode}
            </pre>
          </div>

          {config.slug && (
            <div className="p-4 border border-border rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-foreground text-sm">Landing Page URL</h4>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(landingUrl); toast.success('Copied!'); }} className="gap-1.5">
                    <Copy className="w-3.5 h-3.5" /> Copy
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/w/${config.slug}`} target="_blank" rel="noopener noreferrer" className="gap-1.5">
                      <ExternalLink className="w-3.5 h-3.5" /> Preview
                    </a>
                  </Button>
                </div>
              </div>
              <p className="text-sm font-mono text-muted-foreground">{landingUrl}</p>
            </div>
          )}

          <div className="p-4 border border-border rounded-xl">
            <h4 className="font-medium text-foreground text-sm mb-2">Public Key</h4>
            <p className="text-xs font-mono text-muted-foreground">{config.public_key}</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
