import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageShell, PageHeader, Surface } from '@/components/shell';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Sparkles, Wand2, Search, X, Check } from 'lucide-react';

import chibiRanger from '@/assets/avatars/chibi-ranger.png';
import chibiMage from '@/assets/avatars/chibi-mage.png';
import voxelViking from '@/assets/avatars/voxel-viking.png';
import voxelHacker from '@/assets/avatars/voxel-hacker.png';
import wcFlorist from '@/assets/avatars/watercolor-florist.png';
import wcFisherman from '@/assets/avatars/watercolor-fisherman.png';
import animeSamurai from '@/assets/avatars/anime-samurai.png';
import animeDetective from '@/assets/avatars/anime-detective.png';
import pixelMarine from '@/assets/avatars/pixel-marine.png';
import lowpolyExplorer from '@/assets/avatars/lowpoly-explorer.png';
import clayInventor from '@/assets/avatars/clay-inventor.png';
import inkMonk from '@/assets/avatars/ink-monk.png';

type StyleTag =
  | 'chibi' | 'voxel' | 'watercolor' | 'anime'
  | 'pixel-art' | 'low-poly' | 'claymation' | 'ink-wash';

interface Avatar {
  id: string;
  name: string;
  archetype: string;
  bio: string;
  style: StyleTag;
  styleLabel: string;
  palette: [string, string];
  src: string;
}

