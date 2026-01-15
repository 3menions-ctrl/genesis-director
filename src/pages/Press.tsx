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
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import apexLogo from "@/assets/apex-logo.png";

const CORE_FEATURES = [
  {
    icon: Film,
    title: "Script-to-Video Automation",
    description: "Transform written scripts into fully produced videos with a single click. Our AI understands narrative structure, pacing, and visual storytelling.",
    highlight: "One-Click Movie Creation"
  },
  {
    icon: Users,
    title: "Character Identity System",
    description: "Proprietary 5-view identity generation ensures your characters remain consistent across every scene. No more jarring visual discontinuities.",
    highlight: "Multi-View Consistency"
  },
  {
    icon: Sparkles,
    title: "Hollywood Pipeline",
    description: "15+ specialized AI systems work in concert—from script analysis to final color grading—delivering production-quality results.",
    highlight: "Enterprise-Grade Architecture"
  },
  {
    icon: Music,
    title: "Intelligent Audio Design",
    description: "Per-character voice synthesis with emotional range, beat-synced music generation, and contextual sound effects that enhance every scene.",
    highlight: "Full Audio Production"
  },
  {
    icon: Wand2,
    title: "Smart Continuity Engine",
    description: "Our continuity manifest tracks every visual element across clips—lighting, color profiles, spatial positioning—ensuring seamless transitions.",
    highlight: "Visual Coherence"
  },
  {
    icon: Shield,
    title: "Zero-Waste Guarantee",
    description: "Autonomous retry systems with visual debugging ensure failed generations are automatically corrected. You only pay for successful results.",
    highlight: "Quality Assurance"
  }
];

const STATS = [
  { value: "15+", label: "AI Systems Orchestrated" },
  { value: "5-View", label: "Character Identity" },
  { value: "100%", label: "Automated Pipeline" },
  { value: "Zero", label: "Waste Guarantee" }
];

const PRESS_RELEASES = [
  {
    date: "January 2025",
    title: "Apex Studio Launches Revolutionary AI Video Platform",
    excerpt: "Introducing the first fully automated script-to-video production system powered by 15+ specialized AI models."
  },
  {
    date: "December 2024",
    title: "Character Consistency Breakthrough with 5-View Identity System",
    excerpt: "New proprietary technology ensures unprecedented visual coherence across multi-scene productions."
  },
  {
    date: "November 2024",
    title: "Hollywood Pipeline Architecture Revealed",
    excerpt: "Enterprise-grade infrastructure brings professional video production capabilities to creators worldwide."
  }
];

