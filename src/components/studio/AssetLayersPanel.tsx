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
    <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-sm overflow-hidden hover-lift">
      <div className="p-4 border-b border-border/20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10">
            <Layers className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Composition</h3>
            <p className="text-xs text-muted-foreground">{layers.length} layers</p>
          </div>
        </div>
      </div>

      <div className="p-3">
        {layers.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 mx-auto rounded-xl bg-muted/30 border border-border/20 flex items-center justify-center mb-3">
              <Layers className="w-6 h-6 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground">Generate a preview to see layers</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedLayers.map((layer, index) => {
              const Icon = LAYER_ICONS[layer.layer_type];
              const colorClass = LAYER_COLORS[layer.layer_type];
              
              return (
                <div 
                  key={layer.id} 
                  className="flex items-center gap-3 p-3 rounded-xl bg-muted/10 hover:bg-muted/20 border border-border/10 group transition-all animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground/20 group-hover:text-muted-foreground/50 cursor-grab" />
                  <div className={cn("p-2 rounded-lg bg-gradient-to-br shrink-0", colorClass.split(' ').slice(0, 2).join(' '))}>
                    <Icon className={cn("w-4 h-4", colorClass.split(' ').slice(-1)[0])} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{LAYER_NAMES[layer.layer_type]}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">Layer {layer.z_index}</p>
                  </div>
                  <Badge variant={layer.status as 'idle' | 'generating' | 'rendering' | 'completed'} className="text-[10px] shrink-0">
                    {layer.status}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => onToggleVisibility?.(layer.id)}>
                    <Eye className="w-3.5 h-3.5" />
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