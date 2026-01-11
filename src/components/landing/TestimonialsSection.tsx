import { motion } from 'framer-motion';
import { Star, Quote, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

const TESTIMONIALS = [
  {
    quote: "Apex Studio has completely transformed how we create marketing content. What used to take our team a week now takes an afternoon.",
    author: "Sarah Chen",
    role: "Marketing Director",
    company: "TechVentures Inc.",
    avatar: "SC",
    rating: 5,
    color: 'from-blue-500/20 to-cyan-500/20',
  },
  {
    quote: "The AI script generation is mind-blowing. It understands exactly what kind of story I want to tell and creates perfect shot breakdowns.",
    author: "Marcus Williams",
    role: "YouTube Creator",
    company: "2.4M Subscribers",
    avatar: "MW",
    rating: 5,
    color: 'from-red-500/20 to-orange-500/20',
  },
  {
    quote: "As a one-person agency, this is like having an entire production team. The quality rivals what I used to pay $10k+ for.",
    author: "Elena Rodriguez",
    role: "Creative Director",
    company: "Freelance",
    avatar: "ER",
    rating: 5,
    color: 'from-purple-500/20 to-pink-500/20',
  },
  {
    quote: "We use Apex for all our product videos now. The consistency across clips and the speed of production is unmatched.",
    author: "James Park",
    role: "Head of Content",
    company: "ShopifyPlus Brand",
    avatar: "JP",
    rating: 5,
    color: 'from-emerald-500/20 to-teal-500/20',
  },
  {
    quote: "The character lock feature is a game-changer. My animated host looks the same across 50+ educational videos.",
    author: "Dr. Amanda Foster",
    role: "Online Educator",
    company: "EduTech Academy",
    avatar: "AF",
    rating: 5,
    color: 'from-amber-500/20 to-yellow-500/20',
  },
  {
    quote: "Finally, an AI video tool that actually delivers cinematic quality. Our documentary series looks like it had a real budget.",
    author: "David Okonkwo",
    role: "Documentary Filmmaker",
    company: "Independent",
    avatar: "DO",
    rating: 5,
    color: 'from-slate-500/20 to-zinc-500/20',
  },
];

export default function TestimonialsSection() {
  return (
    <section className="relative z-10 py-24 px-4 lg:px-8 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card mb-6">
            <MessageSquare className="w-4 h-4 text-foreground" />
            <span className="text-sm font-medium text-foreground">Testimonials</span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Loved by creators worldwide
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            See what our community of 23,000+ creators has to say about Apex Studio.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {TESTIMONIALS.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              viewport={{ once: true }}
              className={cn(
                "group relative p-8 rounded-3xl border border-white/[0.08] bg-gradient-to-b",
                testimonial.color,
                "hover:border-white/20 hover:-translate-y-1 transition-all duration-300"
              )}
            >
              {/* Quote icon */}
              <Quote className="absolute top-6 right-6 w-8 h-8 text-foreground/5" />
              
              {/* Stars */}
              <div className="flex items-center gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                ))}
              </div>
              
              {/* Quote */}
              <p className="text-foreground/80 leading-relaxed mb-6 text-[15px]">
                "{testimonial.quote}"
              </p>
              
              {/* Author */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-foreground/10 flex items-center justify-center text-sm font-bold text-foreground/60 border border-white/10">
                  {testimonial.avatar}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{testimonial.author}</p>
                  <p className="text-sm text-muted-foreground">
                    {testimonial.role} • {testimonial.company}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
