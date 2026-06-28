import { useState, useEffect, memo, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, 
  Edit3, 
  Check, 
  X, 
  ChevronDown, 
  ChevronUp,
  Camera,
  ArrowRight,
  Sparkles,
  RotateCcw,
  Play,
  Clock,
  Layers,
  Cpu,
  Wand2,
  Loader2,
  Image as ImageIcon,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ENGINE_CAPS, type EngineToken, type ShotRouting } from '@/lib/editor/shot-engine-router';

const CINEMA_TOKENS: EngineToken[] = ['veo', 'runway', 'sora'];

export interface ScriptShot {
  id: string;
  index: number;
  title: string;
  description: string;
  durationSeconds: number;
  sceneType?: string;
  cameraScale?: string;
  cameraAngle?: string;
  movementType?: string;
  transitionOut?: {
    type: string;
    hint?: string;
  };
  visualAnchors?: string[];
  motionDirection?: string;
  lightingHint?: string;
  dialogue?: string;
  mood?: string;
}

interface ScriptReviewPanelProps {
  shots: ScriptShot[];
  onApprove: (shots: ScriptShot[]) => void;
  onRegenerate: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  totalDuration?: number;
  projectTitle?: string;
  projectId?: string;
}

type RoutingEntry = { engine: EngineToken; engineLabel: string; reasons: string[] };

const SCENE_TYPE_COLORS: Record<string, string> = {
  establishing: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  action: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  reaction: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  detail: 'bg-green-500/10 text-green-500 border-green-500/20',
  transition: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  climax: 'bg-red-500/10 text-red-500 border-red-500/20',
  resolution: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
};

const TRANSITION_LABELS: Record<string, string> = {
  'angle-change': 'Angle Change',
  'motion-carry': 'Motion Carry',
  'match-cut': 'Match Cut',
  'scene-jump': 'Scene Jump',
  'whip-pan': 'Whip Pan',
  'reveal': 'Reveal',
  'follow-through': 'Follow Through',
  'parallel-action': 'Parallel Action',
};

