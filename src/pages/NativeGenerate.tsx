/**
 * NativeGenerate — the native create→generate screen. Wraps the real render
 * pipeline (mode-router edge function) in a fully native UI: prompt, engine +
 * quality, length, aspect, narration/music, a live credit estimate, then one
 * tap to start. No web Studio is ever shown — on success we go straight to the
 * native production progress screen.
 *
 * Spend-only safe: generation SPENDS credits (allowed); it never BUYS them.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Sparkles, Loader2, Film, Mic, Music2, Check, Crown, Flame, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveCredits } from '@/hooks/useEffectiveCredits';
import { calculateCreditsForDurations, type VideoEngine } from '@/lib/creditSystem';
import { getTemplateBlueprint } from '@/lib/templates/registry';
import { AuroraBackdrop } from '@/components/native/AuroraBackdrop';
import { hapticTap } from '@/lib/native/shell';
import { cn } from '@/lib/utils';

// `def` = the engine's RECOMMENDED default clip length (matches engines.ts
// defaultDuration). Generating at durations[0] (the minimum) gave Kling/Seedance/
// Veo/Sora users shorter-than-standard clips; default to the recommended length.
interface EngineOpt { token: VideoEngine; name: string; tier: string; def: number; premium?: boolean }
const ENGINE_OPTS: EngineOpt[] = [
  { token: 'wan', name: 'Wan 2.5', tier: 'Free', def: 5 },
  { token: 'kling', name: 'Kling V3', tier: 'Standard', def: 10 },
  { token: 'seedance', name: 'Seedance 2', tier: 'Pro', def: 10, premium: true },
  { token: 'veo', name: 'Veo 3', tier: 'Cinema', def: 6, premium: true },
  { token: 'sora', name: 'Sora 2', tier: 'Cinema', def: 8, premium: true },
];
const ASPECTS = ['9:16', '16:9', '1:1'];

// engines.ts EngineId → the mode-router videoEngine token.
const ENGINE_ID_TO_TOKEN: Record<string, VideoEngine> = {
  'wan-25': 'wan', 'kling-v3': 'kling', 'seedance-2': 'seedance', 'veo-3': 'veo', 'sora-2': 'sora', 'runway-gen4': 'kling',
};

interface TemplateConfig { id: string; name: string; thumbnailUrl: string; prompt: string; engine: VideoEngine; aspect: string; scenes: number; isBreakout: boolean }

/** Build a native generate config from a template blueprint (the SAME registry the
 *  gallery shows). Breakouts force Seedance; their subject is a chosen avatar. */
function templateConfig(id: string): TemplateConfig | null {
  const bp = getTemplateBlueprint(id);
  if (!bp) return null;
  const isBreakout = !!bp.isBreakout;
  const engine: VideoEngine = isBreakout ? 'seedance' : (ENGINE_ID_TO_TOKEN[bp.engine] ?? 'wan');
  const aspect = ASPECTS.includes(bp.aspectRatio) ? bp.aspectRatio : '9:16';
  const scenes = Math.max(1, Math.min(4, bp.clips?.length || 1));
  return { id, name: bp.name, thumbnailUrl: bp.thumbnailUrl, prompt: bp.description, engine, aspect, scenes, isBreakout };
}

interface PickedAvatar { id: string; name: string; image: string; voiceId: string | null }

