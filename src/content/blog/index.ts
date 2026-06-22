/**
 * Blog content registry.
 *
 * Each article lives in its own .md file under this directory with a YAML
 * frontmatter block (title, slug, date, etc.) followed by markdown body.
 * At build time Vite eagerly inlines every .md as a raw string, we parse the
 * frontmatter once, and expose a typed array — Blog.tsx becomes a thin shell
 * over this registry instead of a 5,000-line dataset.
 */

import { hueFromSlug } from '@/components/blog/BlogCover';

export interface BlogArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  /**
   * Raw frontmatter image key, retained for backwards compatibility. Covers are
   * no longer rendered from photo files — see `hue` and {@link BlogCover}.
   */
  image: string;
  /** Deterministic base hue (0–359) for the generated cover, derived from slug. */
  hue: number;
  author: string;
  date: string;
  readTime: string;
  category: string;
  tags: string[];
  content: string;
}

// Vite-native eager glob: every .md file in this folder loaded as raw string.
const RAW = import.meta.glob<string>('./*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
});

function parseFrontmatter(raw: string): { meta: Record<string, unknown>; body: string } {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(raw);
  if (!m) return { meta: {}, body: raw };
  const meta: Record<string, unknown> = {};
  for (const line of m[1].split('\n')) {
    const km = /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.+)$/.exec(line.trim());
    if (!km) continue;
    const [, key, rawVal] = km;
    let val = rawVal.trim();
    // Array values: `tags: ["a", "b"]`
    if (val.startsWith('[') && val.endsWith(']')) {
      meta[key] = val
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^"(.*)"$/, '$1'))
        .filter(Boolean);
      continue;
    }
    // Quoted string
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }
    meta[key] = val;
  }
  return { meta, body: m[2].trim() };
}

export const BLOG_ARTICLES: BlogArticle[] = Object.entries(RAW)
  .map(([_, raw]) => {
    const { meta, body } = parseFrontmatter(raw);
    const slug = String(meta.slug ?? '');
    const tags = Array.isArray(meta.tags) ? (meta.tags as string[]) : [];
    return {
      id: String(meta.id ?? ''),
      slug,
      title: String(meta.title ?? ''),
      excerpt: String(meta.excerpt ?? ''),
      image: String(meta.image ?? ''),
      hue: hueFromSlug(slug),
      author: String(meta.author ?? 'Small Bridges Team'),
      date: String(meta.date ?? ''),
      readTime: String(meta.readTime ?? ''),
      category: String(meta.category ?? ''),
      tags,
      content: body,
    } as BlogArticle;
  })
  // Most recent first (assumes ISO-ish or "Month DD, YYYY" string).
  .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));

export const BLOG_CATEGORIES = Array.from(
  new Set(BLOG_ARTICLES.map((a) => a.category).filter(Boolean)),
);
