/**
 * Editor — the mount point.
 *
 * Behaviour:
 *   - /editor              — query the user's most recent project, redirect to /editor/{id}.
 *                            If they have no projects yet, mount the editor with an
 *                            empty/onboarding state inside it (NOT a separate chooser page).
 *   - /editor/:id          — full editor surface for the project.
 *   - /workspace/editor    — re-exported via WorkspaceEditor (same surface).
 *   - /admin/editor        — same surface, admin-scoped via route.
 *
 * Clicking "Editor" in the LeftRail lands the user directly in the editor — never
 * on an intermediate chooser. If a project ID is in the URL, we use it; otherwise we
 * auto-pick the user's most recent project on the server before rendering the shell.
 */
import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { Film, Loader2, Sparkles, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";
import { FoundationShell } from "@/components/foundation/FoundationShell";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useProject } from "@/hooks/editor/useProject";
import { usePersistence } from "@/hooks/editor/usePersistence";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { EditorShell } from "./EditorShell";

export default function Editor() {
  const { id } = useParams<{ id?: string }>();

  usePageMeta({
    title: id
      ? `Editor — ${id.slice(0, 8)} — Small Bridges`
      : "Editor — Small Bridges",
    description:
      "The Small Bridges Editor — Stage, Timeline, Script, Storyboard. AI as a first-class collaborator. Versions, not undo.",
  });

  // With an explicit id, mount the project editor directly.
  if (id) {
    return <EditorWithProject id={id} />;
  }
  // Without one, auto-pick the user's most recent project + redirect.
  return <EditorAutoPick />;
}

/**
 * EditorWithProject — separate component so the project hooks
 * (useProject + usePersistence) only run when there's actually a
 * project id to load.
 */
function EditorWithProject({ id }: { id: string }) {
  useProject(id);
  usePersistence(id);
  return (
    <FoundationShell bare>
      <EditorShell />
    </FoundationShell>
  );
}

/**
 * EditorAutoPick — runs when the user lands on /editor with no id.
 * Queries movie_projects for their most recent row, then redirects
 * to /editor/{id}. If they have zero projects, the editor mounts
 * with an inline onboarding panel — no intermediate page.
 */
function EditorAutoPick() {
  const { user, loading: authLoading } = useAuth();
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [noProjects, setNoProjects] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await supabase
          .from("movie_projects")
          .select("id")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        if (data?.id) {
          setRedirectTo(`/editor/${data.id}`);
        } else {
          setNoProjects(true);
        }
      } catch {
        if (!cancelled) setNoProjects(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  if (redirectTo) return <Navigate to={redirectTo} replace />;

  // Loading / signed-out / empty — all render inside the editor's
  // own shell so the user feels they ARE in the editor, never
  // bounced to a separate page.
  return (
    <FoundationShell bare>
      <div className="relative h-[100dvh] flex items-center justify-center">
        {loading ? (
          <div className="text-center">
            <Loader2 className="h-6 w-6 text-accent animate-spin mx-auto" strokeWidth={1.5} />
            <p className={cn(TYPE_META, "mt-5 text-muted-foreground/55 tracking-[0.32em]")}>
              Opening the cutting room
            </p>
          </div>
        ) : !user ? (
          <EditorEmptyState
            title="Sign in to edit."
            sub="The cutting room belongs to you — projects, takes, edits all live with your account."
            ctaTo="/auth"
            ctaLabel="Sign in"
          />
        ) : noProjects ? (
          <EditorEmptyState
            title="No films yet."
            sub="Direct your first reel in Studio. Once it has a clip, the cutting room opens to it automatically."
            ctaTo="/studio"
            ctaLabel="Open Studio"
          />
        ) : null}
      </div>
    </FoundationShell>
  );
}

function EditorEmptyState({
  title,
  sub,
  ctaTo,
  ctaLabel,
}: {
  title: string;
  sub: string;
  ctaTo: string;
  ctaLabel: string;
}) {
  return (
    <div className="text-center max-w-md px-6">
      <div className={cn(TYPE_META, "text-muted-foreground/55 tracking-[0.34em] flex items-center justify-center gap-2")}>
        <Film className="h-3 w-3 text-accent/70" strokeWidth={1.5} />
        <span>◆ Cutting room</span>
      </div>
      <h1
        className="mt-5 font-display italic font-light tracking-tight leading-[1.0]"
        style={{
          fontFamily: "'Fraunces', serif",
          fontSize: "clamp(2.4rem, 4vw, 3.4rem)",
        }}
      >
        <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/55 bg-clip-text text-transparent">
          {title}
        </span>
      </h1>
      <p className="mt-6 text-[15px] leading-relaxed font-light text-muted-foreground/70">
        {sub}
      </p>
      <Link
        to={ctaTo}
        className="group/cta mt-8 inline-flex items-center gap-2 text-[14.5px] text-accent"
      >
        <Sparkles className="h-4 w-4" strokeWidth={1.5} />
        <span className="relative">
          {ctaLabel}
          <span
            aria-hidden
            className="absolute -bottom-1 left-0 right-0 h-px origin-left scale-x-0 bg-gradient-to-r from-accent via-accent to-accent/40 transition-transform duration-500 ease-out group-hover/cta:scale-x-100"
          />
        </span>
        <ArrowUpRight
          className="h-3.5 w-3.5 transition-transform group-hover/cta:translate-x-0.5 group-hover/cta:-translate-y-0.5"
          strokeWidth={1.5}
        />
      </Link>
    </div>
  );
}
