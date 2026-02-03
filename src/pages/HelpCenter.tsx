import { useState, useMemo, lazy, Suspense, forwardRef } from 'react';
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
import { SafeMarkdownRenderer } from '@/components/content/SafeMarkdownRenderer';

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
        description: 'How credits work and our pricing model',
        readTime: '4 min',
        popular: true,
        content: `
## Understanding Credits

Credits are how you pay for video generation on Apex Studio.

### Credit Pricing
- **1 credit = $0.10 USD**
- Short clips (≤6 seconds): **10 credits** per clip
- Long clips (>6 seconds): **15 credits** per clip

### Getting Started
- **Welcome Bonus**: New accounts receive 60 free credits
- **Purchase Packs**: Buy credits in packages ($37, $100, or $250)
- **No Expiration**: Credits never expire while your account is active

### ⚠️ Important: No Refunds
**All credit purchases are final and non-refundable.** Please use your free credits to test the platform before purchasing.

### Credit Usage Tips
1. **Use free credits first**: Test thoroughly before buying
2. **Review scripts carefully**: Avoid regenerating due to typos
3. **Start with shorter clips**: Use ≤6 second clips when possible (10 vs 15 credits)
4. **Check AI limitations**: Understand what AI can and cannot do

### AI Limitations Affect Results
AI-generated videos may require regeneration due to:
- Visual artifacts or inconsistencies
- Character appearance variations
- Unexpected interpretations of prompts

Budget extra credits for potential regenerations. This is normal for AI video generation.
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
    description: 'Understand credit pricing and policies',
    icon: CreditCard,
    color: 'from-amber-500 to-orange-500',
    articles: [
      {
        id: 'credit-pricing',
        title: 'Credit Pricing & Packages',
        description: 'Understand how credits work and our pricing',
        readTime: '4 min',
        content: `
## Credit Pricing & Packages

### How Credits Work
Apex Studio uses a **credit-based** payment system (not subscriptions). You purchase credits once and use them as needed.

**Credit Value**: 1 credit = $0.10 USD

### Video Generation Costs
- **Short clips (≤6 seconds)**: 10 credits per clip ($1.00)
- **Long clips (>6 seconds)**: 15 credits per clip ($1.50)

### Available Credit Packs

**Starter Pack - $37**
- 370 credits (~37 clips)
- Perfect for trying the platform

**Growth Pack - $100**
- 1,000 credits (~100 clips)
- Best value for regular creators

**Agency Pack - $250**
- 2,500 credits (~250 clips)
- Ideal for teams and studios

### New User Bonus
New accounts receive **60 free credits** as a one-time welcome bonus to try the platform.

### Credits Never Expire
Your purchased credits remain in your account indefinitely while your account is active. No monthly limits or expiration dates.
        `
      },
      {
        id: 'payment-methods',
        title: 'Payment Methods',
        description: 'Accepted payment options',
        readTime: '2 min',
        content: `
## Payment Methods

### Accepted Methods
All payments are processed securely through **Stripe**:
- Credit/Debit cards (Visa, Mastercard, Amex, Discover)
- Apple Pay / Google Pay
- Link by Stripe

### Payment Security
- We never store your card details
- All transactions are encrypted
- PCI-DSS compliant processing

### Receipts
Email receipts are sent automatically after each purchase. You can also view your purchase history in Settings → Billing.
        `
      },
      {
        id: 'refund-policy',
        title: 'Refund Policy',
        description: 'Important information about our no-refund policy',
        readTime: '3 min',
        popular: true,
        content: `
## Refund Policy

### ⚠️ IMPORTANT: All Sales Are Final

**ALL CREDIT PURCHASES ARE NON-REFUNDABLE.**

By purchasing credits, you acknowledge and agree that:

1. **No Refunds**: Credits cannot be refunded under any circumstances, including:
   - Unused credits in your account
   - Dissatisfaction with AI-generated results
   - Account closure or suspension
   - Service changes or updates

2. **No Transfers**: Credits cannot be transferred to other accounts or exchanged for cash.

3. **No Exceptions**: This policy applies to all purchases regardless of the payment method used.

### Why This Policy?
AI video generation consumes significant computational resources. Once credits are purchased, those resources are allocated to your account. This policy allows us to offer competitive pricing.

### Before You Buy
- Use your 60 free welcome credits to test the platform
- Review AI-generated samples in our gallery
- Read our documentation on AI limitations
- Ensure Apex Studio meets your needs before purchasing

### Questions?
Contact cole@apex-studio.com before purchasing if you have any concerns.
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
Apex Studio uses advanced third-party AI services to generate video content from your text descriptions and reference images. Our primary video generation is powered by **Kling AI** and other AI technology partners.

### ⚠️ Critical Limitations to Understand

**Before purchasing credits, understand these AI limitations:**

**AI "Hallucinations" Are Common**
AI systems frequently produce unexpected or inaccurate outputs. This is NOT a bug—it's an inherent characteristic of current AI technology:
- Characters may look different between scenes
- Objects may appear, disappear, or transform unexpectedly
- Hands, faces, and fine details often contain artifacts
- Physics may not behave realistically
- Text in videos is often illegible or nonsensical
- Actions may not match your descriptions

**Regeneration Is Normal**
- Expect to regenerate clips multiple times to get acceptable results
- Budget 2-4x the credits you think you need
- Some prompts may never produce satisfactory results
- AI cannot guarantee specific outcomes

**No Guaranteed Results**
- We cannot guarantee any specific output quality
- AI interpretation of prompts varies unpredictably
- Complex scenes and multiple characters are especially challenging
- Results improve with experience but remain variable

### Third-Party Services
Our video generation relies on:
- **Kling AI**: Primary video synthesis engine
- **OpenAI**: Script and text enhancement
- **ElevenLabs**: Voice synthesis
- **Other AI Partners**: Supporting features

These services operate under their own terms and may:
- Have their own content restrictions
- Experience downtime or service interruptions
- Change capabilities without notice

### Your Responsibilities
1. **Review all content** before publishing or sharing
2. **Never rely on AI** for factual accuracy
3. **Budget for regeneration** - this is expected, not a defect
4. **Use free credits first** to understand the platform
5. **Accept inherent limitations** of AI technology

### Credits Are Non-Refundable
Because AI results vary and regeneration is normal, **all credit purchases are final**. Test thoroughly with your 60 free credits before buying.
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

// Article content component - wrapped with forwardRef for AnimatePresence compatibility
const ArticleContent = forwardRef<HTMLDivElement, { article: typeof ALL_ARTICLES[0]; onBack: () => void }>(
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
            <Badge 
              className="bg-muted text-muted-foreground border-0"
            >
              {article.category}
            </Badge>
            <span className="text-muted-foreground/60 text-sm flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {article.readTime}
            </span>
          </div>
          
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-6">
            {article.title}
          </h1>
          
          <SafeMarkdownRenderer 
            content={article.content}
            className="prose prose-invert max-w-none"
          />
        </div>
      </motion.div>
    );
  }
);

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
