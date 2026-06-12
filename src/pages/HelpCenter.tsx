/**
 * Help Center — /help
 *
 * Thin shell over the help content registry. Article prose lives as .md files
 * under src/content/help/<category>/; this page owns the chrome (icons,
 * gradients, category descriptions) since those can't be serialised in
 * frontmatter cleanly. See [src/content/help/index.ts] for the loader.
 */
import { useState, useMemo, lazy, Suspense, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Search, Book, Video, Zap, CreditCard, Shield, MessageCircle,
  ChevronRight, ChevronDown, ArrowLeft, FileText, HelpCircle,
  Sparkles, Settings, Clock, Star, ArrowUpRight,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { SafeMarkdownRenderer } from '@/components/content/SafeMarkdownRenderer';
import { SupportInboxModal } from '@/components/social/SupportInboxModal';
import { useAuth } from '@/contexts/AuthContext';
import { usePageMeta } from '@/hooks/usePageMeta';
import { HELP_CATEGORIES, HELP_ARTICLES, type HelpArticle } from '@/content/help';

const AbstractBackground = lazy(() => import('@/components/landing/AbstractBackground'));

// Per-category visual chrome — icons + gradients + descriptions can't live in
// markdown frontmatter without a translation layer, so we keep them here.
type CategoryChrome = {
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
};

const CATEGORY_CHROME: Record<string, CategoryChrome> = {
  'getting-started': {
    title: 'Getting Started',
    description: 'New to Small Bridges? Start here',
    icon: Sparkles,
    color: 'from-blue-500/20 to-cyan-500/20',
  },
  'video-creation': {
    title: 'Video Creation',
    description: 'Master video generation techniques',
    icon: Video,
    color: 'from-purple-500/20 to-pink-500/20',
  },
  'production-workflow': {
    title: 'Production Workflow',
    description: 'Manage your production pipeline',
    icon: Settings,
    color: 'from-orange-500/20 to-red-500/20',
  },
  'billing-credits': {
    title: 'Billing & Credits',
    description: 'Understand pricing and credits',
    icon: CreditCard,
    color: 'from-green-500/20 to-emerald-500/20',
  },
  'account-security': {
    title: 'Account & Security',
    description: 'Manage your account safely',
    icon: Shield,
    color: 'from-yellow-500/20 to-amber-500/20',
  },
  'ai-limitations': {
    title: 'AI Limitations',
    description: 'Understanding what AI can and cannot do',
    icon: Zap,
    color: 'from-violet-500/20 to-indigo-500/20',
  },
  troubleshooting: {
    title: 'Troubleshooting',
    description: 'Solve common problems',
    icon: HelpCircle,
    color: 'from-rose-500/20 to-pink-500/20',
  },
};

const DEFAULT_CHROME: CategoryChrome = {
  title: 'Help',
  description: '',
  icon: Book,
  color: 'from-white/10 to-white/5',
};

function getChrome(id: string): CategoryChrome {
  return CATEGORY_CHROME[id] ?? DEFAULT_CHROME;
}

// Naive read-time estimator: ~220 wpm. Saves having to maintain readTime in
// frontmatter for every article.
function estimateReadTime(content: string): string {
  const words = content.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.round(words / 220));
  return `${minutes} min`;
}

function ContactSupportBlock() {
  const { user } = useAuth();
  if (user) return <SupportInboxModal />;
  return (
    <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/[0.05] text-center">
      <MessageCircle className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
      <h2 className="text-xl font-semibold text-foreground mb-2">Still need help?</h2>
      <p className="text-foreground/80 mb-6">
        Sign in to message our team in-app and track replies, or send us a note.
      </p>
      <div className="flex items-center justify-center gap-3">
        <Button asChild className="bg-white text-black hover:bg-white/90 rounded-full">
          <Link to="/auth">Sign in to message admin <ArrowUpRight className="w-4 h-4 ml-2" /></Link>
        </Button>
        <Button asChild variant="outline" className="rounded-full">
          <Link to="/contact">Contact form</Link>
        </Button>
      </div>
    </div>
  );
}

interface SelectedArticle extends HelpArticle {
  categoryTitle: string;
  readTime: string;
}

const ArticleContent = forwardRef<HTMLDivElement, { article: SelectedArticle; onBack: () => void }>(
  function ArticleContent({ article, onBack }, ref) {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="max-w-3xl mx-auto"
      >
        <Button
          variant="ghost"
          onClick={onBack}
          className="mb-6 text-muted-foreground hover:text-foreground hover:bg-muted/10"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Help Center
        </Button>

        <div className="p-8 rounded-3xl bg-card/50 border border-border/50">
          <div className="flex items-center gap-3 mb-4">
            <Badge className="bg-muted text-muted-foreground border-0">{article.categoryTitle}</Badge>
            <span className="text-muted-foreground/60 text-sm flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {article.readTime}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-6">{article.title}</h1>
          <SafeMarkdownRenderer
            content={article.content}
            className="prose prose-invert max-w-none"
          />
        </div>
      </motion.div>
    );
  },
);

