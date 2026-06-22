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
import { ArrowLeft, Calendar, Clock, User, Tag, Share2, BookOpen, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SafeMarkdownRenderer } from '@/components/content/SafeMarkdownRenderer';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { usePageMeta } from '@/hooks/usePageMeta';
import { BLOG_ARTICLES, BLOG_CATEGORIES, type BlogArticle } from '@/content/blog';

const Footer = lazy(() => import('@/components/cinema/Footer').then((m) => ({ default: m.Footer })));

const NOISE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";

// Clean, premium, STATIC editorial backdrop — a soft top bloom, a fine masked
// grid, and faint grain. No canvas, no animation, no images.
function BlogBackdrop() {
  return (
    <div aria-hidden className="fixed inset-0 z-0 bg-[#08130c]">
      {/* shared Hoppy-park backdrop (avatar removed) — pinned to the top band */}
      <div
        className="absolute inset-x-0 top-0 h-[78vh]"
        style={{
          backgroundImage: 'url("/cinema-assets/footer-park.jpg")',
          backgroundSize: 'cover',
          backgroundPosition: 'center 42%',
          maskImage: 'linear-gradient(#000 58%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(#000 58%, transparent 100%)',
        }}
      />
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
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />;
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
        <div className="max-w-3xl mx-auto px-6">
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

            <div className="prose prose-invert prose-lg max-w-none">
              <SafeMarkdownRenderer content={article.content} variant="blog" className="text-white/70 leading-relaxed" />
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
            <div className="mt-16 pt-10 border-t border-white/10">
              <h2 className="text-lg font-semibold text-white mb-6">More in {article.category}</h2>
              <div className="grid sm:grid-cols-3 gap-4">
                {related.map((a) => (
                  <Link key={a.slug} to={`/blog/${a.slug}`} className="group">
                    <div className="h-full rounded-2xl bg-white/[0.025] border border-white/[0.06] hover:border-white/[0.14] hover:bg-white/[0.05] transition-all p-5">
                      <div className="text-[10px] font-mono uppercase tracking-[0.28em] text-white/40 mb-2">{a.category}</div>
                      <h3 className="text-sm font-semibold text-white leading-snug line-clamp-3 group-hover:text-white/90">{a.title}</h3>
                      <div className="mt-3 text-[11px] text-white/40">{a.readTime}</div>
                    </div>
                  </Link>
                ))}
              </div>
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

  return (
    <div className="min-h-screen bg-[#050507] overflow-hidden relative">
      <BlogBackdrop />
      <MarketingHeader />

      <div className="relative z-10 pt-28 pb-16">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="text-center mb-14">
            <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.32em] text-white/45 mb-5">
              <span className="h-px w-8 bg-gradient-to-r from-transparent to-white/30" />
              The Cutting Room
              <span className="h-px w-8 bg-gradient-to-l from-transparent to-white/30" />
            </div>
            <h1 className="text-5xl md:text-7xl font-bold mb-5 tracking-[-0.03em] leading-[0.95]">
              <span className="text-white">Field notes on </span>
              <span className="bg-gradient-to-br from-white via-white/90 to-white/40 bg-clip-text text-transparent">AI filmmaking</span>
            </h1>
            <p className="text-lg text-white/55 max-w-2xl mx-auto leading-relaxed">
              Tutorials, comparisons, and playbooks for turning prompts into cinema — from the Small Bridges team.
            </p>
          </motion.div>

          {/* Category filter */}
          <div className="flex flex-wrap justify-center gap-2 mb-12">
            {categories.map((c) => (
              <button key={c} onClick={() => setActive(c)}
                className={
                  'h-9 px-4 rounded-full text-[12px] font-medium transition-colors ' +
                  (active === c ? 'bg-white text-black' : 'bg-white/[0.05] text-white/65 hover:bg-white/[0.1] hover:text-white')
                }>
                {c}
              </button>
            ))}
          </div>

          {/* Featured (only on All) — typographic, no cover art */}
          {active === 'All' && featured && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
              className="mb-12">
              <Link to={`/blog/${featured.slug}`} className="group block">
                <article className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.05] hover:border-white/[0.14] transition-all duration-300 p-8 md:p-12">
                  <div aria-hidden className="absolute -top-24 -right-16 w-[420px] h-[420px] rounded-full pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(96,108,180,0.18), transparent 62%)', filter: 'blur(40px)' }} />
                  <div className="relative">
                    <Badge className="mb-5 bg-white/10 text-white/80 border-0">
                      <span className="text-amber-300/90 mr-1.5">★</span> Featured · {featured.category}
                    </Badge>
                    <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 max-w-3xl tracking-[-0.02em] leading-[1.04] group-hover:text-white/90 transition-colors">{featured.title}</h2>
                    <p className="text-white/60 mb-6 max-w-2xl text-[15px] md:text-base leading-relaxed line-clamp-2">{featured.excerpt}</p>
                    <div className="flex flex-wrap items-center gap-3 text-white/50 text-sm">
                      <span>{featured.author}</span><span className="text-white/25">•</span>
                      <span>{featured.date}</span><span className="text-white/25">•</span><span>{featured.readTime}</span>
                      <span className="ml-auto inline-flex items-center gap-1.5 text-white/80 group-hover:gap-2.5 transition-all">Read article <ArrowRight className="w-4 h-4" /></span>
                    </div>
                  </div>
                </article>
              </Link>
            </motion.div>
          )}

          {/* Grid — typographic cards, no cover art */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((article, i) => (
              <motion.div key={article.slug} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: Math.min(i * 0.05, 0.4) }}>
                <Link to={`/blog/${article.slug}`} className="group block h-full">
                  <article className="h-full flex flex-col rounded-2xl bg-white/[0.025] border border-white/[0.06] hover:border-white/[0.14] hover:bg-white/[0.05] transition-all duration-300 p-6">
                    <div className="text-[10px] font-mono uppercase tracking-[0.28em] text-white/40 mb-3">{article.category}</div>
                    <h3 className="text-[17px] font-semibold text-white mb-2.5 leading-snug tracking-[-0.01em] group-hover:text-white/90 transition-colors line-clamp-3">{article.title}</h3>
                    <p className="text-white/55 text-sm leading-relaxed mb-5 line-clamp-3">{article.excerpt}</p>
                    <div className="mt-auto flex items-center justify-between text-white/40 text-xs pt-4 border-t border-white/[0.06]">
                      <span>{article.date}</span>
                      <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{article.readTime}</span>
                    </div>
                  </article>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <Suspense fallback={null}><Footer /></Suspense>
    </div>
  );
}

export default function Blog() {
  const { slug } = useParams();
  const article = slug ? BLOG_ARTICLES.find((a) => a.slug === slug) : null;

  if (slug && !article) {
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

  return article ? <ArticleDetail article={article} /> : <BlogIndex />;
}
