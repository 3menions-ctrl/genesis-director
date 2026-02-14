import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Wand2, Loader2, ChevronDown, ChevronUp, CheckCircle2, AlertCircle, Film, Camera, Lightbulb, Zap } from 'lucide-react';
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
    scenes: 3,
    techniques: ['Crane reveal', 'Rack focus', 'Volumetric lighting'],
  },
  {
    id: '4th_wall_breakthrough',
    name: '4th Wall Breakthrough',
    description: 'Character breaks out of the video container — premium breakout effect',
    icon: '💥',
    scenes: 3,
    techniques: ['Reality shatter', 'Particle physics', 'Direct address'],
  },
  {
    id: 'minimal_embed',
    name: 'Minimal Embed',
    description: 'Clean floating widget with auto-play scene and subtle CTA',
    icon: '✨',
    scenes: 2,
    techniques: ['Orbital camera', 'Soft DOF', 'Gentle push-in'],
  },
] as const;

type StyleId = typeof STYLES[number]['id'];

type PipelineStage = 'idle' | 'generating_config' | 'launching_videos' | 'videos_in_progress' | 'complete' | 'error';

interface GeneratedProject {
  sceneId: string;
  projectId: string;
}

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
  const [generateVideos, setGenerateVideos] = useState(true);
  
  // Pipeline state
  const [stage, setStage] = useState<PipelineStage>('idle');
  const [stageMessage, setStageMessage] = useState('');
  const [generatedProjects, setGeneratedProjects] = useState<GeneratedProject[]>([]);
  const [sceneStatuses, setSceneStatuses] = useState<Record<string, string>>({});
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Poll video generation progress
  useEffect(() => {
    if (stage !== 'videos_in_progress' || generatedProjects.length === 0) return;

    const poll = async () => {
      const projectIds = generatedProjects.map(p => p.projectId);
      const { data: projects } = await supabase
        .from('movie_projects')
        .select('id, status, video_url, thumbnail_url')
        .in('id', projectIds);

      if (!projects) return;

      const newStatuses: Record<string, string> = {};
      let allDone = true;

      for (const proj of projects) {
        const mapping = generatedProjects.find(g => g.projectId === proj.id);
        if (mapping) {
          newStatuses[mapping.sceneId] = proj.status;
          if (proj.status !== 'completed' && proj.status !== 'failed') {
            allDone = false;
          }
        }
      }

      setSceneStatuses(newStatuses);

      if (allDone) {
        setStage('complete');
        setStageMessage('All videos generated! Save your widget.');
        if (pollRef.current) clearInterval(pollRef.current);
        toast.success('All scene videos generated!');
      }
    };

    pollRef.current = setInterval(poll, 8000);
    poll(); // Initial check
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [stage, generatedProjects]);

  const handleGenerate = async () => {
    if (!concept.trim()) {
      toast.error('Describe your landing page concept first');
      return;
    }

    setStage('generating_config');
    setStageMessage('AI is crafting your widget config with cinematic prompts...');
    setGeneratedProjects([]);
    setSceneStatuses({});

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

        if (data.video_generation_started && data.projects_created?.length > 0) {
          setGeneratedProjects(data.projects_created);
          setStage('videos_in_progress');
          setStageMessage(`${data.projects_created.length} video${data.projects_created.length > 1 ? 's' : ''} generating via Apex Pipeline...`);
          
          // Set initial scene statuses
          const initStatuses: Record<string, string> = {};
          data.projects_created.forEach((p: GeneratedProject) => {
            initStatuses[p.sceneId] = 'generating';
          });
          setSceneStatuses(initStatuses);
          
          toast.success('Config generated! Videos are being produced...');
        } else {
          setStage('complete');
          setStageMessage('Widget config generated! Review and save.');
          toast.success('Widget config generated!');
        }
      } else if (data?.error) {
        setStage('error');
        setStageMessage(data.error);
        toast.error(data.error);
      }
    } catch (err: any) {
      console.error('AI generation failed:', err);
      setStage('error');
      if (err?.message?.includes('429')) {
        setStageMessage('Rate limited — please try again in a moment.');
      } else if (err?.message?.includes('402')) {
        setStageMessage('Credits required — please add funds.');
      } else {
        setStageMessage('Generation failed. Try again.');
      }
      toast.error(stageMessage || 'Failed to generate');
    }
  };

  const selectedStyleData = STYLES.find(s => s.id === selectedStyle)!;
  const isGenerating = stage === 'generating_config' || stage === 'launching_videos' || stage === 'videos_in_progress';

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
            <p className="text-sm font-medium text-white/90">Apex Widget Pipeline</p>
            <p className="text-[10px] text-white/30">Concept → AI Config → Cinematic Videos → Live Widget</p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-5 border-t border-white/[0.06] pt-5">
          {/* Concept Input */}
          <div className="space-y-2">
            <label className="text-[10px] text-white/30 uppercase tracking-wider font-medium">
              Describe your product, audience, and video vision
            </label>
            <textarea
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="E.g., A fitness coaching app for busy professionals. The video should show an energetic trainer speaking directly to camera, demonstrating quick exercises in a modern gym. Target: 30-45 year old professionals who want to get fit but have no time. CTA: Start free trial."
              rows={4}
              disabled={isGenerating}
              className={cn('w-full rounded-xl px-4 py-3 text-sm resize-none transition-opacity', glassInput, isGenerating && 'opacity-50')}
            />
          </div>

          {/* Style Selection */}
          <div className="space-y-2">
            <label className="text-[10px] text-white/30 uppercase tracking-wider font-medium">
              Cinematic Style
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {STYLES.map((style) => (
                <button
                  key={style.id}
                  onClick={() => !isGenerating && setSelectedStyle(style.id)}
                  disabled={isGenerating}
                  className={cn(
                    'flex flex-col items-start gap-2 p-3.5 rounded-xl border text-left transition-all',
                    selectedStyle === style.id
                      ? 'border-violet-500/40 bg-violet-500/10'
                      : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.1]',
                    isGenerating && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{style.icon}</span>
                    <span className={cn('text-xs font-medium', selectedStyle === style.id ? 'text-violet-300' : 'text-white/70')}>
                      {style.name}
                    </span>
                  </div>
                  <p className="text-[10px] text-white/25 leading-relaxed">{style.description}</p>
                  <div className="flex items-center gap-3 pt-1">
                    <span className="text-[9px] text-white/20 flex items-center gap-1">
                      <Film className="w-2.5 h-2.5" /> {style.scenes} scenes
                    </span>
                    <span className="text-[9px] text-white/20 flex items-center gap-1">
                      <Camera className="w-2.5 h-2.5" /> {style.techniques[0]}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Pipeline Techniques Preview */}
          <div className={cn('rounded-xl p-3', glass)}>
            <p className="text-[9px] text-white/25 uppercase tracking-wider font-medium mb-2">Pipeline techniques for {selectedStyleData.name}</p>
            <div className="flex flex-wrap gap-1.5">
              {selectedStyleData.techniques.map(t => (
                <span key={t} className="text-[10px] px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-300/70 border border-violet-500/20">
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Video Generation Toggle */}
          <div className="flex items-center gap-3 px-1">
            <button
              onClick={() => !isGenerating && setGenerateVideos(!generateVideos)}
              disabled={isGenerating}
              className={cn(
                'w-9 h-5 rounded-full transition-colors relative',
                generateVideos ? 'bg-violet-500' : 'bg-white/[0.1]',
                isGenerating && 'opacity-50'
              )}
            >
              <div className={cn(
                'w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform',
                generateVideos ? 'translate-x-[18px]' : 'translate-x-0.5'
              )} />
            </button>
            <div>
              <p className="text-xs text-white/70">Auto-generate videos via Apex Pipeline</p>
              <p className="text-[10px] text-white/25">Uses credits • {selectedStyleData.scenes} scene{selectedStyleData.scenes > 1 ? 's' : ''} will be produced</p>
            </div>
          </div>

          {/* Pipeline Status */}
          {stage !== 'idle' && (
            <div className={cn('rounded-xl p-4 space-y-3', glass)}>
              <div className="flex items-center gap-3">
                {stage === 'complete' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : stage === 'error' ? (
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                ) : (
                  <Loader2 className="w-5 h-5 text-violet-400 animate-spin shrink-0" />
                )}
                <div>
                  <p className={cn(
                    'text-sm font-medium',
                    stage === 'complete' ? 'text-emerald-300' : stage === 'error' ? 'text-red-300' : 'text-white/80'
                  )}>
                    {stage === 'generating_config' && 'Crafting cinematic config...'}
                    {stage === 'launching_videos' && 'Launching Apex Pipeline...'}
                    {stage === 'videos_in_progress' && 'Videos generating...'}
                    {stage === 'complete' && 'Pipeline complete'}
                    {stage === 'error' && 'Pipeline error'}
                  </p>
                  <p className="text-[10px] text-white/30">{stageMessage}</p>
                </div>
              </div>

              {/* Scene-by-scene progress */}
              {Object.keys(sceneStatuses).length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {generatedProjects.map((gp, idx) => (
                    <div key={gp.sceneId} className="flex items-center gap-2">
                      {sceneStatuses[gp.sceneId] === 'completed' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : sceneStatuses[gp.sceneId] === 'failed' ? (
                        <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                      ) : (
                        <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin" />
                      )}
                      <span className="text-[11px] text-white/50">Scene {idx + 1}</span>
                      <span className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded',
                        sceneStatuses[gp.sceneId] === 'completed' ? 'bg-emerald-500/20 text-emerald-300' :
                        sceneStatuses[gp.sceneId] === 'failed' ? 'bg-red-500/20 text-red-300' :
                        'bg-violet-500/10 text-violet-300'
                      )}>
                        {sceneStatuses[gp.sceneId] || 'pending'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !concept.trim()}
            className={cn(
              'w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-medium transition-all',
              isGenerating || !concept.trim()
                ? 'bg-white/[0.06] text-white/30 cursor-not-allowed'
                : 'bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-500 hover:to-purple-500 shadow-lg shadow-violet-500/20'
            )}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {stage === 'generating_config' ? 'AI architecting...' : 'Pipeline running...'}
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Launch Apex Pipeline
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
