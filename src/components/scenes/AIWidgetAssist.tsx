import React, { useState } from 'react';
import { Sparkles, Wand2, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { WidgetConfig, WidgetScene, WidgetTriggers, WidgetRule } from '@/types/widget';

const glass = 'bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm';
const glassInput = 'bg-white/[0.06] border border-white/[0.1] text-white/90 placeholder:text-white/25 focus:ring-1 focus:ring-white/[0.15] focus:border-white/[0.2] outline-none';

const STYLES = [
  {
    id: 'cinematic_hero',
    name: 'Cinematic Hero',
    description: 'Full-screen background video with layered text & CTA reveal',
    icon: '🎬',
  },
  {
    id: '4th_wall_breakthrough',
    name: '4th Wall Breakthrough',
    description: 'Character breaks out of the video container — premium breakout effect',
    icon: '💥',
  },
  {
    id: 'minimal_embed',
    name: 'Minimal Embed',
    description: 'Clean floating widget with auto-play scene and subtle CTA',
    icon: '✨',
  },
] as const;

type StyleId = typeof STYLES[number]['id'];

interface AIWidgetAssistProps {
  widgetId: string;
  onConfigGenerated: (config: {
    headline?: string;
    subheadline?: string;
    cta_text?: string;
    cta_url?: string;
    secondary_cta_text?: string;
    tone?: string;
    widget_type?: string;
    primary_color?: string;
    background_color?: string;
    scenes: WidgetScene[];
    triggers: WidgetTriggers;
    rules: WidgetRule[];
  }) => void;
}

export function AIWidgetAssist({ widgetId, onConfigGenerated }: AIWidgetAssistProps) {
  const [expanded, setExpanded] = useState(true);
  const [concept, setConcept] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<StyleId>('cinematic_hero');
  const [generating, setGenerating] = useState(false);
  const [generateVideos, setGenerateVideos] = useState(true);

  const handleGenerate = async () => {
    if (!concept.trim()) {
      toast.error('Describe your landing page concept first');
      return;
    }

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-widget-config', {
        body: {
          concept: concept.trim(),
          style: selectedStyle,
          widget_id: widgetId,
          generate_videos: generateVideos,
        },
      });

      if (error) throw error;

      if (data?.config) {
        onConfigGenerated(data.config);
        toast.success('Widget config generated! Review and save.');
        if (data.video_generation_started) {
          toast.info('Video generation started — check back in a few minutes.');
        }
      } else if (data?.error) {
        toast.error(data.error);
      }
    } catch (err: any) {
      console.error('AI generation failed:', err);
      if (err?.message?.includes('429')) {
        toast.error('Rate limited — please try again in a moment.');
      } else if (err?.message?.includes('402')) {
        toast.error('Credits required — please add funds to continue.');
      } else {
        toast.error('Failed to generate config. Try again.');
      }
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className={cn('rounded-2xl overflow-hidden transition-all', glass)}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-violet-400" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-white/90">AI Widget Builder</p>
            <p className="text-[10px] text-white/30">Describe your concept → AI builds everything</p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-white/30" />
        ) : (
          <ChevronDown className="w-4 h-4 text-white/30" />
        )}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-5 border-t border-white/[0.06] pt-5">
          {/* Concept Input */}
          <div className="space-y-2">
            <label className="text-[10px] text-white/30 uppercase tracking-wider font-medium">
              What's this landing page about?
            </label>
            <textarea
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="E.g., A fitness coaching app that helps busy professionals get in shape with 15-minute daily workouts. The video should show an energetic trainer demonstrating exercises and speaking directly to the viewer..."
              rows={4}
              className={cn(
                'w-full rounded-xl px-4 py-3 text-sm resize-none',
                glassInput
              )}
            />
            <p className="text-[10px] text-white/20">
              Include details about the product, target audience, video content, and desired CTA action.
            </p>
          </div>

          {/* Style Selection */}
          <div className="space-y-2">
            <label className="text-[10px] text-white/30 uppercase tracking-wider font-medium">
              Visual Style
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {STYLES.map((style) => (
                <button
                  key={style.id}
                  onClick={() => setSelectedStyle(style.id)}
                  className={cn(
                    'flex flex-col items-start gap-1.5 p-3 rounded-xl border text-left transition-all',
                    selectedStyle === style.id
                      ? 'border-violet-500/40 bg-violet-500/10'
                      : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.1]'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{style.icon}</span>
                    <span className={cn(
                      'text-xs font-medium',
                      selectedStyle === style.id ? 'text-violet-300' : 'text-white/70'
                    )}>
                      {style.name}
                    </span>
                  </div>
                  <p className="text-[10px] text-white/25 leading-relaxed">
                    {style.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Video Generation Toggle */}
          <div className="flex items-center gap-3 px-1">
            <button
              onClick={() => setGenerateVideos(!generateVideos)}
              className={cn(
                'w-9 h-5 rounded-full transition-colors relative',
                generateVideos ? 'bg-violet-500' : 'bg-white/[0.1]'
              )}
            >
              <div className={cn(
                'w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform',
                generateVideos ? 'translate-x-[18px]' : 'translate-x-0.5'
              )} />
            </button>
            <div>
              <p className="text-xs text-white/70">Auto-generate videos via Apex Pipeline</p>
              <p className="text-[10px] text-white/25">Uses credits to produce video scenes</p>
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={generating || !concept.trim()}
            className={cn(
              'w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-medium transition-all',
              generating || !concept.trim()
                ? 'bg-white/[0.06] text-white/30 cursor-not-allowed'
                : 'bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-500 hover:to-purple-500 shadow-lg shadow-violet-500/20'
            )}
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating config...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                Build with AI
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