export default function NativeGenerate() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const effective = useEffectiveCredits();

  const imageUrl = params.get('image') || undefined;
  const tpl = useMemo(() => { const t = params.get('template'); return t ? templateConfig(t) : null; }, [params]);
  const avatarId = params.get('avatar') || undefined;
  const [prompt, setPrompt] = useState(tpl?.prompt ?? params.get('prompt') ?? '');
  const [engine, setEngine] = useState<VideoEngine>(tpl?.engine ?? 'wan');
  const [scenes, setScenes] = useState(tpl?.scenes ?? 1);
  const [aspect, setAspect] = useState(tpl?.aspect ?? (ASPECTS.includes(params.get('aspect') ?? '') ? (params.get('aspect') as string) : '9:16'));
  const [narration, setNarration] = useState(false);
  const [music, setMusic] = useState(true);
  const [busy, setBusy] = useState(false);
  const [avatar, setAvatar] = useState<PickedAvatar | null>(null);

  // Breakout templates need a chosen avatar (the subject who bursts out). Fetch it.
  useEffect(() => {
    if (!avatarId) { setAvatar(null); return; }
    let cancel = false;
    (async () => {
      const { data } = await supabase.from('avatar_templates' as never).select('id, name, face_image_url, front_image_url, voice_id').eq('id', avatarId).maybeSingle();
      const a = data as unknown as { id: string; name: string; face_image_url: string; front_image_url: string | null; voice_id: string | null } | null;
      if (!cancel && a) setAvatar({ id: a.id, name: a.name, image: a.face_image_url || a.front_image_url || '', voiceId: a.voice_id });
    })();
    return () => { cancel = true; };
  }, [avatarId]);

  const needsAvatar = !!tpl?.isBreakout && !avatar;

  const eng = ENGINE_OPTS.find((e) => e.token === engine) ?? ENGINE_OPTS[0];
  const clipDuration = eng.def;
  const durations = useMemo(() => Array.from({ length: scenes }, () => clipDuration), [scenes, clipDuration]);
  const cost = useMemo(() => calculateCreditsForDurations(durations, engine), [durations, engine]);
  const available = effective.available ?? 0;
  const canAfford = available >= cost;

  const generate = async () => {
    void hapticTap();
    if (!user) { toast.error('Sign in to generate'); navigate('/auth'); return; }
    if (needsAvatar) { navigate(`/avatars?template=${encodeURIComponent(tpl!.id)}`); return; }
    if (!prompt.trim()) { toast.error('Describe your film first'); return; }
    if (!canAfford) { toast.error(`Need ${cost} credits — you have ${available}.`); return; }
    setBusy(true);
    try {
      // Breakout template: mode:avatar + isBreakout + Seedance, the avatar bursts
      // out (breakoutPlatform = the template id, the format the pipeline expects).
      const breakout = tpl?.isBreakout && avatar;
      const body: Record<string, unknown> = breakout
        ? {
            mode: 'avatar', userId: user.id, requireApproval: false,
            prompt: prompt.trim(), aspectRatio: aspect,
            clipCount: scenes, clipDuration, clipDurations: durations,
            enableNarration: narration, enableMusic: music, videoEngine: 'seedance',
            isBreakout: true, breakoutPlatform: tpl!.id, breakoutStartImageUrl: avatar!.image,
            avatarImageUrl: avatar!.image, avatarName: avatar!.name, avatarTemplateId: avatar!.id, avatarVoiceId: avatar!.voiceId,
            templateName: tpl!.name, qualityOptions: {},
          }
        : {
            mode: imageUrl ? 'image-to-video' : 'text-to-video', userId: user.id, requireApproval: false,
            prompt: prompt.trim(), imageUrl, aspectRatio: aspect,
            clipCount: scenes, clipDuration, clipDurations: durations,
            enableNarration: narration, enableMusic: music, videoEngine: engine,
            ...(tpl ? { templateName: tpl.name } : {}),
            qualityOptions: {},
          };
      const { data, error } = await supabase.functions.invoke('mode-router', { body });
      if (error || (data && data.error)) throw new Error((data && data.error) || error?.message || 'Generation failed');
      if (!data?.projectId) throw new Error('No project returned');
      toast.success('Generation started');
      navigate(`/production/${data.projectId}`, { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Generation failed');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 overflow-y-auto text-white">
      <AuroraBackdrop />
      <div className="relative z-10 flex items-center gap-3 px-4 pb-1" style={{ paddingTop: 'calc(var(--safe-top,0px) + 12px)' }}>
        <button onClick={() => navigate(-1)} aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.06] backdrop-blur-md"><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="font-display text-[20px] font-semibold">{tpl ? 'Use template' : 'New film'}</h1>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[#8fb4ff]/15 px-3 py-1 font-mono text-[11px] font-semibold text-[#8fb4ff]"><Sparkles className="h-3 w-3" />{available.toLocaleString()}</span>
      </div>

      <div className="relative z-10 px-4" style={{ paddingBottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px) + 120px)' }}>
        {/* Template banner */}
        {tpl && (
          <div className="lit-edge mt-3 flex items-center gap-3 overflow-hidden rounded-[18px] bg-white/[0.04] p-2.5">
            <img src={tpl.thumbnailUrl} alt={tpl.name} className="h-14 w-14 shrink-0 rounded-[12px] object-cover" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">{tpl.isBreakout && <Flame className="h-3.5 w-3.5 text-[#ff8a3b]" />}<span className="truncate font-display text-[14.5px] font-semibold">{tpl.name}</span></div>
              <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-white/45">{tpl.isBreakout ? `Breakout · Seedance` : `Template · ${eng.name}`}</div>
            </div>
          </div>
        )}

        {/* Breakout: pick the star who bursts out */}
        {tpl?.isBreakout && (
          <>
            <Label>Your star</Label>
            {avatar ? (
              <div className="flex items-center gap-3 rounded-[16px] msg-glass px-3 py-2.5">
                {avatar.image ? <img src={avatar.image} alt={avatar.name} className="h-11 w-11 rounded-full object-cover" /> : <span className="grid h-11 w-11 place-items-center rounded-full bg-white/10 font-display font-bold">{avatar.name.charAt(0)}</span>}
                <span className="flex-1 truncate text-[14px] font-semibold">{avatar.name}</span>
                <button onClick={() => { void hapticTap(); navigate(`/avatars?template=${encodeURIComponent(tpl.id)}`); }} className="rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white/80">Change</button>
              </div>
            ) : (
              <button onClick={() => { void hapticTap(); navigate(`/avatars?template=${encodeURIComponent(tpl.id)}`); }} className="flex w-full items-center gap-3 rounded-[16px] msg-glass-accent px-4 py-3.5 text-left">
                <UserPlus className="h-[20px] w-[20px]" />
                <span className="flex-1"><span className="block text-[14.5px] font-semibold">Pick your star</span><span className="text-[12px] text-white/60">A breakout needs an avatar to burst out</span></span>
              </button>
            )}
          </>
        )}

        {/* Prompt */}
        <Label>{tpl?.isBreakout ? 'What they say (optional)' : 'Describe'}</Label>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} placeholder="Describe your film…" className="surface-1 w-full resize-none rounded-[18px] bg-transparent px-4 py-3.5 text-[16px] leading-relaxed text-white outline-none placeholder:text-white/30" />
        {imageUrl && <div className="mt-2 flex items-center gap-2 text-[12px] text-white/45"><Film className="h-3.5 w-3.5" /> Animating your photo</div>}

        {/* Engine — hidden for breakouts (Seedance-locked) */}
        {!tpl?.isBreakout && (<>
        <Label>Engine</Label>
        <div className="grid grid-cols-2 gap-2.5">
          {ENGINE_OPTS.map((e) => {
            const on = e.token === engine;
            const c = calculateCreditsForDurations(Array.from({ length: scenes }, () => e.def), e.token);
            return (
              <button key={e.token} onClick={() => { void hapticTap(); setEngine(e.token); }} className={cn('relative rounded-[16px] p-3 text-left transition-all', on ? 'msg-glass-accent' : 'msg-glass')}>
                <div className="flex items-center gap-1.5"><span className="font-display text-[14px] font-bold">{e.name}</span>{e.premium && <Crown className="h-3 w-3 text-[#ffd76b]" />}</div>
                <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-white/45">{e.tier}</div>
                <div className="mt-1.5 font-mono text-[11px] text-[#8fb4ff]">{c === 0 ? 'Free' : `${c} cr`}</div>
                {on && <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-[#3f78ff]"><Check className="h-3 w-3" strokeWidth={3} /></span>}
              </button>
            );
          })}
        </div>
        </>)}

        {/* Length */}
        <Label>Scenes · {scenes} × {clipDuration}s = {scenes * clipDuration}s</Label>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((n) => <Pill key={n} label={`${n}`} on={scenes === n} onClick={() => setScenes(n)} />)}
        </div>

        {/* Aspect */}
        <Label>Aspect</Label>
        <div className="flex gap-2">
          {ASPECTS.map((a) => <Pill key={a} label={a} on={aspect === a} onClick={() => setAspect(a)} />)}
        </div>

        {/* Toggles */}
        <Label>Audio</Label>
        <div className="space-y-2">
          <Toggle icon={Mic} label="Narration" on={narration} onClick={() => setNarration((v) => !v)} />
          <Toggle icon={Music2} label="Music" on={music} onClick={() => setMusic((v) => !v)} />
        </div>
      </div>

      {/* Generate — icon button (cost carried in the caption) */}
      <div className="fixed inset-x-0 z-20 flex flex-col items-center" style={{ bottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px) + 16px)' }}>
        <button onClick={generate} disabled={busy || (!needsAvatar && (!canAfford || (!tpl && !prompt.trim())))} aria-label={needsAvatar ? 'Pick your star' : 'Generate'}
          className="grid h-[68px] w-[68px] place-items-center rounded-full text-[#9fc6ff] drop-shadow-[0_3px_12px_rgba(0,0,0,.6)] transition-transform active:scale-90 disabled:opacity-40">
          {busy ? <Loader2 className="h-7 w-7 animate-spin" /> : needsAvatar ? <UserPlus className="h-7 w-7" /> : <Sparkles className="h-7 w-7" />}
        </button>
        <span className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/55">{busy ? 'Starting…' : needsAvatar ? 'Pick your star' : canAfford ? `Generate · ${cost === 0 ? 'Free' : `${cost} cr`}` : `Need ${cost} cr`}</span>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">{children}</div>;
}
function Pill({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return <button onClick={() => { void hapticTap(); onClick(); }} className={cn('h-10 min-w-[52px] rounded-full px-4 text-[14px] font-semibold transition-colors', on ? 'msg-glass-accent text-white' : 'msg-glass text-white/55')}>{label}</button>;
}
function Toggle({ icon: Icon, label, on, onClick }: { icon: typeof Mic; label: string; on: boolean; onClick: () => void }) {
  return (
    <button onClick={() => { void hapticTap(); onClick(); }} className={cn('flex w-full items-center gap-3 rounded-[16px] px-4 py-3 transition-colors', on ? 'msg-glass-accent' : 'msg-glass')}>
      <Icon className="h-[18px] w-[18px] text-white/70" />
      <span className="flex-1 text-left text-[14.5px] font-medium">{label}</span>
      <span className={cn('relative h-6 w-10 rounded-full transition-colors', on ? 'bg-[#3f78ff]' : 'bg-white/15')}><span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all', on ? 'left-[18px]' : 'left-0.5')} /></span>
    </button>
  );
}
