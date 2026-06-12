import { listEngines, type EngineId, type EngineSpec } from "@/lib/video/engines";
import { Check, Zap, Volume2, Image as ImageIcon, Lock, Film, Layers, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const TIER_CHIP: Record<string, string> = {
  standard: "bg-white/10 text-white/70",
  pro: "bg-primary/20 text-primary",
  cinema: "bg-amber-500/15 text-amber-400",
};

interface Props {
  selected?: EngineId;
  duration?: 5 | 10 | 12 | 15;
  hasCinema?: boolean;
  onSelect: (id: EngineId) => void;
}

export function EnginesDrawerContent({ selected, duration = 10, hasCinema = false, onSelect }: Props) {
  const engines = listEngines({ healthyOnly: false });

  return (
    <div className="relative p-8 space-y-4">
      {/* Ambient hero halo */}
      <div aria-hidden className="pointer-events-none absolute -top-20 left-1/2 h-[420px] w-[520px] -translate-x-1/2 rounded-full opacity-50 blur-3xl" style={{ background: "radial-gradient(circle, hsla(212,100%,50%,0.20), transparent 65%)" }} />

      {/* Editorial hero */}
      <div className="relative mb-6 border-b border-white/[0.06] pb-7">
        <div className="mb-3 inline-flex items-center gap-2.5 rounded-full border border-primary/30 bg-primary/[0.08] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.32em] text-primary">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
          </span>
          The render engines
        </div>
        <h2 className="font-display font-light tracking-[-0.02em] text-white" style={{ fontFamily: "'Fraunces', serif", fontSize: "44px", lineHeight: "1" }}>
          Choose the <em className="bg-gradient-to-br from-white via-[#9DCBFF] to-[#0A84FF] bg-clip-text text-transparent">cinema engine.</em>
        </h2>
        <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-white/55" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
          Five world-class video models — Kling, Seedance, Veo, Runway, Sora — tuned for one continuous flow. Switch any time; your scenes carry over.
        </p>
      </div>

      {(["standard","pro","cinema"] as const).map(tier => (
        <div key={tier} className="space-y-2">
          <div className="flex items-center gap-3 mt-4">
            <span className={cn("text-[10px] font-mono uppercase tracking-[0.2em] px-2.5 py-1 rounded-full", TIER_CHIP[tier])}>{tier}</span>
            <div className="flex-1 h-px bg-glass-active" />
            <span className="font-mono text-[9px] uppercase tracking-[0.28em] text-white/30">{engines.filter(e => e.tier === tier).length} engines</span>
          </div>
          {engines.filter(e => e.tier === tier).map(e => (
            <EngineRow key={e.id} engine={e} selected={selected === e.id} duration={duration} locked={!!e.requiresEntitlement && !hasCinema} onSelect={() => onSelect(e.id)} />
          ))}
        </div>
      ))}
    </div>
  );
}

function EngineRow({ engine, selected, duration, locked, onSelect }: { engine: EngineSpec; selected: boolean; duration: 5|10|12|15; locked: boolean; onSelect: () => void }) {
  const dur = engine.durations.includes(duration) ? duration : engine.durations[0];
  let cost: number | null = null;
  try { cost = engine.baseCreditsFor(dur); } catch { cost = null; }
  return (
    <button
      onClick={onSelect}
      disabled={!engine.healthy}
      title={locked ? `${engine.shortLabel} requires Studio Cinema` : undefined}
      className={cn(
        "w-full text-left rounded-2xl border p-5 transition-all relative overflow-hidden",
        selected ? "border-primary bg-primary/[0.06] shadow-[0_0_32px_rgba(10,132,255,0.2)]" : "border-white/[0.06] hover:border-white/20 bg-glass",
        !engine.healthy && "opacity-40 cursor-not-allowed",
        locked && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-display text-white font-medium">{engine.label}</h3>
            {engine.requiresEntitlement && <Lock className="w-3 h-3 text-amber-400" />}
            {locked && <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-amber-400">Cinema only</span>}
          </div>
          <p className="text-[13px] text-white/50 leading-relaxed">{engine.description}</p>
          <div className="mt-2 inline-flex items-center gap-2 rounded-md border border-white/[0.06] bg-black/30 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-white/55">
            <Layers className="h-3 w-3 text-primary" /> {engine.pipelineId}
            <span className="text-white/25">·</span>
            <span className="text-white/40 normal-case tracking-normal">{engine.pipelineFunction}()</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <Badge icon={<Zap className="w-3 h-3" />} label={`~${Math.round(engine.etaSeconds)}s`} />
            {engine.supportsAudio && <Badge icon={<Volume2 className="w-3 h-3" />} label="audio" />}
            {engine.supportsImageInput && <Badge icon={<ImageIcon className="w-3 h-3" />} label="image-input" />}
            <Badge label={`${engine.durations.join("/")}s`} />
            <Badge icon={<Film className="w-3 h-3" />} label={`${engine.recommendedScenes}/${engine.maxScenesPerProject} scenes`} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {engine.qualityProfiles.map(q => (
              <span key={q.id} className={cn(
                "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] tracking-wider",
                q.recommended ? "border-primary/40 bg-primary/[0.08] text-primary/60" : "border-white/[0.06] bg-glass text-white/45",
              )}>
                {q.recommended && <Sparkles className="h-3 w-3" />}
                {q.resolution} · {q.fps}fps
              </span>
            ))}
          </div>
        </div>
        <div className="text-right shrink-0">
          {cost != null && (
            <>
              <div className="font-mono text-2xl text-white tabular-nums">{cost}</div>
              <div className="text-[10px] uppercase tracking-wider text-white/40">credits</div>
            </>
          )}
          {selected && <div className="mt-2 inline-flex items-center justify-end"><Check className="w-4 h-4 text-primary" /></div>}
        </div>
      </div>
    </button>
  );
}

function Badge({ icon, label }: { icon?: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-glass-hover border border-white/[0.04] text-[11px] font-mono uppercase tracking-wider text-white/50">
      {icon}{label}
    </span>
  );
}