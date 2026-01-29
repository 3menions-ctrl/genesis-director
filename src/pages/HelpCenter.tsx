import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  Search, Book, Video, Zap, CreditCard, Shield, MessageCircle,
  ChevronRight, ChevronDown, ArrowLeft, ExternalLink, 
  Play, FileText, HelpCircle, Lightbulb, Sparkles,
  Settings, Users, Upload, Download, Palette, Clock,
  CheckCircle, AlertCircle, Star, ArrowUpRight
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { lazy, Suspense } from 'react';

const AbstractBackground = lazy(() => import('@/components/landing/AbstractBackground'));

// Help categories with articles
const HELP_CATEGORIES = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    description: 'Learn the basics and create your first video',
    icon: Zap,
    color: 'from-emerald-500 to-teal-500',
    articles: [
      {
        id: 'create-first-video',
        title: 'Create Your First AI Video',
        description: 'Step-by-step guide to generating your first professional video',
        readTime: '5 min',
        popular: true,
        content: `
## Create Your First AI Video

Welcome to Apex! This guide will walk you through creating your first AI-generated video in just a few minutes.

### Step 1: Start a New Project
Click the **"Create New"** button from your dashboard. You'll be prompted to choose a video type.

### Step 2: Write Your Script
Enter your video concept or paste your script. Our AI will enhance it with:
- Scene breakdowns
- Visual descriptions
- Pacing suggestions

### Step 3: Choose Your Style
Select from our curated styles or customize:
- **Cinematic**: Hollywood-quality production
- **Documentary**: Authentic, story-driven
- **Commercial**: Polished advertising look

### Step 4: Generate & Review
Click **"Generate"** and watch your video come to life. You can:
- Preview individual clips
- Regenerate specific scenes
- Adjust timing and pacing

### Step 5: Export & Share
Download your finished video in multiple formats or share directly to social platforms.

> **Pro Tip**: Start with shorter videos (30-60 seconds) to get familiar with the platform before tackling longer projects.
        `
      },
      {
        id: 'understanding-credits',
        title: 'Understanding Credits',
        description: 'How credits work and optimizing your usage',
        readTime: '3 min',
        content: `
## Understanding Credits

Credits are the currency of Apex. Here's everything you need to know.

### How Credits Work
- Each video generation consumes credits based on duration and quality
- 5-second clip at standard quality: ~1 credit
- 5-second clip at 4K quality: ~2 credits

### Earning Credits
- **Free tier**: 60 credits (one-time welcome bonus)
- **Pro plan**: 500 credits monthly
- **Enterprise**: Unlimited or custom

### Optimizing Usage
1. **Preview before generating**: Review your script carefully
2. **Use templates**: Pre-built templates are more efficient
3. **Batch similar content**: Generate related clips together

### Purchasing More
Visit Settings → Billing to purchase additional credit packs.
        `
      },
      {
        id: 'workspace-overview',
        title: 'Workspace Overview',
        description: 'Navigate the Apex interface like a pro',
        readTime: '4 min',
        content: `
## Workspace Overview

Master the Apex interface to boost your productivity.

### Main Sections

**Dashboard**
Your home base showing recent projects, quick actions, and usage stats.

**Create**
The video generation studio with script editing, style selection, and preview.

**Projects**
All your videos organized with filters, search, and folder structure.

**Pipeline**
Track video generation progress and manage the production queue.

### Keyboard Shortcuts
- \`Cmd/Ctrl + N\`: New project
- \`Cmd/Ctrl + S\`: Save
- \`Space\`: Play/Pause preview
- \`Esc\`: Close modals
        `
      },
      {
        id: 'quick-tips',
        title: 'Quick Tips for Better Videos',
        description: 'Expert advice for professional results',
        readTime: '6 min',
        popular: true,
        content: `
## Quick Tips for Better Videos

### Writing Effective Prompts
- Be specific about visual details
- Describe camera movements explicitly
- Include lighting and mood descriptors

### Maintaining Consistency
- Use the same style anchor throughout
- Reference previous clips for continuity
- Keep character descriptions consistent

### Quality Settings
- **Draft mode**: Fast previews, lower quality
- **Standard**: Balanced quality and speed
- **Cinema**: Maximum quality, longer render
        `
      }
    ]
  },
  {
    id: 'video-creation',
    title: 'Video Creation',
    description: 'Master the art of AI video generation',
    icon: Video,
    color: 'from-blue-500 to-indigo-500',
    articles: [
      {
        id: 'script-writing',
        title: 'Writing Effective Scripts',
        description: 'Craft compelling scripts for AI generation',
        readTime: '8 min',
        popular: true,
        content: `
## Writing Effective Scripts

Great videos start with great scripts. Here's how to write for AI.

### Structure Your Scenes
Break your content into clear, visual scenes:

\`\`\`
SCENE 1: Opening Hook (5 seconds)
- Wide establishing shot of city skyline at sunset
- Dramatic lighting, golden hour

SCENE 2: Problem Statement (10 seconds)
- Medium shot of person looking frustrated
- Office environment, cool blue tones
\`\`\`

### Visual Language Tips
- "Close-up" vs "Wide shot" matters
- Describe lighting: "soft diffused light" or "dramatic shadows"
- Include motion: "slow pan left" or "tracking shot following subject"

### Pacing Guidelines
- Hook: 3-5 seconds
- Introduction: 10-15 seconds
- Main content: Vary based on complexity
- Call-to-action: 5-10 seconds
        `
      },
      {
        id: 'styles-and-moods',
        title: 'Styles and Visual Moods',
        description: 'Set the perfect tone for your content',
        readTime: '5 min',
        content: `
## Styles and Visual Moods

### Available Style Presets

**Cinematic**
Film-quality production with dramatic lighting, shallow depth of field, and professional color grading.

**Documentary**
Authentic, naturalistic look with steady camera work and observational style.

**Commercial**
High-energy, polished aesthetic perfect for ads and promotional content.

**Artistic**
Creative, stylized visuals for unique brand expression.

### Customizing Moods
Combine style presets with mood modifiers:
- Warm, inviting
- Cool, professional
- Dramatic, intense
- Soft, dreamy
        `
      },
      {
        id: 'character-consistency',
        title: 'Character Consistency',
        description: 'Keep characters looking the same across scenes',
        readTime: '6 min',
        content: `
## Character Consistency

Maintaining character appearance across multiple clips is crucial for professional results.

### Using Reference Images
Upload a reference image to lock in character appearance:
1. Go to Project Settings
2. Upload reference under "Character Bible"
3. The AI will match features across all scenes

### Description Best Practices
Be extremely specific:
- "Woman with shoulder-length auburn hair, green eyes, fair skin"
- Include clothing details for each scene
- Note distinguishing features

### Troubleshooting
If characters drift between clips:
- Use the same style anchor
- Regenerate problem clips with stronger references
- Enable "Identity Lock" in advanced settings
        `
      }
    ]
  },
  {
    id: 'billing-credits',
    title: 'Billing & Credits',
    description: 'Manage subscriptions and payments',
    icon: CreditCard,
    color: 'from-amber-500 to-orange-500',
    articles: [
      {
        id: 'subscription-plans',
        title: 'Subscription Plans',
        description: 'Compare plans and find the right fit',
        readTime: '4 min',
        content: `
## Subscription Plans

### Free Plan
- 60 credits (one-time welcome bonus)
- Standard quality
- Community support
- Watermarked exports

### Pro Plan ($29/month)
- 500 credits/month
- 4K quality
- Priority processing
- No watermarks
- Email support

### Enterprise
- Custom credit allocation
- Dedicated support
- API access
- White-label options
- Custom integrations

### Switching Plans
Upgrade or downgrade anytime from Settings → Billing.
        `
      },
      {
        id: 'payment-methods',
        title: 'Payment Methods',
        description: 'Accepted payment options and billing',
        readTime: '2 min',
        content: `
## Payment Methods

### Accepted Methods
- Credit/Debit cards (Visa, Mastercard, Amex)
- PayPal
- Apple Pay / Google Pay
- Bank transfer (Enterprise only)

### Billing Cycle
- Monthly plans bill on the same day each month
- Annual plans include 2 months free
- Receipts sent via email automatically

### Updating Payment
1. Go to Settings → Billing
2. Click "Update Payment Method"
3. Enter new details
4. Changes apply to next billing cycle
        `
      },
      {
        id: 'refund-policy',
        title: 'Refund Policy',
        description: 'Our fair refund and cancellation policy',
        readTime: '3 min',
        content: `
## Refund Policy

### Subscription Refunds
- Cancel within 14 days of initial purchase for full refund
- Prorated refunds available for annual plans
- No refunds for used credits

### Credit Pack Refunds
- Unused credit packs: Full refund within 30 days
- Partially used: Prorated based on remaining credits

### How to Request
Contact cole@apex-studio.com with your order details.
        `
      }
    ]
  },
  {
    id: 'account-security',
    title: 'Account & Security',
    description: 'Protect your account and data',
    icon: Shield,
    color: 'from-rose-500 to-pink-500',
    articles: [
      {
        id: 'account-settings',
        title: 'Account Settings',
        description: 'Update profile, email, and preferences',
        readTime: '3 min',
        content: `
## Account Settings

### Profile Information
Update your display name, avatar, and bio:
1. Click your avatar in the top right
2. Select "Profile"
3. Edit your information
4. Click "Save Changes"

### Email Preferences
Control what notifications you receive:
- Project updates
- Weekly digest
- Tips and tutorials
- Product announcements

### Data Export
Download all your data:
1. Settings → Privacy
2. Click "Export My Data"
3. Receive download link via email within 24 hours
        `
      },
      {
        id: 'password-security',
        title: 'Password & Security',
        description: 'Keep your account secure',
        readTime: '4 min',
        content: `
## Password & Security

### Password Requirements
- Minimum 12 characters
- Mix of uppercase and lowercase
- At least one number
- At least one special character

### Two-Factor Authentication
Add an extra layer of security:
1. Settings → Security
2. Enable 2FA
3. Scan QR code with authenticator app
4. Enter verification code

### Session Management
View and terminate active sessions:
- See all logged-in devices
- Revoke access to suspicious sessions
- Force logout everywhere
        `
      },
      {
        id: 'data-privacy',
        title: 'Data & Privacy',
        description: 'How we handle your information',
        readTime: '5 min',
        content: `
## Data & Privacy

### What We Store
- Account information (email, name)
- Project data and generated content
- Usage analytics (anonymized)

### Your Rights
- Access your data anytime
- Request deletion
- Export all content
- Opt out of analytics

### Data Retention
- Active accounts: Indefinite
- Deleted accounts: 30-day grace period
- Projects: Until you delete them

### GDPR Compliance
We're fully GDPR compliant. Contact cole@apex-studio.com for requests.
        `
      }
    ]
  },
  {
    id: 'ai-limitations',
    title: 'AI Technology & Limitations',
    description: 'Understand how our AI works and its limitations',
    icon: Lightbulb,
    color: 'from-yellow-500 to-amber-500',
    articles: [
      {
        id: 'understanding-ai',
        title: 'Understanding AI Video Generation',
        description: 'How our AI technology works and what to expect',
        readTime: '5 min',
        popular: true,
        content: `
## Understanding AI Video Generation

### How It Works
Apex Studio uses advanced third-party AI services, including **Google Veo**, to generate video content from your text descriptions and reference images.

### Important Limitations

**AI Hallucinations**
AI systems may occasionally produce unexpected or inaccurate outputs, known as "hallucinations." This can include:
- Incorrect representations of described scenes
- Unintended visual artifacts or distortions
- Inconsistencies between clips
- Characters or objects that differ from descriptions

**What This Means for You**
- Always review generated content before publishing
- Do not rely on AI for factual accuracy
- Expect to regenerate some clips for best results
- Use reference images to improve consistency

### Third-Party Services
Our video generation is powered by:
- **Google Veo**: Primary video synthesis engine
- **OpenAI**: Script and text enhancement
- **Other AI Partners**: Supporting features

These services operate under their own policies and may have their own content restrictions.

### Best Practices
1. Review all content before publishing
2. Regenerate clips that do not meet expectations
3. Use clear, specific prompts for better results
4. Keep expectations realistic about AI capabilities
        `
      },
      {
        id: 'content-accuracy',
        title: 'Content Accuracy Disclaimer',
        description: 'Important information about AI-generated content',
        readTime: '3 min',
        content: `
## Content Accuracy Disclaimer

### No Guarantee of Accuracy
AI-generated content may contain:
- Visual inaccuracies or artifacts
- Inconsistencies with your prompts
- Unexpected interpretations of descriptions
- Elements that appear unrealistic

### Your Responsibility
You are responsible for:
- Reviewing all generated content
- Verifying accuracy before publishing
- Ensuring content meets your standards
- Compliance with applicable laws

### When to Regenerate
Consider regenerating if:
- Characters look different between scenes
- Actions don't match descriptions
- Visual quality is below expectations
- Unintended elements appear
        `
      }
    ]
  }
];

