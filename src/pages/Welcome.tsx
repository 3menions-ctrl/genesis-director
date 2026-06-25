/**
 * Welcome — first-run onboarding for the native app (route /welcome).
 *
 * Three cinematic steps over the Aurora backdrop: a hero with a floating
 * film-poster fan, "what you love" (interests → profiles.interests), and "what
 * you want to make". Finishing marks onboarding_completed and drops the user
 * into the Feed. Premium, borderless/floating glass + film grain + motion.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Sparkles, ArrowRight, ChevronLeft, Check, Play,
  Rocket, Moon, Wand2, Music, Laugh, Zap, Heart, Leaf, Ghost, Film,
  Clapperboard, Image as ImageIcon, UserRound, type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AuroraBackdrop, GrainOverlay } from '@/components/native/AuroraBackdrop';
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

const POSTERS = [
  { g: 'linear-gradient(160deg,#c98a6a,#3a2d6b)', r: -11, x: -78, d: 0 },
  { g: 'linear-gradient(160deg,#2f6bff,#120a24)', r: 9, x: 78, d: 0.8 },
  { g: 'linear-gradient(160deg,#7a3bff,#0c1230)', r: -1, x: 0, d: 1.6 },
];

export default function Welcome() {
  const navigate = useNavigate();
  const { user, profile, patchProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [interests, setInterests] = useState<Set<string>>(new Set());
  const [make, setMake] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const name = profile?.display_name || user?.email?.split('@')[0] || 'creator';
  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, v: string) => {
    void hapticTap();
    const n = new Set(set); n.has(v) ? n.delete(v) : n.add(v); setter(n);
  };

  const finish = async () => {
    void hapticTap();
    setSaving(true);
    try { patchProfile?.({ onboarding_completed: true }); } catch { /* ignore */ }
    if (user) {
      try { await supabase.from('profiles' as never).update({ onboarding_completed: true, interests: [...interests] } as never).eq('id', user.id); } catch { /* best-effort */ }
    }
    navigate('/feed', { replace: true });
  };

  const next = () => { void hapticTap(); if (step < 2) setStep(step + 1); else void finish(); };
  const back = () => { void hapticTap(); if (step > 0) setStep(step - 1); };

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden text-white">
      <AuroraBackdrop />
      {/* extra ambient bloom + grain for depth */}
      <div className="pointer-events-none absolute left-1/2 top-[12%] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[#5a5bff]/20 blur-[110px]" />
      <GrainOverlay />

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-5" style={{ paddingTop: 'calc(var(--safe-top,0px) + 14px)' }}>
        {step > 0 ? <button onClick={back} aria-label="Back" className="text-white/70"><ChevronLeft className="h-6 w-6" /></button> : <span className="w-6" />}
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => <span key={i} className={cn('h-1.5 rounded-full transition-all duration-300', i === step ? 'w-6 bg-[#8fb4ff] shadow-[0_0_10px_rgba(143,180,255,.8)]' : i < step ? 'w-1.5 bg-[#8fb4ff]/60' : 'w-1.5 bg-white/15')} />)}
        </div>
        <button onClick={finish} className="text-[12.5px] font-medium text-white/45">Skip</button>
      </div>

      <div key={step} className="relative z-10 flex flex-1 flex-col px-7 pt-4" style={{ paddingBottom: 'calc(var(--safe-bottom,0px) + 24px)' }}>
        {step === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            {/* Floating film-poster fan */}
            <div className="relative mb-14 h-[188px] w-full">
              <div className="pointer-events-none absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#7a3bff]/30 blur-3xl" />
              {POSTERS.map((p, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, y: 26, rotate: p.r * 0.5 }}
                  animate={{ opacity: 1, y: [0, -10, 0], rotate: p.r }}
                  transition={{ opacity: { duration: 0.5, delay: 0.1 + i * 0.08 }, rotate: { duration: 0.5, delay: 0.1 + i * 0.08 }, y: { duration: 5 + i, repeat: Infinity, ease: 'easeInOut', delay: p.d } }}
                  className="lit-edge absolute left-1/2 top-1/2 h-[166px] w-[114px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[20px]"
                  style={{ background: p.g, marginLeft: p.x, zIndex: i === 2 ? 10 : i, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.18), 0 30px 60px -24px rgba(0,0,0,.8)' }}>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
                  {i === 2 && <span className="absolute bottom-3 left-1/2 grid h-9 w-9 -translate-x-1/2 place-items-center rounded-full bg-white/15 backdrop-blur-md"><Play className="h-4 w-4 fill-white" /></span>}
                </motion.div>
              ))}
            </div>

            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5 }} className="relative z-20 flex flex-col items-center">
              <span className="msg-glass-accent mb-5 inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-white/90"><Sparkles className="h-3 w-3" /> Small Bridges</span>
              <h1 className="text-[36px] font-light leading-[1.05]" style={{ fontFamily: 'Fraunces, serif' }}>Welcome,<br /><span className="italic">{name}.</span></h1>
              <p className="mt-4 max-w-[300px] text-[15px] leading-relaxed text-white/60">You're one line away from your first film. Let's tune your feed in two quick taps.</p>
            </motion.div>
          </div>
        )}

        {step === 1 && (
          <Step kicker="Step 1 · Your taste" title="What do you love?" sub="Pick a few — we'll shape your feed around them.">
            <div className="grid grid-cols-3 gap-2.5">
              {INTERESTS.map((c, i) => <ChipTile key={c.v} chip={c} on={interests.has(c.v)} delay={i * 0.03} onClick={() => toggle(interests, setInterests, c.v)} />)}
            </div>
          </Step>
        )}

        {step === 2 && (
          <Step kicker="Step 2 · Your craft" title="What will you make?" sub="So we can put the right tools up front.">
            <div className="grid grid-cols-2 gap-3">
              {MAKE.map((c, i) => <ChipTile key={c.v} chip={c} on={make.has(c.v)} big delay={i * 0.05} onClick={() => toggle(make, setMake, c.v)} />)}
            </div>
          </Step>
        )}

        {/* CTA — icon in a translucent container, with a label beneath */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.5 }} className="mt-6 flex flex-col items-center gap-2.5">
          <button onClick={next} disabled={saving} aria-label={step === 0 ? 'Get started' : step === 1 ? 'Continue' : 'Start creating'}
            className="msg-glass-accent grid h-[62px] w-[62px] place-items-center rounded-full text-white transition-transform active:scale-95 disabled:opacity-50">
            {step === 2 ? <Check className="h-7 w-7" strokeWidth={2.4} /> : <ArrowRight className="h-7 w-7" strokeWidth={2.2} />}
          </button>
          <span className="font-display text-[12.5px] font-semibold tracking-wide text-white/75">{step === 0 ? 'Get started' : step === 1 ? 'Continue' : 'Start creating'}</span>
        </motion.div>
      </div>
    </div>
  );
}

