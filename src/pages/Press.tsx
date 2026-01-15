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
  Layers,
  Eye,
  Brain,
  Mic,
  Palette,
  Target,
  Rocket,
  Heart,
  CheckCircle2,
  Quote,
  Play
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import apexLogo from "@/assets/apex-logo.png";

const HERO_STATS = [
  { value: "AI", label: "Powered Generation", icon: Brain, color: "from-violet-500 to-purple-600" },
  { value: "Multi", label: "View Characters", icon: Eye, color: "from-blue-500 to-cyan-500" },
  { value: "Auto", label: "Video Stitching", icon: Zap, color: "from-amber-500 to-orange-500" },
  { value: "Smart", label: "Retry System", icon: Shield, color: "from-emerald-500 to-green-500" },
];

const PLATFORM_FEATURES = [
  {
    icon: Film,
    title: "Script-to-Video Generation",
    subtitle: "Automated Production",
    description: "Create video content from written scripts. Our platform analyzes your script and generates video clips that bring your narrative to life.",
    features: ["Script Analysis", "Scene Generation", "Clip Assembly"],
    gradient: "from-rose-500/20 via-pink-500/10 to-transparent",
    iconBg: "bg-gradient-to-br from-rose-500 to-pink-600"
  },
  {
    icon: Users,
    title: "Character Consistency",
    subtitle: "Visual Coherence",
    description: "Our multi-view character system helps maintain consistent character appearances across different scenes and camera angles in your productions.",
    features: ["Multi-View Capture", "Appearance Tracking", "Scene Consistency"],
    gradient: "from-blue-500/20 via-indigo-500/10 to-transparent",
    iconBg: "bg-gradient-to-br from-blue-500 to-indigo-600"
  },
  {
    icon: Sparkles,
    title: "AI-Powered Pipeline",
    subtitle: "Integrated Workflow",
    description: "Multiple AI systems work together to handle different aspects of video production, from initial script processing to final video assembly.",
    features: ["Multi-Model Approach", "Quality Monitoring", "Automated Processing"],
    gradient: "from-amber-500/20 via-yellow-500/10 to-transparent",
    iconBg: "bg-gradient-to-br from-amber-500 to-yellow-600"
  },
  {
    icon: Music,
    title: "Audio Integration",
    subtitle: "Voice & Music",
    description: "Add AI-generated voice narration and background music to your video projects. Supports multiple voice options and music styles.",
    features: ["Voice Synthesis", "Music Generation", "Audio Sync"],
    gradient: "from-emerald-500/20 via-teal-500/10 to-transparent",
    iconBg: "bg-gradient-to-br from-emerald-500 to-teal-600"
  },
  {
    icon: Wand2,
    title: "Continuity Tracking",
    subtitle: "Scene Management",
    description: "Track visual elements across clips to help maintain consistency in lighting, colors, and positioning throughout your video.",
    features: ["Color Matching", "Scene Memory", "Transition Handling"],
    gradient: "from-violet-500/20 via-purple-500/10 to-transparent",
    iconBg: "bg-gradient-to-br from-violet-500 to-purple-600"
  },
  {
    icon: Shield,
    title: "Automatic Retry System",
    subtitle: "Quality Focus",
    description: "When video generation encounters issues, our system can automatically retry to help deliver better results. Quality monitoring helps identify potential issues.",
    features: ["Auto-Retry", "Issue Detection", "Quality Checks"],
    gradient: "from-cyan-500/20 via-sky-500/10 to-transparent",
    iconBg: "bg-gradient-to-br from-cyan-500 to-sky-600"
  }
];

