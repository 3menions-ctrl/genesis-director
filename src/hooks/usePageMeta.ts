import { useEffect } from 'react';

interface PageMeta {
  title: string;
  description?: string;
}

/**
 * Sets document title and meta description for SEO.
 * Cleans up by restoring defaults on unmount.
 */
export function usePageMeta({ title, description }: PageMeta) {
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

    return () => {
      document.title = prevTitle;
      if (metaDesc && prevDesc !== undefined) {
        metaDesc.content = prevDesc;
      }
    };
  }, [title, description]);
}
