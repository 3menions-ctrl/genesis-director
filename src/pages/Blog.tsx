/**
 * Blog — /blog and /blog/:slug
 *
 * Thin shell over the content registry. Article bodies live as .md files under
 * src/content/blog/; this page renders the index (featured + category-filtered
 * grid) and the per-article detail view. Articles are URL-routed (/blog/:slug)
 * so each post is independently shareable and indexable, with per-article
 * <title>/description and Article JSON-LD for SEO.
 *
 * No cover artwork — the blog is typography-forward on a clean, static
 * editorial backdrop (no canvas/animation, light on every device).
 */
import { useMemo, useState, lazy, Suspense } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, Clock, User, Tag, Share2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SafeMarkdownRenderer } from '@/components/content/SafeMarkdownRenderer';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { usePageMeta } from '@/hooks/usePageMeta';
import { BLOG_ARTICLES, BLOG_CATEGORIES, type BlogArticle } from '@/content/blog';

const Footer = lazy(() => import('@/components/cinema/Footer').then((m) => ({ default: m.Footer })));

/** The magazine nameplate — a film term for where the edit happens. */
const MASTHEAD = 'The Cutting Room';

/**
 * Derive the "issue" framing from the most-recent article's date string — never
 * from Date.now(). Issue number counts months since the Jan 2026 launch; the
 * cover line reads e.g. "ISSUE 06 · June 2026 · 21 stories".
 */
function issueInfo(dateStr: string, count: number) {
  const d = new Date(dateStr);
  const valid = !Number.isNaN(d.getTime());
  const base = new Date('January 1, 2026');
  const monthsSince = valid
    ? (d.getFullYear() - base.getFullYear()) * 12 + (d.getMonth() - base.getMonth())
    : 0;
  const issueNo = String(Math.max(1, monthsSince + 1)).padStart(2, '0');
  const monthYear = valid ? d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '';
  return { issueNo, monthYear, count };
}

/**
 * Scoped editorial typography for the article body — a Fraunces drop cap on the
 * first paragraph and magazine pull-quotes from blockquotes. The body renders as
 * real <p>/<blockquote> nodes inside `.article-body`, so a single first-of-type
 * rule wins on specificity without touching the renderer's logic.
 */
const ARTICLE_BODY_CSS = `
.article-body p:first-of-type::first-letter {
  float: left;
  font-family: Fraunces, Georgia, 'Times New Roman', serif;
  font-weight: 600;
  font-size: 4.6rem;
  line-height: 0.74;
  padding: 0.36rem 0.7rem 0 0;
  margin-top: 0.12rem;
  color: #fff;
}
.article-body blockquote {
  border-left: 2px solid rgba(167, 139, 250, 0.75);
  background: transparent;
  border-radius: 0;
  margin: 2.75rem 0;
  padding: 0.1rem 0 0.1rem 1.75rem;
  font-family: Fraunces, Georgia, 'Times New Roman', serif;
  font-style: italic;
  font-weight: 500;
  font-size: clamp(1.4rem, 2.4vw, 1.9rem);
  line-height: 1.32;
  letter-spacing: -0.01em;
  color: rgba(255, 255, 255, 0.86);
}
`;

const NOISE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";

// Clean, premium, STATIC editorial backdrop — a soft top bloom, a fine masked
// grid, and faint grain. No canvas, no animation, no images.
function BlogBackdrop() {
  return (
    <div aria-hidden className="fixed inset-0 z-0 bg-[#08130c]">
      {/* 60% dark blind */}
      <div className="absolute inset-0 bg-black/60" />
      {/* light-green → dark-green shade */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(159deg, rgba(150,205,110,0.16) 0%, rgba(20,58,34,0.40) 42%, rgba(5,16,10,0.88) 92%)',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.026) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.026) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(100% 65% at 50% 0%, #000 20%, transparent 82%)',
          WebkitMaskImage: 'radial-gradient(100% 65% at 50% 0%, #000 20%, transparent 82%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.04] mix-blend-overlay"
        style={{ backgroundImage: `url("${NOISE}")`, backgroundSize: '180px 180px' }}
      />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#08130c] to-transparent" />
    </div>
  );
}

function ArticleMeta({ article }: { article: BlogArticle }) {
  usePageMeta({
    title: `${article.title} — Small Bridges`,
    description: article.excerpt,
  });
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.excerpt,
    datePublished: article.date,
    author: { '@type': 'Organization', name: article.author },
    publisher: { '@type': 'Organization', name: 'Small Bridges' },
    articleSection: article.category,
    keywords: article.tags.join(', '),
    url: `https://smallbridges.co/blog/${article.slug}`,
  };
  // Escape "<" so a malicious title/excerpt containing "</script>" cannot
  // break out of the JSON-LD script element (XSS via dangerouslySetInnerHTML).
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />;
}

