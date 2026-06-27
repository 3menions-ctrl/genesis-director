/**
 * FinishingStudio — the post-production "finishing pass" surface.
 *
 * Takes a project's stitched master and runs ONE Replicate-ffmpeg pass that
 * applies a unified house color-grade (LUT), an optional 4K Lanczos upscale,
 * and optional 60fps motion interpolation — the layer single-model generators
 * (Sora/Veo/Kling/Runway) don't have. Borderless, floating, Aurora-native.
 *
 * Self-contained: hydrates finishing_state from the row, subscribes to realtime
 * updates, invokes the `production-finish` edge function, and lets the user
 * compare the master against the finished cut.
 */
import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wand2, Check, Loader2, Download, Maximize2, Gauge, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { BrandedVideoPlayer } from '@/components/intro/BrandedVideoPlayer';
import { LUT_LIBRARY, getLut } from '@/lib/editor/lut-library';

// Curated "house looks" — the strongest cinematic grades for finishing.
const HOUSE_LOOK_IDS = [
  'kodak-2383', 'teal-orange', 'bladerunner-2049', 'roma', 'moonlight',
  'wong-kar-wai', 'fuji-eterna', '70s-warm', 'noir', 'rec709-show',
] as const;

const COST_BASE = 10;
const COST_UPSCALE_4K = 15;
const COST_INTERP_60 = 20;

interface FinishOptions {
  houseLutId: string | null;
  upscale4k: boolean;
  interpolate60fps: boolean;
}

type FinishStatus = 'idle' | 'processing' | 'completed' | 'error';

interface FinishingStudioProps {
  projectId: string;
  masterUrl: string;
}

const EYEBROW = 'font-mono text-[10px] uppercase tracking-[0.3em] text-white/40';

