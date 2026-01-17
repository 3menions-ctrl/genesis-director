import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Camera, 
  ChevronDown, 
  ChevronUp, 
  Clapperboard, 
  Clock, 
  Film, 
  Palette, 
  Sparkles, 
  Users, 
  X,
  Move,
  Sun,
  Layers
} from 'lucide-react';
import { 
  TemplateShotSequence, 
  TemplateStyleAnchor, 
  TemplateCharacter, 
  TemplateEnvironmentLock 
} from '@/hooks/useTemplateEnvironment';
import { cn } from '@/lib/utils';

interface TemplatePreviewPanelProps {
  templateName: string;
  shotSequence: TemplateShotSequence[] | null;
  styleAnchor: TemplateStyleAnchor | null;
  characters: TemplateCharacter[] | null;
  environmentLock: TemplateEnvironmentLock | null;
  pacingStyle: string | null;
  onClear: () => void;
}

export function TemplatePreviewPanel({
  templateName,
  shotSequence,
  styleAnchor,
  characters,
  environmentLock,
  pacingStyle,
  onClear,
}: TemplatePreviewPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeShotIndex, setActiveShotIndex] = useState<number | null>(null);

  const hasRichData = shotSequence || styleAnchor || characters || environmentLock;

  if (!hasRichData) {
    return null;
  }

  const totalDuration = shotSequence?.reduce((sum, shot) => sum + (shot.durationSeconds || 6), 0) || 0;

  return (
    <Card className="bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border-amber-500/20 overflow-hidden">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardHeader className="pb-2 pt-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                <Clapperboard className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                  Using Template: {templateName}
                  <Badge variant="secondary" className="bg-amber-500/20 text-amber-300 text-[10px] px-1.5">
                    {shotSequence?.length || 0} shots
                  </Badge>
                </CardTitle>
                <p className="text-xs text-white/50 mt-0.5">
                  Pre-configured shot sequence • {totalDuration}s total
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-white/50 hover:text-white hover:bg-white/10">
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </CollapsibleTrigger>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onClear}
                className="h-7 w-7 p-0 text-white/50 hover:text-red-400 hover:bg-red-500/10"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-2 pb-4 px-4 space-y-4">
            {/* Quick Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {shotSequence && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
                  <Film className="w-4 h-4 text-amber-400" />
                  <div>
                    <p className="text-xs text-white/50">Shots</p>
                    <p className="text-sm font-semibold text-white">{shotSequence.length}</p>
                  </div>
                </div>
              )}
              {characters && characters.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
                  <Users className="w-4 h-4 text-blue-400" />
                  <div>
                    <p className="text-xs text-white/50">Characters</p>
                    <p className="text-sm font-semibold text-white">{characters.length}</p>
                  </div>
                </div>
              )}
              {styleAnchor && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
                  <Palette className="w-4 h-4 text-amber-400" />
                  <div>
                    <p className="text-xs text-white/50">Style</p>
                    <p className="text-sm font-semibold text-white truncate">{styleAnchor.visualStyle || 'Custom'}</p>
                  </div>
                </div>
              )}
              {pacingStyle && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  <div>
                    <p className="text-xs text-white/50">Pacing</p>
                    <p className="text-sm font-semibold text-white capitalize">{pacingStyle}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Shot Sequence Timeline */}
            {shotSequence && shotSequence.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-medium text-white/70 uppercase tracking-wider">Shot Sequence</h4>
                  <Badge variant="outline" className="text-[10px] border-white/20 text-white/50">
                    Click to preview
                  </Badge>
                </div>
                <ScrollArea className="h-32 rounded-lg border border-white/10 bg-black/20">
                  <div className="p-2 space-y-1">
                    {shotSequence.map((shot, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveShotIndex(activeShotIndex === idx ? null : idx)}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-lg transition-all",
                          activeShotIndex === idx 
                            ? "bg-violet-500/20 border border-violet-500/40" 
                            : "hover:bg-white/5 border border-transparent"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-medium text-white/70">
                              {idx + 1}
                            </span>
                            <span className="text-sm font-medium text-white truncate max-w-[150px]">
                              {shot.title || `Shot ${idx + 1}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] border-white/20 text-white/50 hidden sm:inline-flex">
                              {shot.cameraScale || 'MEDIUM'}
                            </Badge>
                            <span className="text-[10px] text-white/40">{shot.durationSeconds || 6}s</span>
                          </div>
                        </div>
                        
                        {/* Expanded shot details */}
                        {activeShotIndex === idx && (
                          <div className="mt-2 pt-2 border-t border-white/10 space-y-2">
                            <p className="text-xs text-white/60 line-clamp-2">{shot.description}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {shot.cameraAngle && (
                                <Badge className="bg-blue-500/20 text-blue-300 text-[10px] border-0">
                                  <Camera className="w-2.5 h-2.5 mr-1" />
                                  {shot.cameraAngle}
                                </Badge>
                              )}
                              {shot.movementType && (
                                <Badge className="bg-emerald-500/20 text-emerald-300 text-[10px] border-0">
                                  <Move className="w-2.5 h-2.5 mr-1" />
                                  {shot.movementType}
                                </Badge>
                              )}
                              {shot.sceneType && (
                                <Badge className="bg-amber-500/20 text-amber-300 text-[10px] border-0">
                                  <Layers className="w-2.5 h-2.5 mr-1" />
                                  {shot.sceneType}
                                </Badge>
                              )}
                              {shot.mood && (
                                <Badge className="bg-purple-500/20 text-purple-300 text-[10px] border-0">
                                  <Sparkles className="w-2.5 h-2.5 mr-1" />
                                  {shot.mood}
                                </Badge>
                              )}
                            </div>
                            {shot.dialogue && (
                              <div className="mt-1 p-2 rounded bg-white/5 text-xs text-white/50 italic">
                                "{shot.dialogue}"
                              </div>
                            )}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Characters Section */}
            {characters && characters.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-white/70 uppercase tracking-wider">Characters</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {characters.map((char, idx) => (
                    <div 
                      key={idx} 
                      className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-white">{char.name}</span>
                        <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-400">
                          {char.role}
                        </Badge>
                      </div>
                      <p className="text-xs text-white/50 line-clamp-1">{char.appearance}</p>
                      {char.personality && (
                        <p className="text-[10px] text-white/40 italic">{char.personality}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Style Anchor Section */}
            {styleAnchor && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-white/70 uppercase tracking-wider">Style Settings</h4>
                <div className="grid grid-cols-2 gap-2">
                  {styleAnchor.visualStyle && (
                    <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                      <p className="text-[10px] text-white/40 uppercase">Visual Style</p>
                      <p className="text-xs text-white/80 capitalize">{styleAnchor.visualStyle}</p>
                    </div>
                  )}
                  {styleAnchor.colorGrading && (
                    <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                      <p className="text-[10px] text-white/40 uppercase">Color Grading</p>
                      <p className="text-xs text-white/80 capitalize">{styleAnchor.colorGrading}</p>
                    </div>
                  )}
                  {styleAnchor.lightingStyle && (
                    <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                      <p className="text-[10px] text-white/40 uppercase">Lighting</p>
                      <p className="text-xs text-white/80 capitalize">{styleAnchor.lightingStyle}</p>
                    </div>
                  )}
                  {styleAnchor.cameraPhilosophy && (
                    <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                      <p className="text-[10px] text-white/40 uppercase">Camera Style</p>
                      <p className="text-xs text-white/80 capitalize truncate">{styleAnchor.cameraPhilosophy}</p>
                    </div>
                  )}
                </div>
                {styleAnchor.pacingNotes && (
                  <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-[10px] text-white/40 uppercase">Pacing Notes</p>
                    <p className="text-xs text-white/60 line-clamp-2">{styleAnchor.pacingNotes}</p>
                  </div>
                )}
              </div>
            )}

            {/* Environment Lock Section */}
            {environmentLock && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-white/70 uppercase tracking-wider">Environment Lock</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {environmentLock.location && (
                    <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <p className="text-[10px] text-emerald-400/70 uppercase">Location</p>
                      <p className="text-xs text-emerald-300 capitalize truncate">{environmentLock.location}</p>
                    </div>
                  )}
                  {environmentLock.timeOfDay && (
                    <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <p className="text-[10px] text-amber-400/70 uppercase flex items-center gap-1">
                        <Sun className="w-2.5 h-2.5" /> Time
                      </p>
                      <p className="text-xs text-amber-300 capitalize">{environmentLock.timeOfDay}</p>
                    </div>
                  )}
                  {environmentLock.weather && (
                    <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <p className="text-[10px] text-blue-400/70 uppercase">Weather</p>
                      <p className="text-xs text-blue-300 capitalize">{environmentLock.weather}</p>
                    </div>
                  )}
                  {environmentLock.lighting && (
                    <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                      <p className="text-[10px] text-white/40 uppercase">Lighting</p>
                      <p className="text-xs text-white/70 capitalize truncate">{environmentLock.lighting}</p>
                    </div>
                  )}
                  {environmentLock.colorPalette && (
                    <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                      <p className="text-[10px] text-white/40 uppercase">Color Palette</p>
                      <p className="text-xs text-white/70 capitalize truncate">{environmentLock.colorPalette}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
