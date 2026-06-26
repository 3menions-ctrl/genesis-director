/**
 * TemplateGallery — the native breakout-template library. Browse the template
 * blueprints (the flagship 4th-wall "breakouts" + built-ins), filter by
 * category, preview, and "Use" → the Studio environment loads the template
 * (?template=<id>). Premium/floating glass over Aurora.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Search, X, Sparkles, ArrowRight, Flame, Clapperboard, Layers } from 'lucide-react';
import { getAllTemplateBlueprints, getBreakoutBlueprints } from '@/lib/templates/registry';
import type { TemplateBlueprint } from '@/lib/templates/blueprint';
import { AuroraBackdrop } from '@/components/native/AuroraBackdrop';
import { hapticTap } from '@/lib/native/shell';
import { cn } from '@/lib/utils';

const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}k` : String(n));
const ALL = getAllTemplateBlueprints();
const BREAKOUT_IDS = new Set(getBreakoutBlueprints().map((b) => b.id));
const CATS = ['breakouts', ...Array.from(new Set(ALL.map((b) => b.category)))];

export default function TemplateGallery() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('breakouts');
  const [open, setOpen] = useState<TemplateBlueprint | null>(null);

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ALL.filter((b) => (cat === 'breakouts' ? BREAKOUT_IDS.has(b.id) : b.category === cat))
      .filter((b) => !q || b.name.toLowerCase().includes(q) || b.description.toLowerCase().includes(q));
  }, [search, cat]);

  return (
    <div className="fixed inset-0 overflow-y-auto text-white">
      <AuroraBackdrop />

      <div className="relative z-10 flex items-center gap-3 px-4 pb-2" style={{ paddingTop: 'calc(var(--safe-top,0px) + 12px)' }}>
        <button onClick={() => navigate(-1)} aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.06] backdrop-blur-md"><ChevronLeft className="h-[18px] w-[18px]" /></button>
        <h1 className="font-display text-[20px] font-semibold">Templates</h1>
      </div>

      <div className="relative z-10 px-4" style={{ paddingBottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px) + 24px)' }}>
        <div className="surface-1 flex h-12 items-center gap-2.5 rounded-full px-4">
          <Search className="h-[18px] w-[18px] text-white/50" strokeWidth={1.8} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search templates" className="flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/35" />
          {search && <button onClick={() => setSearch('')} aria-label="Clear" className="text-white/40"><X className="h-[18px] w-[18px]" /></button>}
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {CATS.map((c) => (
            <button key={c} onClick={() => { void hapticTap(); setCat(c); }} className={cn('inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold capitalize transition-colors', cat === c ? 'msg-glass-accent text-white' : 'msg-glass text-white/55')}>
              {c === 'breakouts' && <Flame className="h-3.5 w-3.5" />}{c}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {items.map((b) => (
            <button key={b.id} onClick={() => { void hapticTap(); setOpen(b); }} className="lit-edge relative aspect-[3/4] overflow-hidden rounded-[16px] bg-black/30 text-left">
              <img src={b.thumbnailUrl} alt={b.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
              {BREAKOUT_IDS.has(b.id) && <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-[#ff8a3b]/25 px-2 py-0.5 font-mono text-[8.5px] font-bold uppercase tracking-wide text-[#ffcaa0] backdrop-blur-md"><Flame className="h-2.5 w-2.5" />Breakout</span>}
              <div className="absolute inset-x-0 bottom-0 p-2.5">
                <div className="truncate font-display text-[13px] font-semibold drop-shadow">{b.name}</div>
                <div className="mt-0.5 font-mono text-[10px] text-white/55">▶ {compact(b.useCount)} uses</div>
              </div>
            </button>
          ))}
        </div>
        {items.length === 0 && <div className="py-16 text-center text-[13px] text-white/40">No templates match.</div>}
      </div>

      {open && <TemplateDetail bp={open} breakout={BREAKOUT_IDS.has(open.id)} onClose={() => setOpen(null)} onUse={() => navigate(`/me/generate?template=${encodeURIComponent(open.id)}`)} />}
    </div>
  );
}

function TemplateDetail({ bp, breakout, onClose, onUse }: { bp: TemplateBlueprint; breakout: boolean; onClose: () => void; onUse: () => void }) {
  return (
    <div className="fixed inset-0 z-[60]">
      <div onClick={onClose} className="absolute inset-0 bg-black/55" />
      <div className="absolute inset-x-0 bottom-0 max-h-[88%] overflow-y-auto rounded-t-[28px] bg-[#0d0d14]/92 backdrop-blur-2xl shadow-[0_-24px_70px_-24px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.08)]" style={{ paddingBottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px) + 16px)' }}>
        <div className="mx-auto mb-2 mt-3 h-1 w-10 rounded-full bg-white/15" />
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 z-10 grid h-8 w-8 place-items-center rounded-full bg-black/40 text-white/60"><X className="h-4 w-4" /></button>

        <div className="relative mx-4 mt-1 overflow-hidden rounded-[22px]">
          <img src={bp.thumbnailUrl} alt={bp.name} className="block max-h-[46vh] w-full object-cover" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-4">
            {breakout && <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-[#ff8a3b]/25 px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide text-[#ffcaa0]"><Flame className="h-2.5 w-2.5" />Breakout</span>}
            <h2 className="font-display text-[24px] font-bold leading-tight">{bp.name}</h2>
          </div>
        </div>

        <div className="px-5">
          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            <Meta icon={Clapperboard} text={bp.aspectRatio} />
            <Meta icon={Layers} text={`${bp.clips.length} clips`} />
            <Meta icon={Sparkles} text={bp.engine} />
            <Meta icon={Flame} text={`${compact(bp.useCount)} uses`} />
          </div>
          <p className="mt-4 text-[13.5px] leading-relaxed text-white/70">{bp.description}</p>

          <div className="mt-5 flex flex-col items-center">
            <button onClick={onUse} aria-label="Use this template" className="grid h-[64px] w-[64px] place-items-center rounded-full text-[#9fc6ff] drop-shadow-[0_3px_12px_rgba(0,0,0,.6)] transition-transform active:scale-90">
              <ArrowRight className="h-6 w-6" strokeWidth={2.4} />
            </button>
            <span className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/55">Use template</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Meta({ icon: Icon, text }: { icon: typeof Flame; text: string }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 capitalize text-white/70"><Icon className="h-3 w-3" />{text}</span>;
}
