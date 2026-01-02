import { Layers, Eye, Image, User, Volume2, Type, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AssetLayer } from '@/types/studio';
import { cn } from '@/lib/utils';

interface AssetLayersPanelProps {
  layers: AssetLayer[];
  onToggleVisibility?: (layerId: string) => void;
  onReorder?: (layers: AssetLayer[]) => void;
}

const LAYER_ICONS: Record<AssetLayer['layer_type'], React.ComponentType<{ className?: string }>> = {
  background_video: Image,
  character_video: User,
  audio_narration: Volume2,
  overlay_metadata: Type,
};

const LAYER_NAMES: Record<AssetLayer['layer_type'], string> = {
  background_video: 'Background (Runway)',
  character_video: 'AI Presenter (HeyGen)',
  audio_narration: 'Voice (ElevenLabs)',
  overlay_metadata: 'Overlays & Captions',
};

const LAYER_COLORS: Record<AssetLayer['layer_type'], string> = {
  background_video: 'from-emerald-500/20 to-teal-500/20 text-emerald-400',
  character_video: 'from-violet-500/20 to-purple-500/20 text-violet-400',
  audio_narration: 'from-cyan-500/20 to-blue-500/20 text-cyan-400',
  overlay_metadata: 'from-amber-500/20 to-orange-500/20 text-amber-400',
};

export function AssetLayersPanel({ layers, onToggleVisibility }: AssetLayersPanelProps) {
  const sortedLayers = [...layers].sort((a, b) => b.z_index - a.z_index);

  return (
    <div className="rounded-xl border border-border/30 bg-card/40 backdrop-blur-sm overflow-hidden">
      <div className="p-4 border-b border-border/30 flex items-center gap-2">
        <div className="p-2 rounded-lg bg-primary/10">
          <Layers className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Composition Layers</h3>
          <p className="text-xs text-muted-foreground">{layers.length} layers</p>
        </div>
      </div>

      <div className="p-2">
        {layers.length === 0 ? (
          <div className="p-6 text-center">
            <Layers className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">Generate a preview to see layers</p>
          </div>
        ) : (
          <div className="space-y-1">
            {sortedLayers.map((layer) => {
              const Icon = LAYER_ICONS[layer.layer_type];
              const colorClass = LAYER_COLORS[layer.layer_type];
              
              return (
                <div key={layer.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/30 group">
                  <GripVertical className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground/60" />
                  <div className={cn("p-2 rounded-lg bg-gradient-to-br shrink-0", colorClass.split(' ').slice(0, 2).join(' '))}>
                    <Icon className={cn("w-4 h-4", colorClass.split(' ').slice(-1)[0])} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{LAYER_NAMES[layer.layer_type]}</p>
                    <p className="text-xs text-muted-foreground font-mono">z: {layer.z_index}</p>
                  </div>
                  <Badge variant={layer.status as 'idle' | 'generating' | 'rendering' | 'completed'} className="text-[10px]">
                    {layer.status}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onToggleVisibility?.(layer.id)}>
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