export default function HelpCenter() {
  usePageMeta({
    title: 'Help Center — Small Bridges',
    description: 'Guides, FAQs, and troubleshooting for everything Small Bridges.',
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<SelectedArticle | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>('getting-started');

  const select = (a: HelpArticle) => {
    const chrome = getChrome(a.category);
    setSelectedArticle({
      ...a,
      categoryTitle: chrome.title,
      readTime: estimateReadTime(a.content),
    });
  };

  const filteredArticles = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return HELP_ARTICLES.filter((article) =>
      article.title.toLowerCase().includes(query) ||
      article.description.toLowerCase().includes(query) ||
      article.content.toLowerCase().includes(query),
    );
  }, [searchQuery]);

  // Surface the first article of each category as "popular" — gives the
  // section a useful starter set without needing per-article curation flags.
  const popularArticles = HELP_CATEGORIES
    .map((c) => c.articles[0])
    .filter(Boolean) as HelpArticle[];

  return (
    <div className="min-h-screen bg-[#000] overflow-hidden relative">
      <Suspense fallback={<div className="fixed inset-0 bg-[#000]" />}>
        <AbstractBackground className="fixed inset-0 z-0" />
      </Suspense>

      <nav className="fixed top-0 left-0 right-0 z-50 px-6 lg:px-12 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
              <span className="text-sm font-bold text-black">A</span>
            </div>
            <span className="text-base font-semibold text-foreground tracking-tight">Small Bridges</span>
          </Link>
        </div>
      </nav>

      <div className="relative z-10 pt-24 pb-16">
        <div className="max-w-6xl mx-auto px-6">
          <AnimatePresence mode="wait">
            {selectedArticle ? (
              <ArticleContent
                key="article"
                article={selectedArticle}
                onBack={() => setSelectedArticle(null)}
              />
            ) : (
              <motion.div key="main" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center mb-12"
                >
                  <Link
                    to="/"
                    className="inline-flex items-center gap-2 text-foreground/80 hover:text-foreground transition-colors mb-8"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Home
                  </Link>
                  <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">Help Center</h1>
                  <p className="text-lg text-foreground/80 max-w-2xl mx-auto mb-8">
                    Find answers, learn best practices, and get the most out of Small Bridges
                  </p>
                  <div className="relative max-w-xl mx-auto">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      placeholder="Search for help..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-14 pl-12 pr-4 bg-white/[0.03] border-white/[0.08] text-foreground placeholder:text-muted-foreground rounded-2xl focus:border-white/20 focus:ring-0"
                    />
                  </div>
                </motion.div>

                {searchQuery && filteredArticles.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
                    <h2 className="text-lg font-semibold text-foreground mb-4">
                      Search Results ({filteredArticles.length})
                    </h2>
                    <div className="grid gap-3">
                      {filteredArticles.map((article) => {
                        const chrome = getChrome(article.category);
                        return (
                          <button
                            key={article.id || article.slug}
                            onClick={() => { select(article); setSearchQuery(''); }}
                            className="group w-full text-left p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] hover:border-white/[0.1] transition-all"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <Badge className="mb-2 bg-white/10 text-muted-foreground border-0 text-xs">
                                  {chrome.title}
                                </Badge>
                                <h3 className="text-foreground font-medium group-hover:text-foreground/95">
                                  {article.title}
                                </h3>
                                <p className="text-foreground/80 text-sm mt-1">{article.description}</p>
                              </div>
                              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground/80 transition-colors" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {searchQuery && filteredArticles.length === 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12 mb-12">
                    <HelpCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-foreground/80">No results found for "{searchQuery}"</p>
                    <p className="text-muted-foreground text-sm mt-2">Try different keywords or browse categories below</p>
                  </motion.div>
                )}

                {!searchQuery && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="mb-12"
                  >
                    <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                      <Star className="w-5 h-5 text-warning" />
                      Popular Articles
                    </h2>
                    <div className="grid md:grid-cols-2 gap-3">
                      {popularArticles.map((article) => (
                        <button
                          key={article.id || article.slug}
                          onClick={() => select(article)}
                          className="group text-left p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] hover:border-white/[0.1] transition-all"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-foreground font-medium group-hover:text-foreground/95">
                                {article.title}
                              </h3>
                              <p className="text-foreground/80 text-sm mt-1">{article.description}</p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground/80 flex-shrink-0 ml-4" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {!searchQuery && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                    <h2 className="text-lg font-semibold text-foreground mb-4">Browse by Category</h2>
                    <div className="space-y-3">
                      {HELP_CATEGORIES.map((category) => {
                        const chrome = getChrome(category.id);
                        const Icon = chrome.icon;
                        const isExpanded = expandedCategory === category.id;
                        return (
                          <div key={category.id} className="rounded-2xl bg-white/[0.02] border border-white/[0.05] overflow-hidden">
                            <button
                              onClick={() => setExpandedCategory(isExpanded ? null : category.id)}
                              className="w-full flex items-center justify-between p-5 hover:bg-white/[0.02] transition-colors"
                            >
                              <div className="flex items-center gap-4">
                                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br', chrome.color)}>
                                  <Icon className="w-5 h-5 text-foreground" />
                                </div>
                                <div className="text-left">
                                  <h3 className="text-foreground font-medium">{chrome.title}</h3>
                                  <p className="text-foreground/80 text-sm">{chrome.description}</p>
                                </div>
                              </div>
                              <ChevronDown className={cn('w-5 h-5 text-muted-foreground transition-transform', isExpanded && 'rotate-180')} />
                            </button>
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <div className="px-5 pb-5 space-y-2">
                                    {category.articles.map((article) => (
                                      <button
                                        key={article.id || article.slug}
                                        onClick={() => select(article)}
                                        className="group w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.03] transition-colors"
                                      >
                                        <div className="flex items-center gap-3">
                                          <FileText className="w-4 h-4 text-muted-foreground" />
                                          <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                                            {article.title}
                                          </span>
                                        </div>
                                        <span className="text-muted-foreground text-sm">{estimateReadTime(article.content)}</span>
                                      </button>
                                    ))}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mt-12"
                >
                  <ContactSupportBlock />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
