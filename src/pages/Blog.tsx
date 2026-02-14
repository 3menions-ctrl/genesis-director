import { useState, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, Clock, User, Tag, ChevronRight, Share2, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SafeMarkdownRenderer } from '@/components/content/SafeMarkdownRenderer';
import { Logo } from '@/components/ui/Logo';

// Import blog images
import aiVideoEvolution from '@/assets/blog/ai-video-evolution.jpg';
import smallBusinessVideo from '@/assets/blog/small-business-video.jpg';
import videoAiPossibilities from '@/assets/blog/video-ai-possibilities.jpg';
import futureVideoCreation from '@/assets/blog/future-of-video-creation.jpg';
import aiAvatarGeneration from '@/assets/blog/ai-avatar-video-generation.jpg';

const AbstractBackground = lazy(() => import('@/components/landing/AbstractBackground'));
const Footer = lazy(() => import('@/components/landing/Footer'));

interface BlogArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  image: string;
  author: string;
  date: string;
  readTime: string;
  category: string;
  tags: string[];
}

const BLOG_ARTICLES: BlogArticle[] = [
  {
    id: '1',
    slug: 'ai-video-creation-getting-better',
    title: 'The Evolution of AI Video Creation: How Technology is Revolutionizing Content Production',
    excerpt: 'Discover how artificial intelligence is transforming video creation, from early experiments to today\'s sophisticated tools that generate cinematic content in minutes.',
    image: aiVideoEvolution,
    author: 'Apex-Studio Team',
    date: 'January 12, 2026',
    readTime: '8 min read',
    category: 'Technology',
    tags: ['AI', 'Video Generation', 'Machine Learning', 'Future Tech'],
    content: `
## The Dawn of AI-Powered Video Creation

The landscape of video production has undergone a remarkable transformation over the past few years. What once required expensive equipment, professional crews, and weeks of post-production work can now be accomplished in minutes using artificial intelligence. This shift represents one of the most significant technological advances in the creative industry since the introduction of digital editing.

## From Text to Moving Pictures

Early AI video tools were limited in scope, producing simple animations or basic transitions between static images. However, recent breakthroughs in deep learning and neural network architecture have enabled AI systems to generate photorealistic video content from nothing more than text descriptions. These advancements leverage sophisticated models trained on millions of hours of video footage, learning the nuances of motion, lighting, perspective, and cinematic composition.

## Key Technological Breakthroughs

### Diffusion Models
The introduction of diffusion models marked a turning point in AI video generation. Unlike previous approaches that struggled with temporal consistency, diffusion-based systems can maintain coherent motion and visual continuity across frames. This means characters stay recognizable, objects maintain their physical properties, and camera movements feel natural and intentional.

### Temporal Coherence
One of the biggest challenges in AI video has been maintaining consistency across frames. Modern systems now use advanced attention mechanisms that understand not just what should appear in each frame, but how elements should move and interact over time. This results in smoother, more professional-looking output that rivals traditionally produced content.

### Style Transfer and Control
Today's AI video tools offer unprecedented control over artistic style. Creators can specify everything from lighting conditions and color grading to camera angles and movement patterns. This level of control was previously only available to large production studios with significant budgets.

## Real-World Applications

The improvements in AI video technology have opened doors across multiple industries:

- **Marketing and Advertising**: Brands can now create professional video ads without the overhead of traditional production
- **Education**: Educators can produce engaging visual content to explain complex concepts
- **Entertainment**: Independent creators can bring stories to life without massive budgets
- **E-commerce**: Product demonstrations and showcases can be generated automatically

## The Quality Revolution

Perhaps the most striking aspect of recent AI video advancement is the dramatic improvement in output quality. Early AI-generated videos were easily identifiable by their artifacts, inconsistent lighting, and unnatural movements. Today's best systems produce content that is increasingly difficult to distinguish from traditionally filmed footage.

Resolution has improved from basic 480p to full 4K and beyond. Frame rates have increased to cinema-standard 24fps and higher. And perhaps most importantly, the "AI look" that plagued earlier generations of tools has largely been eliminated through better training data and more sophisticated architectures.

## What's Next for AI Video

The trajectory of AI video technology suggests even more impressive capabilities on the horizon. Researchers are working on real-time video generation, interactive video experiences, and systems that can understand and implement complex narrative structures automatically.

As these tools become more accessible and powerful, they're democratizing video production in ways we couldn't have imagined just a few years ago. The future of content creation is being written in code, and it's more exciting than ever.
    `
  },
  {
    id: '2',
    slug: 'apex-studio-small-business-solution',
    title: 'Why Apex Studio is the Perfect Video AI Solution for Small Businesses',
    excerpt: 'Learn how small businesses are leveraging Apex Studio to create professional video content without the traditional costs and complexity of video production.',
    image: smallBusinessVideo,
    author: 'Marketing Team',
    date: 'January 10, 2026',
    readTime: '7 min read',
    category: 'Business',
    tags: ['Small Business', 'Marketing', 'ROI', 'Cost Savings'],
    content: `
## The Small Business Video Challenge

For small businesses, video marketing has always presented a frustrating paradox. Studies consistently show that video content drives higher engagement, better conversion rates, and stronger brand recall than any other format. Yet traditional video production remains prohibitively expensive and time-consuming for most small operations.

Hiring a professional video production team typically costs anywhere from $1,000 to $10,000 for a single short video. Add in the time required for planning, shooting, editing, and revisions, and you're looking at weeks of effort for a single piece of content. For a small business trying to maintain a consistent content calendar, this model simply doesn't scale.

## Enter Apex Studio: A Game-Changer for Small Business Video

Apex Studio was built specifically to solve this problem. By harnessing the power of advanced AI video generation, we've created a platform that allows anyone to produce professional-quality video content in minutes, not weeks, and at a fraction of traditional costs.

### Cost Efficiency That Makes Sense

With Apex Studio, small businesses can create unlimited video concepts and only pay for the content they actually produce. Our credit-based system means you're never locked into expensive monthly contracts or left paying for features you don't use. A single video that might cost $5,000 from a production company can be created for a fraction of that price.

### No Technical Skills Required

Perhaps the biggest barrier to video production for small businesses isn't cost—it's expertise. Understanding cameras, lighting, editing software, and post-production workflows requires years of training. Apex Studio eliminates this barrier entirely. If you can describe what you want in plain English, you can create professional video content.

Simply input your topic, select a style, and let our AI handle everything from script generation to final video production. The system understands cinematic principles, pacing, and visual storytelling, applying professional-grade techniques automatically.

### Speed to Market

In today's fast-paced digital landscape, timing matters. A trending topic or timely opportunity can come and go before a traditional video production cycle is complete. With Apex Studio, you can go from idea to finished video in minutes. This agility allows small businesses to:

- Respond quickly to industry trends
- Create timely promotional content for sales and events
- Test multiple video concepts rapidly
- Maintain consistent posting schedules across platforms

## Real Results for Real Businesses

Small businesses using Apex Studio are seeing remarkable results:

**Local Restaurants**: Creating weekly specials videos that drive foot traffic and social engagement

**E-commerce Stores**: Producing product showcase videos that increase conversion rates by up to 80%

**Service Providers**: Generating explainer videos that educate potential customers and build trust

**Real Estate Agents**: Creating property tour videos that attract more qualified buyers

## The ROI of AI Video

The mathematics of AI video production are compelling for small businesses:

- **Reduced production costs**: 80-90% savings compared to traditional video
- **Faster time to market**: Hours instead of weeks
- **Increased output**: Produce 10x more content with the same budget
- **Better testing**: Try multiple concepts before committing to one direction

## Getting Started is Simple

Apex Studio offers a straightforward path to professional video content:

1. Sign up for a free account
2. Describe your video concept
3. Choose your style and preferences
4. Generate and refine your video
5. Download and publish

There's no long-term commitment, no expensive equipment to purchase, and no steep learning curve to overcome. Just powerful AI video technology, designed for businesses of any size.
    `
  },
  {
    id: '3',
    slug: 'what-can-you-do-with-video-ai',
    title: '10 Creative Ways to Use AI Video: Unlocking New Possibilities for Content Creators',
    excerpt: 'Explore the endless possibilities of AI video creation—from educational content and marketing to storytelling and beyond.',
    image: videoAiPossibilities,
    author: 'Creative Team',
    date: 'January 8, 2026',
    readTime: '9 min read',
    category: 'Creative',
    tags: ['Content Creation', 'Creativity', 'Use Cases', 'Inspiration'],
    content: `
## Beyond the Basics: The Creative Potential of AI Video

Artificial intelligence has opened up a world of creative possibilities that were previously inaccessible to most content creators. Whether you're a solo entrepreneur, educator, marketer, or aspiring filmmaker, AI video tools are transforming what's possible. Let's explore the diverse ways people are using this technology to create compelling content.

## 1. Educational Content and E-Learning

One of the most impactful applications of AI video is in education. Complex concepts that are difficult to explain with words alone become instantly clearer when visualized. Educators are using AI video to:

- **Visualize abstract concepts**: From molecular biology to economic theories, AI can generate visual representations that make learning more intuitive
- **Create engaging course content**: Online courses with high-quality video content see significantly higher completion rates
- **Produce multi-language content**: Generate the same educational content in multiple languages to reach global audiences
- **Develop training materials**: Corporate training becomes more effective with visual demonstrations

## 2. Social Media Marketing

Social platforms are increasingly video-first, and AI makes it possible to keep up with the constant demand for fresh content:

- **Daily posting**: Maintain consistent presence across platforms without a dedicated video team
- **Platform-specific content**: Create variations optimized for each platform's unique format and audience
- **Trend response**: Jump on trending topics quickly with relevant video content
- **A/B testing**: Test multiple video concepts to see what resonates with your audience

## 3. Product Demonstrations and Showcases

For e-commerce and product-based businesses, AI video offers new ways to showcase offerings:

- **3D product visualizations**: Show products from every angle, in different environments
- **Use-case demonstrations**: Illustrate how products work in real-world scenarios
- **Feature highlights**: Create focused videos on specific product benefits
- **Comparison content**: Visual comparisons that help customers make decisions

## 4. Storytelling and Narrative Content

Perhaps the most exciting frontier is in narrative storytelling. AI enables creators to:

- **Develop short films**: Bring stories to life that would otherwise require massive budgets
- **Create series content**: Build ongoing narratives with consistent characters and settings
- **Explore visual styles**: Experiment with different artistic approaches without additional cost
- **Prototype longer projects**: Test concepts before committing to full production

## 5. Real Estate and Virtual Tours

The real estate industry has embraced AI video for property marketing:

- **Virtual property tours**: Create immersive walkthrough experiences
- **Neighborhood showcases**: Highlight local amenities and community features
- **Before/after renovations**: Visualize potential improvements for properties
- **Seasonal variations**: Show properties in different seasons or times of day

## The Creative Revolution

We're in the early stages of a creative revolution powered by AI. The tools available today are more capable than anything we've seen before, and they're becoming more accessible every day. Whether you're looking to enhance your business marketing, educate your audience, tell compelling stories, or simply explore new creative possibilities, AI video offers a path forward.

The question isn't whether AI will change creative content production—it already has. The question is how you'll use these powerful new tools to bring your vision to life. The only limit is your imagination.
    `
  }
];

