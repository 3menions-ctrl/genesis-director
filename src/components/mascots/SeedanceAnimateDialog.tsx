import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { SegmentedControl } from '@/components/shell';
import { Sparkles, Wand2, Pencil, Loader2, Film } from 'lucide-react';
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
      <DialogContent className="max-w-3xl bg-background border-foreground/10">
        <DialogHeader>
          <DialogTitle className="text-display-luxe text-3xl flex items-center gap-3">
            <Film className="w-6 h-6 text-primary" />
            Animate {mascot?.name ?? 'mascot'} with Seedance
          </DialogTitle>
          <DialogDescription className="text-body-muted">
            Cinematic motion, kinetic energy — your mascot rendered with Seedance 2.0,
            chained across multiple shots and stitched into one watchable video.
          </DialogDescription>
        </DialogHeader>

        {mascot && (
          <div className="flex items-center gap-4 p-4 rounded-2xl border border-foreground/[0.06] bg-foreground/[0.02]">
            <img
              src={mascot.src}
              alt={mascot.name}
              className="w-20 h-20 object-contain rounded-xl"
            />
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground font-mono">
                Reference locked
              </div>
              <div className="text-display-luxe text-lg mt-1">{mascot.name}</div>
              <div className="text-body-muted text-xs">{mascot.tagline}</div>
            </div>
          </div>
        )}

        {/* Mode toggle */}
        <SegmentedControl<Mode>
          value={mode}
          onChange={setMode}
          items={[
            { key: 'auto', label: 'Automatic Director' },
            { key: 'manual', label: 'Manual Shot List' },
          ]}
        />

        {mode === 'auto' ? (
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Wand2 className="w-4 h-4" />
              Concept
            </Label>
            <Textarea
              rows={4}
              placeholder="e.g. The mascot bursts through a confetti cannon at a stadium pre-show, sprints across the field doing tricks, and lands a hero pose under stadium lights."
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              className="bg-foreground/[0.02] border-foreground/10"
            />
            <p className="text-xs text-muted-foreground">
              The Cameron-tier director will write {clipCount} cinematic shots — camera grammar, lighting, blocking all baked in.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Pencil className="w-4 h-4" />
              Shot prompts <span className="text-xs text-muted-foreground">(one per line — each line becomes a clip)</span>
            </Label>
            <Textarea
              rows={8}
              placeholder={`Shot 1: Slow dolly-in as the mascot pushes through swinging doors, neon backlight, anamorphic flare\nShot 2: Whip-pan tracking the mascot sprinting across rooftops at golden hour\nShot 3: Hero crane shot rising as the mascot lands, dust kicking up, cinematic chiaroscuro`}
              value={manualPrompts}
              onChange={(e) => setManualPrompts(e.target.value)}
              className="bg-foreground/[0.02] border-foreground/10 font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              {parsedManualShots.length} shot{parsedManualShots.length === 1 ? '' : 's'} detected.
            </p>
          </div>
        )}

        {/* Knobs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {mode === 'auto' && (
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Shots · {clipCount}
              </Label>
              <Slider
                value={[clipCount]}
                min={2} max={8} step={1}
                onValueChange={(v) => setClipCount(v[0])}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Duration · {clipDuration}s per shot
            </Label>
            <Slider
              value={[clipDuration]}
              min={2} max={12} step={1}
              onValueChange={(v) => setClipDuration(v[0])}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Aspect
            </Label>
            <div className="flex gap-1">
              {(['16:9', '9:16', '1:1'] as Aspect[]).map((a) => (
                <button
                  key={a}
                  onClick={() => setAspectRatio(a)}
                  className={`flex-1 px-3 py-2 text-xs rounded-lg border transition ${
                    aspectRatio === a
                      ? 'border-primary text-foreground bg-primary/10'
                      : 'border-foreground/10 text-muted-foreground hover:border-foreground/20'
                  }`}
                >{a}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Toggles */}
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            onClick={() => setIncludeMusic(v => !v)}
            className={`px-3 py-1.5 rounded-full border transition ${
              includeMusic ? 'border-primary text-foreground bg-primary/10' : 'border-foreground/10 text-muted-foreground'
            }`}
          >
            🎵 Cinematic score {includeMusic ? 'on' : 'off'}
          </button>
          <button
            onClick={() => setCameraFixed(v => !v)}
            className={`px-3 py-1.5 rounded-full border transition ${
              cameraFixed ? 'border-primary text-foreground bg-primary/10' : 'border-foreground/10 text-muted-foreground'
            }`}
          >
            📷 Camera {cameraFixed ? 'locked' : 'free'}
          </button>
        </div>

        {/* CTA */}
        <div className="flex items-center justify-between gap-4 pt-2 border-t border-foreground/[0.06]">
          <div className="text-sm">
            <span className="text-muted-foreground">Cost · </span>
            <span className="text-display-luxe text-lg">{credits} credits</span>
            <span className="text-muted-foreground"> (~${(credits * 0.10).toFixed(2)})</span>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            variant="pill"
            size="pill"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Starting…</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Animate with Seedance</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}