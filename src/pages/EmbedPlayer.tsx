/**
 * EmbedPlayer — `/embed/{slug}` minimal iframe-friendly player.
 *
 * Strip everything that would compete with the host page: no nav, no
 * background, no controls overlay until hover. Branded "Made on Small Bridges"
 * pill in the corner that links back to the public share page.
 *
 * Adapts to iframe dimensions automatically — `object-contain` keeps
 * the video uncropped no matter what aspect the embedder picks.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Play, ExternalLink } from 'lucide-react';
import { BrandedVideoPlayer } from '@/components/intro/BrandedVideoPlayer';
import { supabase } from '@/integrations/supabase/client';

import { usePageMeta } from '@/hooks/usePageMeta';
interface ProjectRow {
  id: string;
  title: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
}

export default function EmbedPlayer() {
  usePageMeta({ title: "Embed Player — Small Bridges" });

  const { slug = '' } = useParams<{ slug: string }>();
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      const { data: share } = await supabase
        .from('project_shares')
        .select('project_id')
        .eq('slug', slug)
        .eq('is_public', true)
        .maybeSingle();
      if (cancelled) return;
      if (!share) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const { data: proj } = await supabase
        .from('movie_projects')
        .select('id, title, video_url, thumbnail_url')
        .eq('id', share.project_id)
        .maybeSingle<ProjectRow>();
      if (cancelled) return;
      setProject(proj ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return <div className="min-h-screen bg-black" />;
  }
  if (notFound || !project) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white/55 text-[12px] font-mono uppercase tracking-[0.3em] gap-2">
        <span>Reel not found</span>
        <a
          href="https://smallbridges.com"
          className="text-brand-light hover:text-white inline-flex items-center gap-1"
          target="_blank" rel="noopener noreferrer"
        >
          Small Bridges <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {project.video_url ? (
        <BrandedVideoPlayer
          src={project.video_url}
          poster={project.thumbnail_url ?? undefined}
          playerKey={`embed:${project.id}`}
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

      {/* Branded "Made on Small Bridges" pill — links back to the full share page. */}
      <a
        href={`https://smallbridges.com/p/${slug}`}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-[10px] font-mono uppercase tracking-[0.28em] text-white/80 hover:text-white"
      >
        Made on Small Bridges <ExternalLink className="w-2.5 h-2.5" />
      </a>
    </div>
  );
}