function ArticleDetail({ article }: { article: BlogArticle }) {
  const related = useMemo(
    () => BLOG_ARTICLES.filter((a) => a.slug !== article.slug && a.category === article.category).slice(0, 3),
    [article],
  );
  const share = async () => {
    const url = `${window.location.origin}/blog/${article.slug}`;
    try {
      if (navigator.share) await navigator.share({ title: article.title, url });
      else await navigator.clipboard.writeText(url);
    } catch { /* user cancelled */ }
  };

  return (
    <div className="min-h-screen bg-[#050507] overflow-hidden relative">
      <ArticleMeta article={article} />
      <BlogBackdrop />
      <MarketingHeader />

      <div className="relative z-10 pt-28 pb-16">
        <div className="max-w-4xl mx-auto px-6">
          <Link to="/blog" className="inline-flex items-center gap-2 mb-10 text-white/60 hover:text-white transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> Back to Blog
          </Link>

          <motion.article initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            {/* Typographic header — no cover art */}
            <header className="mb-10">
              <div className="text-[11px] font-mono uppercase tracking-[0.32em] text-white/45 mb-5">{article.category}</div>
              <h1 className="text-3xl md:text-5xl font-bold text-white leading-[1.06] tracking-[-0.02em]">{article.title}</h1>
              <p className="mt-5 text-lg text-white/55 leading-relaxed">{article.excerpt}</p>
              <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-2 text-white/45 text-[13px]">
                <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" />{article.author}</span>
                <span className="text-white/20">·</span>
                <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />{article.date}</span>
                <span className="text-white/20">·</span>
                <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{article.readTime}</span>
              </div>
              <div className="mt-8 h-px w-full bg-gradient-to-r from-white/15 via-white/5 to-transparent" />
            </header>

            <style>{ARTICLE_BODY_CSS}</style>
            <div className="prose prose-invert prose-lg max-w-none">
              <SafeMarkdownRenderer content={article.content} variant="blog" className="article-body text-white/70 leading-relaxed" />
            </div>

            {article.tags.length > 0 && (
              <div className="mt-12 pt-8 border-t border-white/10 flex flex-wrap items-center gap-2">
                <Tag className="w-4 h-4 text-white/55" />
                {article.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="border-white/20 text-white/60">{tag}</Badge>
                ))}
              </div>
            )}

            <div className="mt-8 flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={share}
                className="border-white/20 text-white/60 hover:bg-white/5 hover:text-white">
                <Share2 className="w-4 h-4 mr-2" /> Share Article
              </Button>
              <Button size="sm" onClick={() => { window.location.href = '/auth?mode=signup'; }}
                className="rounded-full bg-white text-black hover:bg-white/90">
                Try Small Bridges free
              </Button>
            </div>
          </motion.article>

          {related.length > 0 && (
            <div className="mt-16 pt-8">
              <div className="flex items-center gap-4 mb-1">
                <span className="text-[10px] font-mono uppercase tracking-[0.34em] text-white/45 whitespace-nowrap">
                  Also in {article.category}
                </span>
                <span className="h-px flex-1 bg-white/12" />
              </div>
              <ol className="mt-2">
                {related.map((a, i) => (
                  <li key={a.slug} className="border-t border-white/[0.09]">
                    <Link to={`/blog/${a.slug}`} className="group flex items-baseline gap-5 py-5">
                      <span className="font-mono text-[11px] text-white/35 tabular-nums pt-1 w-6 shrink-0">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-display text-lg md:text-xl text-white leading-snug tracking-[-0.01em]">
                          <span className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-no-repeat bg-left-bottom transition-[background-size] duration-300 group-hover:bg-[length:100%_1px]">
                            {a.title}
                          </span>
                        </span>
                        <span className="mt-1 block text-[11px] font-mono uppercase tracking-[0.22em] text-white/35">
                          {a.readTime}
                        </span>
                      </span>
                      <ArrowRight className="ml-auto w-4 h-4 self-center text-white/30 shrink-0 transition-all group-hover:text-white/70 group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>

      <Suspense fallback={null}><Footer /></Suspense>
    </div>
  );
}

function BlogIndex() {
  usePageMeta({
    title: 'Blog — AI Video Creation Guides & Cinematic Tutorials | Small Bridges',
    description: 'Guides, tutorials, and comparisons on AI video creation — text-to-video, avatars, music videos, character consistency, and the craft of cinematic AI filmmaking.',
  });

  const [active, setActive] = useState<string>('All');
  const categories = useMemo(() => ['All', ...BLOG_CATEGORIES], []);
  const [featured, ...rest] = BLOG_ARTICLES;
  const filtered = active === 'All' ? rest : BLOG_ARTICLES.filter((a) => a.category === active && a.slug !== featured?.slug);

  // Issue framing, derived from the most-recent article's date (BLOG_ARTICLES
  // is sorted newest-first, so featured.date is the freshest dateline).
  const issue = issueInfo(featured?.date ?? '', BLOG_ARTICLES.length);

  // Editorial grid: the first filtered story runs LARGE as the section lead,
  // the rest flow as a numbered, hairline-ruled index.
  const [lead, ...entries] = filtered;

  return (
    <div className="min-h-screen bg-[#050507] overflow-hidden relative">
      <BlogBackdrop />
      <MarketingHeader />

      <div className="relative z-10 pt-28 pb-20">
        <div className="max-w-6xl mx-auto px-6">
          {/* ── Issue masthead ─────────────────────────────────────────── */}
          <motion.header
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="border-y border-white/12 py-7 mb-14"
          >
            <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-[0.42em] text-white/45 mb-2">
                  Small Bridges presents
                </div>
                <h1 className="font-display text-white font-semibold leading-[0.9] tracking-[-0.02em] text-[clamp(2.6rem,8vw,5.5rem)]">
                  {MASTHEAD}
                </h1>
              </div>
              <div className="text-[11px] font-mono uppercase tracking-[0.26em] text-white/45 pb-1">
                Issue {issue.issueNo}
                {issue.monthYear && <> · {issue.monthYear}</>} · {issue.count} stories
              </div>
            </div>
            <p className="mt-5 max-w-2xl font-display italic text-white/55 text-base md:text-lg leading-relaxed">
              Editor's note — tutorials, comparisons, and playbooks for turning a line of text into
              cinema. No cover art here; the pictures are in the prompts.
            </p>
          </motion.header>

          {/* ── Cover story (only on All) ──────────────────────────────── */}
          {active === 'All' && featured && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.08 }}
              className="mb-16"
            >
              <Link to={`/blog/${featured.slug}`} className="group block">
                <div className="text-[11px] font-mono uppercase tracking-[0.34em] text-white/55 mb-5">
                  <span className="text-violet-300/90">Cover story</span>
                  <span className="text-white/25 mx-2">·</span>
                  {featured.category}
                </div>
                <h2 className="font-display font-semibold text-white tracking-[-0.025em] leading-[0.96] max-w-4xl text-[clamp(2.2rem,6vw,5rem)]">
                  <span className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_2px] bg-no-repeat bg-left-bottom transition-[background-size] duration-500 group-hover:bg-[length:100%_2px]">
                    {featured.title}
                  </span>
                </h2>
                <p className="mt-6 max-w-2xl text-white/60 text-lg leading-relaxed">{featured.excerpt}</p>
                <div className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] font-mono uppercase tracking-[0.16em] text-white/45">
                  <span>{featured.author}</span><span className="text-white/20">·</span>
                  <span>{featured.date}</span><span className="text-white/20">·</span>
                  <span>{featured.readTime}</span>
                </div>
                <span className="mt-6 inline-flex items-center gap-2 text-sm text-white/85 group-hover:gap-3 transition-all">
                  Read the story <ArrowRight className="w-4 h-4" />
                </span>
              </Link>
            </motion.section>
          )}

          {/* ── Departments (category filter) ──────────────────────────── */}
          <div className="mb-12">
            <div className="flex items-center gap-4 mb-5">
              <span className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/45 whitespace-nowrap">
                Departments
              </span>
              <span className="h-px flex-1 bg-white/12" />
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setActive(c)}
                  className={
                    'pb-1 text-[12px] font-mono uppercase tracking-[0.22em] transition-colors border-b ' +
                    (active === c
                      ? 'text-white border-white'
                      : 'text-white/45 border-transparent hover:text-white/85 hover:border-white/30')
                  }
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* ── Lead of the department (asymmetric emphasis) ───────────── */}
          {lead && (
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5 }}
              className="mb-12 pb-12 border-b border-white/12"
            >
              <Link to={`/blog/${lead.slug}`} className="group grid md:grid-cols-[auto,1fr] gap-x-8 gap-y-4">
                <span className="font-mono text-xs text-white/35 tabular-nums pt-2">01</span>
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.32em] text-white/45 mb-3">{lead.category}</div>
                  <h3 className="font-display font-semibold text-white tracking-[-0.02em] leading-[1.02] max-w-3xl text-[clamp(1.8rem,4.2vw,3.2rem)]">
                    <span className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1.5px] bg-no-repeat bg-left-bottom transition-[background-size] duration-500 group-hover:bg-[length:100%_1.5px]">
                      {lead.title}
                    </span>
                  </h3>
                  <p className="mt-4 max-w-2xl text-white/55 leading-relaxed line-clamp-2">{lead.excerpt}</p>
                  <div className="mt-4 text-[11px] font-mono uppercase tracking-[0.18em] text-white/40">
                    {lead.date} · {lead.readTime}
                  </div>
                </div>
              </Link>
            </motion.div>
          )}

          {/* ── Editorial index — numbered, hairline-ruled, no cards ───── */}
          <div className="grid md:grid-cols-2 gap-x-12">
            {entries.map((article, i) => (
              <motion.div
                key={article.slug}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.4, delay: Math.min((i % 2) * 0.05, 0.1) }}
                className="border-t border-white/[0.09]"
              >
                <Link to={`/blog/${article.slug}`} className="group flex gap-5 py-7">
                  <span className="font-mono text-xs text-white/35 tabular-nums pt-1.5 w-7 shrink-0">
                    {String(i + 2).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/40 mb-2.5">{article.category}</div>
                    <h3 className="font-display font-semibold text-white tracking-[-0.01em] leading-[1.1] text-[clamp(1.25rem,2.4vw,1.7rem)]">
                      <span className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-no-repeat bg-left-bottom transition-[background-size] duration-300 group-hover:bg-[length:100%_1px]">
                        {article.title}
                      </span>
                    </h3>
                    <p className="mt-2.5 text-white/50 text-sm leading-relaxed line-clamp-2">{article.excerpt}</p>
                    <div className="mt-3.5 text-[10px] font-mono uppercase tracking-[0.2em] text-white/35">
                      {article.date} · {article.readTime}
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

          {filtered.length === 0 && (
            <p className="text-white/45 font-mono text-sm uppercase tracking-[0.2em] py-12 text-center">
              No stories filed under this department yet.
            </p>
          )}
        </div>
      </div>

      <Suspense fallback={null}><Footer /></Suspense>
    </div>
  );
}

function ArticleNotFound() {
  // Unknown slug — show a graceful not-found within the SPA (no hard 404).
  usePageMeta({ title: 'Article not found — Small Bridges', description: 'This article could not be found.' });
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center text-center px-6">
      <h1 className="text-2xl font-bold text-white mb-3">Article not found</h1>
      <p className="text-white/55 mb-6">It may have moved or been retired.</p>
      <Link to="/blog" className="h-10 px-5 inline-flex items-center rounded-full bg-white text-black text-sm font-medium">Back to Blog</Link>
    </div>
  );
}

export default function Blog() {
  const { slug } = useParams();
  const article = slug ? BLOG_ARTICLES.find((a) => a.slug === slug) : null;

  if (slug && !article) {
    return <ArticleNotFound />;
  }

  return article ? <ArticleDetail article={article} /> : <BlogIndex />;
}
