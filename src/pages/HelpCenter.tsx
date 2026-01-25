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
As a user, you are responsible for:
- Reviewing all generated content before use
- Verifying accuracy for commercial applications
- Ensuring content is appropriate for your audience
- Obtaining necessary rights for recognizable elements

### Not Suitable For
AI-generated content should **not** be used for:
- Factual news reporting without verification
- Legal or medical documentation
- Content requiring photographic accuracy
- Situations requiring guaranteed consistency

### Quality Improvement
To get better results:
- Use detailed, specific prompts
- Upload reference images when possible
- Regenerate unsatisfactory clips
- Use our automatic retry system
        `
      }
    ]
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    description: 'Fix common issues quickly',
    icon: AlertCircle,
    color: 'from-red-500 to-rose-500',
    articles: [
      {
        id: 'generation-failed',
        title: 'Video Generation Failed',
        description: 'Steps to resolve failed generations',
        readTime: '4 min',
        popular: true,
        content: `
## Video Generation Failed

### Common Causes

**Content Policy Violation**
The prompt may have triggered safety filters from our third-party AI providers. Try:
- Rewording the prompt
- Removing potentially problematic content
- Being more specific about the context

**AI Service Unavailability**
Our video generation relies on third-party services (Google Veo, etc.) that may occasionally experience:
- Temporary outages
- High demand periods
- Maintenance windows

**Technical Timeout**
Long or complex videos may timeout:
- Break into shorter clips
- Reduce visual complexity
- Try during off-peak hours

### Quick Fixes
1. **Retry**: Click "Retry" on the failed clip
2. **Regenerate**: Start fresh with the same prompt
3. **Simplify**: Reduce the complexity of the scene
4. **Wait**: If services are busy, try again later

### Still Stuck?
Contact support with your project ID for investigation.
        `
      },
      {
        id: 'video-quality-issues',
        title: 'Video Quality Issues',
        description: 'Improve output quality and consistency',
        readTime: '5 min',
        content: `
## Video Quality Issues

### Blurry or Pixelated Output
- Check you're using at least "Standard" quality
- Ensure source references are high-resolution
- Try regenerating with enhanced prompts

### Inconsistent Characters
- Enable Identity Lock
- Use reference images
- Keep descriptions consistent

### Choppy Animations
- Simplify motion descriptions
- Use "smooth" in your prompts
- Check your export settings

### Color/Lighting Issues
- Specify lighting in prompts
- Use consistent style anchors
- Apply color grading in post
        `
      },
      {
        id: 'export-problems',
        title: 'Export & Download Issues',
        description: 'Resolve download and format problems',
        readTime: '3 min',
        content: `
## Export & Download Issues

### Download Won't Start
1. Check your browser's popup blocker
2. Try a different browser
3. Clear cache and cookies
4. Use the direct download link in email

### Wrong Format
- Check export settings before downloading
- Use the format converter in settings
- Common formats: MP4, WebM, MOV

### File Corrupted
- Re-download the file
- Check your internet connection
- Try a smaller file size first
- Contact support if persistent
        `
      }
    ]
  },
  {
    id: 'advanced-features',
    title: 'Advanced Features',
    description: 'Unlock the full power of Apex',
    icon: Sparkles,
    color: 'from-violet-500 to-purple-500',
    articles: [
      {
        id: 'api-integration',
        title: 'API Integration',
        description: 'Integrate Apex into your workflow',
        readTime: '10 min',
        content: `
## API Integration

### Getting Started
1. Generate API key in Settings → Developer
2. Include key in request headers
3. Follow our rate limits

### Basic Example
\`\`\`javascript
const response = await fetch('https://api.apex.video/v1/generate', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    script: 'Your video script here',
    style: 'cinematic',
    duration: 30
  })
});
\`\`\`

### Webhooks
Receive notifications when videos complete:
- Configure webhook URL in settings
- We'll POST to your endpoint
- Includes video URL and metadata
        `
      },
      {
        id: 'custom-templates',
        title: 'Custom Templates',
        description: 'Create reusable video templates',
        readTime: '6 min',
        content: `
## Custom Templates

### Creating Templates
1. Complete a project you want to reuse
2. Click "Save as Template"
3. Name and describe your template
4. Choose privacy (private/team/public)

### Using Templates
- Browse templates in the Create screen
- Click "Use Template"
- Customize the script and settings
- Generate your video

### Template Best Practices
- Keep templates focused on one use case
- Include placeholder text
- Document any special requirements
- Test thoroughly before sharing
        `
      },
      {
        id: 'team-collaboration',
        title: 'Team Collaboration',
        description: 'Work together on video projects',
        readTime: '5 min',
        content: `
## Team Collaboration

### Inviting Team Members
1. Settings → Team
2. Click "Invite Member"
3. Enter email address
4. Select role (Viewer, Editor, Admin)

### Roles & Permissions
**Viewer**: Can view projects
**Editor**: Can edit and generate
**Admin**: Full access including billing

### Shared Projects
- All team projects in shared workspace
- Real-time collaboration
- Comment and feedback tools
- Version history
        `
      }
    ]
  }
];

