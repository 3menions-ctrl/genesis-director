import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, Clock, User, Tag, ChevronRight, Share2, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Footer from '@/components/landing/Footer';

// Import blog images
import aiVideoEvolution from '@/assets/blog/ai-video-evolution.jpg';
import smallBusinessVideo from '@/assets/blog/small-business-video.jpg';
import videoAiPossibilities from '@/assets/blog/video-ai-possibilities.jpg';

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
    author: 'Apex Studio Team',
    date: 'January 12, 2025',
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
    date: 'January 10, 2025',
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

## Features Designed for Business Success

### Multi-Platform Optimization
Every video created in Apex Studio can be automatically optimized for different platforms. Create once, export for YouTube, Instagram, TikTok, and LinkedIn—all with the correct aspect ratios and formatting.

### Brand Consistency
Upload your brand assets and maintain consistent visual identity across all your video content. Colors, fonts, and style preferences are remembered and applied automatically.

### Script Generation
Not sure what to say? Our AI can generate compelling scripts based on your topic and goals. Just provide the basics, and receive professional copywriting tailored to your audience.

### Automatic Retries and Quality Assurance
Our system automatically ensures every clip meets quality standards. If something doesn't look right, the AI regenerates it automatically—you only see the final polished result.

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

## The Future is Now

The small business video revolution is happening right now, and Apex Studio is leading the charge. Don't let budget or expertise hold your business back from the power of video marketing. Join the thousands of small businesses already using AI to compete with larger competitors on the visual content battlefield.
    `
  },
  {
    id: '3',
    slug: 'what-can-you-do-with-video-ai',
    title: '10 Creative Ways to Use AI Video: Unlocking New Possibilities for Content Creators',
    excerpt: 'Explore the endless possibilities of AI video creation—from educational content and marketing to storytelling and beyond.',
    image: videoAiPossibilities,
    author: 'Creative Team',
    date: 'January 8, 2025',
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

## 6. Event Promotion and Recaps

Events benefit from video content at every stage:

- **Promotional teasers**: Build excitement before events with dynamic previews
- **Highlight reels**: Capture the energy and key moments from events
- **Speaker introductions**: Professional introductions for presenters and panelists
- **Thank you videos**: Personalized follow-up content for attendees

## 7. Internal Communications

Organizations are using AI video for more engaging internal communications:

- **Company updates**: Transform dry announcements into engaging video messages
- **Onboarding content**: Welcome new employees with professional introduction videos
- **Policy explanations**: Make compliance and policy content more digestible
- **Team celebrations**: Recognize achievements with personalized video content

## 8. Podcast and Content Repurposing

Maximize the value of existing content by transforming it into new formats:

- **Podcast visualizations**: Turn audio content into engaging video for YouTube and social
- **Blog-to-video**: Transform written articles into visual content
- **Quote graphics in motion**: Animate key quotes and insights from longer content
- **Clip creation**: Extract and visualize the most compelling moments

## 9. Personal Branding and Thought Leadership

Individuals are using AI video to build their personal brands:

- **Consistent content creation**: Maintain regular posting without appearing on camera
- **Expertise visualization**: Demonstrate knowledge through visual explanations
- **Speaking reel creation**: Build portfolios for speaking opportunities
- **Professional introductions**: Create polished self-introduction videos

## 10. Entertainment and Artistic Expression

Finally, AI video is enabling new forms of creative expression:

- **Music video creation**: Independent artists can create professional music videos
- **Poetry visualization**: Transform written poetry into visual experiences
- **Dream journals**: Bring dream imagery to life with AI generation
- **Experimental art**: Push creative boundaries with AI-assisted visual art

## Getting Started with AI Video Creation

The barrier to entry for AI video has never been lower. Modern platforms like Apex Studio make it possible to:

1. Start with just a text description or basic concept
2. Refine and iterate on generated content
3. Export in formats ready for any platform
4. Scale production as needed

## The Creative Revolution

We're in the early stages of a creative revolution powered by AI. The tools available today are more capable than anything we've seen before, and they're becoming more accessible every day. Whether you're looking to enhance your business marketing, educate your audience, tell compelling stories, or simply explore new creative possibilities, AI video offers a path forward.

The question isn't whether AI will change creative content production—it already has. The question is how you'll use these powerful new tools to bring your vision to life. The only limit is your imagination.
    `
  }
];

