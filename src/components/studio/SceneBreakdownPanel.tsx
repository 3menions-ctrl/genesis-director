import { useState } from 'react';
import { Sparkles, Clock, Film, Users, ChevronDown, ChevronUp, Loader2, Clapperboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SceneBreakdown } from '@/types/studio';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface SceneBreakdownPanelProps {
  script?: string;
  scenes: SceneBreakdown[];
  onScenesChange: (scenes: SceneBreakdown[]) => void;
}

export function SceneBreakdownPanel({ script, scenes, onScenesChange }: SceneBreakdownPanelProps) {
  const [isExtracting, setIsExtracting] = useState(false);
  const [expandedScene, setExpandedScene] = useState<number | null>(null);
  const [totalDuration, setTotalDuration] = useState(0);

  const extractScenes = async () => {
    if (!script || script.trim().length === 0) {
      toast.error('Please add a script first');
      return;
    }

    setIsExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke('extract-scenes', {
        body: { script }
      });

      if (error) {
        console.error('Scene extraction error:', error);
        toast.error('Failed to extract scenes');
        return;
      }

      if (data.error) {
        toast.error(data.error);
        return;
      }

      if (data.scenes && Array.isArray(data.scenes)) {
        onScenesChange(data.scenes);
        setTotalDuration(data.totalDurationSeconds || data.scenes.reduce((acc: number, s: SceneBreakdown) => acc + s.durationSeconds, 0));
        toast.success(`Extracted ${data.scenes.length} scenes`);
      }
    } catch (err) {
      console.error('Scene extraction error:', err);
      toast.error('Failed to extract scenes');
    } finally {
      setIsExtracting(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const getMoodColor = (mood: string) => {
    const moodLower = mood.toLowerCase();
    if (moodLower.includes('dramatic') || moodLower.includes('tense')) return 'from-red-500/20 to-orange-500/20 border-red-500/30';
    if (moodLower.includes('calm') || moodLower.includes('peaceful')) return 'from-blue-500/20 to-cyan-500/20 border-blue-500/30';
    if (moodLower.includes('joy') || moodLower.includes('happy')) return 'from-yellow-500/20 to-amber-500/20 border-yellow-500/30';
    if (moodLower.includes('mysterious') || moodLower.includes('dark')) return 'from-purple-500/20 to-indigo-500/20 border-purple-500/30';
    return 'from-slate-500/20 to-gray-500/20 border-slate-500/30';
  };

  return (
    <div className="space-y-4">
      {/* Header with Extract Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clapperboard className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-medium text-foreground">Scene Breakdown</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={extractScenes}
          disabled={isExtracting || !script}
          className="gap-2 text-xs border-cyan-500/30 hover:bg-cyan-500/10 hover:border-cyan-500/50"
        >
          {isExtracting ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="w-3 h-3" />
              AI Extract
            </>
          )}
        </Button>
      </div>

      {/* Total Duration */}
      {scenes.length > 0 && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20">
          <span className="text-xs text-muted-foreground">Total Duration</span>
          <div className="flex items-center gap-2">
            <Clock className="w-3 h-3 text-cyan-400" />
            <span className="text-sm font-mono text-foreground">{formatDuration(totalDuration)}</span>
          </div>
        </div>
      )}

      {/* Scene List */}
      {scenes.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Film className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-xs">No scenes extracted yet</p>
          <p className="text-[10px] mt-1 opacity-70">Click "AI Extract" to analyze your script</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
          {scenes.map((scene) => (
            <div
              key={scene.sceneNumber}
              className={cn(
                "rounded-xl border transition-all duration-300",
                expandedScene === scene.sceneNumber
                  ? "bg-gradient-to-br from-muted/40 to-muted/20 border-primary/30"
                  : "bg-muted/20 border-border/10 hover:border-border/30"
              )}
            >
              {/* Scene Header */}
              <button
                onClick={() => setExpandedScene(expandedScene === scene.sceneNumber ? null : scene.sceneNumber)}
                className="w-full p-3 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/20 flex items-center justify-center">
                    <span className="text-xs font-mono text-cyan-400">{scene.sceneNumber}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground line-clamp-1">{scene.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {formatDuration(scene.durationSeconds)}
                      </span>
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full bg-gradient-to-r border capitalize",
                        getMoodColor(scene.mood)
                      )}>
                        {scene.mood}
                      </span>
                    </div>
                  </div>
                </div>
                {expandedScene === scene.sceneNumber ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </button>

              {/* Scene Details */}
              {expandedScene === scene.sceneNumber && (
                <div className="px-3 pb-3 space-y-3 border-t border-border/10 pt-3">
                  {/* Characters */}
                  {scene.characters.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Users className="w-3 h-3 text-violet-400" />
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Characters</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {scene.characters.map((char, idx) => (
                          <span
                            key={idx}
                            className="text-xs px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300"
                          >
                            {char}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Script Text */}
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1.5">Script</span>
                    <p className="text-xs text-foreground/80 bg-muted/30 p-2 rounded-lg border border-border/10 italic">
                      "{scene.scriptText}"
                    </p>
                  </div>

                  {/* Visual Description */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Film className="w-3 h-3 text-emerald-400" />
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Visual Description</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed bg-emerald-500/5 p-2 rounded-lg border border-emerald-500/10">
                      {scene.visualDescription}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
