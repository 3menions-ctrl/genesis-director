/**
 * Create — a guided, step-by-step flow. The Create tab opens at "What do you
 * want to make?"; each step is a bottom sheet with one question + a few choices
 * (premium borderless icon-with-text in translucent containers) that
 * auto-advance, leading to the writing screen + action. Config-driven: a new
 * creation type is one entry in FLOWS.
 *
 * Spend-only. The final action routes to the real Studio engine.
 */
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Sparkles, ArrowRight, Loader2,
  RectangleHorizontal, RectangleVertical, Square,
  Clapperboard, Image as ImageIcon, UserRound, Music, Scissors,
  PenLine, LayoutGrid, Film, Moon, Tv, Sunset, Box, Camera, UserPlus,
  Mic, AudioLines, Volume2, Waves, Radio, Zap, Leaf, Wind, Sun,
  Upload, Images, Lightbulb, Palette, Eraser, Maximize2,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AuroraBackdrop } from '@/components/native/AuroraBackdrop';
import { hapticTap } from '@/lib/native/shell';
import { cn } from '@/lib/utils';

const enc = encodeURIComponent;

interface Opt { v: string; label: string; icon: LucideIcon }
interface Step { id: string; q: string; opts: Opt[]; skip?: boolean }
interface Flow {
  Icon: LucideIcon; label: string; writeQ: string; placeholder: string; action: string;
  steps: Step[];
  route: (sel: Record<string, string>, prompt: string) => string;
}

const ASPECT_OPTS: Opt[] = [
  { v: '16:9', label: '16:9', icon: RectangleHorizontal },
  { v: '9:16', label: '9:16', icon: RectangleVertical },
  { v: '1:1', label: '1:1', icon: Square },
];
const LOOK_OPTS: Opt[] = [
  { v: 'cinematic', label: 'Cinematic', icon: Film },
  { v: 'anime', label: 'Anime', icon: Sparkles },
  { v: 'noir', label: 'Noir', icon: Moon },
  { v: 'vhs', label: 'VHS', icon: Tv },
  { v: 'vapor', label: 'Vapor', icon: Sunset },
];
const ASPECT_HINT: Record<string, string> = { '16:9': 'widescreen 16:9', '9:16': 'vertical 9:16', '1:1': 'square 1:1' };
/** Compose the final generation prompt from the base text + chosen settings. */
const compose = (base: string, parts: (string | undefined | false)[]) => [base.trim(), ...parts.filter(Boolean)].join(', ');
/** Append the format to the route so Studio can pick it up when supported. */
const fmt = (aspect?: string) => (aspect ? `&aspect=${enc(aspect)}` : '');
/** Append an uploaded reference image (Studio reads ?image= when supported). */
const img = (url?: string) => (url ? `&image=${enc(url)}` : '');

// Only native-complete modes are offered here. Image / Edit-photo / Music are
// web-only Studio flows (no native UI yet) — surfacing them would bleed the web
// app into the native shell, so they're omitted until they have native screens.
const TYPES: Opt[] = [
  { v: 'video', label: 'Video', icon: Clapperboard },
  { v: 'avatar', label: 'Avatar', icon: UserRound },
  { v: 'upload', label: 'Upload reel', icon: Upload },
  { v: 'live', label: 'Go Live', icon: Radio },
];

