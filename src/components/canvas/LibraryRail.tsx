import { motion } from 'framer-motion';
import { Bot, Image as ImageIcon, MessageSquare, Music, Wand2, Layers, Film, Sparkles } from 'lucide-react';
import type { CanvasNodeKind } from '@/lib/canvas/types';

const ITEMS: { kind: CanvasNodeKind; label: string; desc: string; icon: any; accent: string }[] = [
  { kind: 'model', label: 'AI Model', desc: 'Any Replicate engine', icon: Wand2, accent: '#0A84FF' },
  { kind: 'avatar', label: 'Avatar', desc: 'Cast a character', icon: Bot, accent: '#a855f7' },
  { kind: 'environment', label: 'Environment', desc: 'World, set, location', icon: ImageIcon, accent: '#22d3ee' },
  { kind: 'dialogue', label: 'Dialogue', desc: 'Multi-speaker script', icon: MessageSquare, accent: '#f59e0b' },
  { kind: 'audio', label: 'Audio', desc: 'Music, voice, FX', icon: Music, accent: '#10b981' },
  { kind: 'scene', label: 'Scene', desc: 'Combine into a clip', icon: Layers, accent: '#0A84FF' },
  { kind: 'render', label: 'Render', desc: 'Generate the cut', icon: Film, accent: '#ef4444' },
];

export function LibraryRail({ onAdd }: { onAdd: (kind: CanvasNodeKind) => void }) {
  return (
    <aside className="w-[260px] shrink-0 border-r border-white/10 bg-[hsl(220,14%,3%)]/80 backdrop-blur-xl flex flex-col">
      <div className="px-5 pt-6 pb-4 border-b border-white/5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-white/50">
          <Sparkles className="h-3 w-3 text-[#0A84FF]" /> Library
        </div>
        <h2 className="font-serif text-2xl mt-2 leading-tight">Compose a film</h2>
        <p className="text-xs text-white/50 mt-1">Tap a primitive to drop it on the canvas.</p>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {ITEMS.map((it, i) => (
          <motion.button
            key={it.kind}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            whileHover={{ x: 4 }}
            onClick={() => onAdd(it.kind)}
            className="w-full text-left group flex items-center gap-3 rounded-xl px-3 py-3 border border-transparent hover:border-white/10 hover:bg-white/[0.03] transition-all"
          >
            <div
              className="h-9 w-9 rounded-lg grid place-items-center shrink-0"
              style={{ background: `linear-gradient(135deg, ${it.accent}33, ${it.accent}11)`, border: `1px solid ${it.accent}44` }}
            >
              <it.icon className="h-4 w-4" style={{ color: it.accent }} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium">{it.label}</div>
              <div className="text-[11px] text-white/40 truncate">{it.desc}</div>
            </div>
          </motion.button>
        ))}
      </div>
    </aside>
  );
}