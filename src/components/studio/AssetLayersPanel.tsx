import { Video, Volume2, Image, Layers, Eye, EyeOff, GripVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AssetLayer, ProjectStatus } from '@/types/studio';
import { cn } from '@/lib/utils';

interface AssetLayersPanelProps {
  layers: AssetLayer[];
  onToggleVisibility?: (layerId: string) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
}

const LAYER_ICONS = {
  background_video: Video,
  character_video: Image,
  audio_narration: Volume2,
  overlay_metadata: Layers,
};

const LAYER_NAMES = {
  background_video: 'Background Video',
  character_video: 'Character Layer',
  audio_narration: 'Audio Narration',
  overlay_metadata: 'Overlay Data',
};

const LAYER_COLORS = {
  background_video: 'text-violet-400',
  character_video: 'text-primary',
  audio_narration: 'text-success',
  overlay_metadata: 'text-warning',
};

function getStatusVariant(status: ProjectStatus): 'idle' | 'generating' | 'rendering' | 'completed' {
  return status;
}

export function AssetLayersPanel({ layers, onToggleVisibility }: AssetLayersPanelProps) {
  const sortedLayers = [...layers].sort((a, b) => b.z_index - a.z_index);

  return (
    <div className="glass-panel">
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Asset Layers</h3>
        </div>
      </div>

      <div className="divide-y divide-border/30">
        {sortedLayers.map((layer, index) => {
          const Icon = LAYER_ICONS[layer.layer_type];
          const name = LAYER_NAMES[layer.layer_type];
          const colorClass = LAYER_COLORS[layer.layer_type];

          return (
            <div
              key={layer.id}
              className={cn(
                "p-3 flex items-center gap-3 transition-colors hover:bg-muted/20",
                layer.status === 'generating' || layer.status === 'rendering'
                  ? "bg-muted/10"
                  : ""
              )}
            >
              <button className="cursor-grab hover:text-foreground text-muted-foreground/50">
                <GripVertical className="w-4 h-4" />
              </button>

              <div className={cn("p-2 rounded-lg bg-muted/30", colorClass)}>
                <Icon className="w-4 h-4" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {name}
                </p>
                <p className="text-xs text-muted-foreground font-mono">
                  Z: {layer.z_index}
                </p>
              </div>

              <Badge variant={getStatusVariant(layer.status)} className="text-xs">
                {layer.status}
              </Badge>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onToggleVisibility?.(layer.id)}
              >
                <Eye className="w-4 h-4" />
              </Button>
            </div>
          );
        })}

        {layers.length === 0 && (
          <div className="p-8 text-center">
            <Layers className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              No asset layers yet
            </p>
            <p className="text-xs text-muted-foreground/70">
              Generate content to see layers here
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
