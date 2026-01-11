import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
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
  ArrowLeft,
  Sparkles,
  RotateCcw,
  Play,
  Clock,
  Layers,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { parsePendingVideoTasks } from '@/types/pending-video-tasks';

interface ScriptShot {
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

export default function ScriptReview() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  const { user } = useAuth();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shots, setShots] = useState<ScriptShot[]>([]);
  const [projectTitle, setProjectTitle] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [expandedShot, setExpandedShot] = useState<number | null>(null);

  // Load project and script data
  useEffect(() => {
    const loadProject = async () => {
      if (!projectId || !user) {
        toast.error('No project specified');
        navigate('/create');
        return;
      }

      // CRITICAL: Verify Supabase client has valid session before querying
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('ScriptReview: No valid session yet, skipping load');
        return;
      }

      try {
        const { data: project, error } = await supabase
          .from('movie_projects')
          .select('*')
          .eq('id', projectId)
          .eq('user_id', session.user.id) // Use session user ID
          .single();

        if (error || !project) {
          toast.error('Project not found');
          navigate('/create');
          return;
        }

        if (project.status !== 'awaiting_approval') {
          toast.error('This project is not awaiting approval');
          navigate('/create');
          return;
        }

        setProjectTitle(project.title);

        // Extract script from pending_video_tasks or generated_script
        const tasks = parsePendingVideoTasks(project.pending_video_tasks);
        let scriptData = tasks?.script?.shots;
        
        if (!scriptData && project.generated_script) {
          try {
            const parsed = typeof project.generated_script === 'string' 
              ? JSON.parse(project.generated_script) 
              : project.generated_script;
            scriptData = parsed?.shots;
          } catch (e) {
            console.error('Failed to parse generated_script:', e);
          }
        }

        if (!scriptData || !Array.isArray(scriptData)) {
          toast.error('No script found for this project');
          navigate('/create');
          return;
        }

        // Convert to ScriptShot format
        const scriptShots: ScriptShot[] = scriptData.map((shot: any, index: number) => ({
          id: shot.id || `shot_${index + 1}`,
          index,
          title: shot.title || `Shot ${index + 1}`,
          description: shot.description || '',
          durationSeconds: shot.durationSeconds || 4,
          sceneType: shot.sceneType,
          cameraScale: shot.cameraScale,
          cameraAngle: shot.cameraAngle,
          movementType: shot.movementType,
          transitionOut: shot.transitionOut,
          visualAnchors: shot.visualAnchors,
          motionDirection: shot.motionDirection,
          lightingHint: shot.lightingHint,
          dialogue: shot.dialogue,
          mood: shot.mood,
        }));

        setShots(scriptShots);
      } catch (err) {
        console.error('Error loading project:', err);
        toast.error('Failed to load project');
        navigate('/create');
      } finally {
        setIsLoading(false);
      }
    };

    loadProject();
  }, [projectId, user, navigate]);

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

  const handleApprove = async () => {
    if (!projectId || !user) return;

    setIsSubmitting(true);
    toast.info('Resuming video production pipeline...');

    try {
      const { data, error: funcError } = await supabase.functions.invoke('resume-pipeline', {
        body: {
          projectId,
          userId: user.id,
          approvedShots: shots.map(shot => ({
            id: shot.id,
            title: shot.title,
            description: shot.description,
            durationSeconds: shot.durationSeconds,
            sceneType: shot.sceneType,
            cameraScale: shot.cameraScale,
            cameraAngle: shot.cameraAngle,
            movementType: shot.movementType,
            transitionOut: shot.transitionOut,
            visualAnchors: shot.visualAnchors,
            motionDirection: shot.motionDirection,
            lightingHint: shot.lightingHint,
            dialogue: shot.dialogue,
            mood: shot.mood,
          })),
        },
      });

      if (funcError) throw funcError;

      if (data?.success) {
        toast.success('Script approved! Video production started.');
        navigate(`/production?projectId=${projectId}`);
      } else {
        throw new Error(data?.error || 'Failed to resume pipeline');
      }
    } catch (err) {
      console.error('Resume pipeline error:', err);
      const message = err instanceof Error ? err.message : 'Failed to resume pipeline';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegenerate = async () => {
    if (!projectId || !user) return;

    setIsSubmitting(true);
    toast.info('Regenerating script...');

    try {
      // Reset status and call hollywood-pipeline again
      await supabase
        .from('movie_projects')
        .update({ status: 'draft' })
        .eq('id', projectId);

      toast.success('Please start a new generation from the studio.');
      navigate('/create');
    } catch (err) {
      console.error('Regenerate error:', err);
      toast.error('Failed to regenerate script');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!projectId) {
      navigate('/create');
      return;
    }

    try {
      await supabase
        .from('movie_projects')
        .update({ status: 'draft' })
        .eq('id', projectId);
      
      toast.info('Pipeline cancelled');
    } catch (err) {
      console.error('Cancel error:', err);
    }
    
    navigate('/create');
  };

  const calculatedDuration = shots.reduce((sum, shot) => sum + (shot.durationSeconds || 4), 0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading script...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/create')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Review Script</h1>
                <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                  {projectTitle}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <Clock className="w-3 h-3" />
                {calculatedDuration}s
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Layers className="w-3 h-3" />
                {shots.length} shots
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {/* Info Banner */}
        <div className="p-4 mb-6 rounded-xl border border-primary/20 bg-primary/5">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="text-sm font-medium">Script Generated Successfully</p>
              <p className="text-xs text-muted-foreground mt-1">
                Review each shot below. Click on any shot to expand details or edit the description.
                Approve when ready to proceed to video production.
              </p>
            </div>
          </div>
        </div>

        {/* Shots List */}
        <ScrollArea className="h-[calc(100vh-380px)] pr-4">
          <div className="space-y-3">
            {shots.map((shot, index) => {
              const isEditing = editingIndex === index;
              const isExpanded = expandedShot === index;
              const sceneTypeClass = SCENE_TYPE_COLORS[shot.sceneType || 'action'] || SCENE_TYPE_COLORS.action;
              
              return (
                <motion.div
                  key={shot.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card 
                    className={cn(
                      "transition-all duration-200 cursor-pointer",
                      isExpanded && "ring-2 ring-primary/30",
                      isEditing && "ring-2 ring-primary"
                    )}
                    onClick={() => !isEditing && setExpandedShot(isExpanded ? null : index)}
                  >
                    <CardContent className="p-4">
                      {/* Shot Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1">
                          {/* Shot Number */}
                          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-sm font-bold shrink-0">
                            {index + 1}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            {/* Title and badges */}
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              <span className="font-medium truncate">{shot.title}</span>
                              {shot.sceneType && (
                                <Badge variant="outline" className={cn("text-[10px] capitalize", sceneTypeClass)}>
                                  {shot.sceneType}
                                </Badge>
                              )}
                              <Badge variant="secondary" className="text-[10px]">
                                {shot.durationSeconds}s
                              </Badge>
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
                                  <Button size="sm" onClick={handleSaveEdit}>
                                    <Check className="w-3 h-3 mr-1" />
                                    Save
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                                    <X className="w-3 h-3 mr-1" />
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {shot.description}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        {/* Actions */}
                        {!isEditing && (
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEdit(index);
                              }}
                            >
                              <Edit3 className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedShot(isExpanded ? null : index);
                              }}
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
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
                            className="mt-4 pt-4 border-t"
                          >
                            {/* Camera Details */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                              {shot.cameraScale && (
                                <div className="text-xs">
                                  <span className="text-muted-foreground">Scale:</span>
                                  <span className="ml-1 capitalize">{shot.cameraScale}</span>
                                </div>
                              )}
                              {shot.cameraAngle && (
                                <div className="text-xs">
                                  <span className="text-muted-foreground">Angle:</span>
                                  <span className="ml-1 capitalize">{shot.cameraAngle.replace('-', ' ')}</span>
                                </div>
                              )}
                              {shot.movementType && (
                                <div className="text-xs">
                                  <span className="text-muted-foreground">Movement:</span>
                                  <span className="ml-1 capitalize">{shot.movementType}</span>
                                </div>
                              )}
                              {shot.mood && (
                                <div className="text-xs">
                                  <span className="text-muted-foreground">Mood:</span>
                                  <span className="ml-1 capitalize">{shot.mood}</span>
                                </div>
                              )}
                            </div>
                            
                            {/* Full Description */}
                            <div className="mb-3">
                              <p className="text-sm">{shot.description}</p>
                            </div>
                            
                            {/* Dialogue if present */}
                            {shot.dialogue && (
                              <div className="mb-3 p-2 bg-muted/50 rounded-lg">
                                <span className="text-xs text-muted-foreground">Narration:</span>
                                <p className="text-sm italic mt-1">"{shot.dialogue}"</p>
                              </div>
                            )}
                            
                            {/* Visual Anchors */}
                            {shot.visualAnchors && shot.visualAnchors.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-3">
                                {shot.visualAnchors.map((anchor, i) => (
                                  <Badge key={i} variant="secondary" className="text-[10px]">
                                    {anchor}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            
                            {/* Lighting Hint */}
                            {shot.lightingHint && (
                              <div className="text-xs text-muted-foreground">
                                <Camera className="w-3 h-3 inline mr-1" />
                                Lighting: {shot.lightingHint}
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                      
                      {/* Transition to next shot */}
                      {shot.transitionOut && index < shots.length - 1 && (
                        <div className="mt-3 pt-3 border-t border-dashed flex items-center gap-2 text-xs text-muted-foreground">
                          <ArrowRight className="w-3 h-3" />
                          <span>Transition to Shot {index + 2}:</span>
                          <Badge variant="outline" className="text-[10px]">
                            {TRANSITION_LABELS[shot.transitionOut.type] || shot.transitionOut.type}
                          </Badge>
                          {shot.transitionOut.hint && (
                            <span className="italic truncate">{shot.transitionOut.hint}</span>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Action Buttons - Fixed at bottom */}
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-lg border-t border-border p-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <Button variant="ghost" onClick={handleCancel} disabled={isSubmitting}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={handleRegenerate} disabled={isSubmitting}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Regenerate
              </Button>
              
              <Button 
                onClick={handleApprove} 
                disabled={isSubmitting}
                className="min-w-[180px] bg-green-600 hover:bg-green-700"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
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
        </div>
      </div>
    </div>
  );
}
