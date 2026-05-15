import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Wand2, Image as ImageIcon, Upload, Download, Sparkles,
  X, Loader2, Pencil, Maximize2, Send, Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/shell';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

type Aspect = '1:1' | '16:9' | '9:16' | '3:4' | '4:3' | '21:9';
type StyleKey = 'cinematic' | 'editorial' | 'brutalist' | 'dreamlike' | 'product' | 'illustration' | 'noir' | 'poster';

const STYLES: { key: StyleKey; label: string; hint: string }[] = [
  { key: 'cinematic',    label: 'Cinematic',    hint: 'Anamorphic 35mm, teal/orange' },
  { key: 'editorial',    label: 'Editorial',    hint: 'Magazine portraiture' },
  { key: 'product',      label: 'Product',      hint: 'Studio hero photography' },
  { key: 'dreamlike',    label: 'Dreamlike',    hint: 'Pastel haze, lens bloom' },
  { key: 'brutalist',    label: 'Brutalist',    hint: 'Mono, hard light, raw' },
  { key: 'illustration', label: 'Illustration', hint: 'Hand-drawn editorial' },
  { key: 'noir',         label: 'Noir',         hint: 'B&W, chiaroscuro' },
  { key: 'poster',       label: 'Poster',       hint: 'Graphic, hero subject' },
];

const ASPECTS: { key: Aspect; label: string; w: number; h: number }[] = [
  { key: '1:1',  label: '1:1',  w: 1, h: 1 },
  { key: '16:9', label: '16:9', w: 16, h: 9 },
  { key: '9:16', label: '9:16', w: 9, h: 16 },
  { key: '3:4',  label: '3:4',  w: 3, h: 4 },
  { key: '4:3',  label: '4:3',  w: 4, h: 3 },
  { key: '21:9', label: '21:9', w: 21, h: 9 },
];

const PROMPT_SEEDS = [
  'A lone figure in a crimson coat walking a foggy Tokyo alley at dawn, neon reflections in the wet pavement',
  'Macro hero shot of a perfume bottle on black marble, single warm key light, glass refractions',
  'Editorial portrait of a ceramicist in her sunlit studio, hands covered in clay, soft window light',
  'A glacier blue mountaintop at golden hour, lone climber silhouette, anamorphic flare',
];

interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  aspect: Aspect;
  style: StyleKey;
  ts: number;
}

