import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, Zap, Loader2, ChevronDown, ChevronUp, CheckCircle2, AlertCircle, Film, Camera } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { WidgetScene, WidgetTriggers, WidgetRule } from '@/types/widget';

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

type PipelineStage = 'idle' | 'generating_config' | 'videos_in_progress' | 'complete' | 'error';

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
  onSceneVideoReady?: (sceneId: string, videoUrl: string) => void;
}

export function AIWidgetAssist({ widgetId, onConfigGenerated, onSceneVideoReady }: AIWidgetAssistProps) {
  const [expanded, setExpanded] = useState(true);
  const [concept, setConcept] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<StyleId>('cinematic_hero');
  const [generateVideos, setGenerateVideos] = useState(true);
  
  const [stage, setStage] = useState<PipelineStage>('idle');
  const [stageMessage, setStageMessage] = useState('');
  const [allScenes, setAllScenes] = useState<WidgetScene[]>([]);
  const [generatedProjects, setGeneratedProjects] = useState<GeneratedProject[]>([]);
  const [sceneStatuses, setSceneStatuses] = useState<Record<string, string>>({});
  const [currentSceneIdx, setCurrentSceneIdx] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const authHeaderRef = useRef<string>('');

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // Trigger the next pending scene after the current one completes
  const triggerNextScene = useCallback(async (nextIdx: number, scenes: WidgetScene[]) => {
    if (nextIdx >= scenes.length) return;
    const scene = scenes[nextIdx];
    if (!scene.video_generation_prompt || scene.video_generation_prompt.length < 20) return;

    console.log(`[WidgetPipeline] Triggering scene ${nextIdx + 1}/${scenes.length}`);

    try {
      const { data, error } = await supabase.functions.invoke('mode-router', {
        body: {
          mode: 'text-to-video',
          prompt: scene.video_generation_prompt,
          clipCount: 1,
          clipDuration: scene.type === 'cta' ? 5 : 6,
          aspectRatio: selectedStyle === 'minimal_embed' ? '9:16' : '16:9',
          includeVoice: scene.type === 'cta',
          includeMusic: scene.type === 'hero',
          qualityTier: 'professional',
          genre: 'commercial',
          mood: scene.mood || 'cinematic',
        },
      });

      if (error) throw error;

      if (data?.projectId) {
        scene.video_project_id = data.projectId;
        scene.video_generation_status = 'generating';
        setGeneratedProjects(prev => [...prev, { sceneId: scene.id, projectId: data.projectId }]);
        setSceneStatuses(prev => ({ ...prev, [scene.id]: 'generating' }));
        setCurrentSceneIdx(nextIdx);

        // Persist updated scene state
        await supabase
          .from('widget_configs')
          .update({ scenes: JSON.parse(JSON.stringify(scenes)) })
          .eq('id', widgetId);
      }
    } catch (err) {
      console.error(`[WidgetPipeline] Scene ${nextIdx + 1} trigger failed:`, err);
      scene.video_generation_status = 'failed';
      setSceneStatuses(prev => ({ ...prev, [scene.id]: 'failed' }));
    }
  }, [selectedStyle, widgetId]);

  // Poll video generation progress and handle sequential orchestration
  useEffect(() => {
    if (stage !== 'videos_in_progress' || generatedProjects.length === 0) return;

    const poll = async () => {
      const projectIds = generatedProjects.map(p => p.projectId);
      const { data: projects } = await supabase
        .from('movie_projects')
        .select('id, status, video_url, thumbnail_url')
        .in('id', projectIds);

      if (!projects) return;

      const newStatuses: Record<string, string> = { ...sceneStatuses };
      let justCompleted: GeneratedProject | null = null;

      for (const proj of projects) {
        const mapping = generatedProjects.find(g => g.projectId === proj.id);
        if (!mapping) continue;

        const prevStatus = newStatuses[mapping.sceneId];
        newStatuses[mapping.sceneId] = proj.status;

        // Backfill video URL when a project completes
        if (proj.status === 'completed' && prevStatus !== 'completed' && proj.video_url) {
          onSceneVideoReady?.(mapping.sceneId, proj.video_url);
          justCompleted = mapping;

          // Update widget_configs with the video URL
          const { data: widgetData } = await supabase
            .from('widget_configs')
            .select('scenes')
            .eq('id', widgetId)
            .single();

          if (widgetData?.scenes) {
            const updatedScenes = (widgetData.scenes as unknown as WidgetScene[]).map(s =>
              s.id === mapping.sceneId
                ? { ...s, src_mp4: proj.video_url, video_generation_status: 'completed' as const, poster_url: proj.thumbnail_url || s.poster_url }
                : s
            );
            await supabase
              .from('widget_configs')
              .update({ scenes: JSON.parse(JSON.stringify(updatedScenes)) })
              .eq('id', widgetId);
          }
        }
      }

      setSceneStatuses(newStatuses);

      // If a scene just completed, trigger the next pending one
      if (justCompleted && allScenes.length > 0) {
        const completedIdx = allScenes.findIndex(s => s.id === justCompleted!.sceneId);
        const nextIdx = completedIdx + 1;
        if (nextIdx < allScenes.length && allScenes[nextIdx].video_generation_status === 'pending') {
          await triggerNextScene(nextIdx, allScenes);
        }
      }

      // Check if all scenes are done
      const allScenesFinished = allScenes.every(s => {
        const status = newStatuses[s.id] || s.video_generation_status;
        return status === 'completed' || status === 'failed' || !s.video_generation_prompt;
      });

      if (allScenesFinished) {
        setStage('complete');
        setStageMessage('All scene videos generated! Save your widget.');
        if (pollRef.current) clearInterval(pollRef.current);
        toast.success('All scene videos generated!');
      }
    };

    pollRef.current = setInterval(poll, 8000);
    poll();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [stage, generatedProjects, allScenes, widgetId, onSceneVideoReady, triggerNextScene]);

  const handleGenerate = async () => {
    if (!concept.trim()) {
      toast.error('Describe your landing page concept first');
      return;
    }

    setStage('generating_config');
    setStageMessage('AI is crafting your widget config with cinematic prompts...');
    setGeneratedProjects([]);
    setSceneStatuses({});
    setAllScenes([]);

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
        setAllScenes(data.config.scenes || []);

        if (data.video_generation_started && data.projects_created?.length > 0) {
          setGeneratedProjects(data.projects_created);
          setStage('videos_in_progress');

          const totalScenes = data.config.scenes?.length || 0;
          setStageMessage(`Scene 1/${totalScenes} generating via Apex Pipeline... (sequential mode)`);
          
          const initStatuses: Record<string, string> = {};
          data.projects_created.forEach((p: GeneratedProject) => {
            initStatuses[p.sceneId] = 'generating';
          });
          // Mark remaining as queued
          data.config.scenes?.forEach((s: WidgetScene) => {
            if (!initStatuses[s.id] && s.video_generation_prompt) {
              initStatuses[s.id] = 'pending';
            }
          });
          setSceneStatuses(initStatuses);
          
          toast.success('Config generated! Scene 1 is being produced...');
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
      // Parse error from edge function response body
      let msg = 'Generation failed. Try again.';
      try {
        const context = err?.context;
        if (context?.body) {
          const body = typeof context.body === 'string' ? JSON.parse(context.body) : context.body;
          if (body?.error) msg = body.error;
        }
      } catch { /* use default */ }
      if (msg === 'Generation failed. Try again.') {
        const errStr = String(err?.message || err);
        if (errStr.includes('429')) msg = 'Rate limited — please try again in a moment.';
        else if (errStr.includes('402')) msg = 'AI credits exhausted. Add credits in Settings → Usage.';
      }
      setStageMessage(msg);
      toast.error(msg);
    }
  };

  const selectedStyleData = STYLES.find(s => s.id === selectedStyle)!;
  const isGenerating = stage === 'generating_config' || stage === 'videos_in_progress';
  const completedCount = Object.values(sceneStatuses).filter(s => s === 'completed').length;
  const totalCount = allScenes.filter(s => s.video_generation_prompt).length;

  return (
    <div className={cn('rounded-2xl overflow-hidden transition-all', glass)}>
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
            <label className="text-[10px] text-white/30 uppercase tracking-wider font-medium">Cinematic Style</label>
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
                    <span className={cn('text-xs font-medium', selectedStyle === style.id ? 'text-violet-300' : 'text-white/70')}>{style.name}</span>
                  </div>
                  <p className="text-[10px] text-white/25 leading-relaxed">{style.description}</p>
                  <div className="flex items-center gap-3 pt-1">
                    <span className="text-[9px] text-white/20 flex items-center gap-1"><Film className="w-2.5 h-2.5" /> {style.scenes} scenes</span>
                    <span className="text-[9px] text-white/20 flex items-center gap-1"><Camera className="w-2.5 h-2.5" /> {style.techniques[0]}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Pipeline Techniques */}
          <div className={cn('rounded-xl p-3', glass)}>
            <p className="text-[9px] text-white/25 uppercase tracking-wider font-medium mb-2">Pipeline techniques for {selectedStyleData.name}</p>
            <div className="flex flex-wrap gap-1.5">
              {selectedStyleData.techniques.map(t => (
                <span key={t} className="text-[10px] px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-300/70 border border-violet-500/20">{t}</span>
              ))}
            </div>
          </div>

          {/* Video Generation Toggle */}
          <div className="flex items-center gap-3 px-1">
            <button
              onClick={() => !isGenerating && setGenerateVideos(!generateVideos)}
              disabled={isGenerating}
              className={cn('w-9 h-5 rounded-full transition-colors relative', generateVideos ? 'bg-violet-500' : 'bg-white/[0.1]', isGenerating && 'opacity-50')}
            >
              <div className={cn('w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform', generateVideos ? 'translate-x-[18px]' : 'translate-x-0.5')} />
            </button>
            <div>
              <p className="text-xs text-white/70">Auto-generate videos via Apex Pipeline</p>
              <p className="text-[10px] text-white/25">Uses credits • {selectedStyleData.scenes} scene{selectedStyleData.scenes > 1 ? 's' : ''} produced sequentially</p>
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
                  <p className={cn('text-sm font-medium', stage === 'complete' ? 'text-emerald-300' : stage === 'error' ? 'text-red-300' : 'text-white/80')}>
                    {stage === 'generating_config' && 'Crafting cinematic config...'}
                    {stage === 'videos_in_progress' && `Generating videos (${completedCount}/${totalCount})...`}
                    {stage === 'complete' && 'Pipeline complete'}
                    {stage === 'error' && 'Pipeline error'}
                  </p>
                  <p className="text-[10px] text-white/30">{stageMessage}</p>
                </div>
              </div>

              {allScenes.filter(s => s.video_generation_prompt).length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {allScenes.filter(s => s.video_generation_prompt).map((scene, idx) => {
                    const status = sceneStatuses[scene.id] || 'pending';
                    return (
                      <div key={scene.id} className="flex items-center gap-2">
                        {status === 'completed' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : status === 'failed' ? (
                          <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                        ) : status === 'generating' ? (
                          <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin" />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full border border-white/10" />
                        )}
                        <span className="text-[11px] text-white/50">Scene {idx + 1}: {scene.name}</span>
                        <span className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded',
                          status === 'completed' ? 'bg-emerald-500/20 text-emerald-300' :
                          status === 'failed' ? 'bg-red-500/20 text-red-300' :
                          status === 'generating' ? 'bg-violet-500/10 text-violet-300' :
                          'bg-white/[0.04] text-white/20'
                        )}>
                          {status === 'pending' ? 'queued' : status}
                        </span>
                      </div>
                    );
                  })}
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
              <><Loader2 className="w-4 h-4 animate-spin" /> {stage === 'generating_config' ? 'AI architecting...' : `Pipeline running (${completedCount}/${totalCount})...`}</>
            ) : (
              <><Zap className="w-4 h-4" /> Launch Apex Pipeline</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}