// Flatten all articles for search
const ALL_ARTICLES = HELP_CATEGORIES.flatMap(cat => 
  cat.articles.map(article => ({
    ...article,
    category: cat.title,
    categoryId: cat.id,
    categoryColor: cat.color
  }))
);

// Article content component
function ArticleContent({ article, onBack }: { article: typeof ALL_ARTICLES[0]; onBack: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-3xl mx-auto"
    >
      <Button
        variant="ghost"
        onClick={onBack}
        className="mb-6 text-white/40 hover:text-white hover:bg-white/5"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Help Center
      </Button>

      <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/[0.05]">
        <div className="flex items-center gap-3 mb-4">
          <Badge 
            className="bg-white/10 text-white/60 border-0"
          >
            {article.category}
          </Badge>
          <span className="text-white/30 text-sm flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {article.readTime}
          </span>
        </div>
        
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-6">
          {article.title}
        </h1>
        
        <div 
          className="prose prose-invert max-w-none text-white/60"
          dangerouslySetInnerHTML={{ 
            __html: article.content
              .replace(/## /g, '<h2 class="text-xl font-semibold text-white mt-8 mb-4">')
              .replace(/### /g, '<h3 class="text-lg font-medium text-white mt-6 mb-3">')
              .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
              .replace(/`([^`]+)`/g, '<code class="bg-white/10 px-2 py-0.5 rounded text-white/80">$1</code>')
              .replace(/```[\s\S]*?```/g, (match) => {
                const code = match.replace(/```\w*\n?/g, '').trim();
                return `<pre class="bg-white/5 border border-white/10 rounded-xl p-4 overflow-x-auto my-4"><code class="text-white/70 text-sm">${code}</code></pre>`;
              })
              .replace(/> (.*)/g, '<blockquote class="border-l-2 border-white/20 pl-4 italic text-white/50 my-4">$1</blockquote>')
              .replace(/- (.*)/g, '<li class="ml-4 mb-1">$1</li>')
              .replace(/\d+\. (.*)/g, '<li class="ml-4 mb-1">$1</li>')
              .replace(/\n\n/g, '</p><p class="mb-4">')
          }}
        />
      </div>
    </motion.div>
  );
}

