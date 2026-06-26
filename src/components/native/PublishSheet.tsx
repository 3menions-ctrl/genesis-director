/**
 * PublishSheet — push a project to the Lobby. World picker + tags + director
 * notes → publish_reel (via useReelPublisher). Borderless glass sheet.
 */
import { useState } from 'react';
import { X, Send, Loader2, Hash, Globe2 } from 'lucide-react';
import { useWorlds } from '@/hooks/useDiscover';
import { useReelPublisher } from '@/hooks/useReelPublisher';
import { hapticTap } from '@/lib/native/shell';
import { cn } from '@/lib/utils';

export function PublishSheet({ projectId, defaultTitle, onClose, onPublished }: { projectId: string; defaultTitle?: string; onClose: () => void; onPublished?: (reelId: string) => void }) {
  const worlds = useWorlds();
  const { publish, publishing } = useReelPublisher();
  const [world, setWorld] = useState<string | null>(null);
  const [tagText, setTagText] = useState('');
  const [notes, setNotes] = useState('');

  const tags = tagText.split(/[,\s]+/).map((t) => t.replace(/^#/, '').trim()).filter(Boolean).slice(0, 8);

  const submit = async () => {
    void hapticTap();
    const reelId = await publish(projectId, { worldSlug: world, directorNotes: notes.trim() || null, tags, toastWorldLabel: world ? worlds.find((w) => w.slug === world)?.name : undefined });
    if (reelId) { onPublished?.(reelId); onClose(); }
  };

  return (
    <div className="fixed inset-0 z-[70]">
      <div onClick={onClose} className="absolute inset-0 bg-black/55" />
      <div className="absolute inset-x-0 bottom-0 max-h-[88%] overflow-y-auto rounded-t-[28px] bg-[#0d0d14]/92 px-5 backdrop-blur-2xl shadow-[0_-24px_70px_-24px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.08)]" style={{ paddingBottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px) + 16px)' }}>
        <div className="mx-auto mb-3 mt-3 h-1 w-10 rounded-full bg-white/15" />
        <div className="mb-4 flex items-center justify-between">
          <span className="font-display text-[17px] font-semibold">Publish to the Lobby</span>
          <button onClick={onClose} aria-label="Close" className="text-white/50"><X className="h-5 w-5" /></button>
        </div>
        {defaultTitle && <p className="-mt-2 mb-4 truncate text-[13px] text-white/45">{defaultTitle}</p>}

        {/* World */}
        <div className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40"><Globe2 className="h-3 w-3" /> World</div>
        <div className="flex flex-wrap gap-2">
          <Pill label="None" on={world === null} onClick={() => setWorld(null)} />
          {worlds.map((w) => <Pill key={w.slug} label={w.name} on={world === w.slug} onClick={() => setWorld(w.slug)} />)}
        </div>

        {/* Tags */}
        <div className="mb-1.5 mt-5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40"><Hash className="h-3 w-3" /> Tags</div>
        <input value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder="noir, dream, neon" className="surface-1 h-12 w-full rounded-[16px] bg-transparent px-4 text-[15px] text-white outline-none placeholder:text-white/30" />
        {tags.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{tags.map((t) => <span key={t} className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] text-[#8fb4ff]">#{t}</span>)}</div>}

        {/* Notes */}
        <div className="mb-1.5 mt-5 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">Director's notes</div>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="A note for your audience…" className="surface-1 w-full resize-none rounded-[16px] bg-transparent px-4 py-3 text-[15px] text-white outline-none placeholder:text-white/30" />

        <button onClick={submit} disabled={publishing} className="mt-5 flex h-[54px] w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-[#2f6bff] via-[#5a5bff] to-[#7a3bff] text-[15px] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_20px_44px_-14px_rgba(80,80,255,.7)] transition-opacity disabled:opacity-50">
          {publishing ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <Send className="h-[18px] w-[18px]" />} {publishing ? 'Publishing…' : 'Publish'}
        </button>
      </div>
    </div>
  );
}

function Pill({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return <button onClick={() => { void hapticTap(); onClick(); }} className={cn('h-9 rounded-full px-4 text-[13px] font-semibold transition-colors', on ? 'msg-glass-accent text-white' : 'msg-glass text-white/55')}>{label}</button>;
}
