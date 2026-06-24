/**
 * PreVisDialog — pre-render 4 fast 320p frame thumbnails of the user's
 * prompt before they commit credits to the full video generation.
 *
 * The user types a prompt, hits "Preview", sees 4 stylistic interpretations
 * appear over ~8 seconds, picks the one closest to their vision, then
 * clicks "Render the full shot" which signals the parent to kick off the
 * actual mode-router call with the chosen interpretation as a seed/style
 * anchor.
 *
 * Backed by the same `landing-preview` edge function used on the public
 * landing — but with the authenticated user receiving unlimited previews.
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Wand2, Sparkles, ArrowRight, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PrimaryCTA } from '@/components/ui/PrimaryCTA';
import { Spinner } from '@/components/ui/Spinner';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: string;
  onChoose: (frameUrl: string, frameIndex: number) => void;
}

export function PreVisDialog({ open, onOpenChange, prompt, onChoose }: Props) {
  const [busy, setBusy] = useState(false);
  const [frames, setFrames] = useState<string[]>([]);
  const [chosen, setChosen] = useState<number | null>(null);

  const generate = async () => {
    if (!prompt.trim()) {
      toast.error('Type a prompt first');
      return;
    }
    setBusy(true);
    setFrames([]);
    setChosen(null);
    try {
      const { data, error } = await supabase.functions.invoke('landing-preview', {
        body: { prompt: prompt.trim() },
      });
      if (error) throw error;
      const payload = data as { ok: boolean; images?: string[]; message?: string };
      if (!payload.ok || !payload.images) {
        toast.error(payload.message ?? 'Preview failed');
        return;
      }
      setFrames(payload.images);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Preview failed');
    } finally {
      setBusy(false);
    }
  };

  const commit = () => {
    if (chosen === null) return;
    onChoose(frames[chosen], chosen);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogTitle className="text-white font-display text-[22px] flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-brand-light" />
          Pre-vis · Pick your interpretation
        </DialogTitle>
        <DialogDescription className="text-white/55 text-[13px]">
          We&rsquo;ll draft four fast 320p frames. Pick the one closest to your vision — the full render will anchor on it.
        </DialogDescription>

        <div className="mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.015] p-4 text-white/75 text-[13px] line-clamp-3">
          <span className="text-[9px] font-mono uppercase tracking-[0.32em] text-white/30 mr-2">
            Prompt
          </span>
          {prompt}
        </div>

        {/* Frame grid */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {busy &&
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square rounded-xl border border-white/[0.08] bg-black/40 flex items-center justify-center"
              >
                <Spinner size="sm" tone="primary" />
              </div>
            ))}
          {!busy && frames.length === 0 && (
            <div className="col-span-4 rounded-xl border border-dashed border-white/[0.08] py-10 text-center">
              <Sparkles className="w-5 h-5 mx-auto text-brand-light mb-2" />
              <p className="text-[13px] text-white/55">
                Tap &ldquo;Draft frames&rdquo; — the previews take about eight seconds.
              </p>
            </div>
          )}
          {!busy && frames.length > 0 && frames.map((url, i) => (
            <button
              key={i}
              onClick={() => setChosen(i)}
              className={`group relative aspect-square rounded-xl overflow-hidden border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 ${
                chosen === i
                  ? 'border-brand shadow-[0_8px_24px_-12px_hsl(var(--brand)/0.6)]'
                  : 'border-white/[0.08] hover:border-white/30'
              }`}
            >
              <img src={url} alt={`Frame ${i + 1}`} className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute top-1.5 left-1.5 font-mono text-[9px] uppercase tracking-[0.32em] px-1.5 py-0.5 rounded bg-black/60 border border-white/15 text-white/85 tabular-nums">
                Frame {i + 1}
              </div>
              {chosen === i && (
                <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-brand flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="text-[10px] font-mono uppercase tracking-[0.32em] text-white/30">
            Pre-vis is free — costs ~5 credits if you choose to render.
          </div>
          <div className="flex items-center gap-2">
            <PrimaryCTA onClick={generate} loading={busy} icon={Wand2}>
              {frames.length > 0 ? 'Re-draft' : 'Draft frames'}
            </PrimaryCTA>
            <PrimaryCTA
              onClick={commit}
              disabled={chosen === null}
              trailingIcon={ArrowRight}
            >
              Render the full shot
            </PrimaryCTA>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PreVisDialog;
