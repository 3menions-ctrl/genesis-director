/**
 * Blog — /blog and /blog/:slug
 *
 * Thin shell over the content registry. Article bodies live as .md files under
 * src/content/blog/; this page renders the index (featured + category-filtered
 * grid) and the per-article detail view. Articles are URL-routed (/blog/:slug)
 * so each post is independently shareable and indexable, with per-article
 * <title>/description and Article JSON-LD for SEO.
 */
import { useMemo, useState, lazy, Suspense } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, Clock, User, Tag, Share2, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SafeMarkdownRenderer } from '@/components/content/SafeMarkdownRenderer';
import { Logo } from '@/components/ui/Logo';
import { usePageMeta } from '@/hooks/usePageMeta';
import { BLOG_ARTICLES, BLOG_CATEGORIES, type BlogArticle } from '@/content/blog';
import { BlogCover } from '@/components/blog/BlogCover';

const AbstractBackground = lazy(() => import('@/components/landing/AbstractBackground'));
const Footer = lazy(() => import('@/components/cinema/Footer').then((m) => ({ default: m.Footer })));

function TopNav({ showAuth = true }: { showAuth?: boolean }) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-6 lg:px-12 py-5 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <Logo size="md" showText textClassName="text-base" />
        </Link>
        {showAuth && (
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => { window.location.href = '/auth'; }}
              className="h-9 px-4 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-full">
              Sign in
            </Button>
            <Button onClick={() => { window.location.href = '/auth?mode=signup'; }}
              className="h-9 px-5 text-sm font-medium rounded-full bg-white text-black hover:bg-white/90 btn-star-blink">
              Get Started
            </Button>
          </div>
        )}
      </div>
    </nav>
  );
}

function ArticleMeta({ article }: { article: BlogArticle }) {
  // Per-article SEO: title + description.
  usePageMeta({
    title: `${article.title} — Small Bridges`,
    description: article.excerpt,
  });
  // Article structured data for rich results.
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
    <div className="min-h-screen bg-[#000] overflow-hidden relative">
      <ArticleMeta article={article} />
      <Suspense fallback={<div className="fixed inset-0 bg-[#000]" />}>
        <AbstractBackground className="fixed inset-0 z-0" />
      </Suspense>
      <TopNav showAuth={false} />

      <div className="relative z-10 pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-6">
          <Link to="/blog" className="inline-flex items-center gap-2 mb-8 text-white/75 hover:text-white transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> Back to Blog
          </Link>

          <motion.article initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <BlogCover variant="detail" title={article.title} seed={article.slug} className="rounded-3xl mb-8">
              <div className="absolute bottom-0 left-0 p-7 md:p-9">
                <Badge className="bg-white/10 text-white/80 border-0 backdrop-blur-sm">{article.category}</Badge>
              </div>
            </BlogCover>

            <div className="flex flex-wrap items-center gap-4 mb-6 text-white/75">
              <Badge variant="secondary" className="bg-white/10 text-white/70 border-0">{article.category}</Badge>
              <span className="flex items-center gap-1 text-sm"><Calendar className="w-4 h-4" />{article.date}</span>
              <span className="flex items-center gap-1 text-sm"><Clock className="w-4 h-4" />{article.readTime}</span>
              <span className="flex items-center gap-1 text-sm"><User className="w-4 h-4" />{article.author}</span>
            </div>

            <h1 className="text-3xl md:text-4xl font-bold text-white mb-8 leading-tight">{article.title}</h1>

            <div className="prose prose-invert prose-lg max-w-none">
              <SafeMarkdownRenderer content={article.content} variant="blog" className="text-white/70 leading-relaxed" />
            </div>

            {article.tags.length > 0 && (
              <div className="mt-12 pt-8 border-t border-white/10 flex flex-wrap items-center gap-2">
                <Tag className="w-4 h-4 text-white/75" />
                {article.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="border-white/20 text-white/60">{tag}</Badge>
                ))}
              </div>
            )}

            <div className="mt-8 flex items-center gap-4">
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
              <div className="grid sm:grid-cols-3 gap-5">
                {related.map((a) => (
                  <Link key={a.slug} to={`/blog/${a.slug}`} className="group">
                    <div className="rounded-2xl overflow-hidden bg-white/[0.03] border border-white/[0.05] hover:border-white/[0.12] transition-all">
                      <BlogCover variant="related" title={a.title} seed={a.slug} />
                      <div className="p-4">
                        <h3 className="text-sm font-semibold text-white line-clamp-2 group-hover:text-white/90">{a.title}</h3>
                      </div>
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
    <div className="min-h-screen bg-[#000] overflow-hidden relative">
      <Suspense fallback={<div className="fixed inset-0 bg-[#000]" />}>
        <AbstractBackground className="fixed inset-0 z-0" />
      </Suspense>
      <TopNav />

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

          {/* Featured (only on All) */}
          {active === 'All' && featured && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
              className="mb-12">
              <Link to={`/blog/${featured.slug}`} className="group block">
                <div className="relative rounded-3xl overflow-hidden border border-white/[0.05] hover:border-white/[0.12] transition-all duration-300">
                  <BlogCover variant="featured" title={featured.title} seed={featured.slug}>
                    <div className="absolute bottom-0 left-0 right-0 p-8 md:p-10">
                      <Badge className="mb-4 bg-white/10 text-white/80 border-0 backdrop-blur-sm">
                        <span className="text-amber-300/90 mr-1.5">★</span> Featured · {featured.category}
                      </Badge>
                      <h2 className="text-2xl md:text-4xl font-bold text-white mb-3 max-w-3xl tracking-[-0.02em] group-hover:text-white/90 transition-colors">{featured.title}</h2>
                      <p className="text-white/60 mb-4 max-w-2xl text-[15px] leading-relaxed line-clamp-2">{featured.excerpt}</p>
                      <div className="flex items-center gap-3 text-white/55 text-sm">
                        <span>{featured.author}</span><span className="text-white/25">•</span>
                        <span>{featured.date}</span><span className="text-white/25">•</span><span>{featured.readTime}</span>
                      </div>
                    </div>
                  </BlogCover>
                </div>
              </Link>
            </motion.div>
          )}

          {/* Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((article, i) => (
              <motion.div key={article.slug} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: Math.min(i * 0.05, 0.4) }}>
                <Link to={`/blog/${article.slug}`} className="group block h-full">
                  <div className="h-full rounded-2xl overflow-hidden bg-white/[0.03] border border-white/[0.05] hover:border-white/[0.12] hover:bg-white/[0.05] transition-all duration-300">
                    <BlogCover variant="card" title={article.title} seed={article.slug} />
                    <div className="p-5">
                      <Badge variant="secondary" className="mb-3 bg-white/10 text-white/60 border-0 text-xs">{article.category}</Badge>
                      <h3 className="text-[16px] font-semibold text-white mb-2 leading-snug group-hover:text-white/90 transition-colors line-clamp-2">{article.title}</h3>
                      <p className="text-white/55 text-sm mb-4 line-clamp-2">{article.excerpt}</p>
                      <div className="flex items-center justify-between text-white/45 text-xs">
                        <span>{article.date}</span>
                        <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{article.readTime}</span>
                      </div>
                    </div>
                  </div>
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
