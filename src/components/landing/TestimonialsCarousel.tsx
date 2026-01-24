import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Quote, Video, Sparkles, Zap } from 'lucide-react';

// Platform highlights instead of testimonials (no fake reviews)
const HIGHLIGHTS = [
  {
    title: "Text-to-Video in Minutes",
    description: "Describe your vision in plain text. Our AI generates professional video clips with consistent characters, cinematic lighting, and smooth camera movements.",
    icon: Video,
  },
  {
    title: "No Video Editing Skills Required",
    description: "Skip the learning curve of complex software. Apex Studio handles script writing, scene generation, and video production automatically.",
    icon: Sparkles,
  },
  {
    title: "60 Free Credits to Start",
    description: "Create your first 6 video clips completely free. No credit card required. See the quality before you commit to any plan.",
    icon: Zap,
  },
];

interface TestimonialsCarouselProps {
  className?: string;
}

export default function TestimonialsCarousel({ className = '' }: TestimonialsCarouselProps) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % HIGHLIGHTS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const highlight = HIGHLIGHTS[current];
  const Icon = highlight.icon;

  return (
    <section className={`relative z-10 py-16 sm:py-24 px-4 lg:px-8 ${className}`}>
      <div className="max-w-4xl mx-auto">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-foreground/5 border border-foreground/10 mb-4">
            <Quote className="w-4 h-4 text-foreground" />
            <span className="text-sm font-medium text-foreground">Why Apex Studio</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
            Professional video creation, simplified
          </h2>
        </motion.div>

        {/* Highlight card */}
        <div className="relative h-[240px] sm:h-[200px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0"
            >
              <div className="glass-card p-8 sm:p-10 h-full flex flex-col justify-center items-center text-center">
                {/* Icon */}
                <div className="w-14 h-14 rounded-full bg-foreground/10 flex items-center justify-center mb-4">
                  <Icon className="w-7 h-7 text-foreground" />
                </div>
                
                {/* Content */}
                <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-3">
                  {highlight.title}
                </h3>
                <p className="text-muted-foreground max-w-xl leading-relaxed">
                  {highlight.description}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Dots navigation */}
        <div className="flex justify-center gap-2 mt-6">
          {HIGHLIGHTS.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                i === current 
                  ? 'w-8 bg-foreground' 
                  : 'bg-foreground/20 hover:bg-foreground/40'
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
