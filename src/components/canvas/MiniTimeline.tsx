import { motion } from 'framer-motion';
import { ExternalLink, Film, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CanvasGraph, SceneNodeData } from '@/lib/canvas/types';

export function MiniTimeline({
  graph,
  onOpenEditor,
  onRender,
}: {
  graph: CanvasGraph;
  onOpenEditor: () => void;
  onRender: () => void;
}) {
  const scenes = graph.nodes.filter((n) => n.data.kind === 'scene');
  const total = scenes.reduce((acc, n) => acc + ((n.data as SceneNodeData).duration ?? 0), 0);

  return (
    <div className="border-t border-white/10 bg-[hsl(220,14%,3%)]/90 backdrop-blur-xl">
      <div className="px-5 py-3 flex items-center gap-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-white/50">
          <Film className="h-3 w-3" /> Timeline · {scenes.length} scenes · {total}s
        </div>
        <div className="flex-1 flex items-center gap-2 overflow-x-auto">
          {scenes.length === 0 && (
            <span className="text-xs text-white/40 italic font-serif">Add Scene nodes to build your cut</span>
          )}
          {scenes.map((s, i) => {
            const d = s.data as SceneNodeData;
            return (
              <motion.div key={s.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="shrink-0 rounded-lg border border-white/10 bg-gradient-to-br from-[#0A84FF]/15 to-transparent px-3 py-2"
                style={{ width: 60 + d.duration * 14 }}>
                <div className="text-[10px] uppercase tracking-wider text-white/40">Scene {i + 1}</div>
                <div className="text-xs font-medium truncate">{d.label}</div>
                <div className="text-[10px] text-white/40">{d.duration}s</div>
              </motion.div>
            );
          })}
        </div>
        <Button onClick={onRender} className="bg-primary hover:bg-primary/90 text-white">
          <Play className="h-3.5 w-3.5 mr-1" /> Render
        </Button>
        <Button onClick={onOpenEditor} variant="outline" className="border-white/15">
          <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open Editor
        </Button>
      </div>
    </div>
  );
}