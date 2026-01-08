import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Play, 
  AlertTriangle, 
  CheckCircle, 
  Zap, 
  ArrowRight,
  Loader2,
  RefreshCw,
  Sparkles,
  Eye,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface VideoClip {
  id: string;
  shot_index: number;
  video_url: string | null;
  last_frame_url: string | null;
  prompt: string;
  status: string;
  motion_vectors?: any;
}

interface TransitionAnalysis {
  fromIndex: number;
  toIndex: number;
  lightingMatch: number;
  colorMatch: number;
  depthMatch: number;
  objectMatch: number;
  motionMatch: number;
  overallScore: number;
  isCompatible: boolean;
  gaps: {
    component: string;
    severity: 'minor' | 'moderate' | 'severe';
    description: string;
    bridgePrompt: string;
  }[];
  recommendedTransition: 'cut' | 'dissolve' | 'fade' | 'ai-bridge';
  bridgeClipNeeded: boolean;
  bridgeClipPrompt?: string;
  bridgeClipUrl?: string;
  bridgeGenerating?: boolean;
}

interface ClipTransitionAnalyzerProps {
  projectId: string;
  onBridgeGenerated?: () => void;
}

export function ClipTransitionAnalyzer({ projectId, onBridgeGenerated }: ClipTransitionAnalyzerProps) {
  const [clips, setClips] = useState<VideoClip[]>([]);
  const [transitions, setTransitions] = useState<TransitionAnalysis[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [expandedTransition, setExpandedTransition] = useState<number | null>(null);
  const [analyzingStep, setAnalyzingStep] = useState<string>('');
  
  // Load clips for the project
  useEffect(() => {
    loadClips();
  }, [projectId]);
  
  async function loadClips() {
    const { data, error } = await supabase
      .from('video_clips')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'completed')
      .order('shot_index', { ascending: true });
    
    if (error) {
      console.error('Error loading clips:', error);
      return;
    }
    
    setClips(data || []);
  }
  
  // Analyze all transitions between clips
  async function analyzeTransitions() {
    if (clips.length < 2) {
      toast.error('Need at least 2 clips to analyze transitions');
      return;
    }
    
    setIsAnalyzing(true);
    setTransitions([]);
    
    try {
      // Step 1: Extract scene anchors for each clip
      setAnalyzingStep('Extracting visual fingerprints...');
      const anchors: any[] = [];
      
      for (let i = 0; i < clips.length; i++) {
        setAnalyzingStep(`Analyzing clip ${i + 1}/${clips.length}...`);
        const clip = clips[i];
        
        const { data, error } = await supabase.functions.invoke('extract-scene-anchor', {
          body: {
            frameUrl: clip.last_frame_url || clip.video_url,
            shotId: clip.id,
            projectId,
          },
        });
        
        if (data?.success && data.anchor) {
          anchors.push({
            clipIndex: i,
            clipId: clip.id,
            ...data.anchor,
            lastFrameUrl: clip.last_frame_url || clip.video_url,
          });
        } else {
          console.warn(`Failed to extract anchor for clip ${i}:`, data?.error);
          anchors.push({ clipIndex: i, clipId: clip.id, error: true });
        }
      }
      
      // Step 2: Compare consecutive clips
      setAnalyzingStep('Comparing transitions...');
      const newTransitions: TransitionAnalysis[] = [];
      
      for (let i = 0; i < clips.length - 1; i++) {
        setAnalyzingStep(`Comparing clip ${i + 1} → ${i + 2}...`);
        const anchor1 = anchors[i];
        const anchor2 = anchors[i + 1];
        
        if (anchor1.error || anchor2.error) {
          newTransitions.push({
            fromIndex: i,
            toIndex: i + 1,
            lightingMatch: 50,
            colorMatch: 50,
            depthMatch: 50,
            objectMatch: 50,
            motionMatch: 50,
            overallScore: 50,
            isCompatible: false,
            gaps: [{ component: 'analysis', severity: 'moderate', description: 'Analysis incomplete', bridgePrompt: '' }],
            recommendedTransition: 'dissolve',
            bridgeClipNeeded: false,
          });
          continue;
        }
        
        const { data, error } = await supabase.functions.invoke('compare-scene-anchors', {
          body: {
            anchor1,
            anchor2,
            strictness: 'normal',
          },
        });
        
        if (data?.success && data.comparison) {
          const comp = data.comparison;
          newTransitions.push({
            fromIndex: i,
            toIndex: i + 1,
            lightingMatch: comp.lightingMatch,
            colorMatch: comp.colorMatch,
            depthMatch: comp.depthMatch,
            objectMatch: comp.objectMatch,
            motionMatch: comp.motionMatch,
            overallScore: comp.overallScore,
            isCompatible: comp.isCompatible,
            gaps: comp.gaps || [],
            recommendedTransition: comp.recommendedTransition,
            bridgeClipNeeded: comp.bridgeClipNeeded,
            bridgeClipPrompt: comp.bridgeClipPrompt,
          });
        } else {
          newTransitions.push({
            fromIndex: i,
            toIndex: i + 1,
            lightingMatch: 70,
            colorMatch: 70,
            depthMatch: 70,
            objectMatch: 70,
            motionMatch: 70,
            overallScore: 70,
            isCompatible: true,
            gaps: [],
            recommendedTransition: 'dissolve',
            bridgeClipNeeded: false,
          });
        }
      }
      
      setTransitions(newTransitions);
      setAnalyzingStep('');
      
      const problemCount = newTransitions.filter(t => t.bridgeClipNeeded).length;
      if (problemCount > 0) {
        toast.warning(`Found ${problemCount} transition${problemCount > 1 ? 's' : ''} that need bridge clips`);
      } else {
        toast.success('All transitions look smooth!');
      }
      
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Failed to analyze transitions');
    } finally {
      setIsAnalyzing(false);
      setAnalyzingStep('');
    }
  }
  
  // Generate a bridge clip for a specific transition
  async function generateBridgeClip(transitionIndex: number) {
    const transition = transitions[transitionIndex];
    if (!transition.bridgeClipPrompt) {
      toast.error('No bridge prompt available');
      return;
    }
    
    // Update state to show generating
    setTransitions(prev => prev.map((t, i) => 
      i === transitionIndex ? { ...t, bridgeGenerating: true } : t
    ));
    
    try {
      const fromClip = clips[transition.fromIndex];
      const toClip = clips[transition.toIndex];
      
      toast.info('Generating bridge clip... This may take 30-60 seconds');
      
      const { data, error } = await supabase.functions.invoke('generate-video', {
        body: {
          prompt: transition.bridgeClipPrompt,
          startFrameUrl: fromClip.last_frame_url || fromClip.video_url,
          duration: 2, // 2-second bridge
          aspectRatio: '16:9',
          negativePrompt: 'jarring transition, sudden change, inconsistent lighting',
        },
      });
      
      if (data?.success && data.videoUrl) {
        setTransitions(prev => prev.map((t, i) => 
          i === transitionIndex 
            ? { ...t, bridgeClipUrl: data.videoUrl, bridgeGenerating: false, bridgeClipNeeded: false }
            : t
        ));
        toast.success('Bridge clip generated!');
        onBridgeGenerated?.();
      } else if (data?.taskId) {
        // Long-running task - need to poll
        toast.info('Bridge generation started. Checking status...');
        // For now just mark as pending
        setTransitions(prev => prev.map((t, i) => 
          i === transitionIndex ? { ...t, bridgeGenerating: false } : t
        ));
      } else {
        throw new Error(data?.error || 'Generation failed');
      }
      
    } catch (error) {
      console.error('Bridge generation error:', error);
      toast.error('Failed to generate bridge clip');
      setTransitions(prev => prev.map((t, i) => 
        i === transitionIndex ? { ...t, bridgeGenerating: false } : t
      ));
    }
  }
  
  // Generate all needed bridge clips
  async function generateAllBridges() {
    const bridgesNeeded = transitions.filter(t => t.bridgeClipNeeded && !t.bridgeClipUrl);
    if (bridgesNeeded.length === 0) {
      toast.info('No bridge clips needed');
      return;
    }
    
    toast.info(`Generating ${bridgesNeeded.length} bridge clip${bridgesNeeded.length > 1 ? 's' : ''}...`);
    
    for (let i = 0; i < transitions.length; i++) {
      if (transitions[i].bridgeClipNeeded && !transitions[i].bridgeClipUrl) {
        await generateBridgeClip(i);
      }
    }
  }
  
  function getScoreColor(score: number) {
    if (score >= 85) return 'text-green-500';
    if (score >= 70) return 'text-yellow-500';
    if (score >= 50) return 'text-orange-500';
    return 'text-red-500';
  }
  
  function getScoreBg(score: number) {
    if (score >= 85) return 'bg-green-500/20';
    if (score >= 70) return 'bg-yellow-500/20';
    if (score >= 50) return 'bg-orange-500/20';
    return 'bg-red-500/20';
  }
  
  function getTransitionIcon(transition: TransitionAnalysis) {
    if (transition.bridgeClipUrl) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    if (transition.bridgeClipNeeded) {
      return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    }
    if (transition.isCompatible) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
  }
  
  const problemTransitions = transitions.filter(t => t.bridgeClipNeeded && !t.bridgeClipUrl);
  const overallScore = transitions.length > 0 
    ? Math.round(transitions.reduce((sum, t) => sum + t.overallScore, 0) / transitions.length)
    : 0;
  
  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Transition Analyzer
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Analyze clip-to-clip continuity and generate bridge scenes
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {transitions.length > 0 && (
              <Badge variant="outline" className={getScoreBg(overallScore)}>
                <span className={getScoreColor(overallScore)}>
                  {overallScore}% Match
                </span>
              </Badge>
            )}
            <Button
              onClick={analyzeTransitions}
              disabled={isAnalyzing || clips.length < 2}
              size="sm"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {analyzingStep || 'Analyzing...'}
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Analyze
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {clips.length < 2 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Need at least 2 completed clips to analyze transitions</p>
            <p className="text-sm mt-1">Currently have {clips.length} clip{clips.length !== 1 ? 's' : ''}</p>
          </div>
        ) : transitions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Eye className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Click "Analyze" to check transitions between your {clips.length} clips</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary */}
            {problemTransitions.length > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  <span className="text-sm">
                    {problemTransitions.length} transition{problemTransitions.length > 1 ? 's' : ''} need bridge clips
                  </span>
                </div>
                <Button size="sm" onClick={generateAllBridges}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate All Bridges
                </Button>
              </div>
            )}
            
            {/* Clip Timeline */}
            <ScrollArea className="w-full">
              <div className="flex items-start gap-2 pb-4 min-w-max">
                {clips.map((clip, index) => (
                  <div key={clip.id} className="flex items-center">
                    {/* Clip Card */}
                    <div className="w-36 flex-shrink-0">
                      <div className="aspect-video rounded-md overflow-hidden bg-muted relative">
                        {clip.video_url ? (
                          <video
                            src={clip.video_url}
                            className="w-full h-full object-cover"
                            muted
                            loop
                            onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
                            onMouseLeave={(e) => {
                              const video = e.target as HTMLVideoElement;
                              video.pause();
                              video.currentTime = 0;
                            }}
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Play className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="absolute top-1 left-1">
                          <Badge variant="secondary" className="text-xs px-1.5">
                            #{index + 1}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1 px-0.5">
                        {clip.prompt.substring(0, 40)}...
                      </p>
                    </div>
                    
                    {/* Transition Indicator */}
                    {index < clips.length - 1 && transitions[index] && (
                      <div 
                        className="flex-shrink-0 mx-1 cursor-pointer"
                        onClick={() => setExpandedTransition(expandedTransition === index ? null : index)}
                      >
                        <div className={`
                          flex items-center justify-center w-12 h-12 rounded-full border-2
                          ${transitions[index].bridgeClipUrl 
                            ? 'border-green-500 bg-green-500/10' 
                            : transitions[index].bridgeClipNeeded 
                              ? 'border-orange-500 bg-orange-500/10' 
                              : transitions[index].isCompatible 
                                ? 'border-green-500/50 bg-green-500/5' 
                                : 'border-yellow-500/50 bg-yellow-500/5'
                          }
                          transition-all hover:scale-110
                        `}>
                          <div className="text-center">
                            {getTransitionIcon(transitions[index])}
                            <span className={`text-xs font-medium ${getScoreColor(transitions[index].overallScore)}`}>
                              {transitions[index].overallScore}%
                            </span>
                          </div>
                        </div>
                        <div className="text-center mt-1">
                          <Badge variant="outline" className="text-[10px] px-1">
                            {transitions[index].recommendedTransition}
                          </Badge>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
            
            <Separator />
            
            {/* Expanded Transition Details */}
            {expandedTransition !== null && transitions[expandedTransition] && (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium flex items-center gap-2">
                    Clip {expandedTransition + 1}
                    <ArrowRight className="h-4 w-4" />
                    Clip {expandedTransition + 2}
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedTransition(null)}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                </div>
                
                {/* Score Breakdown */}
                <div className="grid grid-cols-5 gap-3">
                  {[
                    { label: 'Lighting', score: transitions[expandedTransition].lightingMatch },
                    { label: 'Color', score: transitions[expandedTransition].colorMatch },
                    { label: 'Depth', score: transitions[expandedTransition].depthMatch },
                    { label: 'Objects', score: transitions[expandedTransition].objectMatch },
                    { label: 'Motion', score: transitions[expandedTransition].motionMatch },
                  ].map(({ label, score }) => (
                    <div key={label} className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">{label}</p>
                      <Progress value={score} className="h-2" />
                      <p className={`text-xs font-medium mt-1 ${getScoreColor(score)}`}>{score}%</p>
                    </div>
                  ))}
                </div>
                
                {/* Gaps */}
                {transitions[expandedTransition].gaps.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Issues Detected:</p>
                    {transitions[expandedTransition].gaps.map((gap, i) => (
                      <div 
                        key={i} 
                        className={`
                          text-sm p-2 rounded
                          ${gap.severity === 'severe' ? 'bg-red-500/10 text-red-400' :
                            gap.severity === 'moderate' ? 'bg-orange-500/10 text-orange-400' :
                            'bg-yellow-500/10 text-yellow-400'}
                        `}
                      >
                        <span className="font-medium capitalize">{gap.component}:</span> {gap.description}
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Bridge Actions */}
                {transitions[expandedTransition].bridgeClipNeeded && !transitions[expandedTransition].bridgeClipUrl && (
                  <div className="pt-2">
                    <Button
                      onClick={() => generateBridgeClip(expandedTransition)}
                      disabled={transitions[expandedTransition].bridgeGenerating}
                      className="w-full"
                    >
                      {transitions[expandedTransition].bridgeGenerating ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Generating Bridge Clip...
                        </>
                      ) : (
                        <>
                          <Zap className="h-4 w-4 mr-2" />
                          Generate AI Bridge Clip
                        </>
                      )}
                    </Button>
                    {transitions[expandedTransition].bridgeClipPrompt && (
                      <p className="text-xs text-muted-foreground mt-2 italic">
                        "{transitions[expandedTransition].bridgeClipPrompt}"
                      </p>
                    )}
                  </div>
                )}
                
                {/* Bridge Generated */}
                {transitions[expandedTransition].bridgeClipUrl && (
                  <div className="pt-2">
                    <p className="text-sm text-green-500 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Bridge clip generated
                    </p>
                    <div className="mt-2 aspect-video w-48 rounded-md overflow-hidden bg-muted">
                      <video
                        src={transitions[expandedTransition].bridgeClipUrl}
                        className="w-full h-full object-cover"
                        controls
                        muted
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Transition List (collapsed view) */}
            {expandedTransition === null && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Click a transition circle above for details</p>
                {transitions.some(t => t.gaps.length > 0) && (
                  <div className="text-xs text-muted-foreground">
                    {transitions.filter(t => t.gaps.some(g => g.severity === 'severe')).length} severe issues,{' '}
                    {transitions.filter(t => t.gaps.some(g => g.severity === 'moderate')).length} moderate issues
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
