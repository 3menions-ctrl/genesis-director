/**
 * You — the comprehensive mobile profile. Borderless / floating (Aurora).
 *
 * Header (cover + avatar + name/handle/tagline + edit + settings), social counts
 * (followers/following → people lists, films, likes), level/XP/streak + credits
 * (spend-only), and content tabs: Films · Liked · Drafts. Edit and settings are
 * bottom sheets. All wired to real tables (see useMyFilms + useProfileData).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Flame, LogIn, Sparkles, Settings, Pencil, X, Heart, Film, Layers,
  Loader2, Trophy, Crown, Lock, Check, MessageCircle, Camera, Bell, Plus, Pin,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { useGamification } from '@/hooks/useGamification';
import { useNotifications } from '@/hooks/useNotifications';
import { useUnreadDMCount } from '@/hooks/useInbox';
import { useMyFilms } from '@/hooks/useMyFilms';
import { useFollowCounts, useFollowList, useLikedReels, useDrafts, usePinnedReels, useActivityHeatmap, type GridItem, type Person } from '@/hooks/useProfileData';
import { AuroraBackdrop } from '@/components/native/AuroraBackdrop';
import { MasonryGrid, MediaTile } from '@/components/native/MediaTile';
import { hapticTap } from '@/lib/native/shell';
import { cn } from '@/lib/utils';

const TITLES = ['Newcomer', 'Creator', 'Filmmaker', 'Auteur', 'Visionary', 'Legend'];
const XP_PER_LEVEL = 500;
const RARITY: Record<string, string> = { common: '#9aa3b2', rare: '#5b9bff', epic: '#a855f7', legendary: '#ffd76b' };
const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}k` : String(n));

type Tab = 'films' | 'liked' | 'drafts';
type Sheet = null | 'followers' | 'following' | 'edit' | 'pins';

export default function You() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const { available } = useCredits();
  const { films, totalLikes } = useMyFilms();
  const counts = useFollowCounts(user?.id);
  const gam = useGamification();
  const { unreadCount } = useNotifications();
  const dmUnread = useUnreadDMCount();
  const pinned = usePinnedReels((profile as { pinned_reel_ids?: string[] })?.pinned_reel_ids);
  const heat = useActivityHeatmap(user?.id);
  const [tab, setTab] = useState<Tab>('films');
  const [sheet, setSheet] = useState<Sheet>(null);

  const liked = useLikedReels(user?.id, tab === 'liked');
  const drafts = useDrafts(user?.id, tab === 'drafts');

  // Real gamification (xp/level/streak/rank), falling back to a films-derived
  // level so the bar is never empty before the gamification row exists.
  const filmsXp = films.length * 100 + totalLikes * 5;
  const level = gam.stats?.level && gam.stats.xp_total ? gam.stats.level : Math.floor(filmsXp / XP_PER_LEVEL) + 1;
  const title = TITLES[Math.min(level - 1, TITLES.length - 1)];
  const streak = gam.stats?.current_streak ?? 0;
  const pct = Math.max(0, Math.min(100, gam.xpProgress?.percentage ?? Math.round(((filmsXp % XP_PER_LEVEL) / XP_PER_LEVEL) * 100)));
  const rank = gam.leaderboard?.find((e) => e.user_id === user?.id)?.rank ?? null;
  const views = (profile as { profile_view_count?: number })?.profile_view_count ?? 0;

  const name = profile?.display_name || profile?.full_name || user?.email?.split('@')[0] || 'You';
  const handle = `@${name.replace(/\s+/g, '').toLowerCase()}`;
  const initial = name.trim().charAt(0).toUpperCase();
  const tagline = (profile as { tagline?: string | null })?.tagline || (profile as { bio?: string | null })?.bio || null;

  if (!user) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-5 px-8 text-center text-white" style={{ paddingBottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px))' }}>
        <AuroraBackdrop />
        <Sparkles className="relative z-10 h-9 w-9 text-[#7aa2ff]" />
        <div className="relative z-10 text-[24px] font-light italic" style={{ fontFamily: 'Fraunces, serif' }}>Sign in to see your studio</div>
        <button onClick={() => navigate('/auth')} className="relative z-10 mt-1 flex flex-col items-center gap-1.5 text-[#7aa2ff]" aria-label="Sign in">
          <LogIn className="h-[26px] w-[26px]" /><span className="font-display text-[11px] font-semibold">Sign in</span>
        </button>
      </div>
    );
  }

  const tabItems: Record<Tab, { loading: boolean; items: GridItem[] }> = {
    films: { loading: false, items: films.map((f) => ({ id: f.id, title: f.title, thumbnail_url: f.thumbnail_url, video_url: f.video_url, play_count: f.play_count })) },
    liked: { loading: liked.loading, items: liked.items },
    drafts: { loading: drafts.loading, items: drafts.items },
  };
  const cur = tabItems[tab];

  return (
    <div className="fixed inset-0 overflow-y-auto text-white">
      <AuroraBackdrop />

      {/* Floating actions over the shared Aurora backdrop (no cover banner) */}
      <div className="fixed right-4 z-20 flex gap-2" style={{ top: 'calc(var(--safe-top,0px) + 12px)' }}>
        <IconBtn label="Activity" badge={unreadCount} onClick={() => { void hapticTap(); navigate('/activity'); }}><Bell className="h-[18px] w-[18px]" /></IconBtn>
        <IconBtn label="Messages" badge={dmUnread} onClick={() => { void hapticTap(); navigate('/messages'); }}><MessageCircle className="h-[18px] w-[18px]" /></IconBtn>
        <IconBtn label="Edit profile" onClick={() => { void hapticTap(); setSheet('edit'); }}><Pencil className="h-[18px] w-[18px]" /></IconBtn>
        <IconBtn label="Settings" onClick={() => { void hapticTap(); navigate('/me/settings'); }}><Settings className="h-[18px] w-[18px]" /></IconBtn>
      </div>

      <div className="relative z-10 px-5" style={{ paddingTop: 'calc(var(--safe-top,0px) + 60px)', paddingBottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px) + 44px)' }}>
        {/* Avatar + identity */}
        <div className="flex flex-col items-center text-center">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-20 w-20 rounded-full object-cover ring-4 ring-[#0a0a0f]" />
          ) : (
            <span className="grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-[#9c8bff] to-[#6b3bff] font-display text-2xl font-bold ring-4 ring-[#0a0a0f]">{initial}</span>
          )}
          <h1 className="mt-2.5 text-[24px] font-light leading-tight" style={{ fontFamily: 'Fraunces, serif' }}>{name}</h1>
          <div className="font-mono text-[12.5px] text-white/40">{handle}</div>
          {tagline && <p className="mt-2 max-w-[300px] text-[13px] leading-snug text-white/70">{tagline}</p>}
        </div>

        {/* Social counts */}
        <div className="mt-6 flex items-stretch">
          <Count label="Followers" value={compact(counts.followers)} onClick={() => setSheet('followers')} />
          <Count label="Following" value={compact(counts.following)} onClick={() => setSheet('following')} divider />
          <Count label="Films" value={String(films.length)} divider />
          <Count label="Views" value={compact(views)} divider />
        </div>

        {/* Level / streak + rank + credits → tap for the leaderboard */}
        <div onClick={() => { void hapticTap(); navigate('/leaderboard'); }} className="lit-edge relative mt-6 cursor-pointer overflow-hidden rounded-[24px] bg-gradient-to-br from-[#2f6bff]/20 to-[#7a3bff]/10 p-4 transition-transform active:scale-[0.99]">
          <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-[#7a3bff]/25 blur-3xl" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#9ab4ff]">{title} · Lv {level}</div>
              {rank != null && <span className="inline-flex items-center gap-1 rounded-full bg-[#ffd76b]/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-[#ffd76b]"><Crown className="h-3 w-3" />#{rank}</span>}
            </div>
            <div className="flex items-center gap-3.5">
              <span className="flex items-center gap-1 text-[13px] font-semibold"><Flame className={cn('h-5 w-5', streak > 0 ? 'fill-orange-500 text-orange-400' : 'text-white/25')} />{streak}</span>
              <span className="flex items-center gap-1 text-[13px] font-semibold text-[#8fb4ff]">◇ {compact(available)}</span>
            </div>
          </div>
          <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-[#3f78ff] to-[#a061ff]" style={{ width: `${pct}%` }} /></div>
        </div>

        {/* Pinned Highlights */}
        <div className="mt-7">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-white/45" strokeWidth={1.8} />
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">Highlights</span>
            <button onClick={() => { void hapticTap(); setSheet('pins'); }} aria-label="Edit highlights" className="ml-auto text-[#8fb4ff]"><Pencil className="h-[14px] w-[14px]" /></button>
          </div>
          {pinned.length > 0 ? (
            <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1" style={{ scrollbarWidth: 'none' }}>
              {pinned.map((p) => <MediaTile key={p.id} src={p.thumbnail_url} title={p.title} play={p.play_count} width={180} onClick={() => navigate(`/r/${p.id}`)} />)}
            </div>
          ) : (
            <button onClick={() => { void hapticTap(); setSheet('pins'); }} className="msg-glass flex w-full items-center justify-center gap-2 rounded-[18px] py-5 text-[13px] font-medium text-white/55 transition-transform active:scale-[0.99]">
              <Plus className="h-4 w-4" /> Pin your best films
            </button>
          )}
        </div>

        {/* Achievements */}
        {gam.achievements && gam.achievements.length > 0 && (
          <Section title="Achievements" icon={Trophy} trailing={`${gam.unlockedAchievements?.length ?? 0}/${gam.achievements.length}`}>
            <div className="-mx-5 flex gap-4 overflow-x-auto px-5 pb-1" style={{ scrollbarWidth: 'none' }}>
              {gam.achievements.map((a) => {
                const got = gam.unlockedAchievements?.some((u) => u.achievement_id === a.id);
                const c = RARITY[a.rarity] ?? RARITY.common;
                return (
                  <div key={a.id} title={a.description ?? a.name} className="flex w-[64px] flex-none flex-col items-center gap-1.5 text-center">
                    <span className="relative grid h-12 w-12 place-items-center rounded-2xl" style={{ background: got ? `${c}22` : 'rgba(255,255,255,.03)', boxShadow: got ? `inset 0 0 0 1px ${c}66, 0 8px 20px -10px ${c}` : undefined }}>
                      {got ? <Trophy className="h-6 w-6" style={{ color: c }} /> : <Lock className="h-4 w-4 text-white/25" />}
                    </span>
                    <span className={cn('text-[9px] font-medium leading-tight', got ? 'text-white/80' : 'text-white/35')}>{a.name}</span>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* Activity heatmap */}
        <Section title="Activity" icon={Flame}>
          <Heatmap days={heat} />
        </Section>

        {/* Tabs — borderless, floating accent icons */}
        <div className="mt-7 flex items-center justify-around">
          {([['films', Film, 'Films'], ['liked', Heart, 'Liked'], ['drafts', Layers, 'Drafts']] as const).map(([id, Icon, label]) => {
            const on = tab === id;
            return (
              <button key={id} onClick={() => { void hapticTap(); setTab(id); }} className={cn('flex flex-1 flex-col items-center gap-1.5 transition-colors active:scale-95', on ? 'text-[#8fb4ff]' : 'text-white/40')}>
                <span className="relative grid place-items-center">
                  {on && <span className="pointer-events-none absolute h-8 w-8 rounded-full bg-[#3f78ff]/30 blur-md" />}
                  <Icon className="relative h-[20px] w-[20px]" strokeWidth={on ? 2.1 : 1.8} />
                </span>
                <span className="text-[11px] font-medium">{label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="mt-4">
          {cur.loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-white/40" /></div>
          ) : cur.items.length === 0 ? (
            <EmptyTab tab={tab} onCreate={() => navigate('/create')} />
          ) : (
            <MasonryGrid cols={3}>
              {cur.items.map((it) => (
                <MediaTile key={it.id} src={it.thumbnail_url} videoSrc={it.video_url} title={it.title} play={tab === 'drafts' ? null : it.play_count}
                  badge={tab === 'drafts' ? it.status : null}
                  onClick={() => navigate(tab === 'drafts' ? `/editor/${it.id}` : `/r/${it.id}`)} />
              ))}
            </MasonryGrid>
          )}
        </div>
      </div>

      {/* ── Sheets ── */}
      {(sheet === 'followers' || sheet === 'following') && (
        <PeopleSheet kind={sheet} userId={user.id} onClose={() => setSheet(null)} onOpen={(id) => { setSheet(null); navigate(`/u/${id}`); }} />
      )}
      {sheet === 'pins' && (
        <PinSheet pinnedIds={(profile as { pinned_reel_ids?: string[] })?.pinned_reel_ids ?? []} onClose={() => setSheet(null)} onChanged={() => { void refreshProfile(); }} />
      )}
      {sheet === 'edit' && (
        <EditSheet
          initial={{ display_name: profile?.display_name ?? name, bio: (profile as { bio?: string | null })?.bio ?? '', tagline: (profile as { tagline?: string | null })?.tagline ?? '' }}
          onClose={() => setSheet(null)}
          onSaved={async () => { setSheet(null); await refreshProfile(); }}
        />
      )}
    </div>
  );
}

/* ───────────────────────── pieces ───────────────────────── */

function Section({ title, icon: Icon, trailing, children }: { title: string; icon: LucideIcon; trailing?: string; children: React.ReactNode }) {
  return (
    <div className="mt-7">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-white/45" strokeWidth={1.8} />
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">{title}</span>
        {trailing && <span className="ml-auto font-mono text-[10px] tabular-nums text-white/30">{trailing}</span>}
      </div>
      {children}
    </div>
  );
}

function Heatmap({ days }: { days: Record<string, number> }) {
  const today = new Date();
  const cells: { key: string; count: number }[] = [];
  for (let i = 83; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const k = d.toISOString().slice(0, 10);
    cells.push({ key: k, count: days[k] ?? 0 });
  }
  const weeks: { key: string; count: number }[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const color = (c: number) => (c === 0 ? 'rgba(255,255,255,.05)' : c === 1 ? 'rgba(63,120,255,.4)' : c <= 3 ? 'rgba(63,120,255,.75)' : '#7a3bff');
  return (
    <div className="flex gap-1 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
      {weeks.map((w, wi) => (
        <div key={wi} className="flex flex-col gap-1">
          {w.map((c) => <span key={c.key} className="h-3.5 w-3.5 rounded-[3px]" style={{ background: color(c.count) }} />)}
        </div>
      ))}
    </div>
  );
}

function IconBtn({ children, label, onClick, badge }: { children: React.ReactNode; label: string; onClick: () => void; badge?: number }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className="relative grid h-9 w-9 place-items-center rounded-full bg-black/35 text-white backdrop-blur-md">
      {children}
      {!!badge && badge > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#ff3b6b] px-1 text-[10px] font-bold leading-none shadow-[0_0_0_2px_#0a0a0f]">{badge > 9 ? '9+' : badge}</span>}
    </button>
  );
}

function Count({ label, value, onClick, divider }: { label: string; value: string; onClick?: () => void; divider?: boolean }) {
  return (
    <button onClick={onClick} disabled={!onClick} className={cn('flex flex-1 flex-col items-center', divider && 'border-l border-white/[0.08]', onClick && 'active:opacity-70')}>
      <span className="font-display text-[19px] font-semibold tabular-nums">{value}</span>
      <span className="mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-white/45">{label}</span>
    </button>
  );
}

function EmptyTab({ tab, onCreate }: { tab: Tab; onCreate: () => void }) {
  const copy = tab === 'films' ? 'No films yet' : tab === 'liked' ? 'Nothing liked yet' : 'No drafts in progress';
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <div className="text-[16px] font-light italic text-white/70" style={{ fontFamily: 'Fraunces, serif' }}>{copy}</div>
      {tab !== 'liked' && (
        <button onClick={() => { void hapticTap(); onCreate(); }} className="flex flex-col items-center gap-1.5 text-[#7aa2ff]"><Sparkles className="h-[24px] w-[24px]" /><span className="text-[10px] font-semibold">Create</span></button>
      )}
    </div>
  );
}

function SheetShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60]">
      <div onClick={onClose} className="absolute inset-0 bg-black/50" />
      <div className="absolute inset-x-0 bottom-0 flex max-h-[80%] flex-col rounded-t-[28px] bg-[#0d0d14]/85 backdrop-blur-2xl shadow-[0_-24px_70px_-24px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.08)]" style={{ paddingBottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px) + 12px)' }}>
        <div className="mx-auto mb-2 mt-3 h-1 w-10 rounded-full bg-white/15" />
        <div className="flex items-center justify-between px-5 pb-3">
          <span className="font-display text-[15px] font-semibold">{title}</span>
          <button onClick={onClose} aria-label="Close" className="text-white/50"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5">{children}</div>
      </div>
    </div>
  );
}

function PeopleSheet({ kind, userId, onClose, onOpen }: { kind: 'followers' | 'following'; userId: string; onClose: () => void; onOpen: (id: string) => void }) {
  const { people, loading, followingIds, toggleFollow, meId } = useFollowList(userId, kind, true);
  return (
    <SheetShell title={kind === 'followers' ? 'Followers' : 'Following'} onClose={onClose}>
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-white/40" /></div>
      ) : people.length === 0 ? (
        <div className="py-10 text-center text-[13px] text-white/40">{kind === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}</div>
      ) : (
        <ul className="space-y-1 pb-3">
          {people.map((p: Person) => {
            const followsThem = followingIds.has(p.id);
            return (
              <li key={p.id} className="flex items-center gap-3 rounded-2xl px-1 py-2">
                <button onClick={() => onOpen(p.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left active:opacity-70">
                  {p.avatar_url ? <img src={p.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-[#9c8bff] to-[#6b3bff] text-[13px] font-bold">{(p.display_name?.[0] ?? '?').toUpperCase()}</span>}
                  <span className="truncate text-[14px] font-medium">{p.display_name ?? 'Anonymous'}</span>
                </button>
                {p.id !== meId && (
                  <button onClick={() => { void hapticTap(); toggleFollow(p.id); }}
                    className={cn('shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors', followsThem ? 'msg-glass text-white/80' : 'msg-glass-accent text-white')}>
                    {followsThem ? 'Following' : 'Follow'}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </SheetShell>
  );
}

function PinSheet({ pinnedIds, onClose, onChanged }: { pinnedIds: string[]; onClose: () => void; onChanged: () => void }) {
  const { films } = useMyFilms();
  const [pins, setPins] = useState<Set<string>>(new Set(pinnedIds));

  const toggle = async (id: string) => {
    const was = pins.has(id);
    if (!was && pins.size >= 3) { toast('You can feature up to 3 films'); return; }
    void hapticTap();
    setPins((p) => { const n = new Set(p); was ? n.delete(id) : n.add(id); return n; });
    try {
      const { error } = await supabase.rpc('toggle_pin_reel' as never, { p_reel_id: id } as never);
      if (error) throw error;
      onChanged();
    } catch (e) {
      setPins((p) => { const n = new Set(p); was ? n.add(id) : n.delete(id); return n; });
      toast.error(e instanceof Error ? e.message : 'Could not update');
    }
  };

  return (
    <SheetShell title="Pin highlights" onClose={onClose}>
      <p className="mb-3 text-[12.5px] text-white/45">Feature up to 3 of your published films at the top of your profile.</p>
      {films.length === 0 ? (
        <div className="py-10 text-center text-[13px] text-white/40">Publish a film to feature it.</div>
      ) : (
        <ul className="space-y-2 pb-2">
          {films.map((f) => {
            const on = pins.has(f.id);
            return (
              <li key={f.id}>
                <button onClick={() => toggle(f.id)} className="flex w-full items-center gap-3 rounded-2xl px-1 py-2 text-left active:opacity-70">
                  {f.thumbnail_url ? <img src={f.thumbnail_url} alt="" className="h-12 w-[68px] rounded-lg object-cover" /> : <span className="grid h-12 w-[68px] place-items-center rounded-lg bg-gradient-to-br from-[#241a3a] to-[#0a0a0a] text-white/30"><Film className="h-4 w-4" /></span>}
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{f.title}</span>
                  <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors', on ? 'msg-glass-accent text-white' : 'msg-glass text-white/45')}>
                    {on ? <Check className="h-[16px] w-[16px]" strokeWidth={2.6} /> : <Pin className="h-[15px] w-[15px]" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </SheetShell>
  );
}

function EditSheet({ initial, onClose, onSaved }: { initial: { display_name: string; bio: string; tagline: string }; onClose: () => void; onSaved: () => void }) {
  const { user, profile, refreshProfile } = useAuth();
  const [name, setName] = useState(initial.display_name);
  const [tagline, setTagline] = useState(initial.tagline);
  const [bio, setBio] = useState(initial.bio);
  const [avatar, setAvatar] = useState<string | null>(profile?.avatar_url ?? null);
  const [cover, setCover] = useState<string | null>((profile as { cover_url?: string | null } | null)?.cover_url ?? null);
  const [busy, setBusy] = useState<'avatar' | 'cover' | null>(null);
  const [saving, setSaving] = useState(false);

  const pick = async (file: File | undefined, kind: 'avatar' | 'cover') => {
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) { toast.error('Please choose an image'); return; }
    if (file.size > 6 * 1024 * 1024) { toast.error('Image must be under 6MB'); return; }
    setBusy(kind);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${user.id}/${kind}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const publicUrl = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
      const col = kind === 'avatar' ? 'avatar_url' : 'cover_url';
      const { error: updErr } = await supabase.from('profiles').update({ [col]: publicUrl } as never).eq('id', user.id);
      if (updErr) throw updErr;
      if (kind === 'avatar') setAvatar(publicUrl); else setCover(publicUrl);
      await refreshProfile();
      toast.success(kind === 'avatar' ? 'Photo updated' : 'Cover updated');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally { setBusy(null); }
  };

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.rpc('update_profile_text' as never, { p_display_name: name.trim(), p_bio: bio.trim(), p_tagline: tagline.trim() } as never);
      if (error) throw error;
      toast.success('Profile updated');
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save');
    } finally { setSaving(false); }
  };

  return (
    <SheetShell title="Edit profile" onClose={onClose}>
      <div className="space-y-4 pb-2">
        {/* Cover + avatar pickers */}
        <div className="relative mb-8">
          <label className="msg-glass relative block h-28 cursor-pointer overflow-hidden rounded-[18px]">
            {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-gradient-to-br from-[#2f6bff]/25 to-[#7a3bff]/15" />}
            <span className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/45 text-white backdrop-blur-md">{busy === 'cover' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}</span>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0], 'cover')} />
          </label>
          <label className="absolute -bottom-6 left-4 block h-20 w-20 cursor-pointer">
            <span className="block h-20 w-20 overflow-hidden rounded-full ring-4 ring-[#0d0d14]">
              {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center bg-gradient-to-br from-[#9c8bff] to-[#6b3bff] font-display text-2xl font-bold">{name.trim().charAt(0).toUpperCase()}</span>}
            </span>
            <span className="absolute bottom-0 right-0 grid h-7 w-7 place-items-center rounded-full bg-[#2f6bff] text-white shadow-[0_0_0_3px_#0d0d14]">{busy === 'avatar' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}</span>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0], 'avatar')} />
          </label>
        </div>

        <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} className="surface-1 h-11 w-full rounded-full bg-transparent px-4 text-[15px] text-white outline-none" /></Field>
        <Field label="Tagline"><input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="One line about you" className="surface-1 h-11 w-full rounded-full bg-transparent px-4 text-[15px] text-white outline-none placeholder:text-white/30" /></Field>
        <Field label="Bio"><textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="A little more about you…" className="surface-1 w-full resize-none rounded-[18px] bg-transparent px-4 py-3 text-[15px] text-white outline-none placeholder:text-white/30" /></Field>
        <div className="flex justify-center pt-1">
          <button onClick={save} disabled={saving} aria-label="Save" title="Save"
            className="surface-1 grid h-14 w-14 place-items-center rounded-2xl text-[#8fb4ff] transition-transform active:scale-95 disabled:opacity-50">
            {saving ? <Loader2 className="h-6 w-6 animate-spin" /> : <Check className="h-7 w-7" strokeWidth={2.2} />}
          </button>
        </div>
      </div>
    </SheetShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">{label}</div>{children}</div>;
}
