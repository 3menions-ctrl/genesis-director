import { motion } from 'framer-motion';
import { Star, Sparkles, Video } from 'lucide-react';
import { cn } from '@/lib/utils';

// Feature highlights instead of fake testimonials
const HIGHLIGHTS = [
  {
    title: 'Text-to-Video Generation',
    description: 'Transform your text descriptions into video clips using AI technology.',
    icon: Video,
    color: 'from-blue-500/20 to-cyan-500/20',
  },
  {
    title: 'Automatic Retries',
    description: 'Our system automatically retries clip generation to help ensure quality results.',
    icon: Star,
    color: 'from-amber-500/20 to-orange-500/20',
  },
  {
    title: 'Script Generation',
    description: 'AI-powered script writing helps break your ideas into scene-by-scene shots.',
    icon: Sparkles,
    color: 'from-purple-500/20 to-pink-500/20',
  },
];

export default function TestimonialsSection() {
  return (
    <section className="relative z-10 py-24 px-4 lg:px-8 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card mb-6">
            <Sparkles className="w-4 h-4 text-foreground" />
            <span className="text-sm font-medium text-foreground">Why Apex Studio</span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground mb-4">
            AI-Powered Video Creation
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Create videos from text or images with our AI video generation platform.
          </p>
        </div>

        {/* Highlights Grid */}
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {HIGHLIGHTS.map((highlight, index) => {
            const Icon = highlight.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
                className={cn(
                  "group relative p-8 rounded-3xl border border-white/[0.08] bg-gradient-to-b",
                  highlight.color,
                  "hover:border-white/20 hover:-translate-y-1 transition-all duration-300"
                )}
              >
                {/* Icon */}
                <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mb-6">
                  <Icon className="w-7 h-7 text-foreground" />
                </div>
                
                {/* Content */}
                <h3 className="text-xl font-bold text-foreground mb-3">
                  {highlight.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {highlight.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