export default function HelpCenter() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<typeof ALL_ARTICLES[0] | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>('getting-started');

  // Filter articles based on search
  const filteredArticles = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return ALL_ARTICLES.filter(article =>
      article.title.toLowerCase().includes(query) ||
      article.description.toLowerCase().includes(query) ||
      article.content.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Popular articles
  const popularArticles = ALL_ARTICLES.filter(a => a.popular);

  return (
    <div className="min-h-screen bg-[#000] overflow-hidden relative">
      {/* Abstract Background */}
      <Suspense fallback={<div className="fixed inset-0 bg-[#000]" />}>
        <AbstractBackground className="fixed inset-0 z-0" />
      </Suspense>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 lg:px-12 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
              <span className="text-sm font-bold text-black">A</span>
            </div>
            <span className="text-base font-semibold text-white tracking-tight">Apex Studio</span>
          </Link>
        </div>
      </nav>

      {/* Content */}
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
              <motion.div
                key="main"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {/* Header */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center mb-12"
                >
                  <Link 
                    to="/" 
                    className="inline-flex items-center gap-2 text-white/40 hover:text-white transition-colors mb-8"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Home
                  </Link>
                  
                  <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Help Center</h1>
                  <p className="text-lg text-white/40 max-w-2xl mx-auto mb-8">
                    Find answers, learn best practices, and get the most out of Apex Studio
                  </p>

                  {/* Search */}
                  <div className="relative max-w-xl mx-auto">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                    <Input
                      placeholder="Search for help..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-14 pl-12 pr-4 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/30 rounded-2xl focus:border-white/20 focus:ring-0"
                    />
                  </div>
                </motion.div>

                {/* Search Results */}
                {searchQuery && filteredArticles.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-12"
                  >
                    <h2 className="text-lg font-semibold text-white mb-4">
                      Search Results ({filteredArticles.length})
                    </h2>
                    <div className="grid gap-3">
                      {filteredArticles.map(article => (
                        <button
                          key={article.id}
                          onClick={() => {
                            setSelectedArticle(article);
                            setSearchQuery('');
                          }}
                          className="group w-full text-left p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] hover:border-white/[0.1] transition-all"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <Badge className="mb-2 bg-white/10 text-white/50 border-0 text-xs">
                                {article.category}
                              </Badge>
                              <h3 className="text-white font-medium group-hover:text-white/90">
                                {article.title}
                              </h3>
                              <p className="text-white/40 text-sm mt-1">{article.description}</p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-white/20 group-hover:text-white/40 transition-colors" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {searchQuery && filteredArticles.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-12 mb-12"
                  >
                    <HelpCircle className="w-12 h-12 text-white/20 mx-auto mb-4" />
                    <p className="text-white/40">No results found for "{searchQuery}"</p>
                    <p className="text-white/30 text-sm mt-2">Try different keywords or browse categories below</p>
                  </motion.div>
                )}

                {/* Popular Articles */}
                {!searchQuery && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="mb-12"
                  >
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Star className="w-5 h-5 text-warning" />
                      Popular Articles
                    </h2>
                    <div className="grid md:grid-cols-2 gap-3">
                      {popularArticles.map(article => (
                        <button
                          key={article.id}
                          onClick={() => setSelectedArticle(article)}
                          className="group text-left p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] hover:border-white/[0.1] transition-all"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-white font-medium group-hover:text-white/90">
                                {article.title}
                              </h3>
                              <p className="text-white/40 text-sm mt-1">{article.description}</p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-white/20 group-hover:text-white/40 flex-shrink-0 ml-4" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Categories */}
                {!searchQuery && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <h2 className="text-lg font-semibold text-white mb-4">Browse by Category</h2>
                    <div className="space-y-3">
                      {HELP_CATEGORIES.map(category => {
                        const Icon = category.icon;
                        const isExpanded = expandedCategory === category.id;
                        
                        return (
                          <div 
                            key={category.id}
                            className="rounded-2xl bg-white/[0.02] border border-white/[0.05] overflow-hidden"
                          >
                            <button
                              onClick={() => setExpandedCategory(isExpanded ? null : category.id)}
                              className="w-full flex items-center justify-between p-5 hover:bg-white/[0.02] transition-colors"
                            >
                              <div className="flex items-center gap-4">
                                <div className={cn(
                                  "w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br",
                                  category.color
                                )}>
                                  <Icon className="w-5 h-5 text-white" />
                                </div>
                                <div className="text-left">
                                  <h3 className="text-white font-medium">{category.title}</h3>
                                  <p className="text-white/40 text-sm">{category.description}</p>
                                </div>
                              </div>
                              <ChevronDown className={cn(
                                "w-5 h-5 text-white/30 transition-transform",
                                isExpanded && "rotate-180"
                              )} />
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
                                    {category.articles.map(article => (
                                      <button
                                        key={article.id}
                                        onClick={() => setSelectedArticle({
                                          ...article,
                                          category: category.title,
                                          categoryId: category.id,
                                          categoryColor: category.color
                                        })}
                                        className="group w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.03] transition-colors"
                                      >
                                        <div className="flex items-center gap-3">
                                          <FileText className="w-4 h-4 text-white/30" />
                                          <span className="text-white/70 group-hover:text-white transition-colors">
                                            {article.title}
                                          </span>
                                          {article.popular && (
                                            <Badge className="bg-warning/20 text-warning border-0 text-xs">
                                              Popular
                                            </Badge>
                                          )}
                                        </div>
                                        <span className="text-white/30 text-sm">{article.readTime}</span>
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

                {/* Contact Support */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mt-12 p-8 rounded-3xl bg-white/[0.02] border border-white/[0.05] text-center"
                >
                  <MessageCircle className="w-10 h-10 text-white/30 mx-auto mb-4" />
                  <h2 className="text-xl font-semibold text-white mb-2">Still need help?</h2>
                  <p className="text-white/40 mb-6">
                    Our support team is ready to assist you with any questions
                  </p>
                  <Button
                    asChild
                    className="bg-white text-black hover:bg-white/90 rounded-full"
                  >
                    <a href="mailto:cole@apex-studio.com">
                      Contact Support
                      <ArrowUpRight className="w-4 h-4 ml-2" />
                    </a>
                  </Button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
