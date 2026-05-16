import { useState, useMemo } from 'react';
import { PageShell, PageHeader, Surface, SegmentedControl } from '@/components/shell';
import { Button } from '@/components/ui/button';
import { Download, Sparkles, Film } from 'lucide-react';
import { SeedanceAnimateDialog } from '@/components/mascots/SeedanceAnimateDialog';

import foodTaco from '@/assets/mascots/food-truck-taco.png';
import foodBurger from '@/assets/mascots/food-truck-burger.png';
import foodIce from '@/assets/mascots/food-truck-icecream.png';
import cerealTiger from '@/assets/mascots/cereal-tiger.png';
import cerealRabbit from '@/assets/mascots/cereal-wizard-rabbit.png';
import cerealBear from '@/assets/mascots/cereal-astronaut-bear.png';
import indieKnight from '@/assets/mascots/indie-knight.png';
import indieFox from '@/assets/mascots/indie-fox-rogue.png';
import indieRobot from '@/assets/mascots/indie-robot.png';

import { usePageMeta } from '@/hooks/usePageMeta';
type Pack = 'all' | 'food-truck' | 'cereal-box' | 'indie-game';

interface Mascot {
  id: string;
  name: string;
  pack: Exclude<Pack, 'all'>;
  packLabel: string;
  tagline: string;
  palette: [string, string];
  src: string;
}

const MASCOTS: Mascot[] = [
  { id: 'taco',   name: 'El Capitán', pack: 'food-truck', packLabel: 'Food Truck', tagline: 'Sunbaked. Spatula-armed. Sells out by noon.',  palette: ['hsl(38,95%,55%)', 'hsl(8,85%,55%)'],   src: foodTaco },
  { id: 'burger', name: 'Patty Knox', pack: 'food-truck', packLabel: 'Food Truck', tagline: 'Wears the bandana. Rings the bell. Always running.',  palette: ['hsl(20,90%,55%)','hsl(0,75%,50%)'],    src: foodBurger },
  { id: 'cone',   name: 'Mintsy',     pack: 'food-truck', packLabel: 'Food Truck', tagline: 'Pastel diplomat of the Sunday queue.',                  palette: ['hsl(150,55%,75%)','hsl(340,75%,80%)'], src: foodIce },

  { id: 'tiger',  name: 'Coach Striker', pack: 'cereal-box', packLabel: 'Cereal Box', tagline: 'Saturday-morning energy in a track jacket.',  palette: ['hsl(48,100%,55%)','hsl(0,80%,55%)'],   src: cerealTiger },
  { id: 'rabbit', name: 'Hexley the Wise', pack: 'cereal-box', packLabel: 'Cereal Box', tagline: 'Star wand. Cape. Endless bowl of magic.',     palette: ['hsl(285,55%,65%)','hsl(330,75%,80%)'], src: cerealRabbit },
  { id: 'bear',   name: 'Captain Astro Bear', pack: 'cereal-box', packLabel: 'Cereal Box', tagline: 'Helmet on. Thumb up. Cereal in zero-G.',       palette: ['hsl(22,95%,55%)','hsl(180,40%,75%)'], src: cerealBear },

  { id: 'knight', name: 'Aralt the Bold', pack: 'indie-game', packLabel: 'Indie Hero', tagline: 'Gilded helm. Glacier blade. Tutorial-boss energy.', palette: ['hsl(180,40%,30%)','hsl(45,90%,55%)'], src: indieKnight },
  { id: 'fox',    name: 'Vesper Six',     pack: 'indie-game', packLabel: 'Indie Hero', tagline: 'Hooded. Twin daggers. Glows in the dark.',           palette: ['hsl(280,55%,30%)','hsl(320,95%,65%)'], src: indieFox },
  { id: 'robot',  name: 'Ko-12',          pack: 'indie-game', packLabel: 'Indie Hero', tagline: 'One blue eye. Three thrusters. Best companion AI.',   palette: ['hsl(215,15%,40%)','hsl(195,95%,60%)'], src: indieRobot },
];

