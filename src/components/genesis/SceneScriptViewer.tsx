import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Film, MapPin, Clock, Cloud, Users, Play, 
  ChevronDown, ChevronRight, Camera, MessageSquare,
  CheckCircle, AlertCircle, Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useGenesisScenes } from '@/hooks/useCollaborativeMovie';
import type { GenesisScene, GenesisSceneCharacter } from '@/types/collaborative-movie';

interface SceneScriptViewerProps {
  screenplayId: string;
  onGenerateScene?: (scene: GenesisScene) => void;
}

const statusColors: Record<string, string> = {
  pending: 'bg-gray-500/20 text-gray-300',
  casting: 'bg-yellow-500/20 text-yellow-300',
  ready: 'bg-blue-500/20 text-blue-300',
  filming: 'bg-purple-500/20 text-purple-300',
  submitted: 'bg-orange-500/20 text-orange-300',
  approved: 'bg-green-500/20 text-green-300',
  rejected: 'bg-red-500/20 text-red-300'
};

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="h-3 w-3" />,
  casting: <Users className="h-3 w-3" />,
  ready: <Play className="h-3 w-3" />,
  filming: <Camera className="h-3 w-3" />,
  submitted: <Loader2 className="h-3 w-3" />,
  approved: <CheckCircle className="h-3 w-3" />,
  rejected: <AlertCircle className="h-3 w-3" />
};

