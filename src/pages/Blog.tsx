/**
 * Blog — /blog
 *
 * Thin shell over the MDX-style content registry. All article bodies live as
 * .md files under src/content/blog/; this page just renders the index grid
 * and the per-article detail view. See [src/content/blog/index.ts] for the
 * loader that handles frontmatter parsing + image resolution.
 */
import { useState, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, Clock, User, Tag, Share2, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SafeMarkdownRenderer } from '@/components/content/SafeMarkdownRenderer';
import { Logo } from '@/components/ui/Logo';
import { usePageMeta } from '@/hooks/usePageMeta';
import { BLOG_ARTICLES, type BlogArticle } from '@/content/blog';

const AbstractBackground = lazy(() => import('@/components/landing/AbstractBackground'));
const Footer = lazy(() => import('@/components/landing/Footer'));

export default function Blog() {
  usePageMeta({
    title: 'Blog — Small Bridges',
    description: 'Insights on AI video creation, avatar generation, and the future of filmmaking with Small Bridges.',
  });

  const [selectedArticle, setSelectedArticle] = useState<BlogArticle | null>(null);

  if (selectedArticle) {
    return (
      <div className="min-h-screen bg-[#000] overflow-hidden relative">
        <Suspense fallback={<div className="fixed inset-0 bg-[#000]" />}>
          <AbstractBackground className="fixed inset-0 z-0" />
        </Suspense>

        <nav className="fixed top-0 left-0 right-0 z-50 px-6 lg:px-12 py-5">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <Logo size="md" showText textClassName="text-base" />
            </Link>
          </div>
        </nav>

        <div className="relative z-10 pt-24 pb-16">
          <div className="max-w-4xl mx-auto px-6">
            <Button
              variant="ghost"
              onClick={() => setSelectedArticle(null)}
              className="mb-8 text-white/75 hover:text-white hover:bg-white/5"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Blog
            </Button>

            <motion.article
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="relative rounded-3xl overflow-hidden mb-8 aspect-video">
                <img
                  src={selectedArticle.image}
                  alt={selectedArticle.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              </div>

              <div className="flex flex-wrap items-center gap-4 mb-6 text-white/75">
                <Badge variant="secondary" className="bg-white/10 text-white/70 border-0">
                  {selectedArticle.category}
                </Badge>
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm">{selectedArticle.date}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">{selectedArticle.readTime}</span>
                </div>
                <div className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  <span className="text-sm">{selectedArticle.author}</span>
                </div>
              </div>

              <h1 className="text-3xl md:text-4xl font-bold text-white mb-8 leading-tight">
                {selectedArticle.title}
              </h1>

              <div className="prose prose-invert prose-lg max-w-none">
                <SafeMarkdownRenderer
                  content={selectedArticle.content}
                  variant="blog"
                  className="text-white/70 leading-relaxed"
                />
              </div>

              {selectedArticle.tags.length > 0 && (
                <div className="mt-12 pt-8 border-t border-white/10">
                  <div className="flex flex-wrap items-center gap-2">
                    <Tag className="w-4 h-4 text-white/75" />
                    {selectedArticle.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="border-white/20 text-white/60 hover:bg-white/5">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-8 flex items-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/20 text-white/60 hover:bg-white/5 hover:text-white"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Share Article
                </Button>
              </div>
            </motion.article>
          </div>
        </div>

        <Suspense fallback={null}>
          <Footer />
        </Suspense>
      </div>
    );
  }

  const [featured, ...rest] = BLOG_ARTICLES;

  return (
    <div className="min-h-screen bg-[#000] overflow-hidden relative">
      <Suspense fallback={<div className="fixed inset-0 bg-[#000]" />}>
        <AbstractBackground className="fixed inset-0 z-0" />
      </Suspense>

      <nav className="fixed top-0 left-0 right-0 z-50 px-6 lg:px-12 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Logo size="md" showText textClassName="text-base" />
          </Link>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={() => { window.location.href = '/auth'; }}
              className="h-9 px-4 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-full"
            >
              Sign in
            </Button>
            <Button
              onClick={() => { window.location.href = '/auth?mode=signup'; }}
              className="h-9 px-5 text-sm font-medium rounded-full bg-white text-black hover:bg-white/90 btn-star-blink"
            >
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      <div className="relative z-10 pt-24 pb-16">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <Link to="/" className="inline-flex items-center gap-2 text-white/75 hover:text-white transition-colors mb-8">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Blog</h1>
            <p className="text-lg text-white/75 max-w-2xl mx-auto">
              Insights, tutorials, and updates from the Small Bridges team
            </p>
          </motion.div>

          {featured && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mb-12"
            >
              <button onClick={() => setSelectedArticle(featured)} className="group w-full text-left">
                <div className="relative rounded-3xl overflow-hidden bg-glass border border-white/[0.05] hover:border-white/[0.1] transition-all duration-300">
                  <div className="aspect-[21/9] relative">
                    <img src={featured.image} alt={featured.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-8">
                      <Badge className="mb-4 bg-white/10 text-white/80 border-0">Featured</Badge>
                      <h2 className="text-2xl md:text-3xl font-bold text-white mb-3 group-hover:text-white/90 transition-colors">
                        {featured.title}
                      </h2>
                      <p className="text-white/50 mb-4 max-w-2xl">{featured.excerpt}</p>
                      <div className="flex items-center gap-4 text-white/75 text-sm">
                        <span>{featured.date}</span>
                        <span>•</span>
                        <span>{featured.readTime}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            </motion.div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            {rest.map((article, i) => (
              <motion.div
                key={article.id || article.slug}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
              >
                <button onClick={() => setSelectedArticle(article)} className="group w-full text-left">
                  <div className="rounded-2xl overflow-hidden bg-glass border border-white/[0.05] hover:border-white/[0.1] hover:bg-glass transition-all duration-300">
                    <div className="aspect-video relative">
                      <img src={article.image} alt={article.title} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                    </div>
                    <div className="p-6">
                      <Badge variant="secondary" className="mb-3 bg-white/10 text-white/60 border-0 text-xs">
                        {article.category}
                      </Badge>
                      <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-white/90 transition-colors line-clamp-2">
                        {article.title}
                      </h3>
                      <p className="text-white/75 text-sm mb-4 line-clamp-2">{article.excerpt}</p>
                      <div className="flex items-center justify-between text-white/65 text-xs">
                        <span>{article.date}</span>
                        <span className="flex items-center gap-1">
                          <BookOpen className="w-3 h-3" />
                          {article.readTime}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </div>
  );
}
