/**
 * Blog content registry.
 *
 * Each article lives in its own .md file under this directory with a YAML
 * frontmatter block (title, slug, date, etc.) followed by markdown body.
 * At build time Vite eagerly inlines every .md as a raw string, we parse the
 * frontmatter once, and expose a typed array — Blog.tsx becomes a thin shell
 * over this registry instead of a 5,000-line dataset.
 */

import aiVideoEvolution from '@/assets/blog/ai-video-evolution.jpg';
import smallBusinessVideo from '@/assets/blog/small-business-video.jpg';
import videoAiPossibilities from '@/assets/blog/video-ai-possibilities.jpg';
import futureVideoCreation from '@/assets/blog/future-of-video-creation.jpg';
import aiAvatarGeneration from '@/assets/blog/ai-avatar-video-generation.jpg';
import seedanceMotion from '@/assets/blog/new/rise-of-generative-video.jpg';
import ecommerceAiVideo from '@/assets/blog/new/ecommerce-ai-video.jpg';
import tiktokCreatorsAi from '@/assets/blog/new/tiktok-creators-ai.jpg';
import multiSceneContinuity from '@/assets/blog/new/multi-character-dialogue.jpg';

const IMAGE_REGISTRY: Record<string, string> = {
  aiVideoEvolution,
  smallBusinessVideo,
  videoAiPossibilities,
  futureVideoCreation,
  aiAvatarGeneration,
  seedanceMotion,
  ecommerceAiVideo,
  tiktokCreatorsAi,
  multiSceneContinuity,
};

export interface BlogArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  image: string;
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

const FALLBACK_IMAGE = aiVideoEvolution;

export const BLOG_ARTICLES: BlogArticle[] = Object.entries(RAW)
  .map(([_, raw]) => {
    const { meta, body } = parseFrontmatter(raw);
    const imgKey = String(meta.image ?? '');
    const image = IMAGE_REGISTRY[imgKey] ?? FALLBACK_IMAGE;
    const tags = Array.isArray(meta.tags) ? (meta.tags as string[]) : [];
    return {
      id: String(meta.id ?? ''),
      slug: String(meta.slug ?? ''),
      title: String(meta.title ?? ''),
      excerpt: String(meta.excerpt ?? ''),
      image,
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
