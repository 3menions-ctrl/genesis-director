import { useEffect } from 'react';

interface PageMeta {
  title: string;
  description?: string;
  /**
   * Self-referencing canonical path for this route, e.g. "/blog".
   * If omitted, the current location pathname is used.
   * Final URL is resolved against https://smallbridges.co.
   */
  canonicalPath?: string;
  /** Open Graph + Twitter Card image. ≥ 1200×630 for best unfurls. */
  ogImage?: string;
  /** og:type — defaults to "website". Use "profile" for /c/:id pages. */
  ogType?: string;
}

const SITE_ORIGIN = 'https://smallbridges.co';

/** Upsert a `<meta>` tag identified by an attribute=value pair. */
function setMeta(attr: 'name' | 'property', key: string, value: string) {
  let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  const prev = el.content;
  el.content = value;
  return () => {
    if (el && prev !== undefined) el.content = prev;
  };
}

/**
 * Sets document title, meta description, canonical link, and Open Graph /
 * Twitter Card tags. Each route should call this with a unique title /
 * description; the canonical defaults to the current pathname. Tags are
 * restored on unmount so HMR + route changes leave no stale state.
 */
export function usePageMeta({ title, description, canonicalPath, ogImage, ogType }: PageMeta) {
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

    // Open Graph + Twitter Card — restorable cleanups stacked at the end.
    const cleanups: Array<() => void> = [];
    cleanups.push(setMeta('property', 'og:title',       title));
    cleanups.push(setMeta('property', 'og:url',         nextHref));
    cleanups.push(setMeta('property', 'og:type',        ogType ?? 'website'));
    cleanups.push(setMeta('property', 'og:site_name',   'Small Bridges'));
    cleanups.push(setMeta('name',     'twitter:card',   ogImage ? 'summary_large_image' : 'summary'));
    cleanups.push(setMeta('name',     'twitter:title',  title));
    if (description) {
      cleanups.push(setMeta('property', 'og:description', description));
      cleanups.push(setMeta('name',     'twitter:description', description));
    }
    if (ogImage) {
      cleanups.push(setMeta('property', 'og:image',     ogImage));
      cleanups.push(setMeta('property', 'og:image:alt', title));
      cleanups.push(setMeta('name',     'twitter:image', ogImage));
    }

    return () => {
      document.title = prevTitle;
      if (metaDesc && prevDesc !== undefined) {
        metaDesc.content = prevDesc;
      }
      if (canonical && prevHref !== undefined) {
        canonical.href = prevHref;
      }
      for (const fn of cleanups) fn();
    };
  }, [title, description, canonicalPath, ogImage, ogType]);
}