export default function Blog() {
  const [selectedArticle, setSelectedArticle] = useState<BlogArticle | null>(null);

  if (selectedArticle) {
    return (
      <div className="min-h-screen bg-background">
        {/* Article View */}
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Button
            variant="ghost"
            onClick={() => setSelectedArticle(null)}
            className="mb-8 text-muted-foreground hover:text-foreground"
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
            <div className="relative aspect-video rounded-2xl overflow-hidden mb-8">
              <img
                src={selectedArticle.image}
                alt={selectedArticle.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <Badge className="absolute top-4 left-4 bg-primary text-primary-foreground">
                {selectedArticle.category}
              </Badge>
            </div>

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-4">
              <span className="flex items-center gap-1">
                <User className="w-4 h-4" />
                {selectedArticle.author}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {selectedArticle.date}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {selectedArticle.readTime}
              </span>
            </div>

            {/* Title */}
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6 leading-tight">
              {selectedArticle.title}
            </h1>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mb-8">
              {selectedArticle.tags.map(tag => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  <Tag className="w-3 h-3 mr-1" />
                  {tag}
                </Badge>
              ))}
            </div>

            {/* Content */}
            <div className="prose prose-lg prose-invert max-w-none">
              {selectedArticle.content.split('\n').map((paragraph, idx) => {
                if (paragraph.startsWith('## ')) {
                  return (
                    <h2 key={idx} className="text-2xl font-bold text-foreground mt-10 mb-4">
                      {paragraph.replace('## ', '')}
                    </h2>
                  );
                }
                if (paragraph.startsWith('### ')) {
                  return (
                    <h3 key={idx} className="text-xl font-semibold text-foreground mt-8 mb-3">
                      {paragraph.replace('### ', '')}
                    </h3>
                  );
                }
                if (paragraph.startsWith('**') && paragraph.endsWith('**')) {
                  return (
                    <p key={idx} className="font-semibold text-foreground my-4">
                      {paragraph.replace(/\*\*/g, '')}
                    </p>
                  );
                }
                if (paragraph.startsWith('- ')) {
                  return (
                    <li key={idx} className="text-muted-foreground ml-6 my-2">
                      {paragraph.replace('- ', '').split('**').map((part, i) => 
                        i % 2 === 1 ? <strong key={i} className="text-foreground">{part}</strong> : part
                      )}
                    </li>
                  );
                }
                if (paragraph.trim()) {
                  return (
                    <p key={idx} className="text-muted-foreground leading-relaxed my-4">
                      {paragraph}
                    </p>
                  );
                }
                return null;
              })}
            </div>

            {/* Share */}
            <div className="mt-12 pt-8 border-t border-border">
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground">
                  Found this article helpful? Share it with others.
                </p>
                <Button variant="outline" size="sm">
                  <Share2 className="w-4 h-4 mr-2" />
                  Share Article
                </Button>
              </div>
            </div>

            {/* Related Articles */}
            <div className="mt-12">
              <h3 className="text-xl font-bold text-foreground mb-6">More Articles</h3>
              <div className="grid md:grid-cols-2 gap-6">
                {BLOG_ARTICLES.filter(a => a.id !== selectedArticle.id).slice(0, 2).map(article => (
                  <button
                    key={article.id}
                    onClick={() => {
                      setSelectedArticle(article);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="text-left group"
                  >
                    <div className="aspect-video rounded-lg overflow-hidden mb-3">
                      <img
                        src={article.image}
                        alt={article.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                      {article.title}
                    </h4>
                  </button>
                ))}
              </div>
            </div>
          </motion.article>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative py-20 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-background to-background" />
        <div className="relative max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Badge className="mb-4" variant="secondary">
              <BookOpen className="w-3 h-3 mr-1" />
              Apex Studio Blog
            </Badge>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4">
              Insights & Resources
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Explore the latest trends in AI video creation, tips for content creators, 
              and insights into the future of digital storytelling.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Articles Grid */}
      <section className="max-w-7xl mx-auto px-4 pb-20">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {BLOG_ARTICLES.map((article, idx) => (
            <motion.article
              key={article.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="group cursor-pointer"
              onClick={() => setSelectedArticle(article)}
            >
              <div className="relative aspect-video rounded-xl overflow-hidden mb-4">
                <img
                  src={article.image}
                  alt={article.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <Badge className="absolute top-3 left-3 bg-primary/90 text-primary-foreground text-xs">
                  {article.category}
                </Badge>
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {article.date}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {article.readTime}
                </span>
              </div>

              <h2 className="text-xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-2">
                {article.title}
              </h2>

              <p className="text-muted-foreground text-sm mb-4 line-clamp-3">
                {article.excerpt}
              </p>

              <div className="flex items-center text-primary text-sm font-medium">
                Read More
                <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </motion.article>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-muted/30 py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
            Ready to Create Amazing Videos?
          </h2>
          <p className="text-muted-foreground mb-6">
            Join thousands of creators using Apex Studio to produce professional video content with AI.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/auth">
              <Button size="lg" className="w-full sm:w-auto">
                Get Started Free
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link to="/">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                Learn More
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