// Popular/Featured articles
const FEATURED_ARTICLES = [
  { categoryId: 'getting-started', articleId: 'create-first-video' },
  { categoryId: 'video-creation', articleId: 'script-writing' },
  { categoryId: 'troubleshooting', articleId: 'generation-failed' },
  { categoryId: 'getting-started', articleId: 'quick-tips' },
];

export default function HelpCenter() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    const results: { category: typeof HELP_CATEGORIES[0]; article: typeof HELP_CATEGORIES[0]['articles'][0] }[] = [];
    
    HELP_CATEGORIES.forEach(category => {
      category.articles.forEach(article => {
        if (
          article.title.toLowerCase().includes(query) ||
          article.description.toLowerCase().includes(query) ||
          article.content?.toLowerCase().includes(query)
        ) {
          results.push({ category, article });
        }
      });
    });
    
    return results.slice(0, 8);
  }, [searchQuery]);

  // Get current article content
  const currentArticle = useMemo(() => {
    if (!selectedCategory || !selectedArticle) return null;
    const category = HELP_CATEGORIES.find(c => c.id === selectedCategory);
    return category?.articles.find(a => a.id === selectedArticle);
  }, [selectedCategory, selectedArticle]);

  const currentCategory = HELP_CATEGORIES.find(c => c.id === selectedCategory);

  // Featured articles with full data
  const featuredWithData = FEATURED_ARTICLES.map(f => {
    const category = HELP_CATEGORIES.find(c => c.id === f.categoryId);
    const article = category?.articles.find(a => a.id === f.articleId);
    return { category, article };
  }).filter(f => f.category && f.article);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => 
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleArticleClick = (categoryId: string, articleId: string) => {
    setSelectedCategory(categoryId);
    setSelectedArticle(articleId);
    setSearchQuery('');
  };

  const handleBack = () => {
    if (selectedArticle) {
      setSelectedArticle(null);
    } else if (selectedCategory) {
      setSelectedCategory(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-foreground via-foreground/95 to-foreground/90">
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-1/2 -right-1/4 w-[800px] h-[800px] rounded-full bg-white/[0.02] blur-3xl" />
          <div className="absolute -bottom-1/2 -left-1/4 w-[600px] h-[600px] rounded-full bg-white/[0.03] blur-3xl" />
          <div className="absolute top-1/4 left-1/4 w-2 h-2 rounded-full bg-white/20 animate-pulse-soft" />
          <div className="absolute top-1/3 right-1/3 w-1.5 h-1.5 rounded-full bg-white/15 animate-pulse-soft delay-2" />
          <div className="absolute bottom-1/4 right-1/4 w-2.5 h-2.5 rounded-full bg-white/10 animate-pulse-soft delay-4" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <Link 
            to="/projects" 
            className="inline-flex items-center gap-2 text-white/60 hover:text-white/90 text-sm mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Projects
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 mb-6">
              <HelpCircle className="w-4 h-4 text-white/80" />
              <span className="text-sm font-medium text-white/80">Help Center</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 tracking-tight">
              How can we help you?
            </h1>
            <p className="text-lg sm:text-xl text-white/60 mb-10 max-w-2xl mx-auto">
              Find answers, learn best practices, and get the most out of Apex
            </p>

            {/* Search Bar */}
            <div className="relative max-w-2xl mx-auto">
              <div className="relative">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search for help articles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-14 pl-14 pr-6 text-lg bg-white border-0 rounded-2xl shadow-2xl focus-visible:ring-2 focus-visible:ring-white/20 placeholder:text-muted-foreground/60"
                />
              </div>

              {/* Search Results Dropdown */}
              <AnimatePresence>
                {searchResults.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-border overflow-hidden z-50"
                  >
                    {searchResults.map(({ category, article }, idx) => (
                      <button
                        key={`${category.id}-${article.id}`}
                        onClick={() => handleArticleClick(category.id, article.id)}
                        className={cn(
                          "w-full px-5 py-4 flex items-start gap-4 hover:bg-muted/50 transition-colors text-left",
                          idx !== 0 && "border-t border-border/50"
                        )}
                      >
                        <div className={cn(
                          "w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center flex-shrink-0",
                          category.color
                        )}>
                          <category.icon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{article.title}</p>
                          <p className="text-sm text-muted-foreground line-clamp-1">{article.description}</p>
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <AnimatePresence mode="wait">
          {/* Article View */}
          {currentArticle && currentCategory ? (
            <motion.div
              key="article"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              {/* Breadcrumb */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
                <button 
                  onClick={() => { setSelectedCategory(null); setSelectedArticle(null); }}
                  className="hover:text-foreground transition-colors"
                >
                  Help Center
                </button>
                <ChevronRight className="w-4 h-4" />
                <button 
                  onClick={() => setSelectedArticle(null)}
                  className="hover:text-foreground transition-colors"
                >
                  {currentCategory.title}
                </button>
                <ChevronRight className="w-4 h-4" />
                <span className="text-foreground">{currentArticle.title}</span>
              </div>

              <div className="grid lg:grid-cols-[1fr_300px] gap-12">
                {/* Article Content */}
                <article className="prose prose-slate max-w-none">
                  <div className="flex items-center gap-3 mb-6">
                    <div className={cn(
                      "w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center",
                      currentCategory.color
                    )}>
                      <currentCategory.icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <Badge variant="secondary" className="mb-1">
                        {currentCategory.title}
                      </Badge>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        {currentArticle.readTime} read
                      </div>
                    </div>
                  </div>

                  <h1 className="text-3xl sm:text-4xl font-bold mb-4">{currentArticle.title}</h1>
                  <p className="text-lg text-muted-foreground mb-8">{currentArticle.description}</p>

                  {/* Render markdown-like content */}
                  <div className="space-y-6">
                    {currentArticle.content?.split('\n').map((line, idx) => {
                      const trimmed = line.trim();
                      if (!trimmed) return null;
                      
                      if (trimmed.startsWith('## ')) {
                        return <h2 key={idx} className="text-2xl font-bold mt-8 mb-4">{trimmed.slice(3)}</h2>;
                      }
                      if (trimmed.startsWith('### ')) {
                        return <h3 key={idx} className="text-xl font-semibold mt-6 mb-3">{trimmed.slice(4)}</h3>;
                      }
                      if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
                        return <p key={idx} className="font-semibold">{trimmed.slice(2, -2)}</p>;
                      }
                      if (trimmed.startsWith('> ')) {
                        return (
                          <div key={idx} className="bg-info-muted border-l-4 border-info rounded-r-lg p-4 my-4">
                            <div className="flex items-start gap-3">
                              <Lightbulb className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
                              <p className="text-foreground">{trimmed.slice(2)}</p>
                            </div>
                          </div>
                        );
                      }
                      if (trimmed.startsWith('- ')) {
                        return (
                          <div key={idx} className="flex items-start gap-3">
                            <CheckCircle className="w-4 h-4 text-success flex-shrink-0 mt-1" />
                            <span>{trimmed.slice(2)}</span>
                          </div>
                        );
                      }
                      if (trimmed.match(/^\d+\./)) {
                        return <p key={idx} className="ml-4">{trimmed}</p>;
                      }
                      if (trimmed.startsWith('```')) {
                        return null; // Skip code block markers
                      }
                      return <p key={idx}>{trimmed}</p>;
                    })}
                  </div>

                  {/* Helpful? */}
                  <div className="mt-12 pt-8 border-t border-border">
                    <p className="text-muted-foreground mb-4">Was this article helpful?</p>
                    <div className="flex items-center gap-3">
                      <Button variant="outline" size="sm" className="gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Yes, helpful
                      </Button>
                      <Button variant="outline" size="sm" className="gap-2">
                        <AlertCircle className="w-4 h-4" />
                        Could be better
                      </Button>
                    </div>
                  </div>
                </article>

                {/* Sidebar */}
                <aside className="space-y-6">
                  <div className="glass-card p-6 rounded-2xl">
                    <h4 className="font-semibold mb-4">Related Articles</h4>
                    <div className="space-y-3">
                      {currentCategory.articles
                        .filter(a => a.id !== currentArticle.id)
                        .slice(0, 3)
                        .map(article => (
                          <button
                            key={article.id}
                            onClick={() => setSelectedArticle(article.id)}
                            className="block w-full text-left p-3 rounded-lg hover:bg-muted/50 transition-colors"
                          >
                            <p className="font-medium text-sm">{article.title}</p>
                            <p className="text-xs text-muted-foreground mt-1">{article.readTime}</p>
                          </button>
                        ))}
                    </div>
                  </div>

                  <div className="glass-card p-6 rounded-2xl">
                    <h4 className="font-semibold mb-4">Need More Help?</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Can't find what you're looking for? Our support team is here to help.
                    </p>
                    <Link to="/contact">
                      <Button className="w-full gap-2">
                        <MessageCircle className="w-4 h-4" />
                        Contact Support
                      </Button>
                    </Link>
                  </div>
                </aside>
              </div>
            </motion.div>
          ) : selectedCategory ? (
            /* Category View */
            <motion.div
              key="category"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              {/* Breadcrumb */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
                <button 
                  onClick={handleBack}
                  className="hover:text-foreground transition-colors"
                >
                  Help Center
                </button>
                <ChevronRight className="w-4 h-4" />
                <span className="text-foreground">{currentCategory?.title}</span>
              </div>

              {currentCategory && (
                <>
                  <div className="flex items-center gap-4 mb-8">
                    <div className={cn(
                      "w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center",
                      currentCategory.color
                    )}>
                      <currentCategory.icon className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <h1 className="text-3xl font-bold">{currentCategory.title}</h1>
                      <p className="text-muted-foreground">{currentCategory.description}</p>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    {currentCategory.articles.map((article, idx) => (
                      <motion.button
                        key={article.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        onClick={() => setSelectedArticle(article.id)}
                        className="glass-card p-6 rounded-2xl text-left hover:scale-[1.02] transition-transform"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="font-semibold">{article.title}</h3>
                          {article.popular && (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                              <Star className="w-3 h-3 mr-1" />
                              Popular
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">{article.description}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            {article.readTime}
                          </span>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          ) : (
            /* Home View */
            <motion.div
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Featured Articles */}
              <section className="mb-16">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-bold">Popular Articles</h2>
                    <p className="text-muted-foreground">Most helpful resources to get you started</p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {featuredWithData.map(({ category, article }, idx) => {
                    if (!category || !article) return null;
                    const IconComponent = category.icon;
                    return (
                      <motion.button
                        key={`${category.id}-${article.id}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        onClick={() => handleArticleClick(category.id, article.id)}
                        className="glass-card p-5 rounded-2xl text-left hover:scale-[1.02] transition-transform group"
                      >
                        <div className={cn(
                          "w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center mb-4",
                          category.color
                        )}>
                          <IconComponent className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="font-semibold mb-2 group-hover:text-primary transition-colors">
                          {article.title}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {article.description}
                        </p>
                        <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
                          <Clock className="w-3.5 h-3.5" />
                          {article.readTime}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </section>

              {/* Browse by Category */}
              <section className="mb-16">
                <h2 className="text-2xl font-bold mb-2">Browse by Category</h2>
                <p className="text-muted-foreground mb-8">Find help organized by topic</p>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {HELP_CATEGORIES.map((category, idx) => (
                    <motion.button
                      key={category.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      onClick={() => setSelectedCategory(category.id)}
                      className="glass-card p-6 rounded-2xl text-left hover:scale-[1.02] transition-transform group"
                    >
                      <div className={cn(
                        "w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center mb-4",
                        category.color
                      )}>
                        <category.icon className="w-6 h-6 text-white" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">
                        {category.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        {category.description}
                      </p>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {category.articles.length} articles
                        </span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                      </div>
                    </motion.button>
                  ))}
                </div>
              </section>

              {/* Quick Links */}
              <section className="mb-16">
                <h2 className="text-2xl font-bold mb-2">Quick Links</h2>
                <p className="text-muted-foreground mb-8">Jump to common tasks</p>

                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { icon: Play, label: 'Video Tutorials', href: '#tutorials' },
                    { icon: FileText, label: 'API Documentation', href: '#api' },
                    { icon: Users, label: 'Community Forum', href: '#community' },
                    { icon: MessageCircle, label: 'Contact Support', href: '/contact' },
                  ].map((link, idx) => (
                    <Link
                      key={idx}
                      to={link.href}
                      className="flex items-center gap-4 p-4 rounded-xl border border-border hover:bg-muted/50 transition-colors group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center group-hover:bg-foreground group-hover:text-background transition-colors">
                        <link.icon className="w-5 h-5" />
                      </div>
                      <span className="font-medium">{link.label}</span>
                      <ArrowUpRight className="w-4 h-4 ml-auto text-muted-foreground group-hover:text-foreground transition-colors" />
                    </Link>
                  ))}
                </div>
              </section>

              {/* Contact CTA */}
              <section className="glass-card-dark rounded-3xl p-8 sm:p-12 text-center">
                <div className="max-w-2xl mx-auto">
                  <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-6">
                    <MessageCircle className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
                    Still need help?
                  </h2>
                  <p className="text-white/60 mb-8">
                    Our support team is available 24/7 to help you with any questions or issues.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Link to="/contact">
                      <Button size="lg" className="bg-white text-foreground hover:bg-white/90 gap-2">
                        <MessageCircle className="w-5 h-5" />
                        Contact Support
                      </Button>
                    </Link>
                    <Button 
                      size="lg" 
                      variant="outline" 
                      className="border-white/20 text-white hover:bg-white/10 gap-2"
                    >
                      <ExternalLink className="w-5 h-5" />
                      Join Community
                    </Button>
                  </div>
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