// Additional articles
const ADDITIONAL_ARTICLES: BlogArticle[] = [
  {
    id: '4',
    slug: 'future-of-video-creation-2030',
    title: 'The Future of Video Creation: What 2030 and Beyond Will Bring',
    excerpt: 'From real-time 4K generation to fully autonomous film production, explore the groundbreaking innovations that will reshape how we create and consume video content.',
    image: futureVideoCreation,
    author: 'Apex-Studio Research',
    date: 'February 3, 2026',
    readTime: '10 min read',
    category: 'Future Tech',
    tags: ['Future', 'Innovation', 'Video Production', '2030', 'Predictions'],
    content: `
## The Next Frontier of Video Creation

As we stand at the precipice of a new era in content creation, the question isn't whether AI will transform video production—it's how radically different the landscape will look by 2030.

## Real-Time 4K and 8K Generation

Current AI video generation typically requires minutes to hours for processing. By 2030, experts predict real-time generation at cinema-quality resolutions will become standard. Imagine describing a scene and watching it render in real-time at 4K or even 8K resolution.

This breakthrough will fundamentally change:
- **Live broadcasting**: Generate visual content during live streams
- **Gaming**: Create infinite, unique cutscenes on the fly
- **Virtual production**: Real-time environment generation for film sets
- **Interactive storytelling**: Viewers influence the narrative as it's created

## Fully Autonomous Film Production

The most ambitious prediction involves AI systems capable of producing entire films autonomously:

- **Analyze successful films** to understand narrative structure and pacing
- **Generate original scripts** with compelling characters
- **Cast virtual actors** with appropriate appearances
- **Direct scenes** with professional cinematography
- **Compose original scores** matching the emotional tone
- **Edit the final cut** with proper pacing

## Neural Interface Content Creation

Perhaps the most transformative technology involves brain-computer interfaces for content creation:

- **Translate mental images directly into video**
- **Control editing through thought**
- **Collaborate telepathically** in real-time

## Hyper-Personalized Content

AI will enable content that adapts to individual viewers:

- **Cultural adaptation**: Same story, different cultural contexts
- **Language integration**: Native lip-sync in any language
- **Personal preferences**: Adjust pacing based on viewer history
- **Accessibility**: Automatic adaptations for different abilities

## The Human Element

Despite these advances, the human element will remain central:

- **New creative roles**: "AI directors" specializing in guiding AI systems
- **Enhanced collaboration**: AI as a creative partner
- **Premium human content**: Hand-crafted videos valued for authenticity
- **Hybrid workflows**: Seamless blending of human and AI contributions

The future of video creation is not a threat to human creativity—it's an unprecedented amplification of it.
    `
  },
  {
    id: '5',
    slug: 'ai-avatar-video-generation-complete-guide',
    title: 'The Complete Guide to AI Avatar Video Generation: Creating Lifelike Digital Presenters',
    excerpt: 'Learn how AI avatars are revolutionizing video content creation, from virtual spokespeople to personalized educational content and beyond.',
    image: aiAvatarGeneration,
    author: 'Apex-Studio Team',
    date: 'February 1, 2026',
    readTime: '11 min read',
    category: 'Tutorials',
    tags: ['AI Avatars', 'Video Generation', 'Digital Humans', 'Tutorial', 'Personalization'],
    content: `
## The Rise of AI-Generated Avatars

Artificial intelligence has unlocked a new frontier in video production: photorealistic digital humans that can deliver any message, in any language, with consistent quality and unlimited availability.

## What Are AI Video Avatars?

AI video avatars are computer-generated digital humans that can:

- **Speak naturally**: Lip-sync accurately to any script in multiple languages
- **Express emotions**: Convey appropriate facial expressions and body language
- **Maintain consistency**: Deliver identical quality across unlimited videos
- **Scale infinitely**: Create thousands of personalized videos simultaneously

## Types of AI Avatars

### Stock Avatars
Pre-designed digital humans available for immediate use, perfect for quick content creation.

### Custom Avatars
AI models trained on specific individuals (with consent), enabling personal brand videos at scale.

### Stylized Avatars
Non-photorealistic digital presenters with artistic styles like cartoon or anime-inspired designs.

## Key Applications

### Corporate Communications
- **Training videos**: Consistent, updatable content for employee onboarding
- **Internal announcements**: Leadership messages without production complexity
- **Multilingual communications**: Same message across global offices

### E-Learning and Education
- **Personalized tutoring**: Avatars that adapt to individual learning styles
- **Accessibility**: Content in sign language or with visual cues
- **Engagement**: Dynamic presenters that maintain student attention

### Marketing and Sales
- **Personalize at scale**: Custom video messages for thousands of prospects
- **A/B test messaging**: Same presenter, different scripts for optimization
- **Localize content**: Native-language versions for global markets

## How AI Avatar Generation Works

Modern AI avatar systems combine multiple technologies:

1. **Text-to-Speech (TTS)**: Converting written scripts to natural speech
2. **Speech-to-Lip-Sync**: Generating accurate mouth movements
3. **Facial Animation**: Creating appropriate expressions
4. **Body Language Generation**: Natural gestures and posture
5. **Video Synthesis**: Combining all elements into seamless output

## Best Practices

### Script Writing
- **Write for speech**: Use natural, conversational language
- **Include pauses**: Add breaks for emphasis and breathing
- **Avoid jargon**: Unless appropriate for your audience

### Avatar Selection
- **Match your brand**: Choose avatars that reflect your identity
- **Consider diversity**: Represent your audience appropriately
- **Test engagement**: Different avatars may perform differently

## Getting Started with Apex-Studio

Apex-Studio makes AI avatar video generation accessible:

1. **Choose your avatar**: Select from our premium library
2. **Write your script**: Describe what you want or let AI help
3. **Customize settings**: Adjust voice, environment, and style
4. **Generate**: Watch your video come to life in minutes
5. **Download and share**: Use across all your platforms

The era of AI avatar video is here, transforming how we create and consume visual content.
    `
  }
];

