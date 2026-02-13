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
import { Plus, Trash2, GripVertical, Copy, ExternalLink, Save, FileText, Film, Zap, Palette, Code2 } from 'lucide-react';
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
          name: config.name, slug: config.slug, widget_type: config.widget_type,
          primary_color: config.primary_color, logo_url: config.logo_url,
          background_color: config.background_color, font_family: config.font_family,
          position: config.position, z_index: config.z_index,
          widget_width: config.widget_width, widget_height: config.widget_height,
          cta_text: config.cta_text, cta_url: config.cta_url, cta_color: config.cta_color,
          secondary_cta_text: config.secondary_cta_text, secondary_cta_url: config.secondary_cta_url,
          headline: config.headline, subheadline: config.subheadline,
          scenes: JSON.parse(JSON.stringify(scenes)),
          triggers: JSON.parse(JSON.stringify(triggers)),
          rules: JSON.parse(JSON.stringify(rules)),
          sensitivity: config.sensitivity, allowed_domains: config.allowed_domains, tone: config.tone,
        })
        .eq('id', config.id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as WidgetConfig;
    },
    onSuccess: (data) => { onUpdate(data); toast.success('Widget saved!'); },
    onError: () => toast.error('Failed to save'),
  });

  const updateConfig = useCallback(<K extends keyof WidgetConfig>(key: K, value: WidgetConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  }, []);

  const addScene = useCallback(() => {
    setScenes(prev => [...prev, {
      id: crypto.randomUUID(), name: `Scene ${prev.length + 1}`,
      type: 'engage', src_mp4: '', loop: false, priority: prev.length + 1,
    }]);
  }, []);

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

  // Shared glass panel style
  const glassPanel = "rounded-2xl bg-white/[0.02] border border-white/[0.06] p-5";
  const glassInput = "bg-white/[0.03] border-white/[0.08] text-foreground placeholder:text-white/25";
  const sectionLabel = "text-[10px] text-white/30 uppercase tracking-wider font-medium";

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Save button */}
      <div className="flex justify-end">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.15] transition-all text-sm font-medium text-foreground disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <Tabs defaultValue="content">
        <TabsList className="bg-white/[0.03] border border-white/[0.08] p-1 rounded-xl w-full grid grid-cols-5">
          <TabsTrigger value="content" className="data-[state=active]:bg-white/[0.08] rounded-lg gap-1.5 text-xs"><FileText className="w-3.5 h-3.5" /> Content</TabsTrigger>
          <TabsTrigger value="scenes" className="data-[state=active]:bg-white/[0.08] rounded-lg gap-1.5 text-xs"><Film className="w-3.5 h-3.5" /> Scenes</TabsTrigger>
          <TabsTrigger value="triggers" className="data-[state=active]:bg-white/[0.08] rounded-lg gap-1.5 text-xs"><Zap className="w-3.5 h-3.5" /> Triggers</TabsTrigger>
          <TabsTrigger value="branding" className="data-[state=active]:bg-white/[0.08] rounded-lg gap-1.5 text-xs"><Palette className="w-3.5 h-3.5" /> Branding</TabsTrigger>
          <TabsTrigger value="embed" className="data-[state=active]:bg-white/[0.08] rounded-lg gap-1.5 text-xs"><Code2 className="w-3.5 h-3.5" /> Embed</TabsTrigger>
        </TabsList>

        {/* Content Tab */}
        <TabsContent value="content" className="mt-6">
          <div className={glassPanel}>
            <p className={`${sectionLabel} mb-5`}>Widget Settings</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-white/50">Widget Name</Label>
                <Input value={config.name} onChange={e => updateConfig('name', e.target.value)} className={glassInput} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-white/50">URL Slug</Label>
                <Input value={config.slug || ''} onChange={e => updateConfig('slug', e.target.value)} placeholder="my-product" className={glassInput} />
                <p className="text-[10px] text-white/20 font-mono">/w/{config.slug || '...'}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-white/50">Headline</Label>
                <Input value={config.headline || ''} onChange={e => updateConfig('headline', e.target.value)} placeholder="Transform your workflow" className={glassInput} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-white/50">Subheadline</Label>
                <Input value={config.subheadline || ''} onChange={e => updateConfig('subheadline', e.target.value)} placeholder="See how it works in 30 seconds" className={glassInput} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-white/50">CTA Text</Label>
                <Input value={config.cta_text} onChange={e => updateConfig('cta_text', e.target.value)} placeholder="Get Started" className={glassInput} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-white/50">CTA URL</Label>
                <Input value={config.cta_url || ''} onChange={e => updateConfig('cta_url', e.target.value)} placeholder="https://..." className={glassInput} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-white/50">Secondary CTA Text</Label>
                <Input value={config.secondary_cta_text || ''} onChange={e => updateConfig('secondary_cta_text', e.target.value)} placeholder="Learn more" className={glassInput} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-white/50">Secondary CTA URL</Label>
                <Input value={config.secondary_cta_url || ''} onChange={e => updateConfig('secondary_cta_url', e.target.value)} placeholder="https://..." className={glassInput} />
              </div>
            </div>

            <div className="h-px bg-white/[0.05] my-6" />
            <p className={`${sectionLabel} mb-5`}>Behavior</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-white/50">Widget Type</Label>
                <Select value={config.widget_type} onValueChange={v => updateConfig('widget_type', v as WidgetConfig['widget_type'])}>
                  <SelectTrigger className={glassInput}><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-zinc-900/95 backdrop-blur-xl border-white/10">
                    <SelectItem value="embed">Embed Only</SelectItem>
                    <SelectItem value="landing_page">Landing Page Only</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-white/50">Tone</Label>
                <Select value={config.tone} onValueChange={v => updateConfig('tone', v as WidgetTone)}>
                  <SelectTrigger className={glassInput}><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-zinc-900/95 backdrop-blur-xl border-white/10">
                    <SelectItem value="friendly">Friendly</SelectItem>
                    <SelectItem value="bold">Bold</SelectItem>
                    <SelectItem value="funny">Funny</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-white/50">Sensitivity</Label>
                <Select value={config.sensitivity} onValueChange={v => updateConfig('sensitivity', v as WidgetSensitivity)}>
                  <SelectTrigger className={glassInput}><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-zinc-900/95 backdrop-blur-xl border-white/10">
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Scenes Tab */}
        <TabsContent value="scenes" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className={sectionLabel}>Video Scenes ({scenes.length})</p>
            <button onClick={addScene} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] text-xs text-white/60 hover:text-white/90 transition-all">
              <Plus className="w-3 h-3" /> Add Scene
            </button>
          </div>

          {scenes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.01] p-12 text-center">
              <p className="text-sm text-white/30">No scenes yet. Add your first video scene.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {scenes.map((scene, idx) => (
                <div key={scene.id} className={`${glassPanel} space-y-3`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GripVertical className="w-4 h-4 text-white/15" />
                      <span className="text-sm font-medium text-foreground">{scene.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.04] text-white/30 uppercase tracking-wider">{scene.type}</span>
                    </div>
                    <button onClick={() => removeScene(idx)} className="text-white/20 hover:text-destructive transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-white/30">Name</Label>
                      <Input value={scene.name} onChange={e => updateScene(idx, { name: e.target.value })} className={`h-9 text-sm ${glassInput}`} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-white/30">Type</Label>
                      <Select value={scene.type} onValueChange={v => updateScene(idx, { type: v as WidgetScene['type'] })}>
                        <SelectTrigger className={`h-9 ${glassInput}`}><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-zinc-900/95 backdrop-blur-xl border-white/10">
                          <SelectItem value="hero">Hero</SelectItem>
                          <SelectItem value="idle">Idle</SelectItem>
                          <SelectItem value="engage">Engage</SelectItem>
                          <SelectItem value="cta">CTA Push</SelectItem>
                          <SelectItem value="exit_save">Exit Save</SelectItem>
                          <SelectItem value="testimonial">Testimonial</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-white/30">Priority</Label>
                      <Input type="number" value={scene.priority} onChange={e => updateScene(idx, { priority: parseInt(e.target.value) || 1 })} className={`h-9 text-sm ${glassInput}`} />
                    </div>
                    <div className="md:col-span-2 space-y-1">
                      <Label className="text-[10px] text-white/30">Video URL (MP4)</Label>
                      <Input value={scene.src_mp4} onChange={e => updateScene(idx, { src_mp4: e.target.value })} placeholder="https://...mp4" className={`h-9 text-sm ${glassInput}`} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-white/30">Subtitle</Label>
                      <Input value={scene.subtitle_text || ''} onChange={e => updateScene(idx, { subtitle_text: e.target.value })} placeholder="Optional" className={`h-9 text-sm ${glassInput}`} />
                    </div>
                    <div className="flex items-center gap-2.5 pt-5">
                      <Switch checked={scene.loop} onCheckedChange={v => updateScene(idx, { loop: v })} />
                      <Label className="text-xs text-white/40">Loop</Label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Triggers Tab */}
        <TabsContent value="triggers" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`${glassPanel} space-y-4`}>
              <p className={sectionLabel}>Trigger Thresholds</p>
              <div className="space-y-1.5">
                <Label className="text-xs text-white/50">Idle Seconds</Label>
                <Input type="number" value={triggers.idle_seconds || ''} onChange={e => setTriggers(t => ({ ...t, idle_seconds: parseInt(e.target.value) || undefined }))} placeholder="6" className={`h-9 ${glassInput}`} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-white/50">Scroll Depth %</Label>
                <Input type="number" value={triggers.scroll_percent || ''} onChange={e => setTriggers(t => ({ ...t, scroll_percent: parseInt(e.target.value) || undefined }))} placeholder="35" className={`h-9 ${glassInput}`} />
              </div>
              <div className="flex items-center gap-3 pt-1">
                <Switch checked={triggers.exit_intent || false} onCheckedChange={v => setTriggers(t => ({ ...t, exit_intent: v }))} />
                <Label className="text-xs text-white/50">Exit Intent Detection</Label>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-white/50">Pricing Hover Selector</Label>
                <Input value={triggers.pricing_hover_selector || ''} onChange={e => setTriggers(t => ({ ...t, pricing_hover_selector: e.target.value || undefined }))} placeholder=".pricing-card" className={`h-9 font-mono ${glassInput}`} />
              </div>
            </div>

            <div className={`${glassPanel} space-y-4`}>
              <div className="flex items-center justify-between">
                <p className={sectionLabel}>Event → Scene Rules</p>
                <button onClick={addRule} className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] text-[10px] text-white/40 hover:text-white/70 transition-all">
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
              {rules.map((rule, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Select value={rule.event} onValueChange={v => setRules(r => r.map((x, i) => i === idx ? { ...x, event: v as WidgetRule['event'] } : x))}>
                    <SelectTrigger className={`h-8 text-xs w-[130px] ${glassInput}`}><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-zinc-900/95 backdrop-blur-xl border-white/10">
                      <SelectItem value="PAGE_VIEW">Page View</SelectItem>
                      <SelectItem value="IDLE">Idle</SelectItem>
                      <SelectItem value="SCROLL_DEPTH">Scroll</SelectItem>
                      <SelectItem value="EXIT_INTENT">Exit Intent</SelectItem>
                      <SelectItem value="CTA_HOVER">CTA Hover</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-[10px] text-white/15">→</span>
                  <Select value={rule.scene_id || ''} onValueChange={v => setRules(r => r.map((x, i) => i === idx ? { ...x, scene_id: v } : x))}>
                    <SelectTrigger className={`h-8 text-xs flex-1 ${glassInput}`}><SelectValue placeholder="Select scene" /></SelectTrigger>
                    <SelectContent className="bg-zinc-900/95 backdrop-blur-xl border-white/10">
                      {scenes.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <button onClick={() => setRules(r => r.filter((_, i) => i !== idx))} className="text-white/15 hover:text-destructive transition-colors h-8 w-8 flex items-center justify-center">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {rules.length === 0 && (
                <p className="text-xs text-white/20">No rules configured. Scenes play by type.</p>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Branding Tab */}
        <TabsContent value="branding" className="mt-6">
          <div className={glassPanel}>
            <p className={`${sectionLabel} mb-5`}>Visual Identity</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { label: 'Primary Color', value: config.primary_color, key: 'primary_color' as const },
                { label: 'CTA Button Color', value: config.cta_color, key: 'cta_color' as const },
                { label: 'Background Color', value: config.background_color, key: 'background_color' as const },
              ].map(({ label, value, key }) => (
                <div key={key} className="space-y-1.5">
                  <Label className="text-xs text-white/50">{label}</Label>
                  <div className="flex gap-2">
                    <div className="relative w-10 h-10 rounded-lg border border-white/[0.08] overflow-hidden">
                      <input type="color" value={value} onChange={e => updateConfig(key, e.target.value)} className="absolute inset-0 w-full h-full cursor-pointer opacity-0" />
                      <div className="w-full h-full" style={{ backgroundColor: value }} />
                    </div>
                    <Input value={value} onChange={e => updateConfig(key, e.target.value)} className={`flex-1 font-mono text-xs ${glassInput}`} />
                  </div>
                </div>
              ))}
              <div className="space-y-1.5">
                <Label className="text-xs text-white/50">Logo URL</Label>
                <Input value={config.logo_url || ''} onChange={e => updateConfig('logo_url', e.target.value)} placeholder="https://..." className={glassInput} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-white/50">Font Family</Label>
                <Select value={config.font_family} onValueChange={v => updateConfig('font_family', v)}>
                  <SelectTrigger className={glassInput}><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-zinc-900/95 backdrop-blur-xl border-white/10">
                    <SelectItem value="Inter">Inter</SelectItem>
                    <SelectItem value="system-ui">System UI</SelectItem>
                    <SelectItem value="Georgia">Georgia</SelectItem>
                    <SelectItem value="monospace">Monospace</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-white/50">Position</Label>
                <Select value={config.position} onValueChange={v => updateConfig('position', v as WidgetPosition)}>
                  <SelectTrigger className={glassInput}><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-zinc-900/95 backdrop-blur-xl border-white/10">
                    <SelectItem value="bottom-right">Bottom Right</SelectItem>
                    <SelectItem value="bottom-left">Bottom Left</SelectItem>
                    <SelectItem value="top-right">Top Right</SelectItem>
                    <SelectItem value="top-left">Top Left</SelectItem>
                    <SelectItem value="center">Center</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-white/50">Width (px)</Label>
                <Input type="number" value={config.widget_width} onChange={e => updateConfig('widget_width', parseInt(e.target.value) || 320)} className={glassInput} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-white/50">Height (px)</Label>
                <Input type="number" value={config.widget_height} onChange={e => updateConfig('widget_height', parseInt(e.target.value) || 400)} className={glassInput} />
              </div>
            </div>

            <div className="h-px bg-white/[0.05] my-6" />
            <div className="space-y-1.5">
              <Label className="text-xs text-white/50">Allowed Domains (one per line)</Label>
              <textarea 
                value={(config.allowed_domains || []).join('\n')}
                onChange={e => updateConfig('allowed_domains', e.target.value.split('\n').map(d => d.trim()).filter(Boolean))}
                className="w-full h-24 rounded-xl bg-white/[0.03] border border-white/[0.08] px-4 py-3 text-sm font-mono text-foreground placeholder:text-white/25 resize-none focus:outline-none focus:ring-1 focus:ring-white/10"
                placeholder={"example.com\nshop.example.com"}
              />
            </div>
          </div>
        </TabsContent>

        {/* Embed Tab */}
        <TabsContent value="embed" className="mt-6 space-y-4">
          <div className={glassPanel}>
            <div className="flex items-center justify-between mb-4">
              <p className={sectionLabel}>Embed Code (iframe)</p>
              <button onClick={() => { navigator.clipboard.writeText(embedCode); toast.success('Copied!'); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] text-xs text-white/50 hover:text-white/80 transition-all">
                <Copy className="w-3 h-3" /> Copy
              </button>
            </div>
            <pre className="bg-black/30 rounded-xl p-4 text-[11px] font-mono text-white/50 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed border border-white/[0.04]">
              {embedCode}
            </pre>
          </div>

          {config.slug && (
            <div className={glassPanel}>
              <div className="flex items-center justify-between mb-4">
                <p className={sectionLabel}>Landing Page URL</p>
                <div className="flex gap-2">
                  <button onClick={() => { navigator.clipboard.writeText(landingUrl); toast.success('Copied!'); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] text-xs text-white/50 hover:text-white/80 transition-all">
                    <Copy className="w-3 h-3" /> Copy
                  </button>
                  <a href={`/w/${config.slug}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] text-xs text-white/50 hover:text-white/80 transition-all">
                    <ExternalLink className="w-3 h-3" /> Preview
                  </a>
                </div>
              </div>
              <p className="text-sm font-mono text-white/40">{landingUrl}</p>
            </div>
          )}

          <div className={glassPanel}>
            <p className={`${sectionLabel} mb-2`}>Public Key</p>
            <p className="text-xs font-mono text-white/30">{config.public_key}</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
