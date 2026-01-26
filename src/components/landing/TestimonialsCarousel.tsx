import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Video, Sparkles, Zap } from 'lucide-react';

const HIGHLIGHTS = [
  {
    title: "Text-to-Video in Minutes",
    description: "Describe your vision in plain text. Our AI generates professional video clips with cinematic quality.",
    icon: Video,
  },
  {
    title: "No Video Editing Skills Required",
    description: "Skip the learning curve. Apex Studio handles script writing, scene generation, and production automatically.",
    icon: Sparkles,
  },
  {
    title: "60 Free Credits to Start",
    description: "Create your first 6 video clips completely free. No credit card required.",
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
    <section className={`relative z-10 py-20 lg:py-28 px-4 lg:px-8 ${className}`}>
      <div className="max-w-3xl mx-auto">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Why Apex Studio
          </h2>
        </motion.div>

        {/* Highlight card */}
        <div className="relative h-[200px] sm:h-[180px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0"
            >
              <div className="rounded-2xl bg-white/[0.02] border border-white/[0.08] p-8 h-full flex flex-col justify-center items-center text-center">
                {/* Icon */}
                <div className="w-12 h-12 rounded-xl bg-white/[0.05] flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-white/70" />
                </div>
                
                {/* Content */}
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
                  {highlight.title}
                </h3>
                <p className="text-white/50 max-w-lg leading-relaxed">
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
                  ? 'w-8 bg-white' 
                  : 'bg-white/20 hover:bg-white/40'
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
