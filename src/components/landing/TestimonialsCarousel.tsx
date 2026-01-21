import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Quote, Star } from 'lucide-react';

const TESTIMONIALS = [
  {
    quote: "Apex Studio transformed my marketing. I created a product video in 10 minutes that would've cost $5,000.",
    author: "Sarah Chen",
    role: "E-commerce Founder",
    rating: 5,
    avatar: "SC"
  },
  {
    quote: "The AI script writer is incredible. It understands exactly what I'm trying to communicate.",
    author: "Marcus Rodriguez",
    role: "Content Creator",
    rating: 5,
    avatar: "MR"
  },
  {
    quote: "I've tried every AI video tool. Apex Studio is the only one that delivers professional quality consistently.",
    author: "Jennifer Park",
    role: "Marketing Director",
    rating: 5,
    avatar: "JP"
  },
  {
    quote: "Character lock changed everything. Finally, consistent characters across my entire video series.",
    author: "David Thompson",
    role: "Course Creator",
    rating: 5,
    avatar: "DT"
  },
];

interface TestimonialsCarouselProps {
  className?: string;
}

export default function TestimonialsCarousel({ className = '' }: TestimonialsCarouselProps) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % TESTIMONIALS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const testimonial = TESTIMONIALS[current];

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
            <span className="text-sm font-medium text-foreground">Loved by Creators</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
            See what creators are saying
          </h2>
        </motion.div>

        {/* Testimonial card */}
        <div className="relative h-[280px] sm:h-[240px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0"
            >
              <div className="glass-card p-8 sm:p-10 h-full flex flex-col justify-between">
                {/* Quote */}
                <div>
                  <div className="flex gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-lg sm:text-xl text-foreground leading-relaxed">
                    "{testimonial.quote}"
                  </p>
                </div>

                {/* Author */}
                <div className="flex items-center gap-4 mt-6">
                  <div className="w-12 h-12 rounded-full bg-foreground text-background flex items-center justify-center font-bold">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{testimonial.author}</p>
                    <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Dots navigation */}
        <div className="flex justify-center gap-2 mt-6">
          {TESTIMONIALS.map((_, i) => (
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
