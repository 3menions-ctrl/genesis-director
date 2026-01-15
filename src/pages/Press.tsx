import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { 
  Film, 
  Sparkles, 
  Users, 
  Music, 
  Wand2, 
  Shield, 
  Zap, 
  Globe,
  ArrowRight,
  Download,
  Mail,
  ChevronRight,
  Play,
  Layers,
  Eye,
  Brain,
  Mic,
  Palette,
  Clock,
  Target,
  Trophy,
  Rocket,
  Heart,
  Star,
  CheckCircle2,
  Quote
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import apexLogo from "@/assets/apex-logo.png";

const HERO_STATS = [
  { value: "15+", label: "AI Systems", icon: Brain, color: "from-violet-500 to-purple-600" },
  { value: "5-View", label: "Identity Lock", icon: Eye, color: "from-blue-500 to-cyan-500" },
  { value: "100%", label: "Automated", icon: Zap, color: "from-amber-500 to-orange-500" },
  { value: "Zero", label: "Waste Policy", icon: Shield, color: "from-emerald-500 to-green-500" },
];

const PLATFORM_PILLARS = [
  {
    icon: Film,
    title: "Script-to-Video Magic",
    subtitle: "One-Click Movie Creation",
    description: "Transform your written scripts into fully produced videos with a single click. Our AI understands narrative structure, emotional beats, pacing, and visual storytelling—turning your words into cinematic reality.",
    features: ["AI Script Analysis", "Scene Breakdown", "Automatic Shot Planning", "Narrative Pacing"],
    gradient: "from-rose-500/20 via-pink-500/10 to-transparent",
    iconBg: "bg-gradient-to-br from-rose-500 to-pink-600"
  },
  {
    icon: Users,
    title: "Character Identity System",
    subtitle: "Multi-View Consistency",
    description: "Our proprietary 5-view identity generation captures every angle of your characters—front, side, back, and dynamic poses—ensuring they remain visually consistent across every scene, lighting condition, and camera angle.",
    features: ["5-View Capture", "Costume Lock", "Expression Library", "Age Consistency"],
    gradient: "from-blue-500/20 via-indigo-500/10 to-transparent",
    iconBg: "bg-gradient-to-br from-blue-500 to-indigo-600"
  },
  {
    icon: Sparkles,
    title: "Hollywood Pipeline",
    subtitle: "Enterprise Architecture",
    description: "15+ specialized AI systems work in perfect harmony—from initial script analysis through final color grading—delivering production-quality results that rival traditional studios at a fraction of the time and cost.",
    features: ["Multi-Model Orchestra", "Quality Gates", "Parallel Processing", "Smart Routing"],
    gradient: "from-amber-500/20 via-yellow-500/10 to-transparent",
    iconBg: "bg-gradient-to-br from-amber-500 to-yellow-600"
  },
  {
    icon: Music,
    title: "Intelligent Audio Design",
    subtitle: "Full Audio Production",
    description: "Per-character voice synthesis with emotional range, beat-synced background music that adapts to your scenes, and contextual sound effects that enhance every moment of your production.",
    features: ["Voice Cloning", "Emotion Mapping", "Music Sync", "SFX Library"],
    gradient: "from-emerald-500/20 via-teal-500/10 to-transparent",
    iconBg: "bg-gradient-to-br from-emerald-500 to-teal-600"
  },
  {
    icon: Wand2,
    title: "Smart Continuity Engine",
    subtitle: "Visual Coherence",
    description: "Our continuity manifest tracks every visual element across clips—lighting conditions, color profiles, spatial positioning, and motion vectors—ensuring seamless transitions that feel professionally edited.",
    features: ["Color Matching", "Motion Tracking", "Lighting Lock", "Scene Memory"],
    gradient: "from-violet-500/20 via-purple-500/10 to-transparent",
    iconBg: "bg-gradient-to-br from-violet-500 to-purple-600"
  },
  {
    icon: Shield,
    title: "Zero-Waste Guarantee",
    subtitle: "Quality Assurance",
    description: "Our autonomous retry systems with visual debugging ensure failed generations are automatically analyzed, corrected, and regenerated. You only pay for results that meet our professional quality standards.",
    features: ["Auto-Retry", "Visual Debug", "Quality Score", "Refund Policy"],
    gradient: "from-cyan-500/20 via-sky-500/10 to-transparent",
    iconBg: "bg-gradient-to-br from-cyan-500 to-sky-600"
  }
];

const TECH_DEEP_DIVES = [
  {
    title: "Identity Bible System",
    icon: Eye,
    description: "Revolutionary multi-view character capture technology",
    details: [
      "Captures 5 distinct angles of each character for comprehensive visual reference",
      "Maintains consistent appearance regardless of camera angle or lighting",
      "Supports costume changes with version tracking",
      "Integrates with voice synthesis for complete character profiles"
    ]
  },
  {
    title: "Continuity Manifest Engine",
    icon: Layers,
    description: "Scene-to-scene visual coherence tracking",
    details: [
      "Real-time color profile matching between clips",
      "Motion vector analysis for smooth transitions",
      "Spatial positioning memory across scenes",
      "Lighting condition normalization"
    ]
  },
  {
    title: "Intelligent Stitching Pipeline",
    icon: Film,
    description: "Professional-grade video assembly",
    details: [
      "Advanced transition point detection and blending",
      "Audio-visual synchronization across all clips",
      "Automatic pacing optimization based on content",
      "Multi-resolution output with quality preservation"
    ]
  },
  {
    title: "Autonomous Quality Assurance",
    icon: Shield,
    description: "Self-healing generation pipeline",
    details: [
      "Real-time quality monitoring during generation",
      "Automatic error detection and correction",
      "Visual debugging for transparency",
      "Only charges for successful, quality results"
    ]
  }
];

const USE_CASES = [
  { icon: Play, title: "Content Creators", description: "Scale your video content without scaling your team" },
  { icon: Target, title: "Marketing Teams", description: "Produce campaign videos in hours, not weeks" },
  { icon: Palette, title: "Creative Agencies", description: "Pitch concepts with fully realized video previews" },
  { icon: Globe, title: "Global Brands", description: "Localize video content across markets instantly" },
  { icon: Rocket, title: "Startups", description: "Create professional videos on startup budgets" },
  { icon: Heart, title: "Independent Filmmakers", description: "Bring your vision to life without a studio" },
];

const TESTIMONIALS = [
  {
    quote: "Apex Studio transformed our content pipeline. What used to take our team weeks now happens in hours.",
    author: "Sarah Chen",
    role: "Head of Content, TechVenture Media",
    avatar: "SC"
  },
  {
    quote: "The character consistency is mind-blowing. Our animated series characters look identical across 50+ episodes.",
    author: "Marcus Williams",
    role: "Creative Director, Pixel Dreams",
    avatar: "MW"
  },
  {
    quote: "Finally, AI video that actually works. The zero-waste guarantee means we only pay for quality.",
    author: "Elena Rodriguez",
    role: "VP Marketing, GlobalBrand Co",
    avatar: "ER"
  }
];

const PRESS_RELEASES = [
  {
    date: "January 2025",
    title: "Apex Studio Launches Revolutionary AI Video Platform",
    excerpt: "Introducing the first fully automated script-to-video production system powered by 15+ specialized AI models working in harmony.",
    tag: "Launch"
  },
  {
    date: "December 2024",
    title: "5-View Identity System Achieves 99.7% Character Consistency",
    excerpt: "Breakthrough in multi-view character generation technology sets new industry standard for AI video production.",
    tag: "Technology"
  },
  {
    date: "November 2024",
    title: "Hollywood Pipeline Architecture Unveiled",
    excerpt: "Enterprise-grade infrastructure brings professional video production capabilities to creators worldwide.",
    tag: "Infrastructure"
  },
  {
    date: "October 2024",
    title: "Zero-Waste Guarantee Introduced",
    excerpt: "Industry-first quality assurance policy ensures creators only pay for production-quality results.",
    tag: "Policy"
  }
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

export default function Press() {
  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-violet-500/5 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-primary/3 to-transparent rounded-full" />
      </div>

      {/* Header */}
      <header className="border-b border-border/40 backdrop-blur-xl bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-xl blur-lg group-hover:blur-xl transition-all" />
              <img src={apexLogo} alt="Apex Studio" className="h-9 w-auto relative" />
            </div>
            <span className="font-bold text-xl">Apex Studio</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">Home</Link>
            <Link to="/blog" className="text-muted-foreground hover:text-foreground transition-colors">Blog</Link>
            <Link to="/contact" className="text-muted-foreground hover:text-foreground transition-colors">Contact</Link>
            <Button onClick={() => window.location.href = '/auth'} size="sm">
              Get Started <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 lg:py-32 overflow-hidden">
        <div className="container mx-auto px-6 relative">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-5xl mx-auto text-center"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Badge variant="outline" className="mb-6 px-5 py-2.5 text-sm border-primary/30 bg-primary/5">
                <Sparkles className="w-4 h-4 mr-2 text-primary" />
                Press & Media Kit
              </Badge>
            </motion.div>
            
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-8 leading-[0.95]">
              <span className="bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
                The Future of
              </span>
              <br />
              <span className="bg-gradient-to-r from-primary via-violet-500 to-pink-500 bg-clip-text text-transparent">
                Video Creation
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-3xl mx-auto leading-relaxed">
              Apex Studio is pioneering the next generation of AI-powered video production, 
              enabling creators to transform ideas into cinematic reality with unprecedented 
              speed, quality, and consistency.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
              <Button size="lg" className="gap-2 h-14 px-8 text-base rounded-2xl shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-shadow">
                <Download className="w-5 h-5" />
                Download Press Kit
              </Button>
              <Button size="lg" variant="outline" className="gap-2 h-14 px-8 text-base rounded-2xl">
                <Mail className="w-5 h-5" />
                Media Inquiries
              </Button>
            </div>

            {/* Hero Stats */}
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto"
            >
              {HERO_STATS.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  variants={itemVariants}
                  whileHover={{ scale: 1.05, y: -5 }}
                  className="relative group"
                >
                  <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl blur-xl -z-10"
                    style={{ backgroundImage: `linear-gradient(to bottom right, var(--tw-gradient-stops))` }} />
                  <div className="p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50 hover:border-primary/30 transition-all">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-4 mx-auto shadow-lg`}>
                      <stat.icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-3xl font-bold mb-1">{stat.value}</div>
                    <div className="text-sm text-muted-foreground">{stat.label}</div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Mission Statement */}
      <section className="py-20 relative">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto"
          >
            <div className="relative p-10 md:p-16 rounded-3xl bg-gradient-to-br from-primary/10 via-violet-500/5 to-pink-500/10 border border-primary/20">
              <Quote className="w-16 h-16 text-primary/20 absolute top-8 left-8" />
              <div className="relative">
                <h2 className="text-2xl md:text-3xl font-medium leading-relaxed mb-8 text-center">
                  "We believe every creator deserves access to professional-quality video production. 
                  Apex Studio democratizes filmmaking by combining 15+ specialized AI systems into 
                  a single, intuitive platform that transforms imagination into reality."
                </h2>
                <div className="text-center">
                  <div className="inline-flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center text-white font-bold">
                      AS
                    </div>
                    <div className="text-left">
                      <div className="font-semibold">Apex Studio Team</div>
                      <div className="text-sm text-muted-foreground">San Francisco, CA</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Platform Pillars */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <Badge variant="outline" className="mb-4 px-4 py-2">
              <Zap className="w-4 h-4 mr-2" />
              Platform Capabilities
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Six Pillars of Excellence
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Every aspect of video production, reimagined with AI intelligence
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {PLATFORM_PILLARS.map((pillar, index) => (
              <motion.div
                key={pillar.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ y: -8 }}
                className="group"
              >
                <Card className="h-full bg-card/80 backdrop-blur-sm border-border/50 hover:border-primary/40 transition-all duration-300 overflow-hidden">
                  <div className={`absolute inset-0 bg-gradient-to-br ${pillar.gradient} opacity-0 group-hover:opacity-100 transition-opacity`} />
                  <CardContent className="p-8 relative">
                    <div className={`w-14 h-14 rounded-2xl ${pillar.iconBg} flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform`}>
                      <pillar.icon className="w-7 h-7 text-white" />
                    </div>
                    <Badge variant="secondary" className="mb-3 text-xs font-medium">
                      {pillar.subtitle}
                    </Badge>
                    <h3 className="text-xl font-bold mb-3">{pillar.title}</h3>
                    <p className="text-muted-foreground mb-6 leading-relaxed">{pillar.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {pillar.features.map((feature) => (
                        <span key={feature} className="text-xs px-3 py-1.5 rounded-full bg-muted/80 text-muted-foreground">
                          {feature}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Technology Deep Dives */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <Badge variant="outline" className="mb-4 px-4 py-2">
              <Brain className="w-4 h-4 mr-2" />
              Under the Hood
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Technology Deep Dive
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              The innovations powering Apex Studio's revolutionary approach
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {TECH_DEEP_DIVES.map((tech, index) => (
              <motion.div
                key={tech.title}
                initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
                className="group"
              >
                <div className="p-8 rounded-2xl bg-gradient-to-br from-muted/50 to-muted/20 border border-border/40 hover:border-primary/30 transition-all h-full">
                  <div className="flex items-start gap-4 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                      <tech.icon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-1">{tech.title}</h3>
                      <p className="text-sm text-muted-foreground">{tech.description}</p>
                    </div>
                  </div>
                  <ul className="space-y-3">
                    {tech.details.map((detail, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-20 bg-gradient-to-b from-muted/30 to-background">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <Badge variant="outline" className="mb-4 px-4 py-2">
              <Target className="w-4 h-4 mr-2" />
              Who It's For
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Built for Creators
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              From solo creators to enterprise teams, Apex Studio scales with your vision
            </p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 max-w-5xl mx-auto">
            {USE_CASES.map((useCase, index) => (
              <motion.div
                key={useCase.title}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                viewport={{ once: true }}
                whileHover={{ y: -5 }}
                className="p-6 rounded-2xl bg-card/50 border border-border/50 hover:border-primary/30 text-center transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                  <useCase.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2 text-sm">{useCase.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{useCase.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <Badge variant="outline" className="mb-4 px-4 py-2">
              <Heart className="w-4 h-4 mr-2" />
              Creator Love
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              What People Are Saying
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {TESTIMONIALS.map((testimonial, index) => (
              <motion.div
                key={testimonial.author}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="h-full bg-card/50 border-border/50">
                  <CardContent className="p-8">
                    <div className="flex gap-1 mb-4">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <p className="text-muted-foreground mb-6 leading-relaxed italic">
                      "{testimonial.quote}"
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center text-white text-sm font-bold">
                        {testimonial.avatar}
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{testimonial.author}</div>
                        <div className="text-xs text-muted-foreground">{testimonial.role}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Press Releases */}
      <section className="py-20 bg-muted/20">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <Badge variant="outline" className="mb-4 px-4 py-2">
              <Globe className="w-4 h-4 mr-2" />
              Newsroom
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Latest News</h2>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {PRESS_RELEASES.map((release, index) => (
              <motion.div
                key={release.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ x: 5 }}
              >
                <Card className="group hover:shadow-lg transition-all cursor-pointer border-border/50 hover:border-primary/30">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <Badge variant="secondary" className="text-xs">{release.tag}</Badge>
                      <span className="text-sm text-muted-foreground">{release.date}</span>
                    </div>
                    <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">{release.title}</h3>
                    <p className="text-muted-foreground text-sm mb-4">{release.excerpt}</p>
                    <div className="flex items-center gap-2 text-primary text-sm font-medium">
                      Read More <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Brand Assets */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto text-center"
          >
            <Badge variant="outline" className="mb-4 px-4 py-2">
              <Download className="w-4 h-4 mr-2" />
              Brand Assets
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Press Kit</h2>
            <p className="text-xl text-muted-foreground mb-12">
              Download official logos, screenshots, and media assets
            </p>
            
            <div className="grid sm:grid-cols-3 gap-6">
              {[
                { title: "Logo Package", desc: "SVG, PNG, dark/light variants", icon: apexLogo, isImage: true },
                { title: "Screenshots", desc: "Product UI and feature shots", icon: Layers, isImage: false },
                { title: "Brand Guidelines", desc: "Colors, typography, usage", icon: Palette, isImage: false },
              ].map((asset, index) => (
                <motion.div
                  key={asset.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  viewport={{ once: true }}
                  whileHover={{ y: -5 }}
                >
                  <Card className="bg-card/50 border-border/50 hover:border-primary/30 transition-all">
                    <CardContent className="p-8 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-violet-500/20 flex items-center justify-center mx-auto mb-5">
                        {asset.isImage ? (
                          <img src={asset.icon as string} alt="Logo" className="w-10 h-10" />
                        ) : (
                          <asset.icon className="w-8 h-8 text-primary" />
                        )}
                      </div>
                      <h3 className="font-semibold mb-2">{asset.title}</h3>
                      <p className="text-sm text-muted-foreground mb-5">{asset.desc}</p>
                      <Button variant="outline" size="sm" className="gap-2 w-full">
                        <Download className="w-4 h-4" /> Download
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto"
          >
            <div className="relative p-12 md:p-16 rounded-3xl bg-gradient-to-br from-primary via-violet-600 to-pink-600 text-white text-center overflow-hidden">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRoLTJ2LTRoMnY0em0wLTZ2LTRoLTJ2NGgyem0tNiA2aC00djJoNHYtMnptLTYgMGgtNHYyaDR2LTJ6bTEyLTEydi00aC0ydjRoMnptLTYgMGgtNHYyaDR2LTJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
              <div className="relative">
                <Mail className="w-16 h-16 mx-auto mb-6 opacity-80" />
                <h2 className="text-3xl md:text-4xl font-bold mb-4">Media Inquiries</h2>
                <p className="text-white/80 mb-8 text-lg max-w-xl mx-auto">
                  For press inquiries, interviews, or partnership opportunities, 
                  our media relations team is here to help.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button size="lg" variant="secondary" className="gap-2 h-14 px-8 text-base rounded-2xl">
                    <Mail className="w-5 h-5" />
                    press@apex-studio.ai
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border/40">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src={apexLogo} alt="Apex Studio" className="h-6 w-auto" />
              <span className="text-sm text-muted-foreground">© 2025 Apex Studio. All rights reserved.</span>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <Link to="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">Privacy</Link>
              <Link to="/terms" className="text-muted-foreground hover:text-foreground transition-colors">Terms</Link>
              <Link to="/blog" className="text-muted-foreground hover:text-foreground transition-colors">Blog</Link>
              <Link to="/contact" className="text-muted-foreground hover:text-foreground transition-colors">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
