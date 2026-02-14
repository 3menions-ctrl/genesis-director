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
import { AIWidgetAssist } from './AIWidgetAssist';

/* ── dark glass tokens ── */
const glass = 'bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm';
const glassInput = 'bg-white/[0.06] border-white/[0.1] text-white/90 placeholder:text-white/25 focus-visible:ring-white/[0.15] focus-visible:border-white/[0.2]';
const textPrimary = 'text-white/90';
const textSecondary = 'text-white/50';
const textMuted = 'text-white/30';
const sectionLabel = `text-[10px] ${textMuted} uppercase tracking-wider font-medium`;

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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* AI Widget Assist */}
      <AIWidgetAssist
        widgetId={config.id}
        onConfigGenerated={(aiConfig) => {
          if (aiConfig.headline) updateConfig('headline', aiConfig.headline);
          if (aiConfig.subheadline) updateConfig('subheadline', aiConfig.subheadline);
          if (aiConfig.cta_text) updateConfig('cta_text', aiConfig.cta_text);
          if (aiConfig.cta_url) updateConfig('cta_url', aiConfig.cta_url);
          if (aiConfig.secondary_cta_text) updateConfig('secondary_cta_text', aiConfig.secondary_cta_text);
          if (aiConfig.tone) updateConfig('tone', aiConfig.tone as WidgetTone);
          if (aiConfig.widget_type) updateConfig('widget_type', aiConfig.widget_type as any);
          if (aiConfig.primary_color) updateConfig('primary_color', aiConfig.primary_color);
          if (aiConfig.background_color) updateConfig('background_color', aiConfig.background_color);
          if (aiConfig.scenes?.length) setScenes(aiConfig.scenes);
          if (aiConfig.triggers) setTriggers(aiConfig.triggers);
          if (aiConfig.rules?.length) setRules(aiConfig.rules);
        }}
      />

      {/* Save button */}
      <div className="flex justify-end">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium ${textPrimary} ${glass} hover:bg-white/[0.06] hover:border-white/[0.12] transition-all disabled:opacity-50`}
        >
          <Save className="w-4 h-4" />
          {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <Tabs defaultValue="content">
        <TabsList className="bg-white/[0.04] border border-white/[0.08] p-1 rounded-xl w-full grid grid-cols-5">
          {[
            { value: 'content', icon: FileText, label: 'Content' },
            { value: 'scenes', icon: Film, label: 'Scenes' },
            { value: 'triggers', icon: Zap, label: 'Triggers' },
            { value: 'branding', icon: Palette, label: 'Branding' },
            { value: 'embed', icon: Code2, label: 'Embed' },
          ].map(({ value, icon: Icon, label }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="data-[state=active]:bg-white/[0.1] data-[state=active]:text-white data-[state=active]:shadow-none rounded-lg gap-1.5 text-xs text-white/40"
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Content Tab */}
        <TabsContent value="content" className="mt-6">
          <div className={`rounded-2xl ${glass} p-6`}>
            <p className={`${sectionLabel} mb-5`}>Widget Settings</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: 'Widget Name', value: config.name, key: 'name' as const, placeholder: '' },
                { label: 'URL Slug', value: config.slug || '', key: 'slug' as const, placeholder: 'my-product' },
                { label: 'Headline', value: config.headline || '', key: 'headline' as const, placeholder: 'Transform your workflow' },
                { label: 'Subheadline', value: config.subheadline || '', key: 'subheadline' as const, placeholder: 'See how it works in 30 seconds' },
                { label: 'CTA Text', value: config.cta_text, key: 'cta_text' as const, placeholder: 'Get Started' },
                { label: 'CTA URL', value: config.cta_url || '', key: 'cta_url' as const, placeholder: 'https://...' },
                { label: 'Secondary CTA Text', value: config.secondary_cta_text || '', key: 'secondary_cta_text' as const, placeholder: 'Learn more' },
                { label: 'Secondary CTA URL', value: config.secondary_cta_url || '', key: 'secondary_cta_url' as const, placeholder: 'https://...' },
              ].map(({ label, value, key, placeholder }) => (
                <div key={key} className="space-y-1.5">
                  <Label className={`text-xs ${textSecondary}`}>{label}</Label>
                  <Input
                    value={value}
                    onChange={e => updateConfig(key, e.target.value)}
                    placeholder={placeholder}
                    className={glassInput}
                  />
                  {key === 'slug' && (
                    <p className={`text-[10px] ${textMuted} font-mono`}>/w/{config.slug || '...'}</p>
                  )}
                </div>
              ))}
            </div>

            <div className="h-px bg-white/[0.06] my-6" />
            <p className={`${sectionLabel} mb-5`}>Behavior</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: 'Widget Type', value: config.widget_type, key: 'widget_type', options: [{ v: 'embed', l: 'Embed Only' }, { v: 'landing_page', l: 'Landing Page Only' }, { v: 'both', l: 'Both' }] },
                { label: 'Tone', value: config.tone, key: 'tone', options: [{ v: 'friendly', l: 'Friendly' }, { v: 'bold', l: 'Bold' }, { v: 'funny', l: 'Funny' }, { v: 'professional', l: 'Professional' }, { v: 'urgent', l: 'Urgent' }] },
                { label: 'Sensitivity', value: config.sensitivity, key: 'sensitivity', options: [{ v: 'low', l: 'Low' }, { v: 'medium', l: 'Medium' }, { v: 'high', l: 'High' }] },
              ].map(({ label, value, key, options }) => (
                <div key={key} className="space-y-1.5">
                  <Label className={`text-xs ${textSecondary}`}>{label}</Label>
                  <Select value={value} onValueChange={v => updateConfig(key as any, v)}>
                    <SelectTrigger className={glassInput}><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#1a1714] border-white/[0.1]">
                      {options.map(o => <SelectItem key={o.v} value={o.v} className="text-white/80 focus:bg-white/[0.08] focus:text-white">{o.l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Scenes Tab */}
        <TabsContent value="scenes" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className={sectionLabel}>Video Scenes ({scenes.length})</p>
            <button onClick={addScene} className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg ${glass} ${textSecondary} hover:text-white/80 hover:bg-white/[0.06] transition-all`}>
              <Plus className="w-3.5 h-3.5" /> Add Scene
            </button>
          </div>

          {scenes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] p-12 text-center">
              <p className={`text-sm ${textSecondary}`}>No scenes yet. Add your first video scene.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {scenes.map((scene, idx) => (
                <div key={scene.id} className={`rounded-2xl ${glass} p-5 space-y-3`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GripVertical className={`w-4 h-4 ${textMuted}`} />
                      <span className={`text-sm font-medium ${textPrimary}`}>{scene.name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-md bg-white/[0.06] ${textMuted} uppercase tracking-wider`}>{scene.type}</span>
                    </div>
                    <button className={`h-8 w-8 flex items-center justify-center rounded-lg ${textMuted} hover:text-red-400 hover:bg-red-500/10 transition-all`} onClick={() => removeScene(idx)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className={`text-[10px] ${textMuted}`}>Name</Label>
                      <Input value={scene.name} onChange={e => updateScene(idx, { name: e.target.value })} className={`h-9 text-sm ${glassInput}`} />
                    </div>
                    <div className="space-y-1">
                      <Label className={`text-[10px] ${textMuted}`}>Type</Label>
                      <Select value={scene.type} onValueChange={v => updateScene(idx, { type: v as WidgetScene['type'] })}>
                        <SelectTrigger className={`h-9 ${glassInput}`}><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-[#1a1714] border-white/[0.1]">
                          {['hero', 'idle', 'engage', 'cta', 'exit_save', 'testimonial'].map(t => (
                            <SelectItem key={t} value={t} className="text-white/80 focus:bg-white/[0.08] focus:text-white capitalize">{t.replace('_', ' ')}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className={`text-[10px] ${textMuted}`}>Priority</Label>
                      <Input type="number" value={scene.priority} onChange={e => updateScene(idx, { priority: parseInt(e.target.value) || 1 })} className={`h-9 text-sm ${glassInput}`} />
                    </div>
                    <div className="md:col-span-2 space-y-1">
                      <Label className={`text-[10px] ${textMuted}`}>Video URL (MP4)</Label>
                      <Input value={scene.src_mp4} onChange={e => updateScene(idx, { src_mp4: e.target.value })} placeholder="https://...mp4" className={`h-9 text-sm ${glassInput}`} />
                    </div>
                    <div className="space-y-1">
                      <Label className={`text-[10px] ${textMuted}`}>Subtitle</Label>
                      <Input value={scene.subtitle_text || ''} onChange={e => updateScene(idx, { subtitle_text: e.target.value })} placeholder="Optional" className={`h-9 text-sm ${glassInput}`} />
                    </div>
                    <div className="flex items-center gap-2.5 pt-5">
                      <Switch checked={scene.loop} onCheckedChange={v => updateScene(idx, { loop: v })} />
                      <Label className={`text-xs ${textSecondary}`}>Loop</Label>
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
            <div className={`rounded-2xl ${glass} p-5 space-y-4`}>
              <p className={sectionLabel}>Trigger Thresholds</p>
              <div className="space-y-1.5">
                <Label className={`text-xs ${textSecondary}`}>Idle Seconds</Label>
                <Input type="number" value={triggers.idle_seconds || ''} onChange={e => setTriggers(t => ({ ...t, idle_seconds: parseInt(e.target.value) || undefined }))} placeholder="6" className={`h-9 ${glassInput}`} />
              </div>
              <div className="space-y-1.5">
                <Label className={`text-xs ${textSecondary}`}>Scroll Depth %</Label>
                <Input type="number" value={triggers.scroll_percent || ''} onChange={e => setTriggers(t => ({ ...t, scroll_percent: parseInt(e.target.value) || undefined }))} placeholder="35" className={`h-9 ${glassInput}`} />
              </div>
              <div className="flex items-center gap-3 pt-1">
                <Switch checked={triggers.exit_intent || false} onCheckedChange={v => setTriggers(t => ({ ...t, exit_intent: v }))} />
                <Label className={`text-xs ${textPrimary}`}>Exit Intent Detection</Label>
              </div>
              <div className="space-y-1.5">
                <Label className={`text-xs ${textSecondary}`}>Pricing Hover Selector</Label>
                <Input value={triggers.pricing_hover_selector || ''} onChange={e => setTriggers(t => ({ ...t, pricing_hover_selector: e.target.value || undefined }))} placeholder=".pricing-card" className={`h-9 font-mono ${glassInput}`} />
              </div>
            </div>

            <div className={`rounded-2xl ${glass} p-5 space-y-4`}>
              <div className="flex items-center justify-between">
                <p className={sectionLabel}>Event → Scene Rules</p>
                <button onClick={addRule} className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg ${glass} ${textSecondary} hover:text-white/80 hover:bg-white/[0.06] transition-all`}>
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
              {rules.map((rule, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Select value={rule.event} onValueChange={v => setRules(r => r.map((x, i) => i === idx ? { ...x, event: v as WidgetRule['event'] } : x))}>
                    <SelectTrigger className={`h-8 text-xs w-[130px] ${glassInput}`}><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#1a1714] border-white/[0.1]">
                      {['PAGE_VIEW', 'IDLE', 'SCROLL_DEPTH', 'EXIT_INTENT', 'CTA_HOVER'].map(e => (
                        <SelectItem key={e} value={e} className="text-white/80 focus:bg-white/[0.08] focus:text-white text-xs">{e.replace('_', ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className={`text-xs ${textMuted}`}>→</span>
                  <Select value={rule.scene_id || ''} onValueChange={v => setRules(r => r.map((x, i) => i === idx ? { ...x, scene_id: v } : x))}>
                    <SelectTrigger className={`h-8 text-xs flex-1 ${glassInput}`}><SelectValue placeholder="Select scene" /></SelectTrigger>
                    <SelectContent className="bg-[#1a1714] border-white/[0.1]">
                      {scenes.map(s => <SelectItem key={s.id} value={s.id} className="text-white/80 focus:bg-white/[0.08] focus:text-white">{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <button className={`h-8 w-8 flex items-center justify-center rounded-lg ${textMuted} hover:text-red-400 hover:bg-red-500/10 transition-all`} onClick={() => setRules(r => r.filter((_, i) => i !== idx))}>
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {rules.length === 0 && (
                <p className={`text-xs ${textSecondary}`}>No rules configured. Scenes play by type.</p>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Branding Tab */}
        <TabsContent value="branding" className="mt-6">
          <div className={`rounded-2xl ${glass} p-6`}>
            <p className={`${sectionLabel} mb-5`}>Visual Identity</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { label: 'Primary Color', value: config.primary_color, key: 'primary_color' as const },
                { label: 'CTA Button Color', value: config.cta_color, key: 'cta_color' as const },
                { label: 'Background Color', value: config.background_color, key: 'background_color' as const },
              ].map(({ label, value, key }) => (
                <div key={key} className="space-y-1.5">
                  <Label className={`text-xs ${textSecondary}`}>{label}</Label>
                  <div className="flex gap-2">
                    <div className="relative w-10 h-10 rounded-lg border border-white/[0.1] overflow-hidden shrink-0">
                      <input type="color" value={value} onChange={e => updateConfig(key, e.target.value)} className="absolute inset-0 w-full h-full cursor-pointer opacity-0" />
                      <div className="w-full h-full" style={{ backgroundColor: value }} />
                    </div>
                    <Input value={value} onChange={e => updateConfig(key, e.target.value)} className={`flex-1 font-mono text-xs ${glassInput}`} />
                  </div>
                </div>
              ))}
              <div className="space-y-1.5">
                <Label className={`text-xs ${textSecondary}`}>Logo URL</Label>
                <Input value={config.logo_url || ''} onChange={e => updateConfig('logo_url', e.target.value)} placeholder="https://..." className={glassInput} />
              </div>
              <div className="space-y-1.5">
                <Label className={`text-xs ${textSecondary}`}>Font Family</Label>
                <Select value={config.font_family} onValueChange={v => updateConfig('font_family', v)}>
                  <SelectTrigger className={glassInput}><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#1a1714] border-white/[0.1]">
                    {['Inter', 'system-ui', 'Georgia', 'monospace'].map(f => (
                      <SelectItem key={f} value={f} className="text-white/80 focus:bg-white/[0.08] focus:text-white">{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className={`text-xs ${textSecondary}`}>Position</Label>
                <Select value={config.position} onValueChange={v => updateConfig('position', v as WidgetPosition)}>
                  <SelectTrigger className={glassInput}><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#1a1714] border-white/[0.1]">
                    {[{ v: 'bottom-right', l: 'Bottom Right' }, { v: 'bottom-left', l: 'Bottom Left' }, { v: 'top-right', l: 'Top Right' }, { v: 'top-left', l: 'Top Left' }, { v: 'center', l: 'Center' }].map(o => (
                      <SelectItem key={o.v} value={o.v} className="text-white/80 focus:bg-white/[0.08] focus:text-white">{o.l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className={`text-xs ${textSecondary}`}>Width (px)</Label>
                <Input type="number" value={config.widget_width} onChange={e => updateConfig('widget_width', parseInt(e.target.value) || 320)} className={glassInput} />
              </div>
              <div className="space-y-1.5">
                <Label className={`text-xs ${textSecondary}`}>Height (px)</Label>
                <Input type="number" value={config.widget_height} onChange={e => updateConfig('widget_height', parseInt(e.target.value) || 400)} className={glassInput} />
              </div>
            </div>

            <div className="h-px bg-white/[0.06] my-6" />
            <div className="space-y-1.5">
              <Label className={`text-xs ${textSecondary}`}>Allowed Domains (one per line)</Label>
              <textarea
                value={(config.allowed_domains || []).join('\n')}
                onChange={e => updateConfig('allowed_domains', e.target.value.split('\n').map(d => d.trim()).filter(Boolean))}
                className={`w-full h-24 rounded-xl border px-4 py-3 text-sm font-mono resize-none focus:outline-none focus:ring-2 ${glassInput} focus:ring-white/[0.1]`}
                placeholder={"example.com\nshop.example.com"}
              />
            </div>
          </div>
        </TabsContent>

        {/* Embed Tab */}
        <TabsContent value="embed" className="mt-6 space-y-4">
          <div className={`rounded-2xl ${glass} p-5`}>
            <div className="flex items-center justify-between mb-4">
              <p className={sectionLabel}>Embed Code (iframe)</p>
              <button onClick={() => { navigator.clipboard.writeText(embedCode); toast.success('Copied!'); }} className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg ${glass} ${textSecondary} hover:text-white/80 hover:bg-white/[0.06] transition-all`}>
                <Copy className="w-3.5 h-3.5" /> Copy
              </button>
            </div>
            <pre className={`bg-white/[0.03] rounded-xl p-4 text-[11px] font-mono ${textSecondary} overflow-x-auto whitespace-pre-wrap break-all leading-relaxed border border-white/[0.06]`}>
              {embedCode}
            </pre>
          </div>

          {config.slug && (
            <div className={`rounded-2xl ${glass} p-5`}>
              <div className="flex items-center justify-between mb-4">
                <p className={sectionLabel}>Landing Page URL</p>
                <div className="flex gap-2">
                  <button onClick={() => { navigator.clipboard.writeText(landingUrl); toast.success('Copied!'); }} className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg ${glass} ${textSecondary} hover:text-white/80 hover:bg-white/[0.06] transition-all`}>
                    <Copy className="w-3.5 h-3.5" /> Copy
                  </button>
                  <a href={`/w/${config.slug}`} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg ${glass} ${textSecondary} hover:text-white/80 hover:bg-white/[0.06] transition-all`}>
                    <ExternalLink className="w-3.5 h-3.5" /> Preview
                  </a>
                </div>
              </div>
              <p className={`text-sm font-mono ${textSecondary}`}>{landingUrl}</p>
            </div>
          )}

          <div className={`rounded-2xl ${glass} p-5`}>
            <p className={`${sectionLabel} mb-2`}>Public Key</p>
            <p className={`text-xs font-mono ${textSecondary}`}>{config.public_key}</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