const PACK_FILTERS = [
  { key: 'all',         label: 'All' },
  { key: 'food-truck',  label: 'Food Truck' },
  { key: 'cereal-box',  label: 'Cereal Box' },
  { key: 'indie-game',  label: 'Indie Heroes' },
] as const;

export default function Mascots() {
  usePageMeta({ title: "Mascots — Apex Studio", description: "Custom brand mascots and recurring characters for cinematic series." });

  const [filter, setFilter] = useState<Pack>('all');
  const [animateOpen, setAnimateOpen] = useState(false);
  const [animateTarget, setAnimateTarget] = useState<Mascot | null>(null);

  const visible = useMemo(
    () => filter === 'all' ? MASCOTS : MASCOTS.filter(m => m.pack === filter),
    [filter],
  );

  function openAnimate(m: Mascot) {
    setAnimateTarget(m);
    setAnimateOpen(true);
  }

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Brand · Mascot Pack"
        title={<>Cast a character.<br/><span className="text-muted-foreground">Three worlds, nine heroes.</span></>}
        subtitle="A curated set of brand mascots — food-truck personalities, vintage cereal-box icons, and indie-game protagonists. Animate any of them with Seedance — cinematic motion, chained shots, auto-stitched."
        actions={
          <Button variant="pill" size="pill" asChild>
            <a href="#gallery"><Sparkles className="w-4 h-4" /> Browse pack</a>
          </Button>
        }
        toolbar={
          <SegmentedControl<Pack>
            value={filter}
            onChange={setFilter}
            items={PACK_FILTERS as unknown as { key: Pack; label: string }[]}
          />
        }
      />

      <section id="gallery" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {visible.map((m, i) => (
          <Surface
            key={m.id}
            hover
            padded={false}
            className="group relative overflow-hidden animate-fade-in"
            style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'both' }}
          >
            {/* Aurora wash — derived from palette */}
            <div
              aria-hidden
              className="pointer-events-none absolute -top-20 -left-20 w-[420px] h-[300px] rounded-full opacity-50 blur-[80px] transition-opacity duration-500 group-hover:opacity-80"
              style={{ background: `radial-gradient(closest-side, ${m.palette[0]}, transparent 70%)` }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-24 -right-16 w-[360px] h-[260px] rounded-full opacity-40 blur-[80px] transition-opacity duration-500 group-hover:opacity-70"
              style={{ background: `radial-gradient(closest-side, ${m.palette[1]}, transparent 70%)` }}
            />

            {/* Stage — square aspect with a subtle inner ring */}
            <div className="relative aspect-square overflow-hidden">
              <div className="absolute inset-4 rounded-2xl border border-foreground/[0.06]" />
              <img
                src={m.src}
                alt={`${m.name}, ${m.packLabel} mascot`}
                width={1024}
                height={1024}
                loading="lazy"
                className="relative z-10 w-full h-full object-contain p-8 transition-transform duration-700 ease-out group-hover:scale-[1.04] group-hover:-translate-y-1"
              />
            </div>

            {/* Caption rail */}
            <div className="relative px-6 py-5 border-t border-foreground/[0.06]">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground font-mono">
                    {String(i + 1).padStart(2, '0')} · {m.packLabel}
                  </div>
                  <h3 className="text-display-luxe text-2xl mt-2 truncate">{m.name}</h3>
                  <p className="text-body-muted text-sm mt-2 line-clamp-2">{m.tagline}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    asChild
                    aria-label={`Download ${m.name}`}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <a href={m.src} download>
                      <Download className="w-4 h-4" />
                    </a>
                  </Button>
                  <Button
                    variant="pill"
                    size="pill"
                    onClick={() => openAnimate(m)}
                    aria-label={`Animate ${m.name} with Seedance`}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Film className="w-4 h-4" /> Animate
                  </Button>
                </div>
              </div>
            </div>
          </Surface>
        ))}
      </section>

      {visible.length === 0 && (
        <Surface className="text-center py-20">
          <p className="text-body-muted">No mascots in this pack yet.</p>
        </Surface>
      )}

      <SeedanceAnimateDialog
        open={animateOpen}
        onOpenChange={setAnimateOpen}
        mascot={animateTarget}
      />
    </PageShell>
  );
}
