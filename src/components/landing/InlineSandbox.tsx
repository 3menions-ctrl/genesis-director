/**
 * InlineSandbox — the landing-page "type a prompt → see four 320p frames"
 * widget. Free, public, rate-limited to 4 / IP / day.
 *
 * This is the single highest-impact section on the page — visitors get to
 * touch the product without signing up. Even when the model key isn't
 * configured, the function returns synthetic gradient placeholders so the
 * full UX flow demonstrates correctly.
 */

import { useState } from 'react';
import { Send, Loader2, Sparkles, RefreshCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PrimaryCTA } from '@/components/ui/PrimaryCTA';
import { useSafeNavigation } from '@/lib/navigation';

interface PreviewResponse {
  ok: boolean;
  images?: string[];
  synthetic?: boolean;
  remaining_today?: number;
  reason?: string;
  message?: string;
}

const SAMPLE_PROMPTS = [
  'A neon-lit Tokyo street at night, rain on the pavement, slow tracking shot toward a glowing ramen shop',
  'Aerial sunrise over the Faroe Islands, a single sailboat carving through mirror-flat water',
  'A confident product founder talks to camera in a sunlit Brooklyn loft — handheld, warm, candid',
];

export function InlineSandbox() {
  const { navigate } = useSafeNavigation();
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PreviewResponse | null>(null);
  const [animateIn, setAnimateIn] = useState<number[]>([]);

  const handleSubmit = async () => {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    setResult(null);
    setAnimateIn([]);
    try {
      const { data, error } = await supabase.functions.invoke('landing-preview', {
        body: { prompt: prompt.trim() },
      });
      if (error) throw error;
      const payload = data as PreviewResponse;
      setResult(payload);
      if (payload.ok && payload.images) {
        // Stagger reveal of frames
        payload.images.forEach((_, i) =>
          window.setTimeout(() => setAnimateIn((arr) => [...arr, i]), 120 + i * 240),
        );
      }
    } catch {
      setResult({
        ok: false,
        reason: 'network',
        message: 'Network glitch. Try again in a moment.',
      });
    } finally {
      setBusy(false);
    }
  };

  const usePromptSample = (s: string) => {
    setPrompt(s);
    setResult(null);
    setAnimateIn([]);
  };

  return (
    <section className="relative z-10 py-32 lg:py-40 px-6">
      <div className="max-w-[1100px] mx-auto">
        {/* Eyebrow */}
        <div className="text-center mb-10 lg:mb-14">
          <div className="text-[9px] font-mono uppercase tracking-[0.4em] text-white/30 mb-4">
            The Sandbox · No signup · Free
          </div>
          <h2
            className="font-display text-[36px] sm:text-[52px] lg:text-[64px] font-light text-white leading-[1.05]"
            style={{ fontVariant: 'small-caps' }}
          >
            Type a scene. Watch Small Bridges think.
          </h2>
          <p className="text-white/55 text-[14px] sm:text-[16px] max-w-xl mx-auto mt-5 leading-relaxed">
            Four pre-vis frames in about eight seconds. No account needed. When you like one, sign up to render the full shot.
          </p>
        </div>

        {/* Prompt box */}
        <div className="relative rounded-3xl border border-white/[0.08] bg-white/[0.025] backdrop-blur-md p-6 lg:p-8 overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-20 right-0 w-[420px] h-[420px] rounded-full"
            style={{
              background:
                'radial-gradient(circle, hsl(var(--brand) / 0.18), transparent 65%)',
              filter: 'blur(60px)',
            }}
          />

          <div className="relative">
            <label htmlFor="sandbox-prompt" className="block">
              <span className="text-[10px] font-mono uppercase tracking-[0.32em] text-white/45 mb-3 inline-flex items-center gap-2">
                <Sparkles className="w-3 h-3 text-brand-light" />
                Your scene
              </span>
            </label>
            <textarea
              id="sandbox-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSubmit();
              }}
              placeholder="A neon-lit Tokyo street at night, rain on the pavement, slow tracking shot toward a glowing ramen shop"
              rows={3}
              maxLength={240}
              className="w-full bg-transparent border-0 outline-none text-white text-[16px] sm:text-[18px] leading-[1.55] placeholder:text-white/30 resize-none font-display"
            />

            {/* Sample prompts as quick-fills */}
            <div className="mt-4 flex flex-wrap gap-2">
              {SAMPLE_PROMPTS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => usePromptSample(s)}
                  className="text-[11px] font-mono uppercase tracking-[0.22em] px-3 py-1.5 rounded-full border border-white/[0.08] bg-glass hover:bg-glass-active hover:border-white/20 text-white/55 hover:text-white transition-all"
                >
                  Sample {i + 1}
                </button>
              ))}
            </div>

            {/* Submit row */}
            <div className="mt-6 flex items-center justify-between flex-wrap gap-4">
              <div className="text-[10px] font-mono uppercase tracking-[0.32em] text-white/35 tabular-nums">
                {prompt.length} / 240 · ⌘↵ to preview
              </div>
              <PrimaryCTA
                size="lg"
                loading={busy}
                onClick={handleSubmit}
                disabled={!prompt.trim()}
                icon={Send}
              >
                Preview four frames
              </PrimaryCTA>
            </div>
          </div>
        </div>

        {/* Result grid */}
        {(busy || result) && (
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4">
            {busy && !result &&
              Array.from({ length: 4 }).map((_, i) => (
                <FrameSkeleton key={i} index={i} />
              ))}
            {result?.ok && result.images?.map((url, i) => (
              <div
                key={i}
                className={[
                  'group relative aspect-square rounded-2xl overflow-hidden border border-white/[0.08] bg-black/40 transition-all duration-700',
                  animateIn.includes(i)
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-3',
                ].join(' ')}
              >
                <img
                  src={url}
                  alt={`Small Bridges preview frame ${i + 1}`}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-700"
                />
                <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-md border border-white/15 font-mono text-[9px] uppercase tracking-[0.32em] text-white/85 tabular-nums">
                  Frame {String(i + 1).padStart(2, '0')}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Status / errors */}
        {result && !result.ok && (
          <div className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-500/[0.05] p-5 flex items-start gap-3">
            <div className="w-8 h-8 rounded-full border border-amber-400/40 bg-amber-500/10 flex items-center justify-center shrink-0">
              <RefreshCcw className="w-3.5 h-3.5 text-amber-300" />
            </div>
            <div className="flex-1">
              <div className="text-amber-100 text-[13px] font-medium mb-1">
                {result.reason === 'rate_limit' || result.reason === 'platform_cap'
                  ? "Today's free previews are used up."
                  : result.reason === 'content'
                    ? "We can't preview that prompt."
                    : "The preview engine needs another beat."}
              </div>
              <p className="text-amber-300/70 text-[12px] leading-relaxed">
                {result.message ?? 'Try again, or sign up — the preview is unlimited with an account.'}
              </p>
              <div className="mt-3">
                <PrimaryCTA size="sm" onClick={() => navigate('/auth?mode=signup')}>
                  Sign up — free
                </PrimaryCTA>
              </div>
            </div>
          </div>
        )}

        {/* Footer hint */}
        {result?.ok && (
          <div className="mt-6 flex items-center justify-between flex-wrap gap-3 text-[11px] font-mono uppercase tracking-[0.32em] text-white/35">
            <span>
              {result.synthetic
                ? 'Preview engine in warm-up · placeholder frames'
                : `${result.remaining_today ?? 0} free previews left today`}
            </span>
            <button
              onClick={() => navigate('/auth?mode=signup')}
              className="text-brand-light hover:text-white transition-colors inline-flex items-center gap-1.5"
            >
              Sign up to render the full shot
              <span aria-hidden>→</span>
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function FrameSkeleton({ index }: { index: number }) {
  return (
    <div className="relative aspect-square rounded-2xl overflow-hidden border border-white/[0.08] bg-black/40">
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.05) 50%, transparent 100%)',
          backgroundSize: '200% 100%',
          animation: `app-shimmer ${1.8 + index * 0.2}s linear infinite`,
        }}
      />
      <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-black/60 border border-white/15 font-mono text-[9px] uppercase tracking-[0.32em] text-white/55">
        Frame {String(index + 1).padStart(2, '0')}
      </div>
      <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
        <Loader2 className="w-3 h-3 text-white/35 animate-spin" />
        <span className="text-[9px] font-mono text-white/35 uppercase tracking-[0.32em]">
          Generating…
        </span>
      </div>
    </div>
  );
}

export default InlineSandbox;