const FLOWS: Record<string, Flow> = {
  video: {
    Icon: Clapperboard, label: 'Video', writeQ: 'Describe your scene', action: 'Generate',
    placeholder: 'A lone astronaut watching twin suns set over a glass desert…',
    steps: [
      { id: 'source', q: 'Start from', opts: [{ v: 'text', label: 'Text', icon: PenLine }, { v: 'photo', label: 'A photo', icon: ImageIcon }, { v: 'template', label: 'Template', icon: LayoutGrid }] },
      { id: 'look', q: 'Pick a look', skip: true, opts: LOOK_OPTS },
      { id: 'aspect', q: 'Format', opts: ASPECT_OPTS },
    ],
    route: (s, p) => `/me/generate?prompt=${enc(compose(p, [s.look && `${s.look} style`]))}${fmt(s.aspect)}${img(s.image)}`,
  },
  image: {
    Icon: ImageIcon, label: 'Image', writeQ: 'Describe the image', action: 'Generate',
    placeholder: 'A portrait of a desert wanderer at golden hour, 85mm…',
    steps: [
      { id: 'look', q: 'Pick a style', skip: true, opts: [{ v: 'cinematic', label: 'Cinematic', icon: Film }, { v: 'anime', label: 'Anime', icon: Sparkles }, { v: '3d', label: '3D', icon: Box }, { v: 'photo', label: 'Photo', icon: Camera }] },
      { id: 'aspect', q: 'Format', opts: ASPECT_OPTS },
    ],
    route: (s, p) => `/studio?tab=image&prompt=${enc(compose(p, [s.look && `${s.look} style`, ASPECT_HINT[s.aspect]]))}${fmt(s.aspect)}`,
  },
  avatar: {
    Icon: UserRound, label: 'Avatar', writeQ: 'What do they say?', action: 'Generate',
    placeholder: 'Hey everyone — welcome back to the channel…',
    steps: [
      { id: 'presenter', q: 'Pick a presenter', opts: [{ v: 'nova', label: 'Nova', icon: UserRound }, { v: 'kai', label: 'Kai', icon: UserRound }, { v: 'mara', label: 'Mara', icon: UserRound }, { v: 'own', label: 'Create own', icon: UserPlus }] },
      { id: 'voice', q: 'Pick a voice', opts: [{ v: 'warm', label: 'Warm', icon: Mic }, { v: 'bright', label: 'Bright', icon: AudioLines }, { v: 'deep', label: 'Deep', icon: Volume2 }, { v: 'calm', label: 'Calm', icon: Waves }] },
      { id: 'aspect', q: 'Format', opts: ASPECT_OPTS },
    ],
    route: (_s, p) => `/avatars${p.trim() ? `?script=${enc(p.trim())}` : ''}`,
  },
  music: {
    Icon: Music, label: 'Music', writeQ: 'Describe the track', action: 'Compose',
    placeholder: 'A tense orchestral build with low strings and a distant choir…',
    steps: [
      { id: 'genre', q: 'Genre', opts: [{ v: 'cinematic', label: 'Cinematic', icon: Film }, { v: 'electronic', label: 'Electronic', icon: AudioLines }, { v: 'orchestral', label: 'Orchestral', icon: Music }, { v: 'lofi', label: 'Lo-fi', icon: Radio }, { v: 'ambient', label: 'Ambient', icon: Waves }] },
      { id: 'mood', q: 'Mood', opts: [{ v: 'epic', label: 'Epic', icon: Zap }, { v: 'calm', label: 'Calm', icon: Leaf }, { v: 'tense', label: 'Tense', icon: Wind }, { v: 'uplifting', label: 'Uplifting', icon: Sun }, { v: 'dreamy', label: 'Dreamy', icon: Moon }] },
    ],
    route: (s, p) => { const q = compose(p, [s.genre, s.mood && `${s.mood} mood`]); return q ? `/music?prompt=${enc(q)}` : '/music'; },
  },
  photo: {
    Icon: Scissors, label: 'Edit photo', writeQ: 'Describe the edit', action: 'Apply',
    placeholder: 'Relight to golden hour, remove the background, add film grain…',
    steps: [
      { id: 'source', q: 'Add a photo', opts: [{ v: 'upload', label: 'Upload', icon: Upload }, { v: 'library', label: 'Library', icon: Images }, { v: 'camera', label: 'Camera', icon: Camera }] },
      { id: 'op', q: 'What to do', opts: [{ v: 'relight', label: 'Relight', icon: Lightbulb }, { v: 'restyle', label: 'Restyle', icon: Palette }, { v: 'remove', label: 'Remove', icon: Eraser }, { v: 'upscale', label: 'Upscale', icon: Maximize2 }] },
    ],
    route: (s, p) => `/studio?tab=photo&prompt=${enc(compose(p, [s.op]))}${img(s.image)}`,
  },
};

