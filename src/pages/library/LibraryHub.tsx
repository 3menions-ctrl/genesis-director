/**
 * LibraryHub — `/library` root page that surfaces the four reusable
 * creative atoms (Cast / Locations / Looks / Voices) plus pin-tray + smart
 * collections + storyboard wall. The premise: in Small Bridges, *everything you
 * make becomes raw material you can recompose forever*.
 *
 * This page is the "director's library room" — atmospheric, dense, premium.
 */

import { useEffect, useState } from 'react';
import { Users, MapPin, Palette, Mic2, Pin, LayoutGrid, ArrowUpRight, Sparkles } from 'lucide-react';
import { useSafeNavigation } from '@/lib/navigation';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PageShell } from '@/components/shell/PageShell';
import { usePageMeta } from '@/hooks/usePageMeta';
import { BetaHero, StatGrid, Stat } from '@/components/ui/BetaHero';

interface AtomCounts {
  cast: number;
  locations: number;
  looks: number;
  voices: number;
  pins: number;
}

export default function LibraryHub() {
  usePageMeta({
    title: 'Library — Small Bridges',
    description: 'Your Cast, Locations, Looks, Voices, and pins.',
  });
  const { navigate } = useSafeNavigation();
  const { user } = useAuth();
  const [counts, setCounts] = useState<AtomCounts>({ cast: 0, locations: 0, looks: 0, voices: 0, pins: 0 });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [cast, locations, looks, voices, pins] = await Promise.all([
        supabase.from('director_cast').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('director_locations').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('director_looks').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('director_voices').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('director_pins').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      ]);
      if (cancelled) return;
      setCounts({
        cast: cast.count ?? 0,
        locations: locations.count ?? 0,
        looks: looks.count ?? 0,
        voices: voices.count ?? 0,
        pins: pins.count ?? 0,
      });
    })();
    return () => { cancelled = true; };
  }, [user]);

  return (
    <PageShell width="wide">
      <BetaHero
        badge="LIBRARY"
        eyebrow="Director's archive"
        title={<>Everything you&rsquo;ve made — at your fingertips.</>}
        body={
          <>
            Cast, Locations, Looks, and Voices live forever. Drop any of them into a new project and the model locks them in for you. The work compounds.
          </>
        }
        rail={
          <StatGrid>
            <Stat label="Cast" value={counts.cast} tone="blue" />
            <Stat label="Looks" value={counts.looks} tone="emerald" />
            <Stat label="Pins" value={counts.pins} tone="amber" />
          </StatGrid>
        }
      />

      {/* Atom grid */}
      <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <AtomCard
          icon={Users}
          name="Cast"
          count={counts.cast}
          tagline="Characters with locked consistency"
          to="/library/cast"
        />
        <AtomCard
          icon={MapPin}
          name="Locations"
          count={counts.locations}
          tagline="Sets you keep returning to"
          to="/library/locations"
        />
        <AtomCard
          icon={Palette}
          name="Looks"
          count={counts.looks}
          tagline="Your signature grading & palette"
          to="/library/looks"
        />
        <AtomCard
          icon={Mic2}
          name="Voices"
          count={counts.voices}
          tagline="Saved narrators & characters"
          to="/library/voices"
        />
      </div>

      {/* Secondary surfaces */}
      <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SurfaceCard
          icon={Pin}
          title="Pin tray"
          body={`${counts.pins} project${counts.pins === 1 ? '' : 's'} pinned for active iteration. Survives across sessions.`}
          cta={{ label: 'Open pin tray', onClick: () => navigate('/projects?pins=1') }}
        />
        <SurfaceCard
          icon={LayoutGrid}
          title="Storyboard wall"
          body="Every shot from every project, flat 4K grid. Browse the entire catalog like a wall of polaroids."
          cta={{ label: 'Open storyboard wall', onClick: () => navigate('/library/wall') }}
        />
      </div>

      <SignatureCard />
    </PageShell>
  );
}

