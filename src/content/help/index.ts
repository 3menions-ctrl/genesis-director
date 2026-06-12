/**
 * Help Center content registry.
 *
 * Articles live under src/content/help/<category>/<slug>.md with frontmatter
 * declaring the category + title. At build time we glob every .md and group
 * them by category — HelpCenter.tsx renders directly from this registry.
 */

export interface HelpArticle {
  id: string;
  slug: string;
  category: string;
  categoryTitle: string;
  title: string;
  description: string;
  content: string;
}

export interface HelpCategory {
  id: string;
  title: string;
  articles: HelpArticle[];
}

const RAW = import.meta.glob<string>('./**/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
});

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(raw);
  if (!m) return { meta: {}, body: raw };
  const meta: Record<string, string> = {};
  for (const line of m[1].split('\n')) {
    const km = /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.+)$/.exec(line.trim());
    if (!km) continue;
    let val = km[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }
    meta[km[1]] = val;
  }
  return { meta, body: m[2].trim() };
}

const articles: HelpArticle[] = Object.entries(RAW).map(([path, raw]) => {
  const { meta, body } = parseFrontmatter(raw);
  // Path is like "./getting-started/quick-tips.md"; second segment = category.
  const pathCategory = path.split('/')[1] ?? meta.category ?? 'misc';
  return {
    id: meta.id ?? meta.slug ?? pathCategory,
    slug: meta.slug ?? path.split('/').pop()!.replace(/\.md$/, ''),
    category: meta.category ?? pathCategory,
    categoryTitle: meta.categoryTitle ?? pathCategory,
    title: meta.title ?? '',
    description: meta.description ?? '',
    content: body,
  };
});

export const HELP_ARTICLES = articles;

export const HELP_CATEGORIES: HelpCategory[] = (() => {
  const byCategory = new Map<string, HelpCategory>();
  for (const a of articles) {
    if (!byCategory.has(a.category)) {
      byCategory.set(a.category, {
        id: a.category,
        title: a.categoryTitle || a.category,
        articles: [],
      });
    }
    byCategory.get(a.category)!.articles.push(a);
  }
  return Array.from(byCategory.values());
})();