export default function Create() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [flow, setFlow] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [sel, setSel] = useState<Record<string, string>>({});
  const [prompt, setPrompt] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingPick = useRef<{ id: string; v: string } | null>(null);

  const def = flow ? FLOWS[flow] : null;
  const steps = def?.steps ?? [];
  const atWriting = !!def && step >= steps.length;
  const total = steps.length + 1;

  const start = (type: string) => {
    void hapticTap();
    // Avatar → straight into the real avatar library (pick presenter + hear
    // voice + write a script there) rather than placeholder chips.
    if (type === 'avatar') { navigate('/avatars'); return; }
    // Upload → the native reel uploader (pick a 5s clip + publish).
    if (type === 'upload') { navigate('/upload'); return; }
    // Live → the Live lobby (browse live rooms + go live).
    if (type === 'live') { navigate('/live'); return; }
    setFlow(type); setStep(0); setSel({}); setPrompt('');
  };

  // A photo source opens the native picker, uploads, then advances with the URL.
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = '';
    const pend = pendingPick.current; pendingPick.current = null;
    if (!file || !user || !pend) return;
    if (!file.type.startsWith('image/')) { toast.error('Please choose an image'); return; }
    if (file.size > 12 * 1024 * 1024) { toast.error('Image must be under 12MB'); return; }
    setUploading(true);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${user.id}/create-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (error) throw error;
      const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
      setSel((s) => ({ ...s, [pend.id]: pend.v, image: url }));
      setStep((n) => n + 1);
      toast.success('Photo added');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Upload failed'); }
    finally { setUploading(false); }
  };

  const pick = (id: string, v: string) => {
    void hapticTap();
    // "Template" source → the template gallery (breakouts + built-ins).
    if (flow === 'video' && id === 'source' && v === 'template') { navigate('/templates'); return; }
    const needsPhoto = (flow === 'photo' && id === 'source') || (flow === 'video' && id === 'source' && v === 'photo');
    if (needsPhoto) {
      if (!user) { navigate('/auth'); return; }
      pendingPick.current = { id, v };
      fileRef.current?.click();
      return;
    }
    setSel((s) => ({ ...s, [id]: v })); setStep((n) => n + 1);
  };
  const back = () => { void hapticTap(); if (!flow) return; if (step === 0) setFlow(null); else setStep((n) => n - 1); };
  const submit = () => { if (!def) return; void hapticTap(); navigate(def.route(sel, prompt)); };
  const canSubmit = flow === 'avatar' || prompt.trim().length > 0;

  return (
    <div className="fixed inset-0 text-white">
      <AuroraBackdrop />
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      {uploading && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-black/55">
          <div className="msg-glass flex items-center gap-3 rounded-2xl px-5 py-3.5"><Loader2 className="h-5 w-5 animate-spin text-[#8fb4ff]" /><span className="text-[14px] font-medium">Uploading photo…</span></div>
        </div>
      )}

      {/* faint context above the sheet */}
      {def && (
        <div className="absolute inset-x-0 top-0 z-10 flex flex-col items-center text-white/80" style={{ paddingTop: 'calc(var(--safe-top,0px) + 60px)' }}>
          <def.Icon className="h-10 w-10" strokeWidth={1.4} />
          <div className="mt-2.5 font-mono text-[11px] uppercase tracking-[0.3em] text-white/35">{def.label}</div>
        </div>
      )}

      {/* ── Bottom sheet — the current step ── */}
      <div
        className="absolute inset-x-0 bottom-0 z-20 rounded-t-[30px] bg-[#0d0d14]/85 px-5 pt-3 shadow-[0_-24px_70px_-24px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.08)] backdrop-blur-2xl"
        style={{ paddingBottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px) + 20px)' }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15" />

        <div className="mb-4 flex h-6 items-center justify-between">
          {flow ? (
            <button onClick={back} aria-label="Back" className="text-white/70"><ChevronLeft className="h-6 w-6" /></button>
          ) : <span className="w-6" />}
          {flow && (
            <div className="flex items-center gap-1.5">
              {Array.from({ length: total }).map((_, i) => (
                <span key={i} className={cn('h-1.5 rounded-full transition-all', i === step ? 'w-5 bg-[#8fb4ff]' : i < step ? 'w-1.5 bg-[#8fb4ff]/60' : 'w-1.5 bg-white/15')} />
              ))}
            </div>
          )}
          <span className="w-6" />
        </div>

        <div key={`${flow}-${step}`} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          {!flow ? (
            <Choice q="What do you want to make?" opts={TYPES} cols={3} onPick={(v) => start(v)} />
          ) : !atWriting ? (
            <Choice q={steps[step].q} opts={steps[step].opts} cols={steps[step].opts.length > 4 ? 3 : steps[step].opts.length} onPick={(v) => pick(steps[step].id, v)}
              onSkip={steps[step].skip ? () => pick(steps[step].id, '') : undefined} />
          ) : (
            <Write def={def!} sel={sel} prompt={prompt} setPrompt={setPrompt} canSubmit={canSubmit} onSubmit={submit} onJump={(i) => setStep(i)} />
          )}
        </div>
      </div>
    </div>
  );
}