export const FinishingStudio = memo(function FinishingStudio({ projectId, masterUrl }: FinishingStudioProps) {
  const houseLooks = useMemo(
    () => HOUSE_LOOK_IDS.map((id) => getLut(id)).filter(Boolean) as typeof LUT_LIBRARY,
    [],
  );

  const [options, setOptions] = useState<FinishOptions>({
    houseLutId: houseLooks[0]?.id ?? null,
    upscale4k: true,
    interpolate60fps: false,
  });
  const [status, setStatus] = useState<FinishStatus>('idle');
  const [finishedUrl, setFinishedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'finished' | 'master'>('finished');
  const [downloading, setDownloading] = useState(false);

  const running = status === 'processing';

  const cost = useMemo(
    () =>
      COST_BASE +
      (options.upscale4k ? COST_UPSCALE_4K : 0) +
      (options.interpolate60fps ? COST_INTERP_60 : 0),
    [options],
  );

  // Hydrate prior finishing state + subscribe to realtime updates on the row.
  useEffect(() => {
    let active = true;

    (async () => {
      const { data } = await supabase
        .from('movie_projects')
        .select('finished_video_url, finishing_state')
        .eq('id', projectId)
        .maybeSingle();
      if (!active || !data) return;
      const st = (data.finishing_state ?? null) as Record<string, unknown> | null;
      if (data.finished_video_url) {
        setFinishedUrl(data.finished_video_url as string);
        setStatus('completed');
      } else if (st?.status === 'processing') {
        setStatus('processing');
      }
      const savedOpts = st?.options as Partial<FinishOptions> | undefined;
      if (savedOpts) {
        setOptions((o) => ({
          houseLutId: savedOpts.houseLutId ?? o.houseLutId,
          upscale4k: savedOpts.upscale4k ?? o.upscale4k,
          interpolate60fps: savedOpts.interpolate60fps ?? o.interpolate60fps,
        }));
      }
    })();

    const channel = supabase
      .channel(`finishing_${projectId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'movie_projects', filter: `id=eq.${projectId}` },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const st = (row.finishing_state ?? null) as Record<string, unknown> | null;
          if (row.finished_video_url) {
            setFinishedUrl(row.finished_video_url as string);
            setStatus('completed');
            setView('finished');
          } else if (st?.status === 'processing') {
            setStatus('processing');
          } else if (st?.status === 'error') {
            setStatus('error');
            setError((st.error as string) ?? 'Finishing failed');
          }
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  const run = useCallback(async () => {
    if (running) return;
    if (!options.houseLutId && !options.upscale4k && !options.interpolate60fps) {
      toast.error('Pick a look or an enhancement first.');
      return;
    }
    setStatus('processing');
    setError(null);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke('production-finish', {
        body: { projectId, options },
      });
      if (invokeErr) throw invokeErr;
      if (data?.success && data.url) {
        setFinishedUrl(data.url);
        setStatus('completed');
        setView('finished');
        toast.success(data.cached ? 'Loaded your finished cut.' : 'Finishing complete — house-graded and upscaled.');
      } else {
        throw new Error(data?.message || data?.error || 'Finishing returned no video');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Finishing failed';
      // The pass runs server-side; a client timeout doesn't mean it failed.
      // Realtime will flip us to completed if it lands. Surface softly.
      setStatus((s) => (s === 'completed' ? s : 'error'));
      setError(msg);
      toast.error('Finishing didn’t complete', { description: msg.slice(0, 120) });
    }
  }, [projectId, options, running]);

  const download = useCallback(async () => {
    const url = finishedUrl;
    if (!url) return;
    setDownloading(true);
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) throw new Error('download failed');
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = 'finished-4k.mp4';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objUrl), 5000);
      toast.success('Finished cut downloaded.');
    } catch {
      window.open(url, '_blank');
    } finally {
      setDownloading(false);
    }
  }, [finishedUrl]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="relative mt-6 rounded-3xl px-6 py-6 sm:px-8 sm:py-7 backdrop-blur-2xl"
      style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.008) 60%, transparent)' }}
    >
      {/* Hairline top edge, accent-tinted — no border box */}
      <div className="absolute top-0 inset-x-8 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-accent/12 text-accent">
            <Wand2 className="w-5 h-5" strokeWidth={1.6} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-[20px] leading-none text-white">Finishing Studio</h3>
              <Sparkles className="w-3.5 h-3.5 text-accent/70" />
            </div>
            <p className={cn(EYEBROW, 'mt-1.5')}>Color · Resolution · Motion</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-[22px] tabular-nums text-white leading-none">{cost}</span>
            <span className={EYEBROW}>credits</span>
          </div>
          <button
            type="button"
            onClick={run}
            disabled={running}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-5 h-11 text-[13px] font-medium transition-all',
              'bg-accent text-black hover:brightness-110 active:scale-[0.98]',
              'shadow-[0_18px_40px_-18px_hsl(214_90%_62%/0.8)]',
              running && 'opacity-60 cursor-not-allowed',
            )}
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {running ? 'Finishing…' : finishedUrl ? 'Re-finish' : 'Finish in 4K'}
          </button>
        </div>
      </div>

      {/* House look picker — floating swatches, selection by glow not border */}
      <div className="mt-7">
        <p className={cn(EYEBROW, 'mb-3')}>House look</p>
        <div className="flex gap-3.5 overflow-x-auto pb-2 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <LookChip
            label="None"
            selected={options.houseLutId === null}
            onClick={() => setOptions((o) => ({ ...o, houseLutId: null }))}
            gradient="linear-gradient(135deg, #2a2a2e, #161618)"
          />
          {houseLooks.map((lut) => (
            <LookChip
              key={lut.id}
              label={lut.name}
              selected={options.houseLutId === lut.id}
              onClick={() => setOptions((o) => ({ ...o, houseLutId: lut.id }))}
              gradient={`linear-gradient(135deg, ${lut.swatch.primary}, ${lut.swatch.secondary})`}
              accent={lut.swatch.accent}
            />
          ))}
        </div>
      </div>

      {/* Enhancement toggles */}
      <div className="mt-6 flex flex-wrap gap-3">
        <TogglePill
          icon={<Maximize2 className="w-4 h-4" />}
          label="4K Upscale"
          sub="Lanczos, aspect-preserving"
          on={options.upscale4k}
          onClick={() => setOptions((o) => ({ ...o, upscale4k: !o.upscale4k }))}
        />
        <TogglePill
          icon={<Gauge className="w-4 h-4" />}
          label="60fps Motion"
          sub="Interpolated smoothness"
          on={options.interpolate60fps}
          onClick={() => setOptions((o) => ({ ...o, interpolate60fps: !o.interpolate60fps }))}
        />
      </div>

      {/* Error surface */}
      <AnimatePresence>
        {status === 'error' && error && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-5 text-[12.5px] text-rose-300/80"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Result — master / finished compare */}
      <AnimatePresence>
        {finishedUrl && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-7"
          >
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <div className="inline-flex items-center gap-1 rounded-full bg-white/[0.04] p-1">
                {(['finished', 'master'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setView(v)}
                    className={cn(
                      'rounded-full px-4 h-8 text-[12px] capitalize transition-colors',
                      view === v ? 'bg-accent/90 text-black font-medium' : 'text-white/55 hover:text-white',
                    )}
                  >
                    {v === 'finished' ? 'Finished' : 'Master'}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/12 text-accent px-3 h-8 text-[11px] font-medium">
                  <Check className="w-3.5 h-3.5" /> House-graded{options.upscale4k ? ' · 4K' : ''}
                  {options.interpolate60fps ? ' · 60fps' : ''}
                </span>
                <button
                  type="button"
                  onClick={download}
                  disabled={downloading}
                  className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] hover:bg-white/[0.1] text-white px-4 h-8 text-[12px] transition-colors"
                >
                  {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  Download
                </button>
              </div>
            </div>
            <div className="relative aspect-video rounded-2xl overflow-hidden bg-black/80">
              <BrandedVideoPlayer
                key={view}
                src={view === 'finished' ? finishedUrl : masterUrl}
                title={view === 'finished' ? 'Finished cut' : 'Master'}
                skipIntro
                playsInline
                className="w-full h-full"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

// ── Swatch chip ───────────────────────────────────────────────────────────
const LookChip = memo(function LookChip({
  label, selected, onClick, gradient, accent,
}: { label: string; selected: boolean; onClick: () => void; gradient: string; accent?: string }) {
  return (
    <button type="button" onClick={onClick} className="group shrink-0 w-[88px] text-left">
      <div
        className={cn(
          'relative h-[58px] w-full rounded-2xl transition-all duration-300',
          selected ? 'scale-[1.03]' : 'opacity-80 group-hover:opacity-100',
        )}
        style={{
          background: gradient,
          boxShadow: selected
            ? `0 0 0 2px hsl(214 90% 62%), 0 14px 30px -12px ${accent ?? 'hsl(214 90% 62%)'}`
            : '0 8px 20px -14px rgba(0,0,0,0.8)',
        }}
      >
        {selected && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-accent text-black flex items-center justify-center">
            <Check className="w-2.5 h-2.5" strokeWidth={3} />
          </span>
        )}
      </div>
      <p className={cn('mt-2 text-[10.5px] leading-tight truncate', selected ? 'text-white' : 'text-white/45')}>
        {label}
      </p>
    </button>
  );
});

// ── Enhancement toggle pill ───────────────────────────────────────────────
const TogglePill = memo(function TogglePill({
  icon, label, sub, on, onClick,
}: { icon: React.ReactNode; label: string; sub: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-2xl pl-3.5 pr-4 h-[52px] transition-all duration-200',
        on ? 'bg-accent/[0.14] text-white' : 'bg-white/[0.035] text-white/55 hover:text-white/80',
      )}
    >
      <span className={cn('w-8 h-8 rounded-xl flex items-center justify-center transition-colors', on ? 'bg-accent/20 text-accent' : 'bg-white/[0.05] text-white/40')}>
        {icon}
      </span>
      <span className="text-left leading-tight">
        <span className="block text-[13px] font-medium">{label}</span>
        <span className="block text-[10px] text-white/35">{sub}</span>
      </span>
      <span className={cn('ml-1 w-9 h-5 rounded-full relative transition-colors', on ? 'bg-accent' : 'bg-white/12')}>
        <span className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all', on ? 'left-[18px]' : 'left-0.5')} />
      </span>
    </button>
  );
});