// Combine all articles
const ALL_BLOG_ARTICLES = [...BLOG_ARTICLES, ...ADDITIONAL_ARTICLES];

export default function Blog() {
  const [selectedArticle, setSelectedArticle] = useState<BlogArticle | null>(null);

  if (selectedArticle) {
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
              <Logo size="md" showText textClassName="text-base" />
            </Link>
          </div>
        </nav>

        {/* Article View */}
        <div className="relative z-10 pt-24 pb-16">
          <div className="max-w-4xl mx-auto px-6">
            <Button
              variant="ghost"
              onClick={() => setSelectedArticle(null)}
              className="mb-8 text-white/40 hover:text-white hover:bg-white/5"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Blog
            </Button>

            <motion.article
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              {/* Hero Image */}
              <div className="relative rounded-3xl overflow-hidden mb-8 aspect-video">
                <img 
                  src={selectedArticle.image} 
                  alt={selectedArticle.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              </div>

              {/* Meta */}
              <div className="flex flex-wrap items-center gap-4 mb-6 text-white/40">
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

              {/* Title */}
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-8 leading-tight">
                {selectedArticle.title}
              </h1>

              {/* Content - Safe Markdown Rendering */}
              <div className="prose prose-invert prose-lg max-w-none">
                <SafeMarkdownRenderer 
                  content={selectedArticle.content}
                  variant="blog"
                  className="text-white/70 leading-relaxed"
                />
              </div>

              {/* Tags */}
              <div className="mt-12 pt-8 border-t border-white/10">
                <div className="flex flex-wrap items-center gap-2">
                  <Tag className="w-4 h-4 text-white/40" />
                  {selectedArticle.tags.map(tag => (
                    <Badge 
                      key={tag} 
                      variant="outline" 
                      className="border-white/20 text-white/60 hover:bg-white/5"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Share */}
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

        {/* Footer */}
        <Suspense fallback={null}>
          <Footer />
        </Suspense>
      </div>
    );
  }

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
            <Logo size="md" showText textClassName="text-base" />
          </Link>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={() => window.location.href = '/auth'}
              className="h-9 px-4 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-full"
            >
              Sign in
            </Button>
            <Button
              onClick={() => window.location.href = '/auth?mode=signup'}
              className="h-9 px-5 text-sm font-medium rounded-full bg-white text-black hover:bg-white/90 btn-star-blink"
            >
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="relative z-10 pt-24 pb-16">
        <div className="max-w-6xl mx-auto px-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <Link 
              to="/" 
              className="inline-flex items-center gap-2 text-white/40 hover:text-white transition-colors mb-8"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>
            
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Blog</h1>
            <p className="text-lg text-white/40 max-w-2xl mx-auto">
              Insights, tutorials, and updates from the Apex-Studio team
            </p>
          </motion.div>

          {/* Featured Article */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-12"
          >
            <button
              onClick={() => setSelectedArticle(ALL_BLOG_ARTICLES[0])}
              className="group w-full text-left"
            >
              <div className="relative rounded-3xl overflow-hidden bg-white/[0.02] border border-white/[0.05] hover:border-white/[0.1] transition-all duration-300">
                <div className="aspect-[21/9] relative">
                  <img 
                    src={ALL_BLOG_ARTICLES[0].image} 
                    alt={ALL_BLOG_ARTICLES[0].title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                  
                  <div className="absolute bottom-0 left-0 right-0 p-8">
                    <Badge className="mb-4 bg-white/10 text-white/80 border-0">
                      Featured
                    </Badge>
                    <h2 className="text-2xl md:text-3xl font-bold text-white mb-3 group-hover:text-white/90 transition-colors">
                      {ALL_BLOG_ARTICLES[0].title}
                    </h2>
                    <p className="text-white/50 mb-4 max-w-2xl">
                      {ALL_BLOG_ARTICLES[0].excerpt}
                    </p>
                    <div className="flex items-center gap-4 text-white/40 text-sm">
                      <span>{ALL_BLOG_ARTICLES[0].date}</span>
                      <span>•</span>
                      <span>{ALL_BLOG_ARTICLES[0].readTime}</span>
                    </div>
                  </div>
                </div>
              </div>
            </button>
          </motion.div>

          {/* Article Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            {ALL_BLOG_ARTICLES.slice(1).map((article, i) => (
              <motion.div
                key={article.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
              >
                <button
                  onClick={() => setSelectedArticle(article)}
                  className="group w-full text-left"
                >
                  <div className="rounded-2xl overflow-hidden bg-white/[0.02] border border-white/[0.05] hover:border-white/[0.1] hover:bg-white/[0.03] transition-all duration-300">
                    <div className="aspect-video relative">
                      <img 
                        src={article.image} 
                        alt={article.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                    </div>
                    
                    <div className="p-6">
                      <Badge variant="secondary" className="mb-3 bg-white/10 text-white/60 border-0 text-xs">
                        {article.category}
                      </Badge>
                      <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-white/90 transition-colors line-clamp-2">
                        {article.title}
                      </h3>
                      <p className="text-white/40 text-sm mb-4 line-clamp-2">
                        {article.excerpt}
                      </p>
                      <div className="flex items-center justify-between text-white/30 text-xs">
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

      {/* Footer */}
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </div>
  );
}
