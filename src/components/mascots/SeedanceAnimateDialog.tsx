import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { SegmentedControl } from '@/components/shell';
import { Sparkles, Wand2, Pencil, Loader2, Film, Music, Camera, X } from 'lucide-react';
import { DialogClose } from '@radix-ui/react-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

type Mode = 'auto' | 'manual';
type Aspect = '16:9' | '9:16' | '1:1';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mascot: {
    id: string;
    name: string;
    src: string;          // local asset path — used as reference image
    tagline?: string;
    palette?: [string, string];
  } | null;
}

const SEEDANCE_CREDIT_TABLE: Record<number, number> = { 5: 35, 10: 65, 12: 95 };
function seedanceCreditsForClip(d: number): number {
  return SEEDANCE_CREDIT_TABLE[d] ?? Math.round(35 + ((d - 5) * 60) / 7);
}

export function SeedanceAnimateDialog({ open, onOpenChange, mascot }: Props) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('auto');
  const [concept, setConcept] = useState('');
  const [manualPrompts, setManualPrompts] = useState('');
  const [clipCount, setClipCount] = useState(4);
  const [clipDuration, setClipDuration] = useState(10);
  const [aspectRatio, setAspectRatio] = useState<Aspect>('16:9');
  const [cameraFixed, setCameraFixed] = useState(false);
  const [includeMusic, setIncludeMusic] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const credits = useMemo(
    () => clipCount * seedanceCreditsForClip(clipDuration),
    [clipCount, clipDuration],
  );

  const parsedManualShots = useMemo(
    () => manualPrompts.split('\n').map(s => s.trim()).filter(Boolean),
    [manualPrompts],
  );

  async function handleSubmit() {
    if (!mascot) return;
    if (mode === 'auto' && concept.trim().length < 10) {
      toast.error('Describe your concept (at least 10 characters)');
      return;
    }
    if (mode === 'manual' && parsedManualShots.length === 0) {
      toast.error('Add at least one shot prompt (one per line)');
      return;
    }

    setSubmitting(true);
    try {
      // Resolve mascot asset URL to absolute (Seedance needs http URL)
      const referenceImageUrl = new URL(mascot.src, window.location.origin).toString();

      const body: Record<string, any> = {
        videoEngine: 'seedance',
        aspectRatio,
        clipCount: mode === 'manual' ? parsedManualShots.length : clipCount,
        clipDuration,
        cameraFixed,
        includeMusic,
        includeVoice: false, // mascots are typically silent / muxed later
        referenceImageUrl,
        // Character lock so identity stays consistent across all shots
        characterLock: {
          description: `${mascot.name} — ${mascot.tagline ?? 'brand mascot character'}`,
        },
        mood: 'playful',
        genre: 'brand mascot',
      };

      if (mode === 'auto') {
        body.concept = concept.trim();
      } else {
        body.manualPrompts = parsedManualShots;
      }

      const { data, error } = await supabase.functions.invoke('seedance-pipeline', { body });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Pipeline failed');

      toast.success(`${mascot.name} is being animated — heading to production`);
      onOpenChange(false);
      if (data?.projectId) navigate(`/production/${data.projectId}`);
    } catch (e: any) {
      console.error('[SeedanceAnimate] failed', e);
      toast.error(e?.message ?? 'Failed to start generation');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        className="!p-0 !gap-0 w-[min(96vw,1080px)] !max-w-[min(96vw,1080px)] max-h-[min(92dvh,820px)] overflow-hidden rounded-3xl border-foreground/10 bg-background"
      >
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,0.78fr)_minmax(0,1fr)] h-full max-h-[inherit]">
          {/* ── LEFT · Cinematic hero panel ─────────────────────────── */}
          <aside
            className="relative hidden md:flex flex-col justify-between overflow-hidden p-8 border-r border-foreground/[0.06]"
            style={{
              background: mascot
                ? `radial-gradient(120% 80% at 20% 10%, ${mascot.palette[0]}33, transparent 60%), radial-gradient(120% 80% at 80% 90%, ${mascot.palette[1]}33, transparent 60%), hsl(220 14% 3%)`
                : 'hsl(220 14% 3%)',
            }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-screen"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.6) 1px, transparent 0)',
                backgroundSize: '22px 22px',
              }}
            />

            <header className="relative z-10 flex items-center gap-2 text-[10px] uppercase tracking-[0.36em] text-white/55 font-mono">
              <Film className="w-3.5 h-3.5" />
              Seedance · Animate
            </header>

            {mascot && (
              <div className="relative z-10 flex flex-col items-center text-center my-6">
                <div className="relative">
                  <div
                    aria-hidden
                    className="absolute -inset-10 rounded-full blur-3xl opacity-70"
                    style={{
                      background: `radial-gradient(closest-side, ${mascot.palette[0]}aa, transparent 70%)`,
                    }}
                  />
                  <img
                    src={mascot.src}
                    alt={mascot.name}
                    className="relative w-56 h-56 object-contain drop-shadow-[0_30px_60px_rgba(0,0,0,0.45)]"
                  />
                </div>
                <div className="mt-6 text-[10px] uppercase tracking-[0.36em] text-white/55 font-mono">
                  Reference locked
                </div>
                <h2 className="mt-2 text-display-luxe text-3xl text-white">
                  {mascot.name}
                </h2>
                <p className="mt-2 max-w-[28ch] text-sm text-white/65 leading-relaxed">
                  {mascot.tagline}
                </p>
              </div>
            )}

            <footer className="relative z-10 flex items-center justify-between text-[10px] uppercase tracking-[0.32em] text-white/40 font-mono">
              <span>Cinematic chain</span>
              <span>Auto-stitched</span>
            </footer>
          </aside>

          {/* ── RIGHT · Scrollable form column ──────────────────────── */}
          <section className="relative flex flex-col min-h-0 max-h-[inherit]">
            {/* Close */}
            <DialogClose
              aria-label="Close"
              className="absolute right-4 top-4 z-20 rounded-full p-2 text-white/40 hover:text-white hover:bg-white/[0.06] transition"
            >
              <X className="w-4 h-4" />
            </DialogClose>

            {/* Scroll body */}
            <div className="overflow-y-auto px-6 sm:px-8 pt-8 pb-6 space-y-7">
              {/* Mobile-only hero strip */}
              {mascot && (
                <div className="md:hidden flex items-center gap-4 p-4 rounded-2xl border border-foreground/[0.06] bg-foreground/[0.02]">
                  <img src={mascot.src} alt={mascot.name} className="w-16 h-16 object-contain" />
                  <div className="min-w-0">
                    <div className="text-[9px] uppercase tracking-[0.32em] text-muted-foreground font-mono">
                      Reference locked
                    </div>
                    <div className="text-display-luxe text-lg mt-1 truncate">{mascot.name}</div>
                  </div>
                </div>
              )}

              {/* Title */}
              <div>
                <div className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground font-mono">
                  Director
                </div>
                <h3 className="mt-2 text-display-luxe text-2xl sm:text-3xl leading-tight">
                  Direct {mascot?.name ?? 'this mascot'}<br />
                  <span className="text-muted-foreground">in a cinematic short.</span>
                </h3>
              </div>

              {/* Mode toggle */}
              <SegmentedControl<Mode>
                value={mode}
                onChange={setMode}
                items={[
                  { key: 'auto', label: 'Automatic Director' },
                  { key: 'manual', label: 'Manual Shot List' },
                ]}
              />

              {/* Concept / shots */}
              {mode === 'auto' ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground font-mono inline-flex items-center gap-2">
                      <Wand2 className="w-3.5 h-3.5" /> Concept
                    </div>
                    <div className="text-[10px] font-mono text-white/30 tabular-nums">{concept.length}/600</div>
                  </div>
                  <Textarea
                    rows={5}
                    placeholder="e.g. The mascot bursts through a confetti cannon at a stadium pre-show, sprints across the field doing tricks, and lands a hero pose under stadium lights."
                    value={concept}
                    onChange={(e) => setConcept(e.target.value.slice(0, 600))}
                    className="resize-none bg-foreground/[0.02] border-foreground/10 focus-visible:ring-1 focus-visible:ring-primary/40"
                  />
                  <p className="text-xs text-muted-foreground">
                    The Cameron-tier director will write {clipCount} cinematic shots — camera grammar, lighting, blocking all baked in.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground font-mono inline-flex items-center gap-2">
                      <Pencil className="w-3.5 h-3.5" /> Shot prompts
                    </div>
                    <div className="text-[10px] font-mono text-white/40 tabular-nums">
                      {parsedManualShots.length} shot{parsedManualShots.length === 1 ? '' : 's'}
                    </div>
                  </div>
                  <Textarea
                    rows={7}
                    placeholder={`Shot 1: Slow dolly-in as the mascot pushes through swinging doors, neon backlight, anamorphic flare\nShot 2: Whip-pan tracking the mascot sprinting across rooftops at golden hour\nShot 3: Hero crane shot rising as the mascot lands, dust kicking up, cinematic chiaroscuro`}
                    value={manualPrompts}
                    onChange={(e) => setManualPrompts(e.target.value)}
                    className="resize-none bg-foreground/[0.02] border-foreground/10 font-mono text-xs leading-relaxed"
                  />
                  <p className="text-xs text-muted-foreground">One line per shot — each becomes its own clip.</p>
                </div>
              )}

              {/* Sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {mode === 'auto' && (
                  <div className="space-y-3 rounded-2xl border border-foreground/[0.06] bg-foreground/[0.02] p-4">
                    <div className="flex items-baseline justify-between">
                      <div className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground font-mono">Shots</div>
                      <div className="text-display-luxe text-xl tabular-nums">{clipCount}</div>
                    </div>
                    <Slider value={[clipCount]} min={2} max={8} step={1} onValueChange={(v) => setClipCount(v[0])} />
                  </div>
                )}
                <div className="space-y-3 rounded-2xl border border-foreground/[0.06] bg-foreground/[0.02] p-4">
                  <div className="flex items-baseline justify-between">
                    <div className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground font-mono">Duration</div>
                    <div className="text-display-luxe text-xl tabular-nums">{clipDuration}s</div>
                  </div>
                  <Slider value={[clipDuration]} min={2} max={12} step={1} onValueChange={(v) => setClipDuration(v[0])} />
                </div>
              </div>

              {/* Aspect */}
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground font-mono">Aspect ratio</div>
                <div className="grid grid-cols-3 gap-2">
                  {(['16:9', '9:16', '1:1'] as Aspect[]).map((a) => (
                    <button
                      key={a}
                      onClick={() => setAspectRatio(a)}
                      className={`h-11 rounded-xl border text-xs font-mono tracking-wider transition ${
                        aspectRatio === a
                          ? 'border-primary/60 text-foreground bg-primary/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
                          : 'border-foreground/10 text-muted-foreground hover:border-foreground/25 hover:text-foreground'
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setIncludeMusic(v => !v)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full border text-xs transition ${
                    includeMusic
                      ? 'border-primary/60 text-foreground bg-primary/10'
                      : 'border-foreground/10 text-muted-foreground hover:border-foreground/25'
                  }`}
                >
                  <Music className="w-3.5 h-3.5" />
                  Cinematic score {includeMusic ? 'on' : 'off'}
                </button>
                <button
                  onClick={() => setCameraFixed(v => !v)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full border text-xs transition ${
                    cameraFixed
                      ? 'border-primary/60 text-foreground bg-primary/10'
                      : 'border-foreground/10 text-muted-foreground hover:border-foreground/25'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  Camera {cameraFixed ? 'locked' : 'free'}
                </button>
              </div>
            </div>

            {/* Sticky footer · cost + CTA always reachable */}
            <div className="shrink-0 border-t border-foreground/[0.06] bg-background/95 backdrop-blur px-6 sm:px-8 py-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground font-mono">
                  Estimated cost
                </div>
                <div className="mt-0.5 flex items-baseline gap-2">
                  <span className="text-display-luxe text-xl tabular-nums">{credits}</span>
                  <span className="text-xs text-muted-foreground">credits · ${(credits * 0.10).toFixed(2)}</span>
                </div>
              </div>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                variant="pill"
                size="pill"
                className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Starting…</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Animate</>
                )}
              </Button>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}