const CAPABILITIES = [
  {
    title: "Multi-View Character System",
    icon: Eye,
    description: "Character appearance tracking across scenes",
    details: [
      "Captures multiple angles of characters for reference",
      "Helps maintain visual consistency across clips",
      "Supports different costume and appearance variations",
      "Integrates with the video generation pipeline"
    ]
  },
  {
    title: "Continuity Management",
    icon: Layers,
    description: "Scene-to-scene visual tracking",
    details: [
      "Monitors color and lighting between clips",
      "Tracks spatial positioning in scenes",
      "Helps with smooth transitions between clips",
      "Records scene metadata for reference"
    ]
  },
  {
    title: "Video Stitching",
    icon: Film,
    description: "Multi-clip video assembly",
    details: [
      "Combines multiple clips into complete videos",
      "Handles transitions between scenes",
      "Supports audio-visual synchronization",
      "Cloud-based processing for reliability"
    ]
  },
  {
    title: "Quality Monitoring",
    icon: Shield,
    description: "Generation quality tracking",
    details: [
      "Monitors generation status and progress",
      "Automatic retry for failed generations",
      "Visual feedback on clip status",
      "Credits charged only for successful generations"
    ]
  }
];

const USE_CASES = [
  { icon: Play, title: "Content Creators", description: "Create video content more efficiently" },
  { icon: Target, title: "Marketing Teams", description: "Produce video campaigns faster" },
  { icon: Palette, title: "Creative Projects", description: "Visualize concepts with video" },
  { icon: Globe, title: "Educational Content", description: "Create instructional videos" },
  { icon: Rocket, title: "Startups", description: "Video content on limited budgets" },
  { icon: Heart, title: "Personal Projects", description: "Bring your stories to video" },
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
                Press & Media
              </Badge>
            </motion.div>
            
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-8 leading-[0.95]">
              <span className="bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
                AI-Powered
              </span>
              <br />
              <span className="bg-gradient-to-r from-primary via-violet-500 to-pink-500 bg-clip-text text-transparent">
                Video Creation
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-3xl mx-auto leading-relaxed">
              Apex Studio is a video creation platform that uses AI to help transform 
              scripts and ideas into video content. Generate clips, add narration, 
              and assemble complete videos.
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

      {/* About Section */}
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
                  "We're building tools that make video creation more accessible. 
                  Apex Studio combines multiple AI technologies into a single platform 
                  designed to help creators produce video content more efficiently."
                </h2>
                <div className="text-center">
                  <div className="inline-flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center">
                      <img src={apexLogo} alt="Apex Studio" className="w-8 h-8" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold">Apex Studio</div>
                      <div className="text-sm text-muted-foreground">apex-studio.ai</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Platform Features */}
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
              Platform Features
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              What We Offer
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Key features of the Apex Studio video creation platform
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {PLATFORM_FEATURES.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ y: -8 }}
                className="group"
              >
                <Card className="h-full bg-card/80 backdrop-blur-sm border-border/50 hover:border-primary/40 transition-all duration-300 overflow-hidden">
                  <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity`} />
                  <CardContent className="p-8 relative">
                    <div className={`w-14 h-14 rounded-2xl ${feature.iconBg} flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform`}>
                      <feature.icon className="w-7 h-7 text-white" />
                    </div>
                    <Badge variant="secondary" className="mb-3 text-xs font-medium">
                      {feature.subtitle}
                    </Badge>
                    <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                    <p className="text-muted-foreground mb-6 leading-relaxed">{feature.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {feature.features.map((item) => (
                        <span key={item} className="text-xs px-3 py-1.5 rounded-full bg-muted/80 text-muted-foreground">
                          {item}
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

      {/* Capabilities */}
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
              How It Works
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Platform Capabilities
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Technical capabilities that power the platform
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {CAPABILITIES.map((capability, index) => (
              <motion.div
                key={capability.title}
                initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
                className="group"
              >
                <div className="p-8 rounded-2xl bg-gradient-to-br from-muted/50 to-muted/20 border border-border/40 hover:border-primary/30 transition-all h-full">
                  <div className="flex items-start gap-4 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                      <capability.icon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-1">{capability.title}</h3>
                      <p className="text-sm text-muted-foreground">{capability.description}</p>
                    </div>
                  </div>
                  <ul className="space-y-3">
                    {capability.details.map((detail, i) => (
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
              Use Cases
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Who It's For
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Apex Studio is designed for a variety of video creation needs
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
              Download official logos and media assets for press coverage
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
                  please reach out to our team.
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
