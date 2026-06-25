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
  ChevronRight, LogOut, CreditCard, Loader2, Trophy, Crown, Lock,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { useGamification } from '@/hooks/useGamification';
import { useMyFilms } from '@/hooks/useMyFilms';
import { useFollowCounts, useFollowList, useLikedReels, useDrafts, usePinnedReels, useActivityHeatmap, type GridItem, type Person } from '@/hooks/useProfileData';
import { AuroraBackdrop } from '@/components/native/AuroraBackdrop';
import { MasonryGrid, MediaTile } from '@/components/native/MediaTile';
import { hapticTap } from '@/lib/native/shell';
import { cn } from '@/lib/utils';

const TITLES = ['Newcomer', 'Creator', 'Director', 'Auteur', 'Visionary', 'Legend'];
const XP_PER_LEVEL = 500;
const RARITY: Record<string, string> = { common: '#9aa3b2', rare: '#5b9bff', epic: '#a855f7', legendary: '#ffd76b' };
const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}k` : String(n));

type Tab = 'films' | 'liked' | 'drafts';
type Sheet = null | 'followers' | 'following' | 'edit' | 'settings';

export default function You() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile, signOut } = useAuth();
  const { available } = useCredits();
  const { films, totalLikes } = useMyFilms();
  const counts = useFollowCounts(user?.id);
  const gam = useGamification();
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
  const coverUrl = (profile as { cover_url?: string | null })?.cover_url || null;

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

      {/* Cover banner */}
      <div className="relative h-28 w-full overflow-hidden" style={{ marginTop: 'var(--safe-top,0px)' }}>
        {coverUrl ? <img src={coverUrl} alt="" className="h-full w-full object-cover opacity-70" /> : <div className="h-full w-full bg-gradient-to-br from-[#2f6bff]/30 via-[#5a3bff]/20 to-transparent" />}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#0a0a0f] to-transparent" />
        <div className="absolute right-4 top-3 flex gap-2">
          <IconBtn label="Edit profile" onClick={() => { void hapticTap(); setSheet('edit'); }}><Pencil className="h-[18px] w-[18px]" /></IconBtn>
          <IconBtn label="Settings" onClick={() => { void hapticTap(); setSheet('settings'); }}><Settings className="h-[18px] w-[18px]" /></IconBtn>
        </div>
      </div>

      <div className="relative z-10 px-5" style={{ paddingBottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px) + 44px)' }}>
        {/* Avatar + identity */}
        <div className="-mt-10 flex flex-col items-center text-center">
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

        {/* Level / streak + rank + credits */}
        <div className="lit-edge relative mt-6 overflow-hidden rounded-[24px] bg-gradient-to-br from-[#2f6bff]/20 to-[#7a3bff]/10 p-4">
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
        {pinned.length > 0 && (
          <Section title="Highlights" icon={Sparkles}>
            <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1" style={{ scrollbarWidth: 'none' }}>
              {pinned.map((p) => (
                <MediaTile key={p.id} src={p.thumbnail_url} title={p.title} play={p.play_count} width={180} onClick={() => navigate(`/r/${p.id}`)} />
              ))}
            </div>
          </Section>
        )}

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
                <MediaTile key={it.id} src={it.thumbnail_url} title={it.title} play={tab === 'drafts' ? null : it.play_count}
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
      {sheet === 'edit' && (
        <EditSheet
          initial={{ display_name: profile?.display_name ?? name, bio: (profile as { bio?: string | null })?.bio ?? '', tagline: (profile as { tagline?: string | null })?.tagline ?? '' }}
          onClose={() => setSheet(null)}
          onSaved={async () => { setSheet(null); await refreshProfile(); }}
        />
      )}
      {sheet === 'settings' && (
        <SettingsSheet onClose={() => setSheet(null)} onNav={(to) => { setSheet(null); navigate(to); }} onSignOut={async () => { setSheet(null); await signOut(); navigate('/feed'); }} />
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

function IconBtn({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return <button onClick={onClick} aria-label={label} title={label} className="grid h-9 w-9 place-items-center rounded-full bg-black/35 text-white backdrop-blur-md">{children}</button>;
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
      <div className="absolute inset-x-0 bottom-0 flex max-h-[80%] flex-col rounded-t-[28px] bg-[#0c0c12]/96 backdrop-blur-2xl" style={{ paddingBottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px) + 12px)' }}>
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
  const { people, loading } = useFollowList(userId, kind, true);
  return (
    <SheetShell title={kind === 'followers' ? 'Followers' : 'Following'} onClose={onClose}>
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-white/40" /></div>
      ) : people.length === 0 ? (
        <div className="py-10 text-center text-[13px] text-white/40">{kind === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}</div>
      ) : (
        <ul className="space-y-2 pb-3">
          {people.map((p: Person) => (
            <li key={p.id}>
              <button onClick={() => onOpen(p.id)} className="flex w-full items-center gap-3 rounded-2xl px-1 py-2 text-left active:bg-white/5">
                {p.avatar_url ? <img src={p.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-[#9c8bff] to-[#6b3bff] text-[13px] font-bold">{(p.display_name?.[0] ?? '?').toUpperCase()}</span>}
                <span className="flex-1 text-[14px] font-medium">{p.display_name ?? 'Anonymous'}</span>
                <ChevronRight className="h-4 w-4 text-white/30" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </SheetShell>
  );
}

function EditSheet({ initial, onClose, onSaved }: { initial: { display_name: string; bio: string; tagline: string }; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(initial.display_name);
  const [tagline, setTagline] = useState(initial.tagline);
  const [bio, setBio] = useState(initial.bio);
  const [saving, setSaving] = useState(false);
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
        <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} className="surface-1 h-11 w-full rounded-full bg-transparent px-4 text-[15px] text-white outline-none" /></Field>
        <Field label="Tagline"><input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="One line about you" className="surface-1 h-11 w-full rounded-full bg-transparent px-4 text-[15px] text-white outline-none placeholder:text-white/30" /></Field>
        <Field label="Bio"><textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="A little more about you…" className="surface-1 w-full resize-none rounded-[18px] bg-transparent px-4 py-3 text-[15px] text-white outline-none placeholder:text-white/30" /></Field>
        <button onClick={save} disabled={saving} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#2f6bff] to-[#7a3bff] font-display text-[15px] font-bold disabled:opacity-50">
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Save'}
        </button>
        <p className="text-center text-[11px] text-white/30">Avatar &amp; cover editing coming soon.</p>
      </div>
    </SheetShell>
  );
}

function SettingsSheet({ onClose, onNav, onSignOut }: { onClose: () => void; onNav: (to: string) => void; onSignOut: () => void }) {
  return (
    <SheetShell title="Settings" onClose={onClose}>
      <div className="space-y-1.5 pb-2">
        <Row icon={Settings} label="Account &amp; preferences" onClick={() => onNav('/settings')} />
        <Row icon={CreditCard} label="Billing &amp; credits" onClick={() => onNav('/account?tab=credits')} />
        <Row icon={LogOut} label="Sign out" danger onClick={onSignOut} />
      </div>
    </SheetShell>
  );
}

function Row({ icon: Icon, label, onClick, danger }: { icon: typeof Settings; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={cn('flex w-full items-center gap-3 rounded-2xl px-3 py-3.5 text-left active:bg-white/5', danger ? 'text-[#ff6b6b]' : 'text-white/90')}>
      <Icon className="h-[19px] w-[19px]" strokeWidth={1.7} />
      <span className="flex-1 text-[14.5px]">{label}</span>
      {!danger && <ChevronRight className="h-4 w-4 text-white/30" />}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">{label}</div>{children}</div>;
}
