/**
 * createDraftProject — mint a fresh `movie_projects` row from inside
 * the editor when the user is on the empty NLE surface (`/editor`
 * with no `:id`).
 *
 * Why this exists:
 *   The editor never auto-loads a project (per
 *   src/pages/Editor/index.tsx, comment block). When the user hits
 *   Create / Media / Script from the empty surface, the original
 *   surfaces bail with "Open a project first" because they have no
 *   `project_id` to attach a row to. This helper lets each surface
 *   mint a draft project on-the-fly so the user's first verb in the
 *   editor — type a brief, drop an upload, save a screenplay — just
 *   works.
 *
 * Schema parity with StudioContext.createProject:
 *   Same column shape so a project minted here is indistinguishable
 *   from a project minted in Studio. Title is the same
 *   `Draft {short-date} {time}` format. `status='draft'`,
 *   `target_duration_minutes=1`, `organization_id` stamped when an
 *   org is active in localStorage.
 *
 * Caller contract:
 *   await createDraftProject() — returns the new project id on
 *   success, or null on failure. On null, callers should toast their
 *   own error and bail. The helper itself stays silent so callers
 *   own the UX wording for their specific surface.
 */
import { supabase } from "@/integrations/supabase/client";

export async function createDraftProject(): Promise<string | null> {
  // Always re-read the live session — relying on cached auth context
  // can give us a stale user when the helper is called immediately
  // after a sign-in or token refresh.
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;

  // Title mirrors StudioContext.createProject so projects minted from
  // anywhere look identical in the Library card list.
  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const dateStr = now.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const draftTitle = `Draft ${dateStr} ${timeStr}`;

  // Stamp organization_id when the active session is acting inside a
  // workspace, so org admins can see the project. Same key as
  // WorkspaceContext.
  let orgId: string | null = null;
  try { orgId = localStorage.getItem("smallbridges.currentOrgId"); } catch { /* ssr / no-store */ }

  const { data, error } = await supabase
    .from("movie_projects")
    .insert({
      title: draftTitle,
      status: "draft",
      target_duration_minutes: 1,
      user_id: session.user.id,
      ...(orgId ? { organization_id: orgId } : {}),
    })
    .select("id")
    .single();

  if (error || !data) {
    // eslint-disable-next-line no-console
    console.warn("[createDraftProject] insert failed", error);
    return null;
  }
  return data.id as string;
}
