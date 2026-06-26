/**
 * MobileSettings — a full-page settings screen (not a sheet). Borderless,
 * floating glass rows over the Aurora backdrop. Groups Account / App, plus
 * sign out. Deeper screens link to the existing web surfaces for now.
 */
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, CreditCard, UserRound, Bell, ShieldCheck, HelpCircle, LogOut, Pencil, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { AuroraBackdrop } from '@/components/native/AuroraBackdrop';
import { hapticTap } from '@/lib/native/shell';
import { cn } from '@/lib/utils';

export default function MobileSettings() {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { available } = useCredits();

  const name = profile?.display_name || profile?.full_name || user?.email?.split('@')[0] || 'You';
  const go = (to: string) => { void hapticTap(); navigate(to); };
  const out = async () => { void hapticTap(); await signOut(); navigate('/feed'); };

  return (
    <div className="fixed inset-0 overflow-y-auto text-white">
      <AuroraBackdrop />

      <div className="relative z-10 flex items-center gap-3 px-4 pb-2" style={{ paddingTop: 'calc(var(--safe-top,0px) + 12px)' }}>
        <button onClick={() => navigate(-1)} aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.06] backdrop-blur-md"><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="font-display text-[20px] font-semibold">Settings</h1>
      </div>

      <div className="relative z-10 px-4" style={{ paddingBottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px) + 28px)' }}>
        {/* Identity */}
        <button onClick={() => go('/you')} className="msg-glass mt-3 flex w-full items-center gap-3 rounded-[20px] px-4 py-3.5 text-left transition-transform active:scale-[0.99]">
          {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" /> : <span className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-[#9c8bff] to-[#6b3bff] font-display text-lg font-bold">{name[0]?.toUpperCase()}</span>}
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-[16px] font-semibold">{name}</div>
            <div className="truncate text-[12.5px] text-white/45">{user?.email ?? 'Tap to edit profile'}</div>
          </div>
          <Pencil className="h-[18px] w-[18px] text-white/40" />
        </button>

        <Group label="Account">
          <Row icon={CreditCard} label="Credits & billing" hint={`◇ ${available}`} onClick={() => go('/account?tab=credits')} />
          <Row icon={UserRound} label="Account & data" onClick={() => go('/me/settings/account')} />
        </Group>

        <Group label="App">
          <Row icon={Bell} label="Notifications" onClick={() => go('/me/settings/notifications')} />
          <Row icon={ShieldCheck} label="Privacy & messaging" onClick={() => go('/me/settings/privacy')} />
          <Row icon={HelpCircle} label="Help & about" onClick={() => go('/settings')} />
        </Group>

        <div className="mt-7">
          <button onClick={out} className="msg-glass flex w-full items-center gap-3 rounded-[20px] px-4 py-3.5 text-left text-[#ff6b6b] transition-transform active:scale-[0.99]">
            <LogOut className="h-[19px] w-[19px]" strokeWidth={1.8} />
            <span className="flex-1 font-display text-[15px] font-semibold">Sign out</span>
          </button>
        </div>

        <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-white/25">Small Bridges · iOS</p>
      </div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-7">
      <div className="mb-2.5 px-1 font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">{label}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ icon: Icon, label, hint, onClick }: { icon: LucideIcon; label: string; hint?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn('msg-glass flex w-full items-center gap-3 rounded-[18px] px-4 py-3.5 text-left text-white/90 transition-transform active:scale-[0.99]')}>
      <Icon className="h-[19px] w-[19px] text-white/70" strokeWidth={1.7} />
      <span className="flex-1 text-[14.5px]">{label}</span>
      {hint && <span className="font-mono text-[12px] text-[#8fb4ff]">{hint}</span>}
      <ChevronRight className="h-4 w-4 text-white/30" />
    </button>
  );
}