const AVATARS: Avatar[] = [
  { id: 'a1', name: 'Linnea', archetype: 'Forest Ranger', bio: 'Soft-spoken tracker with a starlit bow. Born for woodland chase scenes and dialogue under canopy light.', style: 'chibi', styleLabel: 'Chibi', palette: ['hsl(142,65%,55%)', 'hsl(28,90%,60%)'], src: chibiRanger },
  { id: 'a2', name: 'Mira',   archetype: 'Star Mage',     bio: 'Pastel-bright mascot energy. Best for kid-friendly hooks, magical reveals, and sparkle-led product cuts.', style: 'chibi', styleLabel: 'Chibi', palette: ['hsl(330,80%,75%)', 'hsl(48,95%,65%)'], src: chibiMage },

  { id: 'a3', name: 'Bjorn',  archetype: 'Voxel Viking',   bio: 'Blocky, brave, broadcast-ready. Perfect for indie-game trailers and gritty fantasy hooks.', style: 'voxel', styleLabel: 'Voxel', palette: ['hsl(0,75%,55%)', 'hsl(38,85%,55%)'], src: voxelViking },
  { id: 'a4', name: 'Echo-7', archetype: 'Cyber Hacker',   bio: 'Neon-hooded operative for synthwave product spots and futurist explainers.', style: 'voxel', styleLabel: 'Voxel', palette: ['hsl(285,75%,60%)', 'hsl(195,95%,60%)'], src: voxelHacker },

  { id: 'a5', name: 'Solène', archetype: 'Florist',        bio: 'Hand-painted softness for slow-cinema beauty, lifestyle, and editorial fragrance scenes.', style: 'watercolor', styleLabel: 'Watercolor', palette: ['hsl(20,75%,75%)', 'hsl(150,40%,70%)'], src: wcFlorist },
  { id: 'a6', name: 'Old Hal', archetype: 'Sailor',         bio: 'Weathered, warm, narrative — built for documentary opens and heritage-brand voiceovers.', style: 'watercolor', styleLabel: 'Watercolor', palette: ['hsl(210,55%,55%)', 'hsl(38,75%,60%)'], src: wcFisherman },

  { id: 'a7', name: 'Renji',   archetype: 'Wandering Swordsman', bio: 'Shōnen swagger with windswept hair. Built for action sizzles and dramatic match cuts.', style: 'anime', styleLabel: 'Anime', palette: ['hsl(0,75%,50%)', 'hsl(20,15%,15%)'], src: animeSamurai },
  { id: 'a8', name: 'Yui',     archetype: 'Detective',           bio: 'Cozy mystery vibes — voice-overs, episodic hooks, and slice-of-life montages.', style: 'anime', styleLabel: 'Anime', palette: ['hsl(170,75%,70%)', 'hsl(50,90%,70%)'], src: animeDetective },

  { id: 'a9', name: 'Vex-09', archetype: 'Space Marine', bio: '32-bit retro grit. For arcade trailers, gaming brands, and chiptune-flavored launches.', style: 'pixel-art', styleLabel: 'Pixel Art', palette: ['hsl(215,30%,50%)', 'hsl(0,80%,55%)'], src: pixelMarine },

  { id: 'a10', name: 'Otto', archetype: 'Mountain Explorer', bio: 'Faceted, rugged, optimistic. Outdoor brands, expedition spots, and travel pre-rolls.', style: 'low-poly', styleLabel: 'Low Poly', palette: ['hsl(45,95%,55%)', 'hsl(215,40%,40%)'], src: lowpolyExplorer },

  { id: 'a11', name: 'Pip', archetype: 'Inventor', bio: 'Stop-motion warmth — children\\'s storytelling, tactile DTC ads, and craft-brand intros.', style: 'claymation', styleLabel: 'Claymation', palette: ['hsl(28,55%,60%)', 'hsl(45,40%,75%)'], src: clayInventor },

  { id: 'a12', name: 'Master Wen', archetype: 'Wandering Monk', bio: 'Sumi-e minimalism. Editorial, meditative pacing, and slow-burn cinematic openings.', style: 'ink-wash', styleLabel: 'Ink Wash', palette: ['hsl(0,0%,15%)', 'hsl(0,0%,55%)'], src: inkMonk },
];

const TAGS: { key: StyleTag; label: string }[] = [
  { key: 'chibi',      label: 'Chibi' },
  { key: 'voxel',      label: 'Voxel' },
  { key: 'watercolor', label: 'Watercolor' },
  { key: 'anime',      label: 'Anime' },
  { key: 'pixel-art',  label: 'Pixel Art' },
  { key: 'low-poly',   label: 'Low Poly' },
  { key: 'claymation', label: 'Claymation' },
  { key: 'ink-wash',   label: 'Ink Wash' },
];

export default function AvatarsGallery() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Set<StyleTag>>(new Set());
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState<Avatar | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return AVATARS.filter(a => {
      const tagOk = selected.size === 0 || selected.has(a.style);
      if (!tagOk) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.archetype.toLowerCase().includes(q) ||
        a.styleLabel.toLowerCase().includes(q)
      );
    });
  }, [selected, query]);

  const toggleTag = (t: StyleTag) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(t) ? next.delete(t) : next.add(t);
      return next;
    });
  };

  const generate = (a: Avatar) => {
    setPreview(null);
    navigate(`/create?avatar=${encodeURIComponent(a.id)}&style=${a.style}`);
  };

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Cast · Avatar Library"
        title={<>Pick a face.<br /><span className="text-muted-foreground">Generate the scene.</span></>}
        subtitle="A curated cast across eight visual styles. Filter by aesthetic, preview the character, then send them straight to the studio with a single click."
        actions={
          <Button variant="pill" size="pill" onClick={() => document.getElementById('roster')?.scrollIntoView({ behavior: 'smooth' })}>
            <Sparkles className="w-4 h-4" /> Browse cast
          </Button>
        }
        toolbar={
          <div className="flex flex-col gap-4 w-full">
            {/* Search */}
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search by name, archetype, or style…"
                className="w-full h-10 pl-9 pr-9 rounded-full bg-foreground/[0.04] border border-foreground/[0.08] text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary/40 transition-colors"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Tag chips */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground font-mono mr-1">
                Style
              </span>
              {TAGS.map(t => {
                const active = selected.has(t.key);
                return (
                  <button
                    key={t.key}
                    onClick={() => toggleTag(t.key)}
                    className={[
                      'group inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium transition-all',
                      'border',
                      active
                        ? 'bg-primary text-primary-foreground border-primary shadow-[0_0_24px_-6px_hsl(var(--primary)/0.6)]'
                        : 'bg-foreground/[0.03] text-muted-foreground border-foreground/[0.08] hover:text-foreground hover:border-foreground/[0.16]',
                    ].join(' ')}
                  >
                    {active && <Check className="w-3 h-3" />}
                    {t.label}
                  </button>
                );
              })}
              {selected.size > 0 && (
                <button
                  onClick={() => setSelected(new Set())}
                  className="ml-1 text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
                >
                  Clear
                </button>
              )}
              <span className="ml-auto text-[10px] uppercase tracking-[0.32em] text-muted-foreground font-mono">
                {visible.length} / {AVATARS.length}
              </span>
            </div>
          </div>
        }
      />

      {/* Roster grid */}
      <section id="roster" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {visible.map((a, i) => (
          <Surface
            key={a.id}
            hover
            padded={false}
            onClick={() => setPreview(a)}
            className="group relative overflow-hidden cursor-pointer animate-fade-in"
            style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'both' }}
          >
            {/* Aurora wash */}
            <div
              aria-hidden
              className="pointer-events-none absolute -top-20 -left-16 w-[340px] h-[260px] rounded-full opacity-50 blur-[70px] transition-opacity duration-500 group-hover:opacity-90"
              style={{ background: `radial-gradient(closest-side, ${a.palette[0]}, transparent 70%)` }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-20 -right-12 w-[300px] h-[220px] rounded-full opacity-40 blur-[70px] transition-opacity duration-500 group-hover:opacity-70"
              style={{ background: `radial-gradient(closest-side, ${a.palette[1]}, transparent 70%)` }}
            />

            {/* Stage */}
            <div className="relative aspect-[4/5] overflow-hidden">
              <div className="absolute inset-3 rounded-2xl border border-foreground/[0.06]" />
              <img
                src={a.src}
                alt={`${a.name} — ${a.archetype}, ${a.styleLabel} style`}
                width={768}
                height={768}
                loading="lazy"
                className="relative z-10 w-full h-full object-contain p-6 transition-transform duration-700 ease-out group-hover:scale-[1.05] group-hover:-translate-y-1"
              />

              {/* Style chip */}
              <div className="absolute top-4 left-4 z-20">
                <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-background/70 backdrop-blur border border-foreground/[0.08] text-[10px] uppercase tracking-[0.2em] font-mono text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: a.palette[0] }} />
                  {a.styleLabel}
                </span>
              </div>
            </div>

            {/* Caption */}
            <div className="relative px-5 py-4 border-t border-foreground/[0.06]">
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground font-mono">
                    {String(i + 1).padStart(2, '0')} · {a.archetype}
                  </div>
                  <h3 className="text-display-luxe text-xl mt-1.5 truncate">{a.name}</h3>
                </div>
                <span className="text-[10px] uppercase tracking-[0.28em] font-mono text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  Preview →
                </span>
              </div>
            </div>
          </Surface>
        ))}
      </section>

      {visible.length === 0 && (
        <Surface className="text-center py-20">
          <p className="text-body-muted">No avatars match those filters.</p>
          <Button variant="ghost" className="mt-4" onClick={() => { setSelected(new Set()); setQuery(''); }}>
            Reset filters
          </Button>
        </Surface>
      )}

      {/* Preview dialog */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden border-foreground/[0.08] bg-background">
          {preview && (
            <div className="grid grid-cols-1 md:grid-cols-[1.1fr_1fr]">
              {/* Stage */}
              <div className="relative aspect-square md:aspect-auto md:min-h-[520px] overflow-hidden bg-foreground/[0.02]">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -top-24 -left-20 w-[520px] h-[420px] rounded-full opacity-70 blur-[100px]"
                  style={{ background: `radial-gradient(closest-side, ${preview.palette[0]}, transparent 70%)` }}
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute -bottom-28 -right-16 w-[460px] h-[360px] rounded-full opacity-60 blur-[100px]"
                  style={{ background: `radial-gradient(closest-side, ${preview.palette[1]}, transparent 70%)` }}
                />
                <img
                  src={preview.src}
                  alt={preview.name}
                  className="relative z-10 w-full h-full object-contain p-10 animate-fade-in"
                />
              </div>

              {/* Detail rail */}
              <div className="relative p-8 md:p-10 flex flex-col">
                <div className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground font-mono">
                  {preview.styleLabel} · {preview.archetype}
                </div>
                <h2 className="text-display-luxe text-4xl md:text-5xl mt-3 leading-[0.95]">
                  {preview.name}
                </h2>
                <p className="text-body-muted text-sm mt-5 leading-relaxed">
                  {preview.bio}
                </p>

                {/* Palette */}
                <div className="mt-8">
                  <div className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground font-mono mb-2">
                    Signature palette
                  </div>
                  <div className="flex gap-2">
                    {preview.palette.map((c, i) => (
                      <div
                        key={i}
                        className="h-10 flex-1 rounded-lg border border-foreground/[0.06]"
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </div>

                {/* Style tags */}
                <div className="mt-6">
                  <div className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground font-mono mb-2">
                    Tags
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[preview.styleLabel, preview.archetype, 'Cinematic', 'Brand-safe'].map(t => (
                      <span key={t} className="inline-flex items-center h-6 px-2.5 rounded-full bg-foreground/[0.04] border border-foreground/[0.08] text-[10px] uppercase tracking-[0.2em] font-mono text-muted-foreground">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                {/* CTA */}
                <div className="mt-auto pt-8 flex items-center gap-3">
                  <Button variant="pill" size="pill" className="flex-1" onClick={() => generate(preview)}>
                    <Wand2 className="w-4 h-4" /> Generate video
                  </Button>
                  <Button variant="ghost" onClick={() => setPreview(null)}>
                    Close
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