export default function Press() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 backdrop-blur-sm bg-background/80 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src={apexLogo} alt="Apex Studio" className="h-8 w-auto" />
            <span className="font-bold text-xl">Apex Studio</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">Home</Link>
            <Link to="/contact" className="text-muted-foreground hover:text-foreground transition-colors">Contact</Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="container mx-auto px-6 relative">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto text-center"
          >
            <Badge variant="outline" className="mb-6 px-4 py-2 text-sm">
              Press & Media
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent">
              Redefining Video Creation with AI
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Apex Studio is the world's first fully automated AI video production platform, 
              transforming scripts into professional-quality videos with unprecedented consistency and quality.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="gap-2">
                <Download className="w-4 h-4" />
                Press Kit
              </Button>
              <Button size="lg" variant="outline" className="gap-2">
                <Mail className="w-4 h-4" />
                Media Inquiries
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Banner */}
      <section className="py-12 bg-muted/30 border-y border-border/40">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="text-3xl md:text-4xl font-bold text-primary mb-2">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl font-bold mb-6">About Apex Studio</h2>
              <div className="prose prose-lg dark:prose-invert max-w-none">
                <p className="text-muted-foreground text-lg leading-relaxed mb-6">
                  Apex Studio represents a paradigm shift in video production. Built on the principle that 
                  creative vision shouldn't be limited by technical complexity, our platform orchestrates 
                  over 15 specialized AI systems to deliver end-to-end video production—from script to 
                  finished product—with zero manual intervention required.
                </p>
                <p className="text-muted-foreground text-lg leading-relaxed mb-6">
                  Our proprietary Hollywood Pipeline architecture ensures every aspect of production meets 
                  professional standards: intelligent scene composition, character consistency through our 
                  5-view identity system, synchronized audio design, and seamless multi-clip stitching with 
                  advanced continuity tracking.
                </p>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  With our Zero-Waste Guarantee, creators can focus entirely on their vision. Our autonomous 
                  retry systems with visual debugging automatically correct any generation issues, ensuring 
                  you only pay for results that meet our quality standards.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Core Features */}
      <section className="py-20 bg-muted/20">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl font-bold mb-4">Platform Capabilities</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              A comprehensive suite of AI-powered tools designed for professional video production
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {CORE_FEATURES.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="h-full bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/50 transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <feature.icon className="w-6 h-6 text-primary" />
                    </div>
                    <Badge variant="secondary" className="mb-3 text-xs">
                      {feature.highlight}
                    </Badge>
                    <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Technology Highlights */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mb-12"
            >
              <h2 className="text-3xl font-bold mb-4">Technology Highlights</h2>
              <p className="text-muted-foreground">
                The innovations that power Apex Studio's revolutionary approach to video creation
              </p>
            </motion.div>

            <div className="space-y-6">
              {[
                {
                  title: "Identity Bible System",
                  description: "Our multi-view character identity technology captures 5 distinct angles of each character, creating a comprehensive visual reference that ensures consistent appearance across all scenes—regardless of camera angle or lighting conditions."
                },
                {
                  title: "Continuity Manifest Engine",
                  description: "Every clip is analyzed and tagged with detailed metadata including color profiles, motion vectors, spatial positioning, and lighting conditions. This manifest ensures seamless transitions and visual coherence throughout your production."
                },
                {
                  title: "Intelligent Stitching Pipeline",
                  description: "Advanced video assembly technology that goes beyond simple concatenation. Our stitcher analyzes transition points, applies professional-grade blending, and ensures audio-visual synchronization across all clips."
                },
                {
                  title: "Autonomous Quality Assurance",
                  description: "Built-in validation systems continuously monitor generation quality. Failed attempts are automatically analyzed, corrected, and retried—ensuring every delivered frame meets professional standards."
                }
              ].map((item, index) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="flex gap-4 p-6 rounded-lg bg-muted/30 border border-border/40"
                >
                  <ChevronRight className="w-5 h-5 text-primary mt-1 shrink-0" />
                  <div>
                    <h3 className="font-semibold mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
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
            <h2 className="text-3xl font-bold mb-4">Latest News</h2>
            <p className="text-muted-foreground">Recent announcements and updates from Apex Studio</p>
          </motion.div>

          <div className="max-w-3xl mx-auto space-y-6">
            {PRESS_RELEASES.map((release, index) => (
              <motion.div
                key={release.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardContent className="p-6">
                    <div className="text-sm text-primary mb-2">{release.date}</div>
                    <h3 className="text-lg font-semibold mb-2">{release.title}</h3>
                    <p className="text-muted-foreground text-sm">{release.excerpt}</p>
                    <Button variant="link" className="px-0 mt-2 gap-1">
                      Read More <ArrowRight className="w-4 h-4" />
                    </Button>
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
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl font-bold mb-4">Brand Assets</h2>
              <p className="text-muted-foreground mb-8">
                Download official logos, screenshots, and media assets for press coverage
              </p>
              
              <div className="grid sm:grid-cols-2 gap-6 max-w-xl mx-auto">
                <Card className="bg-card/50 border-border/50">
                  <CardContent className="p-6 text-center">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <img src={apexLogo} alt="Logo" className="w-10 h-10" />
                    </div>
                    <h3 className="font-semibold mb-2">Logo Package</h3>
                    <p className="text-sm text-muted-foreground mb-4">SVG, PNG, and dark/light variants</p>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Download className="w-4 h-4" /> Download
                    </Button>
                  </CardContent>
                </Card>
                
                <Card className="bg-card/50 border-border/50">
                  <CardContent className="p-6 text-center">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <Globe className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">Media Kit</h3>
                    <p className="text-sm text-muted-foreground mb-4">Screenshots, banners, and B-roll</p>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Download className="w-4 h-4" /> Download
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="py-20 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-2xl mx-auto text-center"
          >
            <h2 className="text-3xl font-bold mb-4">Media Inquiries</h2>
            <p className="text-muted-foreground mb-8">
              For press inquiries, interviews, or additional information, please contact our media relations team.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="gap-2">
                <Mail className="w-4 h-4" />
                press@apex-studio.ai
              </Button>
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
              <Link to="/contact" className="text-muted-foreground hover:text-foreground transition-colors">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
