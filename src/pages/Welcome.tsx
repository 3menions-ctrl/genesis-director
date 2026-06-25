/**
 * Welcome — first-run onboarding for the native app (route /welcome).
 *
 * Three light steps: a hero, "what you love" (interests → profiles.interests),
 * and "what you want to make". Finishing marks onboarding_completed and drops
 * the user into the Feed. Premium, borderless/floating glass over the Aurora
 * backdrop. Reached automatically for new users (see the gate in App.tsx).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, ArrowRight, ChevronLeft, Check,
  Rocket, Moon, Wand2, Music, Laugh, Zap, Heart, Leaf, Ghost, Film,
  Clapperboard, Image as ImageIcon, UserRound, type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AuroraBackdrop } from '@/components/native/AuroraBackdrop';
import { hapticTap } from '@/lib/native/shell';
import { cn } from '@/lib/utils';

interface Chip { v: string; label: string; icon: LucideIcon }

const INTERESTS: Chip[] = [
  { v: 'scifi', label: 'Sci-Fi', icon: Rocket }, { v: 'noir', label: 'Noir', icon: Moon },
  { v: 'anime', label: 'Anime', icon: Sparkles }, { v: 'fantasy', label: 'Fantasy', icon: Wand2 },
  { v: 'music', label: 'Music', icon: Music }, { v: 'comedy', label: 'Comedy', icon: Laugh },
  { v: 'action', label: 'Action', icon: Zap }, { v: 'romance', label: 'Romance', icon: Heart },
  { v: 'nature', label: 'Nature', icon: Leaf }, { v: 'horror', label: 'Horror', icon: Ghost },
  { v: 'cinematic', label: 'Cinematic', icon: Film },
];

const MAKE: Chip[] = [
  { v: 'video', label: 'Videos', icon: Clapperboard }, { v: 'avatar', label: 'Avatars', icon: UserRound },
  { v: 'music', label: 'Music', icon: Music }, { v: 'image', label: 'Images', icon: ImageIcon },
];

export default function Welcome() {
  const navigate = useNavigate();
  const { user, profile, patchProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [interests, setInterests] = useState<Set<string>>(new Set());
  const [make, setMake] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const name = profile?.display_name || user?.email?.split('@')[0] || 'director';
  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, v: string) => {
    void hapticTap();
    const next = new Set(set);
    next.has(v) ? next.delete(v) : next.add(v);
    setter(next);
  };

  const finish = async () => {
    void hapticTap();
    setSaving(true);
    try { patchProfile?.({ onboarding_completed: true }); } catch { /* ignore */ }
    if (user) {
      try {
        await supabase.from('profiles' as never).update({ onboarding_completed: true, interests: [...interests] } as never).eq('id', user.id);
      } catch { /* best-effort */ }
    }
    navigate('/feed', { replace: true });
  };

  const next = () => { void hapticTap(); if (step < 2) setStep(step + 1); else void finish(); };
  const back = () => { void hapticTap(); if (step > 0) setStep(step - 1); };

  return (
    <div className="fixed inset-0 flex flex-col text-white">
      <AuroraBackdrop />

      {/* Top bar: back + progress + skip */}
      <div className="relative z-10 flex items-center justify-between px-5" style={{ paddingTop: 'calc(var(--safe-top,0px) + 14px)' }}>
        {step > 0 ? <button onClick={back} aria-label="Back" className="text-white/70"><ChevronLeft className="h-6 w-6" /></button> : <span className="w-6" />}
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => <span key={i} className={cn('h-1.5 rounded-full transition-all', i === step ? 'w-5 bg-[#8fb4ff]' : i < step ? 'w-1.5 bg-[#8fb4ff]/60' : 'w-1.5 bg-white/15')} />)}
        </div>
        <button onClick={finish} className="text-[12.5px] font-medium text-white/45">Skip</button>
      </div>

      <div key={step} className="relative z-10 flex flex-1 flex-col px-7 pt-6 animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ paddingBottom: 'calc(var(--safe-bottom,0px) + 24px)' }}>
        {step === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="msg-glass-accent grid h-16 w-16 place-items-center rounded-3xl"><Sparkles className="h-8 w-8 text-white" /></div>
            <h1 className="mt-6 text-[34px] font-light leading-tight" style={{ fontFamily: 'Fraunces, serif' }}>Welcome,<br />{name}.</h1>
            <p className="mt-3 max-w-[300px] text-[15px] leading-relaxed text-white/60">You're one line away from your first film. Let's tune your feed in two quick taps.</p>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-1 flex-col">
            <h1 className="text-[27px] font-light leading-tight" style={{ fontFamily: 'Fraunces, serif' }}>What do you love?</h1>
            <p className="mt-1.5 text-[14px] text-white/55">Pick a few — we'll shape your feed around them.</p>
            <div className="mt-6 grid grid-cols-3 gap-2.5">
              {INTERESTS.map((c) => <ChipTile key={c.v} chip={c} on={interests.has(c.v)} onClick={() => toggle(interests, setInterests, c.v)} />)}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-1 flex-col">
            <h1 className="text-[27px] font-light leading-tight" style={{ fontFamily: 'Fraunces, serif' }}>What will you make?</h1>
            <p className="mt-1.5 text-[14px] text-white/55">So we can put the right tools up front.</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {MAKE.map((c) => <ChipTile key={c.v} chip={c} on={make.has(c.v)} big onClick={() => toggle(make, setMake, c.v)} />)}
            </div>
          </div>
        )}

        {/* CTA */}
        <button onClick={next} disabled={saving}
          className="mt-6 flex h-[54px] w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-[#2f6bff] via-[#5a5bff] to-[#7a3bff] text-[15.5px] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_20px_44px_-14px_rgba(80,80,255,.7)] transition-opacity disabled:opacity-50">
          {step === 0 ? 'Get started' : step === 1 ? 'Continue' : "Start creating"}
          {step === 2 ? <Check className="h-[18px] w-[18px]" /> : <ArrowRight className="h-[18px] w-[18px]" />}
        </button>
      </div>
    </div>
  );
}

function ChipTile({ chip, on, big, onClick }: { chip: Chip; on: boolean; big?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn('relative flex flex-col items-center justify-center gap-2 rounded-2xl transition-transform active:scale-95', big ? 'py-6' : 'py-4', on ? 'msg-glass-accent text-white' : 'msg-glass text-white/80')}>
      <chip.icon className={cn(big ? 'h-7 w-7' : 'h-[22px] w-[22px]')} strokeWidth={1.8} />
      <span className={cn('font-medium', big ? 'text-[13.5px]' : 'text-[12px]')}>{chip.label}</span>
      {on && <span className="absolute right-1.5 top-1.5 grid h-4 w-4 place-items-center rounded-full bg-[#8fb4ff] text-[#0a0a0f]"><Check className="h-2.5 w-2.5" strokeWidth={3.5} /></span>}
    </button>
  );
}
