/**
 * AvatarLibrary — the native avatar casting vault. Browse the 500+
 * avatar_templates (search + type/gender filters), open an avatar's identity
 * bible, hear its voice sample, and "Use" it → a script composer that hands off
 * to the Studio avatar pipeline. Spend-only safe (handoff only; render is server
 * side). Premium/floating glass over the Aurora backdrop.
 */
import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, ChevronLeft, Play, Pause, Sparkles, Crown, ArrowRight, Loader2, Mic } from 'lucide-react';
import { useAvatarTemplatesQuery } from '@/hooks/useAvatarTemplatesQuery';
import type { AvatarTemplate } from '@/types/avatar-templates';
import { AuroraBackdrop } from '@/components/native/AuroraBackdrop';
import { hapticTap } from '@/lib/native/shell';
import { cn } from '@/lib/utils';

const enc = encodeURIComponent;
const TYPES = [{ v: 'all', label: 'All' }, { v: 'realistic', label: 'Realistic' }, { v: 'animated', label: 'Animated' }] as const;
const GENDERS = [{ v: 'all', label: 'All' }, { v: 'female', label: 'Women' }, { v: 'male', label: 'Men' }] as const;

export default function AvatarLibrary() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [type, setType] = useState<string>('all');
  const [gender, setGender] = useState<string>('all');
  const [open, setOpen] = useState<AvatarTemplate | null>(null);

  const filter = useMemo(() => ({ search: search.trim() || undefined, avatarType: type === 'all' ? undefined : type, gender: gender === 'all' ? undefined : gender }), [search, type, gender]);
  const { templates, isLoading } = useAvatarTemplatesQuery(filter, { includePlaceholders: false });

  return (
    <div className="fixed inset-0 overflow-y-auto text-white">
      <AuroraBackdrop />

      <div className="relative z-10 flex items-center gap-3 px-4 pb-2" style={{ paddingTop: 'calc(var(--safe-top,0px) + 12px)' }}>
        <button onClick={() => navigate(-1)} aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.06] backdrop-blur-md"><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="font-display text-[20px] font-semibold">Avatars</h1>
        <span className="ml-auto font-mono text-[11px] text-white/35">{templates.length}</span>
      </div>

      <div className="relative z-10 px-4" style={{ paddingBottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px) + 24px)' }}>
        {/* Search */}
        <div className="surface-1 flex h-12 items-center gap-2.5 rounded-full px-4">
          <Search className="h-[18px] w-[18px] text-white/50" strokeWidth={1.8} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search presenters & voices" className="flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/35" />
          {search && <button onClick={() => setSearch('')} aria-label="Clear" className="text-white/40"><X className="h-[18px] w-[18px]" /></button>}
        </div>

        {/* Filters */}
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {TYPES.map((t) => <Chip key={t.v} label={t.label} on={type === t.v} onClick={() => { void hapticTap(); setType(t.v); }} />)}
          <span className="my-1 w-px shrink-0 bg-white/10" />
          {GENDERS.map((g) => <Chip key={g.v} label={g.label} on={gender === g.v} onClick={() => { void hapticTap(); setGender(g.v); }} />)}
        </div>

        {/* Grid */}
        <div className="mt-4">
          {isLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-white/40" /></div>
          ) : templates.length === 0 ? (
            <div className="py-20 text-center text-[13px] text-white/40">No avatars match.</div>
          ) : (
            <div className="grid grid-cols-3 gap-2.5">
              {templates.map((a) => (
                <button key={a.id} onClick={() => { void hapticTap(); setOpen(a); }} className="lit-edge relative aspect-[3/4] overflow-hidden rounded-[14px] bg-black/30">
                  <img src={a.face_image_url} alt={a.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />
                  <span className="absolute inset-x-0 bottom-0 truncate px-2 py-1.5 text-left font-display text-[11.5px] font-semibold drop-shadow">{a.name}</span>
                  {a.is_premium && <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-black/45 text-[#ffd76b] backdrop-blur-md"><Crown className="h-3 w-3" /></span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {open && <AvatarDetail avatar={open} onClose={() => setOpen(null)} onUse={(script) => navigate(`/studio?tab=create&prompt=${enc(script)}&avatar=${enc(open.id)}`)} />}
    </div>
  );
}

function Chip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn('h-9 shrink-0 rounded-full px-4 text-[13px] font-semibold transition-colors', on ? 'msg-glass-accent text-white' : 'msg-glass text-white/55')}>{label}</button>
  );
}

function AvatarDetail({ avatar, onClose, onUse }: { avatar: AvatarTemplate; onClose: () => void; onUse: (script: string) => void }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [script, setScript] = useState('');

  const toggleVoice = () => {
    void hapticTap();
    const el = audioRef.current; if (!el) return;
    if (playing) { el.pause(); setPlaying(false); } else { el.currentTime = 0; void el.play().then(() => setPlaying(true)).catch(() => setPlaying(false)); }
  };

  const meta = [avatar.age_range, avatar.ethnicity, avatar.style].filter(Boolean).join(' · ');

  return (
    <div className="fixed inset-0 z-[60]">
      <div onClick={onClose} className="absolute inset-0 bg-black/55" />
      <div className="absolute inset-x-0 bottom-0 max-h-[88%] overflow-y-auto rounded-t-[28px] bg-[#0d0d14]/92 backdrop-blur-2xl shadow-[0_-24px_70px_-24px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.08)]" style={{ paddingBottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px) + 16px)' }}>
        <div className="mx-auto mb-2 mt-3 h-1 w-10 rounded-full bg-white/15" />
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 z-10 grid h-8 w-8 place-items-center rounded-full bg-black/40 text-white/60"><X className="h-4 w-4" /></button>

        {/* Hero */}
        <div className="relative mx-4 mt-1 overflow-hidden rounded-[22px]">
          <img src={avatar.front_image_url || avatar.face_image_url} alt={avatar.name} className="block max-h-[44vh] w-full object-cover" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-4">
            <div className="flex items-center gap-2"><h2 className="font-display text-[24px] font-bold leading-tight">{avatar.name}</h2>{avatar.is_premium && <Crown className="h-4 w-4 text-[#ffd76b]" />}</div>
            {meta && <div className="mt-0.5 text-[12.5px] capitalize text-white/65">{meta}</div>}
          </div>
        </div>

        <div className="px-5">
          {/* Voice */}
          <button onClick={toggleVoice} disabled={!avatar.sample_audio_url} className="msg-glass mt-4 flex w-full items-center gap-3 rounded-[18px] px-4 py-3 text-left disabled:opacity-50">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#8fb4ff]/20 text-[#8fb4ff]">{playing ? <Pause className="h-[18px] w-[18px]" /> : <Play className="h-[18px] w-[18px] fill-current" />}</span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-[14px] font-semibold"><Mic className="h-3.5 w-3.5 text-white/50" />{avatar.voice_name || 'Voice'}</span>
              {avatar.voice_description && <span className="block truncate text-[12px] text-white/45">{avatar.voice_description}</span>}
            </span>
            {avatar.sample_audio_url ? <span className="font-mono text-[10px] uppercase tracking-wide text-white/40">{playing ? 'Playing' : 'Sample'}</span> : <span className="font-mono text-[10px] text-white/30">No sample</span>}
          </button>
          <audio ref={audioRef} src={avatar.sample_audio_url ?? undefined} onEnded={() => setPlaying(false)} className="hidden" />

          {/* Identity */}
          {avatar.personality && (
            <div className="mt-4">
              <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">Personality</div>
              <p className="text-[13.5px] leading-relaxed text-white/75">{avatar.personality}</p>
            </div>
          )}
          {avatar.description && <p className="mt-3 text-[13px] leading-relaxed text-white/55">{avatar.description}</p>}
          {avatar.tags && avatar.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">{avatar.tags.slice(0, 8).map((t) => <span key={t} className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] text-white/55">{t}</span>)}</div>
          )}

          {/* Script + use */}
          <div className="mt-5">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#8fb4ff]">What do they say?</div>
            <textarea value={script} onChange={(e) => setScript(e.target.value)} rows={3} placeholder={`Write a line for ${avatar.name}…`} className="surface-1 w-full resize-none rounded-[18px] bg-transparent px-4 py-3 text-[15px] text-white outline-none placeholder:text-white/30" />
          </div>
          <button onClick={() => { if (!script.trim()) return; void hapticTap(); onUse(script.trim()); }} disabled={!script.trim()}
            className="mt-4 flex h-[54px] w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-[#2f6bff] via-[#5a5bff] to-[#7a3bff] text-[15px] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_20px_44px_-14px_rgba(80,80,255,.7)] transition-opacity disabled:opacity-40">
            <Sparkles className="h-[18px] w-[18px]" /> Use {avatar.name} <ArrowRight className="h-[17px] w-[17px]" />
          </button>
        </div>
      </div>
    </div>
  );
}