function SceneCard({ 
  scene, 
  isExpanded, 
  onToggle,
  onGenerate 
}: { 
  scene: GenesisScene; 
  isExpanded: boolean;
  onToggle: () => void;
  onGenerate?: () => void;
}) {
  const canGenerate = scene.status === 'ready' && 
    scene.characters?.every(c => c.character?.is_cast);
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="border-l-2 border-primary/20 pl-4 ml-4"
    >
      <Card className={`overflow-hidden transition-all ${
        isExpanded ? 'border-primary/50' : 'border-border/30'
      } ${scene.is_key_scene ? 'ring-1 ring-amber-500/30' : ''}`}>
        <CardHeader 
          className="cursor-pointer py-3 px-4"
          onClick={onToggle}
        >
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ rotate: isExpanded ? 90 : 0 }}
              className="text-muted-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </motion.div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">
                  {String(scene.scene_number).padStart(3, '0')}
                </span>
                <h4 className="font-medium truncate">{scene.title}</h4>
                {scene.is_key_scene && (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-xs">
                    Key Scene
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                {scene.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {scene.location.name}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {scene.duration_seconds}s
                </span>
                {scene.characters && scene.characters.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {scene.characters.length}
                  </span>
                )}
              </div>
            </div>
            
            <Badge className={statusColors[scene.status]}>
              {statusIcons[scene.status]}
              <span className="ml-1 capitalize">{scene.status}</span>
            </Badge>
          </div>
        </CardHeader>
        
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <CardContent className="pt-0 pb-4 px-4 space-y-4">
                {/* Scene Details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  <div className="p-2 rounded bg-muted/30">
                    <div className="text-xs text-muted-foreground">Time</div>
                    <div className="capitalize">{scene.time_of_day}</div>
                  </div>
                  <div className="p-2 rounded bg-muted/30">
                    <div className="text-xs text-muted-foreground">Weather</div>
                    <div className="capitalize flex items-center gap-1">
                      <Cloud className="h-3 w-3" />
                      {scene.weather}
                    </div>
                  </div>
                  {scene.mood && (
                    <div className="p-2 rounded bg-muted/30">
                      <div className="text-xs text-muted-foreground">Mood</div>
                      <div>{scene.mood}</div>
                    </div>
                  )}
                  {scene.era && (
                    <div className="p-2 rounded bg-muted/30">
                      <div className="text-xs text-muted-foreground">Era</div>
                      <div>{scene.era.name}</div>
                    </div>
                  )}
                </div>
                
                {/* Description */}
                {scene.description && (
                  <div className="p-3 rounded-lg bg-muted/20 text-sm">
                    {scene.description}
                  </div>
                )}
                
                {/* Visual Prompt */}
                {scene.visual_prompt && (
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Camera className="h-3 w-3" />
                      Visual Direction
                    </div>
                    <div className="p-3 rounded-lg bg-primary/5 text-sm italic border border-primary/10">
                      {scene.visual_prompt}
                    </div>
                  </div>
                )}
                
                {/* Camera Directions */}
                {scene.camera_directions && (
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">Camera</div>
                    <div className="text-sm text-muted-foreground">
                      {scene.camera_directions}
                    </div>
                  </div>
                )}
                
                {/* Characters in Scene */}
                {scene.characters && scene.characters.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      Characters
                    </div>
                    <div className="space-y-2">
                      {scene.characters.map((sc) => (
                        <div 
                          key={sc.id}
                          className="p-3 rounded-lg bg-muted/20 border border-border/30"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{sc.character?.name}</span>
                              {sc.character?.is_cast ? (
                                <Badge variant="outline" className="bg-green-500/10 text-green-400 text-xs">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Cast
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">
                                  Needs casting
                                </Badge>
                              )}
                            </div>
                            <Badge variant="outline" className="text-xs capitalize">
                              {sc.character?.role_type}
                            </Badge>
                          </div>
                          
                          {sc.action_description && (
                            <p className="text-sm text-muted-foreground mb-1">
                              {sc.action_description}
                            </p>
                          )}
                          
                          {sc.dialogue && (
                            <div className="flex items-start gap-2 mt-2">
                              <MessageSquare className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                              <p className="text-sm italic">"{sc.dialogue}"</p>
                            </div>
                          )}
                          
                          <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
                            {sc.emotional_state && (
                              <span className="capitalize">{sc.emotional_state}</span>
                            )}
                            {sc.screen_time_seconds && (
                              <span>{sc.screen_time_seconds}s</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Generate Button */}
                {onGenerate && (
                  <Button 
                    onClick={onGenerate}
                    disabled={!canGenerate}
                    className="w-full"
                  >
                    <Film className="h-4 w-4 mr-2" />
                    {canGenerate 
                      ? 'Generate This Scene' 
                      : scene.characters?.some(c => !c.character?.is_cast)
                        ? 'Waiting for Cast'
                        : 'Not Ready'
                    }
                  </Button>
                )}
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

export function SceneScriptViewer({ screenplayId, onGenerateScene }: SceneScriptViewerProps) {
  const { data: scenes, isLoading } = useGenesisScenes(screenplayId);
  const [expandedScenes, setExpandedScenes] = useState<Set<string>>(new Set());
  const [filterAct, setFilterAct] = useState<number | null>(null);
  
  const toggleScene = (sceneId: string) => {
    setExpandedScenes(prev => {
      const next = new Set(prev);
      if (next.has(sceneId)) {
        next.delete(sceneId);
      } else {
        next.add(sceneId);
      }
      return next;
    });
  };
  
  const filteredScenes = scenes?.filter(s => 
    filterAct === null || s.act_number === filterAct
  ) || [];
  
  // Group scenes by act
  const acts = new Set(scenes?.map(s => s.act_number) || []);
  
  // Calculate progress
  const totalScenes = scenes?.length || 0;
  const approvedScenes = scenes?.filter(s => s.status === 'approved').length || 0;
  const progress = totalScenes > 0 ? (approvedScenes / totalScenes) * 100 : 0;
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="py-3">
              <div className="h-5 bg-muted rounded w-1/3" />
            </CardHeader>
          </Card>
        ))}
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span>Script Progress</span>
          <span>{approvedScenes} / {totalScenes} scenes completed</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>
      
      {/* Act Filter */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={filterAct === null ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterAct(null)}
        >
          All Acts
        </Button>
        {Array.from(acts).sort().map(act => (
          <Button
            key={act}
            variant={filterAct === act ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterAct(act)}
          >
            Act {act}
          </Button>
        ))}
        
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpandedScenes(new Set(filteredScenes.map(s => s.id)))}
          >
            <ChevronDown className="h-4 w-4 mr-1" />
            Expand All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpandedScenes(new Set())}
          >
            Collapse All
          </Button>
        </div>
      </div>
      
      {/* Scene List */}
      <ScrollArea className="h-[600px] pr-4">
        <div className="space-y-2 pb-8">
          <AnimatePresence>
            {filteredScenes.map(scene => (
              <SceneCard
                key={scene.id}
                scene={scene}
                isExpanded={expandedScenes.has(scene.id)}
                onToggle={() => toggleScene(scene.id)}
                onGenerate={onGenerateScene ? () => onGenerateScene(scene) : undefined}
              />
            ))}
          </AnimatePresence>
        </div>
      </ScrollArea>
      
      {filteredScenes.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No scenes found for this filter.
        </div>
      )}
    </div>
  );
}
