import { motion } from 'framer-motion';
import { Bot, Image as ImageIcon, MessageSquare, Music, Wand2, Layers, Film, Sparkles, Plus } from 'lucide-react';
import type { CanvasNodeKind } from '@/lib/canvas/types';
import { CURATED_MODELS } from '@/lib/canvas/modelCapabilities';

const ITEMS: { kind: CanvasNodeKind; label: string; desc: string; icon: any; accent: string }[] = [
  { kind: 'scene',       label: 'Scene',       desc: 'Combine into a clip',     icon: Layers,        accent: '#0A84FF' },
  { kind: 'model',       label: 'AI Model',    desc: 'Pick the engine',         icon: Wand2,         accent: '#0A84FF' },
  { kind: 'avatar',      label: 'Avatar',      desc: 'Cast a character',        icon: Bot,           accent: '#7DA8FF' },
  { kind: 'environment', label: 'Environment', desc: 'World, set, location',    icon: ImageIcon,     accent: '#22d3ee' },
  { kind: 'dialogue',    label: 'Dialogue',    desc: 'Multi-speaker script',    icon: MessageSquare, accent: '#f59e0b' },
  { kind: 'audio',       label: 'Audio',       desc: 'Score, voice, FX',        icon: Music,         accent: '#10b981' },
  { kind: 'render',      label: 'Render',      desc: 'Generate the cut',        icon: Film,          accent: '#ef4444' },
];

const FEATURED = CURATED_MODELS.filter((m) => m.badge === 'flagship' || m.badge === 'new').slice(0, 5);

export function LibraryRail({
  onAdd,
  onAddModel,
}: {
  onAdd: (kind: CanvasNodeKind) => void;
  onAddModel: (owner: string, name: string, label: string) => void;
}) {
  return (
    <aside className="w-[280px] shrink-0 border-r border-white/[0.06] bg-[hsl(220,14%,2.5%)]/90 backdrop-blur-2xl flex flex-col">
      <div className="px-6 pt-7 pb-5 border-b border-white/[0.05] relative overflow-hidden">
        <div className="absolute -top-12 -left-8 h-32 w-32 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-white/45 relative">
          <Sparkles className="h-3 w-3 text-primary" /> Library
        </div>
        <h2 className="font-serif text-[26px] mt-2 leading-[1.05] relative">Compose<br/>a film</h2>
        <p className="text-[11px] text-white/45 mt-2 relative">Tap a primitive to drop it on the canvas.</p>
      </div>

      <div className="flex-1 overflow-y-auto py-3">
        <div className="px-3 space-y-1">
          {ITEMS.map((it, i) => (
            <motion.button
              key={it.kind}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              whileHover={{ x: 3 }}
              onClick={() => onAdd(it.kind)}
              className="w-full text-left group flex items-center gap-3 rounded-xl px-3 py-2.5 border border-transparent hover:border-white/10 hover:bg-white/[0.025] transition-all"
            >
              <div
                className="h-9 w-9 rounded-lg grid place-items-center shrink-0"
                style={{ background: `linear-gradient(135deg, ${it.accent}26, ${it.accent}08)`, border: `1px solid ${it.accent}3a` }}
              >
                <it.icon className="h-4 w-4" style={{ color: it.accent }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium tracking-tight">{it.label}</div>
                <div className="text-[10.5px] text-white/40 truncate">{it.desc}</div>
              </div>
              <Plus className="h-3.5 w-3.5 text-white/20 group-hover:text-white/60 transition" />
            </motion.button>
          ))}
        </div>

        <div className="mt-6 px-5 mb-2 flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-[0.28em] text-white/45">Featured Models</div>
          <div className="text-[9px] uppercase tracking-[0.2em] text-white/30">Tap to add</div>
        </div>
        <div className="px-3 space-y-1">
          {FEATURED.map((m) => (
            <button
              key={`${m.owner}/${m.name}`}
              onClick={() => onAddModel(m.owner, m.name, m.label ?? m.name)}
              className="w-full text-left rounded-xl px-3 py-2.5 border border-white/[0.05] hover:border-primary/40 bg-white/[0.015] hover:bg-primary/[0.04] transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="text-[13px] font-medium font-serif">{m.label}</div>
                {m.badge && (
                  <span className="text-[9px] uppercase tracking-[0.18em] px-1.5 py-0.5 rounded-md bg-primary/15 text-primary/60 border border-primary/30">
                    {m.badge}
                  </span>
                )}
              </div>
              <div className="text-[10.5px] text-white/45 mt-0.5 line-clamp-1">{m.blurb}</div>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
