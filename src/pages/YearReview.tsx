/**
 * YearReview — a cinematic "Your Year" recap (route /me/recap). Built from
 * useMyFilms (published reels): films this year, plays, likes, streak, and your
 * top films. Read-only, premium glass over Aurora. Shareable.
 */
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Share2, Play, Heart, Film, Flame } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useMyFilms } from '@/hooks/useMyFilms';
import { AuroraBackdrop, GrainOverlay } from '@/components/native/AuroraBackdrop';
import { MediaTile } from '@/components/native/MediaTile';
import { shareLink } from '@/lib/native/shell';

const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}k` : String(n));

export default function YearReview() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { films, totalLikes, totalPlays, streak } = useMyFilms();
  const year = new Date().getFullYear();

  const yearFilms = films.filter((f) => f.created_at && new Date(f.created_at).getFullYear() === year);
  const made = yearFilms.length;
  const top = [...films].sort((a, b) => b.play_count - a.play_count).slice(0, 4);

  return (
    <div className="fixed inset-0 overflow-y-auto text-white">
      <AuroraBackdrop />
      <div className="pointer-events-none absolute left-1/2 top-[10%] h-[360px] w-[360px] -translate-x-1/2 rounded-full bg-[#5a5bff]/18 blur-[110px]" />
      <GrainOverlay />

      <div className="relative z-10 flex items-center justify-between px-4 pb-2" style={{ paddingTop: 'calc(var(--safe-top,0px) + 12px)' }}>
        <button onClick={() => navigate(-1)} aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.06] backdrop-blur-md"><ChevronLeft className="h-5 w-5" /></button>
        <button onClick={async () => { if (!user) return; const r = await shareLink({ title: `My ${year} on Small Bridges`, text: `${made} films · ${compact(totalPlays)} plays this year`, url: `https://smallbridges.co/c/${user.id}` }); if (r === 'copied') toast.success('Link copied'); }}
          aria-label="Share" className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.06] backdrop-blur-md"><Share2 className="h-[17px] w-[17px]" /></button>
      </div>

      <div className="relative z-10 px-5" style={{ paddingBottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px) + 28px)' }}>
        {/* Hero */}
        <div className="mt-4 text-center">
          <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#8fb4ff]">Your Year</div>
          <div className="mt-1 font-display text-[72px] font-bold leading-none">{year}</div>
          <p className="mt-3 text-[15px] text-white/60">{made > 0 ? `You directed ${made} film${made === 1 ? '' : 's'} this year.` : 'Your story starts now — make your first film.'}</p>
        </div>

        {/* Stats */}
        <div className="mt-8 grid grid-cols-2 gap-3">
          <Stat icon={Film} label="Films" value={String(made)} accent />
          <Stat icon={Play} label="Total plays" value={compact(totalPlays)} />
          <Stat icon={Heart} label="Likes earned" value={compact(totalLikes)} />
          <Stat icon={Flame} label="Best streak" value={`${streak} day${streak === 1 ? '' : 's'}`} />
        </div>

        {/* Top films */}
        {top.length > 0 && (
          <div className="mt-9">
            <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">Your top films</div>
            <div className="grid grid-cols-2 gap-3">
              {top.map((f) => <MediaTile key={f.id} src={f.thumbnail_url} title={f.title} play={f.play_count} onClick={() => navigate(`/r/${f.id}`)} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent }: { icon: typeof Film; label: string; value: string; accent?: boolean }) {
  return (
    <div className={accent ? 'msg-glass-accent rounded-[20px] px-5 py-5' : 'msg-glass rounded-[20px] px-5 py-5'}>
      <Icon className="h-[20px] w-[20px] text-white/70" strokeWidth={1.8} />
      <div className="mt-3 font-display text-[30px] font-bold leading-none tabular-nums">{value}</div>
      <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/45">{label}</div>
    </div>
  );
}