export function ImageStudioHub() {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState<StyleKey>('cinematic');

  // Hydrate from ?seed= and ?style= deep links (e.g. from Avatars Gallery)
  useEffect(() => {
    try {
      const url = new URLSearchParams(window.location.search);
      const seed = url.get('seed');
      if (seed) setPrompt(seed);
      const s = url.get('style');
      if (s && STYLES.some(x => x.key === s)) setStyle(s as StyleKey);
    } catch {}
  }, []);

  const [aspect, setAspect] = useState<Aspect>('16:9');
  const [count, setCount] = useState<1 | 2 | 4>(2);
  const [hq, setHq] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<GeneratedImage[]>([]);
  const [preview, setPreview] = useState<GeneratedImage | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleRefUpload = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Image too large (max 8 MB)');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setReference(String(reader.result));
    reader.readAsDataURL(file);
  }, []);

  const generate = useCallback(async () => {
    const p = prompt.trim();
    if (p.length < 3) {
      toast.error('Add a prompt first');
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('studio-image', {
        body: { prompt: p, style, aspect, count, hq, referenceUrl: reference || undefined },
      });
      if (error || data?.error) {
        const msg = (data?.error as string) || error?.message || 'Generation failed';
        toast.error(msg);
        return;
      }
      const fresh: GeneratedImage[] = (data?.images || []).map((url: string, i: number) => ({
        id: `${Date.now()}-${i}`,
        url, prompt: p, aspect, style, ts: Date.now(),
      }));
      setResults(prev => [...fresh, ...prev]);
      toast.success(reference ? 'Image edited' : `Generated ${fresh.length} image${fresh.length > 1 ? 's' : ''}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setBusy(false);
    }
  }, [prompt, style, aspect, count, hq, reference]);

  const useAsReference = (img: GeneratedImage) => {
    setReference(img.url);
    setPreview(null);
    toast.message('Using image as reference', { description: 'Edit the prompt and generate to remix.' });
  };

  const aspectStyle = ASPECTS.find(a => a.key === aspect)!;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6">
      {/* ─────────────────── Composer ─────────────────── */}
      <Surface padded={false} className="relative overflow-hidden">
        {/* aurora wash */}
        <div aria-hidden className="pointer-events-none absolute -top-24 -left-20 w-[420px] h-[320px] rounded-full opacity-50 blur-[80px]"
          style={{ background: 'radial-gradient(closest-side, hsl(215,100%,55%/0.55), transparent 70%)' }} />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-16 w-[360px] h-[280px] rounded-full opacity-40 blur-[80px]"
          style={{ background: 'radial-gradient(closest-side, hsl(190,100%,55%/0.45), transparent 70%)' }} />

        <div className="relative p-6 space-y-6">
          <div>
            <div className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground font-mono">
              Image · Studio
            </div>
            <h2 className="text-display-luxe text-3xl mt-2 leading-[0.95]">Compose a still.</h2>
            <p className="text-body-muted text-sm mt-2">
              Text-to-image, or drop a reference to remix. Powered by Nano Banana.
            </p>
          </div>

          {/* Prompt */}
          <div>
            <label className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground font-mono">
              Prompt
            </label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="A lone figure in a crimson coat walking a foggy Tokyo alley at dawn…"
              rows={4}
              className="mt-2 w-full rounded-2xl bg-foreground/[0.04] border border-foreground/[0.08] px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/40 resize-none transition-colors leading-relaxed"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PROMPT_SEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => setPrompt(s)}
                  className="text-[10px] uppercase tracking-[0.18em] font-mono px-2 py-1 rounded-full border border-foreground/[0.08] text-muted-foreground hover:text-foreground hover:border-foreground/[0.18] transition-colors"
                >
                  {s.split(' ').slice(0, 4).join(' ')}…
                </button>
              ))}
            </div>
          </div>

          {/* Reference */}
          <div>
            <label className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground font-mono">
              Reference {reference && <span className="text-primary">· editing</span>}
            </label>
            {reference ? (
              <div className="mt-2 relative group">
                <img src={reference} alt="Reference" className="w-full h-40 object-cover rounded-2xl border border-foreground/[0.08]" />
                <button
                  onClick={() => setReference(null)}
                  className="absolute top-2 right-2 h-7 w-7 grid place-items-center rounded-full bg-background/80 backdrop-blur border border-foreground/[0.08] text-muted-foreground hover:text-foreground"
                  aria-label="Remove reference"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="mt-2 w-full h-24 rounded-2xl border border-dashed border-foreground/[0.12] hover:border-primary/40 hover:bg-foreground/[0.02] transition-colors flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <Upload className="w-4 h-4" /> Drop an image to remix
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => e.target.files?.[0] && handleRefUpload(e.target.files[0])}
            />
          </div>

          {/* Style */}
          <div>
            <label className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground font-mono">
              Style
            </label>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {STYLES.map(s => {
                const active = style === s.key;
                return (
                  <button
                    key={s.key}
                    onClick={() => setStyle(s.key)}
                    className={cn(
                      'text-left p-2.5 rounded-xl border text-xs transition-all',
                      active
                        ? 'border-primary bg-primary/10 text-foreground shadow-[0_0_24px_-8px_hsl(var(--primary)/0.6)]'
                        : 'border-foreground/[0.08] bg-foreground/[0.02] text-muted-foreground hover:text-foreground hover:border-foreground/[0.16]',
                    )}
                  >
                    <div className="font-medium">{s.label}</div>
                    <div className="text-[10px] opacity-60 mt-0.5 leading-snug">{s.hint}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Aspect */}
          <div>
            <label className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground font-mono">
              Aspect
            </label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ASPECTS.map(a => {
                const active = aspect === a.key;
                return (
                  <button
                    key={a.key}
                    onClick={() => setAspect(a.key)}
                    className={cn(
                      'inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-mono border transition-all',
                      active
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-foreground/[0.08] bg-foreground/[0.02] text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <span className="block bg-current rounded-[2px]" style={{ width: a.w * 1.5, height: a.h * 1.5, opacity: active ? 0.8 : 0.4 }} />
                    {a.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Count + HQ */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground font-mono">Variants</label>
              <div className="mt-2 flex gap-1.5">
                {([1, 2, 4] as const).map(n => (
                  <button
                    key={n}
                    onClick={() => setCount(n)}
                    className={cn(
                      'flex-1 h-9 rounded-full text-xs font-mono border transition-all',
                      count === n
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-foreground/[0.08] bg-foreground/[0.02] text-muted-foreground hover:text-foreground',
                    )}
                  >
                    ×{n}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground font-mono">Quality</label>
              <button
                onClick={() => setHq(v => !v)}
                className={cn(
                  'mt-2 w-full h-9 rounded-full text-xs font-mono border transition-all flex items-center justify-center gap-1.5',
                  hq
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-foreground/[0.08] bg-foreground/[0.02] text-muted-foreground hover:text-foreground',
                )}
              >
                <Sparkles className="w-3 h-3" /> {hq ? 'Pro · slower' : 'Fast'}
              </button>
            </div>
          </div>

          {/* Generate */}
          <Button
            variant="pill"
            size="pill"
            className="w-full"
            disabled={busy || prompt.trim().length < 3}
            onClick={generate}
          >
            {busy ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
            ) : reference ? (
              <><Pencil className="w-4 h-4" /> Edit image</>
            ) : (
              <><Wand2 className="w-4 h-4" /> Generate</>
            )}
          </Button>
        </div>
      </Surface>

      {/* ─────────────────── Results ─────────────────── */}
      <div className="space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground font-mono">
              {results.length === 0 ? 'Empty stage' : `${results.length} renders`}
            </div>
            <h3 className="text-display-luxe text-2xl mt-1">Render gallery</h3>
          </div>
          {results.length > 0 && (
            <button
              onClick={() => setResults([])}
              className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
            >
              Clear
            </button>
          )}
        </div>

        {results.length === 0 ? (
          <Surface className="relative overflow-hidden">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-40 blur-[60px]"
              style={{ background: 'radial-gradient(ellipse at 30% 20%, hsl(215,100%,55%/0.4), transparent 60%), radial-gradient(ellipse at 70% 80%, hsl(190,100%,55%/0.35), transparent 60%)' }}
            />
            <div
              className="relative grid place-items-center text-center"
              style={{ aspectRatio: `${aspectStyle.w} / ${aspectStyle.h}`, minHeight: 320 }}
            >
              <div className="space-y-3 max-w-md">
                <div className="mx-auto w-12 h-12 rounded-full bg-foreground/[0.04] border border-foreground/[0.08] grid place-items-center">
                  <ImageIcon className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
                </div>
                <h4 className="text-display-luxe text-2xl">Your stage is dark.</h4>
                <p className="text-body-muted text-sm">
                  Write a prompt — or drop a reference and remix it. Renders appear here in {aspectStyle.label}.
                </p>
              </div>
            </div>
          </Surface>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <AnimatePresence initial={false}>
              {results.map((img, i) => (
                <motion.div
                  key={img.id}
                  initial={{ opacity: 0, y: 16, filter: 'blur(8px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Surface
                    padded={false}
                    hover
                    className="group relative overflow-hidden cursor-pointer"
                    onClick={() => setPreview(img)}
                  >
                    <div
                      className="relative bg-foreground/[0.02]"
                      style={{ aspectRatio: `${ASPECTS.find(a => a.key === img.aspect)!.w} / ${ASPECTS.find(a => a.key === img.aspect)!.h}` }}
                    >
                      <img src={img.url} alt={img.prompt.slice(0, 80)} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
                      {/* hover overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      <div className="absolute bottom-0 inset-x-0 p-4 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-500 flex items-center gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="bg-background/70 backdrop-blur border border-foreground/[0.08] hover:bg-background"
                          onClick={(e) => { e.stopPropagation(); setPreview(img); }}
                          aria-label="Open"
                        >
                          <Maximize2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="bg-background/70 backdrop-blur border border-foreground/[0.08] hover:bg-background"
                          onClick={(e) => { e.stopPropagation(); useAsReference(img); }}
                          aria-label="Remix"
                        >
                          <Layers className="w-4 h-4" />
                        </Button>
                        <a
                          href={img.url}
                          download={`apex-${img.id}.png`}
                          onClick={(e) => e.stopPropagation()}
                          className="ml-auto inline-flex h-8 px-3 items-center gap-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium hover:opacity-90"
                        >
                          <Download className="w-3.5 h-3.5" /> Save
                        </a>
                      </div>
                      {/* style chip */}
                      <div className="absolute top-3 left-3 inline-flex items-center h-6 px-2.5 rounded-full bg-background/70 backdrop-blur border border-foreground/[0.08] text-[10px] uppercase tracking-[0.2em] font-mono text-muted-foreground">
                        {STYLES.find(s => s.key === img.style)?.label} · {img.aspect}
                      </div>
                    </div>
                  </Surface>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ─────────────────── Preview ─────────────────── */}
      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 bg-background/85 backdrop-blur-2xl grid place-items-center p-6"
            onClick={() => setPreview(null)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.97, y: 8 }}
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}
              className="relative max-w-6xl w-full max-h-[90vh] grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="relative rounded-2xl overflow-hidden border border-foreground/[0.08] bg-foreground/[0.02]">
                <img src={preview.url} alt="Preview" className="w-full max-h-[90vh] object-contain" />
              </div>
              <div className="space-y-4">
                <button
                  onClick={() => setPreview(null)}
                  className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-foreground/[0.04] border border-foreground/[0.08] text-muted-foreground hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground font-mono">
                  {STYLES.find(s => s.key === preview.style)?.label} · {preview.aspect}
                </div>
                <p className="text-body-muted text-sm leading-relaxed">{preview.prompt}</p>
                <div className="grid grid-cols-2 gap-2 pt-4">
                  <Button variant="pill" size="pill" asChild>
                    <a href={preview.url} download={`apex-${preview.id}.png`}>
                      <Download className="w-4 h-4" /> Download
                    </a>
                  </Button>
                  <Button variant="ghost" onClick={() => useAsReference(preview)}>
                    <Layers className="w-4 h-4" /> Remix
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => {
                    navigator.clipboard.writeText(preview.url);
                    toast.success('URL copied');
                  }}
                >
                  <Send className="w-4 h-4" /> Copy image URL
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ImageStudioHub;
