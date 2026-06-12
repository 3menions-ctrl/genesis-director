/**
 * PublicShare — `/p/{slug}` public, unauthenticated page for a project that
 * the user has chosen to share. Renders:
 *   • Final video as the hero
 *   • Project credits (Director name + project title)
 *   • The Production Replay reel (auto-generated from generation history)
 *   • A "Create your own" recruitment CTA
 *   • OG meta so social embeds look premium
 *
 * Reads `project_shares` (RLS allows public when is_public=true) plus the
 * referenced `movie_projects` row for the video URL + title.
 *
 * This is the viral mechanic. Every Small Bridges share recruits new visitors —
 * they see not just the output but the *craft*.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Play, ArrowUpRight, Sparkles, Share2, Film } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { BrandedVideoPlayer } from '@/components/intro/BrandedVideoPlayer';
import { useSafeNavigation } from '@/lib/navigation';
import { usePageMeta } from '@/hooks/usePageMeta';
import { PrimaryCTA } from '@/components/ui/PrimaryCTA';
import { Spinner } from '@/components/ui/Spinner';
import { toast } from 'sonner';

interface ShareRow {
  id: string;
  project_id: string;
  user_id: string;
  slug: string;
  show_credits: boolean;
  show_replay: boolean;
  view_count: number;
  trailer_url: string | null;
  making_of_url: string | null;
}

interface ProjectRow {
  id: string;
  title: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  prompt?: string | null;
  last_user_prompt?: string | null;
  status: string;
}

export default function PublicShare() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? '';
  const { navigate } = useSafeNavigation();
  const [share, setShare] = useState<ShareRow | null>(null);
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [director, setDirector] = useState<{ display_name: string | null; avatar_url: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  usePageMeta({
    title: project?.title
      ? `${project.title} — Small Bridges`
      : 'A scene from Small Bridges',
    description: project?.last_user_prompt ?? project?.prompt ?? 'Made in Small Bridges.',
  });

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: shareRow } = await supabase
        .from('project_shares')
        .select('id, project_id, user_id, slug, show_credits, show_replay, view_count, trailer_url, making_of_url')
        .eq('slug', slug)
        .eq('is_public', true)
        .maybeSingle<ShareRow>();
      if (cancelled) return;
      if (!shareRow) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setShare(shareRow);

      // Fetch project + director in parallel.
      const [proj, prof] = await Promise.all([
        supabase
          .from('movie_projects')
          .select('id, title, video_url, thumbnail_url, prompt, last_user_prompt, status')
          .eq('id', shareRow.project_id)
          .maybeSingle<ProjectRow>(),
        supabase
          .from('profiles')
          .select('display_name, avatar_url')
          .eq('id', shareRow.user_id)
          .maybeSingle<{ display_name: string | null; avatar_url: string | null }>(),
      ]);
      if (cancelled) return;
      setProject(proj.data ?? null);
      setDirector(prof.data ?? null);
      setLoading(false);

      // Increment view count (best-effort; failures are silent).
      void supabase
        .from('project_shares')
        .update({ view_count: shareRow.view_count + 1 })
        .eq('id', shareRow.id);
    })();
    return () => { cancelled = true; };
  }, [slug]);

  const copyShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Share URL copied');
    } catch {
      toast.error('Could not copy');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white/60">
        <Spinner size="md" tone="muted" />
      </div>
    );
  }

  if (notFound || !share || !project) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-white px-6 text-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.4em] text-white/35 mb-4">
          404 · Reel not found
        </div>
        <h1 className="font-display text-4xl mb-3">This project isn&rsquo;t public.</h1>
        <p className="text-white/55 text-[14px] mb-8 max-w-md">
          The director may have changed the share settings, or the link may have expired.
        </p>
        <PrimaryCTA onClick={() => navigate('/')}>Visit Small Bridges</PrimaryCTA>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white">
      {/* Cinematic background */}
      <div
        aria-hidden
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at top, hsl(var(--brand) / 0.08) 0%, transparent 60%)',
        }}
      />

      <div className="max-w-[1280px] mx-auto px-6 pt-12 pb-24">
        {/* Top eyebrow */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-10">
          <div className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-[0.4em] text-white/35">
            <span className="relative inline-flex w-1.5 h-1.5">
              <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping" />
              <span className="relative rounded-full w-1.5 h-1.5 bg-emerald-400" />
            </span>
            <span>A Scene · Made in Small Bridges</span>
          </div>
          <button
            onClick={copyShare}
            className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.22em] text-white/55 hover:text-white px-3.5 py-1.5 rounded-full border border-white/[0.08] hover:border-white/20 transition-colors"
          >
            <Share2 className="w-3 h-3" />
            Copy share link
          </button>
        </div>

        {/* Hero — final video */}
        <div className="relative rounded-3xl overflow-hidden border border-white/[0.08] bg-black shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)]">
          <div className="relative aspect-video bg-black">
            {project.video_url ? (
              <BrandedVideoPlayer
                src={project.video_url}
                poster={project.thumbnail_url ?? undefined}
                playerKey={`share:${project.id}`}
                controls
                autoPlay={false}
                muted={false}
                playsInline
                className="absolute inset-0 w-full h-full bg-black"
                style={{ objectFit: "contain" }}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-white/35">
                <Play className="w-12 h-12" />
              </div>
            )}
          </div>
        </div>

        {/* Title + credits */}
        <div className="mt-10 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-10">
          <div>
            <h1
              className="font-display font-light text-[40px] lg:text-[52px] leading-[1.05] text-white"
              style={{ fontVariant: 'small-caps' }}
            >
              {project.title ?? 'Untitled scene'}
            </h1>
            {(project.last_user_prompt || project.prompt) && (
              <p className="text-white/55 text-[14px] mt-5 leading-relaxed max-w-2xl">
                <span className="text-[10px] font-mono uppercase tracking-[0.32em] text-white/30 mr-2">
                  Prompt
                </span>
                {project.last_user_prompt ?? project.prompt}
              </p>
            )}
          </div>

          {/* Credits sidebar */}
          {share.show_credits && (
            <aside className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6">
              <div className="text-[9px] font-mono uppercase tracking-[0.4em] text-white/30 mb-4">
                Credits
              </div>
              <Credit role="Directed by" name={director?.display_name ?? 'A director on Small Bridges'} avatar={director?.avatar_url ?? undefined} />
              <Credit role="Cinematography" name="Small Bridges Pipeline" />
              <Credit role="Sound" name="ElevenLabs · Soundtrack" />
              <Credit role="Made in" name="Small Bridges" />
              <Credit role="Views" name={(share.view_count + 1).toLocaleString()} />
            </aside>
          )}
        </div>

        {/* Production Replay */}
        {share.show_replay && (
          <section className="mt-16 lg:mt-24">
            <div className="flex items-center gap-3 mb-6">
              <Film className="w-4 h-4 text-brand-light" />
              <h2 className="font-display text-[24px] text-white font-light">The Production Replay</h2>
            </div>
            <p className="text-white/55 text-[13px] mb-6 max-w-xl">
              A 30-second time-lapse of how this scene came together — prompt evolution, takes considered, cuts made. Auto-generated for every Small Bridges project.
            </p>
            <div className="relative rounded-2xl overflow-hidden border border-white/[0.07] bg-black aspect-video">
              {share.making_of_url ? (
                <video
                  src={share.making_of_url}
                  controls
                  playsInline
                  preload="metadata"
                  className="absolute inset-0 w-full h-full object-contain bg-black"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white/45">
                  <Sparkles className="w-6 h-6 mb-3 text-brand-light" />
                  <div className="text-[14px] font-display">Replay is rendering…</div>
                  <div className="text-[11px] text-white/30 mt-1 font-mono uppercase tracking-[0.32em]">
                    Most replays finish within an hour of project completion
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Recruitment CTA */}
        <section className="mt-20 lg:mt-32 rounded-3xl border border-white/[0.07] bg-gradient-to-br from-brand/[0.06] to-transparent p-10 lg:p-12 text-center relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-32 right-0 w-[420px] h-[420px] rounded-full"
            style={{
              background: 'radial-gradient(circle, hsl(var(--brand) / 0.18), transparent 65%)',
              filter: 'blur(60px)',
            }}
          />
          <div className="relative">
            <div className="text-[10px] font-mono uppercase tracking-[0.4em] text-brand-light mb-4">
              Make your own
            </div>
            <h2
              className="font-display text-[32px] lg:text-[48px] font-light text-white leading-[1.05] mb-5"
              style={{ fontVariant: 'small-caps' }}
            >
              Small Bridges made this — Small Bridges can make yours.
            </h2>
            <p className="text-white/65 text-[14px] max-w-xl mx-auto mb-8 leading-relaxed">
              Free during beta. 100 starter credits the moment you sign up. No card needed.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <PrimaryCTA size="lg" onClick={() => navigate('/start')} trailingIcon={ArrowUpRight}>
                Start your scene
              </PrimaryCTA>
              <button
                onClick={() => navigate('/gallery')}
                className="text-[12px] uppercase tracking-[0.22em] text-white/55 hover:text-white px-5 py-3 rounded-lg border border-white/[0.06] hover:border-white/20 transition-colors"
              >
                Browse the Gallery
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Credit({
  role,
  name,
  avatar,
}: {
  role: string;
  name: string;
  avatar?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/[0.04] last:border-b-0">
      <div className="text-[9px] font-mono uppercase tracking-[0.32em] text-white/35 w-24 shrink-0">
        {role}
      </div>
      {avatar && (
        <img
          src={avatar}
          alt=""
          className="w-6 h-6 rounded-full border border-white/[0.06] object-cover"
        />
      )}
      <div className="text-[13px] text-white/85 truncate">{name}</div>
    </div>
  );
}
