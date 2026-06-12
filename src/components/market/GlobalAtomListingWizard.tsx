/**
 * GlobalAtomListingWizard — app-root mount of the listing wizard.
 *
 *   window.dispatchEvent(new CustomEvent('sb:atom-listing-wizard', {
 *     detail: { defaultType: "voice" },   // optional
 *   }));
 *
 * Mirrors the GlobalPublishWizard pattern so any surface (Market hero
 * tile, editor pop-out, profile shop button) can trigger the wizard
 * without prop drilling.
 */
import { useCallback, useEffect, useState } from "react";
import { AtomListingWizard, type AtomType } from "./AtomListingWizard";

interface ListingEventDetail {
  defaultType?: AtomType;
}

declare global {
  interface WindowEventMap {
    'sb:atom-listing-wizard': CustomEvent<ListingEventDetail>;
  }
}

export function GlobalAtomListingWizard() {
  const [open, setOpen] = useState(false);
  const [defaultType, setDefaultType] = useState<AtomType | undefined>(undefined);

  useEffect(() => {
    const handler = (e: WindowEventMap['sb:atom-listing-wizard']) => {
      setDefaultType(e.detail?.defaultType);
      setOpen(true);
    };
    window.addEventListener('sb:atom-listing-wizard', handler);
    return () => window.removeEventListener('sb:atom-listing-wizard', handler);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  return <AtomListingWizard open={open} onClose={close} defaultType={defaultType} />;
}

/** Tiny helper for call sites. */
export function openAtomListingWizard(defaultType?: AtomType) {
  window.dispatchEvent(new CustomEvent('sb:atom-listing-wizard', {
    detail: { defaultType },
  }));
}