function AtomCard({
  icon: Icon,
  name,
  count,
  tagline,
  to,
}: {
  icon: React.ElementType;
  name: string;
  count: number;
  tagline: string;
  to: string;
}) {
  const { navigate } = useSafeNavigation();
  return (
    <button
      onClick={() => navigate(to)}
      className="group relative text-left rounded-3xl border border-white/[0.07] bg-gradient-to-br from-white/[0.025] to-transparent p-7 lg:p-8 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 transition-all hover:border-white/15"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-14 -right-10 w-[240px] h-[240px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700"
        style={{
          background: 'radial-gradient(circle, hsl(var(--brand) / 0.18), transparent 65%)',
          filter: 'blur(40px)',
        }}
      />
      <div className="relative">
        <div className="w-11 h-11 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md flex items-center justify-center mb-5">
          <Icon className="w-4 h-4 text-brand-light" strokeWidth={1.5} />
        </div>
        <div className="font-mono text-[9px] uppercase tracking-[0.32em] text-white/30 mb-2">
          The {name}
        </div>
        <h3
          className="font-display text-[26px] text-white font-light leading-tight mb-2"
          style={{ fontVariant: 'small-caps' }}
        >
          {name}
        </h3>
        <p className="text-white/55 text-[13px] leading-relaxed mb-6">{tagline}</p>
        <div className="flex items-center justify-between">
          <div className="font-mono text-[11px] tabular-nums text-white/65">
            {count.toLocaleString()} {count === 1 ? 'item' : 'items'}
          </div>
          <ArrowUpRight className="w-4 h-4 text-white/35 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
        </div>
      </div>
    </button>
  );
}

function SurfaceCard({
  icon: Icon,
  title,
  body,
  cta,
}: {
  icon: React.ElementType;
  title: string;
  body: string;
  cta: { label: string; onClick: () => void };
}) {
  return (
    <div className="rounded-3xl border border-white/[0.07] bg-white/[0.015] p-7 lg:p-8 flex items-start gap-5">
      <div className="w-11 h-11 rounded-2xl border border-white/10 bg-white/[0.02] flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-brand-light" strokeWidth={1.5} />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-display text-[20px] text-white font-light leading-tight mb-2">{title}</h3>
        <p className="text-white/55 text-[13px] leading-relaxed mb-5">{body}</p>
        <button
          onClick={cta.onClick}
          className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.22em] text-brand-light hover:text-white transition-colors"
        >
          {cta.label} <ArrowUpRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

function SignatureCard() {
  const { user } = useAuth();
  const [memory, setMemory] = useState<{
    preferred_mode: string | null;
    preferred_style: string | null;
    preferred_aspect_ratio: string | null;
    preferred_clip_duration: number | null;
    total_projects: number;
  } | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('director_memory')
        .select('preferred_mode, preferred_style, preferred_aspect_ratio, preferred_clip_duration, total_projects')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!cancelled) setMemory(data);
    })();
    return () => { cancelled = true; };
  }, [user]);

  return (
    <div className="mt-10 rounded-3xl border border-white/[0.07] bg-gradient-to-br from-brand/[0.04] to-transparent p-7 lg:p-8 relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-10 w-[300px] h-[300px] rounded-full"
        style={{
          background: 'radial-gradient(circle, hsl(var(--brand) / 0.14), transparent 65%)',
          filter: 'blur(60px)',
        }}
      />
      <div className="relative flex items-start gap-4">
        <Sparkles className="w-5 h-5 text-brand-light mt-1 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[9px] uppercase tracking-[0.32em] text-brand-light mb-2">
            Your signature · {(memory?.total_projects ?? 0).toLocaleString()} projects observed
          </div>
          <h3
            className="font-display text-[24px] text-white font-light leading-tight mb-3"
            style={{ fontVariant: 'small-caps' }}
          >
            What Small Bridges has learned about your taste.
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 mt-5">
            <SignatureCell label="Mode" value={memory?.preferred_mode ?? '—'} />
            <SignatureCell label="Style" value={memory?.preferred_style ?? '—'} />
            <SignatureCell label="Aspect" value={memory?.preferred_aspect_ratio ?? '—'} />
            <SignatureCell label="Length" value={memory?.preferred_clip_duration ? `${memory.preferred_clip_duration}s` : '—'} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SignatureCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-[0.32em] text-white/35 mb-1.5">{label}</div>
      <div className="font-display text-[18px] text-white/95">{value}</div>
    </div>
  );
}
