/**
 * GlobalPublishWizard — the wizard mounted once at app root, controlled
 * via a `window.dispatchEvent(new CustomEvent('sb:publish-wizard'))`
 * pattern so any surface can trigger it without prop-drilling.
 *
 *   window.dispatchEvent(new CustomEvent('sb:publish-wizard', {
 *     detail: { projectId: "uuid" },
 *   }));
 *
 * Optionally pass `detail.onPublished` (a string identifier — *not* a
 * function, since CustomEvent serialization across boundaries can be
 * lossy) or use the wizard's default behaviour of navigating to the new
 * reel.
 */
import { useCallback, useEffect, useState } from "react";
import { PublishWizard } from "./PublishWizard";

interface PublishEventDetail {
  projectId: string;
}

declare global {
  interface WindowEventMap {
    'sb:publish-wizard': CustomEvent<PublishEventDetail>;
  }
}

export function GlobalPublishWizard() {
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: WindowEventMap['sb:publish-wizard']) => {
      const id = e.detail?.projectId;
      if (!id) return;
      setProjectId(id);
      setOpen(true);
    };
    window.addEventListener('sb:publish-wizard', handler);
    return () => window.removeEventListener('sb:publish-wizard', handler);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  return <PublishWizard open={open} projectId={projectId} onClose={close} />;
}

/** Tiny helper for call sites: `openPublishWizard("<projectId>")`. */
export function openPublishWizard(projectId: string) {
  window.dispatchEvent(new CustomEvent('sb:publish-wizard', { detail: { projectId } }));
}
