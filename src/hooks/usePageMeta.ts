import { useEffect } from 'react';

interface PageMeta {
  title: string;
  description?: string;
  /**
   * Self-referencing canonical path for this route, e.g. "/blog".
   * If omitted, the current location pathname is used.
   * Final URL is resolved against https://smallbridges.com.
   */
  canonicalPath?: string;
}

const SITE_ORIGIN = 'https://smallbridges.com';

/**
 * Sets document title, meta description, and a self-referencing canonical
 * link tag for SEO. Each route should call this with a unique title /
 * description; the canonical defaults to the current pathname.
 * Cleans up by restoring defaults on unmount.
 */
export function usePageMeta({ title, description, canonicalPath }: PageMeta) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;

    let metaDesc = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    const prevDesc = metaDesc?.content;

    if (description) {
      if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.name = 'description';
        document.head.appendChild(metaDesc);
      }
      metaDesc.content = description;
    }

    // Self-referencing canonical per route (overrides the index.html default).
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    const prevHref = canonical?.href;
    const path = canonicalPath ?? (typeof window !== 'undefined' ? window.location.pathname : '/');
    const nextHref = `${SITE_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = nextHref;

    return () => {
      document.title = prevTitle;
      if (metaDesc && prevDesc !== undefined) {
        metaDesc.content = prevDesc;
      }
      if (canonical && prevHref !== undefined) {
        canonical.href = prevHref;
      }
    };
  }, [title, description, canonicalPath]);
}