export const ScriptReviewPanel = memo(forwardRef<HTMLDivElement, ScriptReviewPanelProps>(function ScriptReviewPanel({
  shots: initialShots,
  onApprove,
  onRegenerate,
  onCancel,
  isLoading = false,
  totalDuration,
  projectTitle,
  projectId,
}: ScriptReviewPanelProps) {
  const [shots, setShots] = useState<ScriptShot[]>(initialShots);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [expandedShot, setExpandedShot] = useState<number | null>(null);

  // ── Smart Route (per-shot model auto-router) ──────────────────────────
  const [smartOn, setSmartOn] = useState(false);
  const [routing, setRouting] = useState<Record<number, RoutingEntry>>({});
  const [routingBusy, setRoutingBusy] = useState(false);
  const [allowCinema, setAllowCinema] = useState(true);

  // Hydrate an existing routing_map so the toggle reflects reality (the map is
  // honored at render whether or not the toggle is shown).
  useEffect(() => {
    if (!projectId) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('movie_projects')
        .select('routing_map, scene_images')
        .eq('id', projectId)
        .maybeSingle();
      if (!active) return;
      const rm = (data?.routing_map ?? null) as Record<string, RoutingEntry> | null;
      if (rm && Object.keys(rm).length) {
        const map: Record<number, RoutingEntry> = {};
        Object.entries(rm).forEach(([i, v]) => {
          map[Number(i)] = { engine: v.engine, engineLabel: v.engineLabel, reasons: v.reasons || [] };
        });
        setRouting(map);
        setSmartOn(true);
      }
      const si = (data?.scene_images ?? null) as Array<{ sceneNumber: number; imageUrl: string }> | null;
      if (si && si.length) {
        const fr: Record<number, string> = {};
        si.forEach((s) => { if (s?.imageUrl) fr[s.sceneNumber - 1] = s.imageUrl; });
        setFrames(fr);
      }
    })();
    return () => { active = false; };
  }, [projectId]);

  const persistRoutingMap = async (map: Record<number, RoutingEntry>) => {
    if (!projectId) return;
    const payload: Record<string, RoutingEntry> = {};
    Object.entries(map).forEach(([i, v]) => { payload[i] = v; });
    await supabase
      .from('movie_projects')
      .update({ routing_map: Object.keys(payload).length ? payload : null })
      .eq('id', projectId);
  };

  const toggleSmart = async () => {
    if (!projectId) { toast.error('Smart Route needs a saved project.'); return; }
    if (smartOn) {
      setSmartOn(false);
      setRouting({});
      await supabase.from('movie_projects').update({ routing_map: null }).eq('id', projectId);
      return;
    }
    setRoutingBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('route-shots', { body: { projectId } });
      if (error) throw error;
      if (data?.success && Array.isArray(data.routing)) {
        const map: Record<number, RoutingEntry> = {};
        (data.routing as ShotRouting[]).forEach((r) => {
          map[r.index] = { engine: r.engine, engineLabel: r.engineLabel, reasons: r.reasons };
        });
        setRouting(map);
        setAllowCinema(!!data.allowCinema);
        setSmartOn(true);
        toast.success('Smart Route on — each shot matched to its best model.');
      } else {
        throw new Error(data?.message || data?.error || 'Routing failed');
      }
    } catch (e) {
      toast.error('Couldn’t route shots', { description: (e instanceof Error ? e.message : '').slice(0, 120) });
    } finally {
      setRoutingBusy(false);
    }
  };

  const overrideEngine = async (index: number, token: EngineToken) => {
    const next = { ...routing, [index]: { engine: token, engineLabel: ENGINE_CAPS[token].label, reasons: ['manual override'] } };
    setRouting(next);
    await persistRoutingMap(next);
  };

  // ── Storyboard (previz keyframes that seed video generation) ───────────
  const [frames, setFrames] = useState<Record<number, string>>({});
  const [storyBusy, setStoryBusy] = useState<number | 'all' | null>(null);

  const generateStoryboard = async (shotIndex?: number) => {
    if (!projectId) { toast.error('Storyboard needs a saved project.'); return; }
    if (storyBusy !== null) return;
    setStoryBusy(shotIndex ?? 'all');
    try {
      const { data, error } = await supabase.functions.invoke('generate-storyboard', {
        body: shotIndex === undefined ? { projectId } : { projectId, shotIndex },
      });
      if (error) throw error;
      if (data?.success && Array.isArray(data.frames)) {
        setFrames((prev) => {
          const next = { ...prev };
          for (const f of data.frames) next[f.index] = f.imageUrl;
          return next;
        });
        toast.success(shotIndex === undefined ? 'Storyboard generated — approve to seed your render.' : `Shot ${shotIndex + 1} redrawn.`);
      } else {
        throw new Error(data?.message || data?.error || 'Storyboard failed');
      }
    } catch (e) {
      toast.error('Storyboard didn’t generate', { description: (e instanceof Error ? e.message : '').slice(0, 120) });
    } finally {
      setStoryBusy(null);
    }
  };

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditValue(shots[index].description);
  };

  const handleSaveEdit = () => {
    if (editingIndex === null) return;
    
    setShots(prev => prev.map((shot, i) => 
      i === editingIndex ? { ...shot, description: editValue } : shot
    ));
    setEditingIndex(null);
    setEditValue('');
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditValue('');
  };

  const calculatedDuration = shots.reduce((sum, shot) => sum + (shot.durationSeconds || 6), 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full flex flex-col h-full max-h-[calc(100vh-120px)] md:max-h-none"
    >
      {/* Header - Compact on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-primary/10 flex items-center justify-center">
            <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold">Review Script</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {shots.length} shots • ~{totalDuration || calculatedDuration}s
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 text-xs">
            <Clock className="w-3 h-3" />
            {totalDuration || calculatedDuration}s
          </Badge>
          <Badge variant="outline" className="gap-1 text-xs">
            <Layers className="w-3 h-3" />
            {shots.length}
          </Badge>
        </div>
      </div>

      {/* Info Banner - Hidden on very small screens */}
      <div className="hidden sm:block glass-card p-3 sm:p-4 mb-4 sm:mb-6 border-primary/20 bg-primary/5 shrink-0">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium">Script Generated</p>
            <p className="text-xs text-muted-foreground mt-1">
              Tap any shot to expand or edit. Approve when ready.
            </p>
          </div>
        </div>
      </div>

      {/* Smart Route — per-shot model auto-router (borderless, floating) */}
      {projectId && (
        <div
          className="mb-4 sm:mb-5 flex items-center justify-between gap-3 rounded-2xl px-4 py-3 backdrop-blur-xl shrink-0"
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.045), transparent)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-accent/12 text-accent">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Smart Route</p>
              <p className="text-[11px] text-white/45">
                {smartOn ? 'Each shot matched to its best model' : 'Render every shot on its best model'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={toggleSmart}
            disabled={routingBusy}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-4 h-9 text-[12.5px] font-medium transition-all',
              smartOn ? 'bg-accent text-black' : 'bg-white/[0.06] text-white/70 hover:text-white',
              routingBusy && 'opacity-60',
            )}
          >
            {routingBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
            {smartOn ? 'On' : 'Auto-route'}
          </button>
        </div>
      )}

      {/* Storyboard — previz keyframes that seed the render (borderless) */}
      {projectId && (
        <div
          className="mb-4 sm:mb-5 flex items-center justify-between gap-3 rounded-2xl px-4 py-3 backdrop-blur-xl shrink-0"
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.045), transparent)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-accent/12 text-accent">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Storyboard</p>
              <p className="text-[11px] text-white/45">
                {Object.keys(frames).length ? 'Approve keyframes — they seed your render' : 'Preview keyframes before spending video credits'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => generateStoryboard()}
            disabled={storyBusy !== null}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-4 h-9 text-[12.5px] font-medium transition-all',
              Object.keys(frames).length ? 'bg-white/[0.06] text-white/70 hover:text-white' : 'bg-accent text-black',
              storyBusy !== null && 'opacity-60',
            )}
          >
            {storyBusy === 'all' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
            {Object.keys(frames).length ? 'Regenerate' : `Generate · ${3 * shots.length}cr`}
          </button>
        </div>
      )}

      {/* Shots List - Flexible height */}
      <ScrollArea className="flex-1 min-h-0 pr-2 sm:pr-4 -mr-2 sm:-mr-4">
        <div className="space-y-2 sm:space-y-3 pb-4">
          {shots.map((shot, index) => {
            const isEditing = editingIndex === index;
            const isExpanded = expandedShot === index;
            const sceneTypeClass = SCENE_TYPE_COLORS[shot.sceneType || 'action'] || SCENE_TYPE_COLORS.action;
            
            return (
              <motion.div
                key={shot.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <Card 
                  className={cn(
                    "transition-all duration-200 cursor-pointer",
                    isExpanded && "ring-2 ring-primary/30",
                    isEditing && "ring-2 ring-primary"
                  )}
                  onClick={() => !isEditing && setExpandedShot(isExpanded ? null : index)}
                >
                  <CardContent className="p-3 sm:p-4">
                    {/* Shot Header */}
                    <div className="flex items-start justify-between gap-2 sm:gap-3">
                      <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                        {/* Shot Number */}
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-muted flex items-center justify-center text-xs sm:text-sm font-bold shrink-0">
                          {index + 1}
                        </div>

                        {/* Storyboard keyframe — click to redraw */}
                        {frames[index] && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); generateStoryboard(index); }}
                            disabled={storyBusy !== null}
                            title="Redraw keyframe"
                            className="hidden sm:block relative w-16 h-9 rounded-md overflow-hidden shrink-0 group/sb"
                          >
                            <img src={frames[index]} alt="" className="w-full h-full object-cover" />
                            <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover/sb:opacity-100 transition-opacity">
                              {storyBusy === index ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> : <RefreshCw className="w-3.5 h-3.5 text-white" />}
                            </span>
                          </button>
                        )}

                        <div className="flex-1 min-w-0">
                          {/* Title and badges */}
                          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap mb-1.5 sm:mb-2">
                            <span className="font-medium text-sm sm:text-base truncate">{shot.title}</span>
                            {shot.sceneType && (
                              <Badge variant="outline" className={cn("text-[9px] sm:text-[10px] capitalize px-1.5", sceneTypeClass)}>
                                {shot.sceneType}
                              </Badge>
                            )}
                            <Badge variant="secondary" className="text-[9px] sm:text-[10px] px-1.5">
                              {shot.durationSeconds}s
                            </Badge>
                            {routing[index] && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-accent/12 text-accent px-2 h-[18px] text-[9px] sm:text-[10px] font-medium">
                                <Cpu className="w-2.5 h-2.5" /> {routing[index].engineLabel}
                              </span>
                            )}
                          </div>
                          
                          {/* Description - editable */}
                          {isEditing ? (
                            <div className="space-y-2" onClick={e => e.stopPropagation()}>
                              <Textarea
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="min-h-[80px] text-sm"
                                placeholder="Describe this shot..."
                                autoFocus
                              />
                              <div className="flex items-center gap-2">
                                <Button size="sm" onClick={handleSaveEdit} className="h-8">
                                  <Check className="w-3 h-3 mr-1" />
                                  Save
                                </Button>
                                <Button size="sm" variant="ghost" onClick={handleCancelEdit} className="h-8">
                                  <X className="w-3 h-3 mr-1" />
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                              {shot.description}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {/* Actions */}
                      {!isEditing && (
                        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 sm:h-8 sm:w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartEdit(index);
                            }}
                          >
                            <Edit3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 sm:h-8 sm:w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedShot(isExpanded ? null : index);
                            }}
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    {/* Expanded Details */}
                    <AnimatePresence>
                      {isExpanded && !isEditing && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t"
                        >
                          {/* Camera Details */}
                          <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-3 sm:mb-4">
                            {shot.cameraScale && (
                              <div className="text-[10px] sm:text-xs">
                                <span className="text-muted-foreground">Scale:</span>
                                <span className="ml-1 capitalize">{shot.cameraScale}</span>
                              </div>
                            )}
                            {shot.cameraAngle && (
                              <div className="text-[10px] sm:text-xs">
                                <span className="text-muted-foreground">Angle:</span>
                                <span className="ml-1 capitalize">{shot.cameraAngle.replace('-', ' ')}</span>
                              </div>
                            )}
                            {shot.movementType && (
                              <div className="text-[10px] sm:text-xs">
                                <span className="text-muted-foreground">Movement:</span>
                                <span className="ml-1 capitalize">{shot.movementType}</span>
                              </div>
                            )}
                            {shot.mood && (
                              <div className="text-[10px] sm:text-xs">
                                <span className="text-muted-foreground">Mood:</span>
                                <span className="ml-1 capitalize">{shot.mood}</span>
                              </div>
                            )}
                          </div>

                          {/* Smart Route — routed engine + reasons + manual override */}
                          {routing[index] && (
                            <div className="mb-3" onClick={(e) => e.stopPropagation()}>
                              <p className="text-[10px] sm:text-xs text-white/45 mb-1.5">
                                Routed to <span className="text-accent">{routing[index].engineLabel}</span>
                                {routing[index].reasons.length ? ` — ${routing[index].reasons.join(' · ')}` : ''}
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {(Object.keys(ENGINE_CAPS) as EngineToken[])
                                  .filter((t) => allowCinema || !CINEMA_TOKENS.includes(t))
                                  .map((t) => (
                                    <button
                                      key={t}
                                      type="button"
                                      onClick={() => overrideEngine(index, t)}
                                      className={cn(
                                        'rounded-full px-2.5 h-6 text-[10px] transition-colors',
                                        routing[index].engine === t
                                          ? 'bg-accent text-black font-medium'
                                          : 'bg-white/[0.05] text-white/55 hover:text-white',
                                      )}
                                    >
                                      {ENGINE_CAPS[t].label}
                                    </button>
                                  ))}
                              </div>
                            </div>
                          )}

                          {/* Full Description */}
                          <div className="mb-3">
                            <p className="text-xs sm:text-sm">{shot.description}</p>
                          </div>
                          
                          {/* Dialogue if present */}
                          {shot.dialogue && (
                            <div className="mb-3 p-2 bg-muted/50 rounded-lg">
                              <span className="text-[10px] sm:text-xs text-muted-foreground">Narration:</span>
                              <p className="text-xs sm:text-sm italic mt-1">"{shot.dialogue}"</p>
                            </div>
                          )}
                          
                          {/* Visual Anchors */}
                          {shot.visualAnchors && shot.visualAnchors.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-3">
                              {shot.visualAnchors.map((anchor, i) => (
                                <Badge key={i} variant="secondary" className="text-[9px] sm:text-[10px]">
                                  {anchor}
                                </Badge>
                              ))}
                            </div>
                          )}
                          
                          {/* Lighting Hint */}
                          {shot.lightingHint && (
                            <div className="text-[10px] sm:text-xs text-muted-foreground">
                              <Camera className="w-3 h-3 inline mr-1" />
                              Lighting: {shot.lightingHint}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    
                    {/* Transition to next shot - Hidden on mobile for cleaner look */}
                    {shot.transitionOut && index < shots.length - 1 && (
                      <div className="hidden sm:flex mt-3 pt-3 border-t border-dashed items-center gap-2 text-xs text-muted-foreground">
                        <ArrowRight className="w-3 h-3" />
                        <span>To Shot {index + 2}:</span>
                        <Badge variant="outline" className="text-[10px]">
                          {TRANSITION_LABELS[shot.transitionOut.type] || shot.transitionOut.type}
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Action Buttons - Sticky on mobile */}
      <div className="sticky bottom-0 left-0 right-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-0 mt-4 sm:mt-6 pt-4 sm:pt-6 border-t bg-background/95 backdrop-blur-sm shrink-0 -mx-4 px-4 sm:mx-0 sm:px-0 pb-4 sm:pb-0">
        <Button variant="ghost" onClick={onCancel} disabled={isLoading} className="order-3 sm:order-1 h-10 sm:h-9">
          <X className="w-4 h-4 mr-2" />
          Cancel
        </Button>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 order-1 sm:order-2">
          <Button variant="outline" onClick={onRegenerate} disabled={isLoading} className="h-10 sm:h-9">
            <RotateCcw className="w-4 h-4 mr-2" />
            Regenerate
          </Button>
          
          <Button 
            onClick={() => onApprove(shots)} 
            disabled={isLoading}
            className="h-12 sm:h-10 text-base sm:text-sm font-semibold"
          >
            {isLoading ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-4 h-4 mr-2"
                >
                  <Sparkles className="w-4 h-4" />
                </motion.div>
                Processing…
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Approve & Generate
              </>
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}));