function Step({ kicker, title, sub, children }: { kicker: string; title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col pt-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.24em] text-[#8fb4ff]">{kicker}</div>
        <h1 className="text-[28px] font-light leading-tight" style={{ fontFamily: 'Fraunces, serif' }}>{title}</h1>
        <p className="mt-1.5 text-[14px] text-white/55">{sub}</p>
      </motion.div>
      <div className="mt-7">{children}</div>
    </div>
  );
}

function ChipTile({ chip, on, big, delay, onClick }: { chip: Chip; on: boolean; big?: boolean; delay: number; onClick: () => void }) {
  return (
    <motion.button initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 + delay, duration: 0.3 }}
      onClick={onClick}
      className={cn('relative flex flex-col items-center justify-center gap-2 rounded-2xl transition-all active:scale-95', big ? 'py-7' : 'py-[18px]', on ? 'msg-glass-accent text-white' : 'msg-glass text-white/80')}
      style={on ? { boxShadow: 'inset 0 1px 0 rgba(255,255,255,.3), inset 0 0 0 1px rgba(255,255,255,.1), 0 0 34px -6px rgba(86,96,255,.65)' } : undefined}>
      <chip.icon className={cn(big ? 'h-7 w-7' : 'h-[22px] w-[22px]')} strokeWidth={1.8} />
      <span className={cn('font-medium', big ? 'text-[13.5px]' : 'text-[12px]')}>{chip.label}</span>
      {on && <span className="absolute right-1.5 top-1.5 grid h-4 w-4 place-items-center rounded-full bg-[#8fb4ff] text-[#0a0a0f]"><Check className="h-2.5 w-2.5" strokeWidth={3.5} /></span>}
    </motion.button>
  );
}
