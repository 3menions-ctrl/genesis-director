/**
 * Settings kit — shared scaffold + controls for the native settings sub-pages
 * (Notifications, Privacy, Account). Borderless/floating glass over Aurora.
 */
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { AuroraBackdrop } from '@/components/native/AuroraBackdrop';
import { hapticTap } from '@/lib/native/shell';
import { cn } from '@/lib/utils';

export function SettingsScaffold({ title, children }: { title: string; children: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="fixed inset-0 overflow-y-auto text-white">
      <AuroraBackdrop />
      <div className="relative z-10 flex items-center gap-3 px-4 pb-2" style={{ paddingTop: 'calc(var(--safe-top,0px) + 12px)' }}>
        <button onClick={() => navigate(-1)} aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.06] backdrop-blur-md"><ChevronLeft className="h-[18px] w-[18px]" /></button>
        <h1 className="font-display text-[20px] font-semibold">{title}</h1>
      </div>
      <div className="relative z-10 px-4" style={{ paddingBottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px) + 28px)' }}>{children}</div>
    </div>
  );
}

export function Group({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      {label && <div className="mb-2.5 px-1 font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">{label}</div>}
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => { void hapticTap(); onChange(!on); }} aria-pressed={on}
      className={cn('relative h-[28px] w-[48px] shrink-0 rounded-full transition-colors', on ? 'bg-[#2f6bff]' : 'bg-white/[0.14]')}>
      <span className={cn('absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white shadow transition-all', on ? 'left-[23px]' : 'left-[3px]')} />
    </button>
  );
}

export function ToggleRow({ label, sub, on, onChange }: { label: string; sub?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="msg-glass flex items-center gap-3 rounded-[18px] px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-[14.5px] font-medium text-white/90">{label}</div>
        {sub && <div className="mt-0.5 text-[12px] text-white/45">{sub}</div>}
      </div>
      <Toggle on={on} onChange={onChange} />
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="msg-glass flex gap-1 rounded-full p-1">
      {options.map((o) => (
        <button key={o.v} onClick={() => { void hapticTap(); onChange(o.v); }}
          className={cn('flex-1 rounded-full py-2 text-[13px] font-semibold transition-colors', value === o.v ? 'msg-glass-accent text-white' : 'text-white/55')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