function Choice({ q, opts, cols, onPick, onSkip }: { q: string; opts: Opt[]; cols: number; onPick: (v: string) => void; onSkip?: () => void }) {
  return (
    <div>
      <h2 className="mb-5 text-center text-[22px] font-light" style={{ fontFamily: 'Fraunces, serif' }}>{q}</h2>
      <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${Math.min(cols, 4)}, minmax(0,1fr))` }}>
        {opts.map((o) => (
          <button key={o.v} onClick={() => onPick(o.v)}
            className="surface-1 flex flex-col items-center gap-2.5 rounded-[18px] py-5 text-white/85 transition-transform active:scale-95">
            <o.icon className="h-[26px] w-[26px]" strokeWidth={1.5} />
            <span className="text-[12.5px] font-medium text-white">{o.label}</span>
          </button>
        ))}
      </div>
      {onSkip && (
        <button onClick={onSkip} className="mx-auto mt-4 block text-[12px] font-light text-white/45">Skip</button>
      )}
    </div>
  );
}

function Write({ def, sel, prompt, setPrompt, canSubmit, onSubmit, onJump }: {
  def: Flow; sel: Record<string, string>; prompt: string; setPrompt: (v: string) => void; canSubmit: boolean; onSubmit: () => void; onJump: (i: number) => void;
}) {
  return (
    <div>
      <div className="mb-4 flex flex-wrap justify-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#8fb4ff]/15 px-3 py-1 text-[11px] font-medium text-[#cdddff]"><def.Icon className="h-3.5 w-3.5" /> {def.label}</span>
        {def.steps.map((s, i) => sel[s.id] ? (
          <button key={s.id} onClick={() => onJump(i)} className="rounded-full bg-white/[0.06] px-3 py-1 text-[11px] font-light text-white/70">
            {def.steps[i].opts.find((o) => o.v === sel[s.id])?.label ?? sel[s.id]}
          </button>
        ) : null)}
      </div>

      <h2 className="mb-3 text-center text-[22px] font-light" style={{ fontFamily: 'Fraunces, serif' }}>{def.writeQ}</h2>

      <div className="surface-2 rounded-[22px] p-1 focus-within:shadow-[inset_0_1px_0_rgba(255,255,255,.12),0_24px_70px_-30px_rgba(60,90,255,.55)]">
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} autoFocus placeholder={def.placeholder}
          className="w-full resize-none bg-transparent px-4 py-3 text-[16px] font-light leading-relaxed text-white outline-none placeholder:text-white/25" style={{ outline: 'none' }} />
      </div>

      <button onClick={onSubmit} disabled={!canSubmit}
        className="mt-4 flex h-[54px] w-full items-center justify-center gap-2.5 rounded-[18px] bg-gradient-to-r from-[#2f6bff] via-[#5a5bff] to-[#7a3bff] text-[15px] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_22px_44px_-12px_rgba(80,80,255,.7)] transition-opacity disabled:opacity-40">
        <Sparkles className="h-[18px] w-[18px]" /> {def.action} <ArrowRight className="h-[17px] w-[17px]" />
      </button>
    </div>
  );
}
