import { useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, HelpCircle, Zap, Video, DollarSign, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const FAQS = [
  {
    question: 'How does it work?',
    answer: 'Simply describe your video idea in text. Our AI generates professional video clips based on your description. You can then edit, combine, and export your final video.',
    icon: Zap,
    gradient: 'from-blue-500 to-cyan-400',
  },
  {
    question: 'What are credits?',
    answer: 'Credits are used to generate video clips. Each clip costs approximately 10 credits. You start with 60 free credits (about 6 clips) to try the platform.',
    icon: DollarSign,
    gradient: 'from-emerald-500 to-teal-400',
  },
  {
    question: 'Can I use videos commercially?',
    answer: 'Yes. All videos you create are yours to use for any purpose, including commercial projects, social media, marketing, and more.',
    icon: Video,
    gradient: 'from-violet-500 to-purple-400',
  },
  {
    question: 'What video quality is available?',
    answer: 'We support HD (1080p) and 4K exports. Higher tier plans include access to 4K HDR exports for the best quality.',
    icon: Sparkles,
    gradient: 'from-amber-500 to-orange-400',
  },
  {
    question: 'How long are the generated clips?',
    answer: 'Each clip can be 5 or 10 seconds long. You can combine multiple clips to create longer videos using our built-in editor.',
    icon: Clock,
    gradient: 'from-pink-500 to-rose-400',
  },
];

function FAQCard({ 
  faq, 
  index, 
  isOpen, 
  onToggle 
}: { 
  faq: typeof FAQS[0]; 
  index: number; 
  isOpen: boolean;
  onToggle: () => void;
}) {
  const Icon = faq.icon;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        className={cn(
          "group relative cursor-pointer overflow-hidden rounded-2xl transition-all duration-500",
          isOpen ? "bg-white/[0.06]" : "bg-white/[0.02] hover:bg-white/[0.04]"
        )}
        onClick={onToggle}
        whileHover={{ scale: 1.01 }}
        transition={{ duration: 0.2 }}
      >
        {/* Animated border gradient */}
        <div className={cn(
          "absolute inset-0 rounded-2xl p-[1px] transition-opacity duration-500",
          isOpen ? "opacity-100" : "opacity-0 group-hover:opacity-50"
        )}>
          <div className={cn(
            "absolute inset-0 rounded-2xl bg-gradient-to-r",
            faq.gradient,
            "opacity-30 blur-sm"
          )} />
        </div>
        
        {/* Ambient glow when open */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={cn(
                "absolute -inset-4 rounded-3xl blur-3xl bg-gradient-to-r opacity-10 pointer-events-none",
                faq.gradient
              )}
            />
          )}
        </AnimatePresence>
        
        {/* Content */}
        <div className="relative p-6">
          <div className="flex items-start gap-4">
            {/* Icon container */}
            <motion.div 
              className={cn(
                "flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500",
                isOpen 
                  ? `bg-gradient-to-br ${faq.gradient} shadow-lg` 
                  : "bg-white/[0.05] group-hover:bg-white/[0.08]"
              )}
              animate={{ 
                rotate: isOpen ? 360 : 0,
                scale: isOpen ? 1.05 : 1
              }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <Icon className={cn(
                "w-5 h-5 transition-colors duration-300",
                isOpen ? "text-white" : "text-white/50 group-hover:text-white/70"
              )} />
            </motion.div>
            
            {/* Question & Answer */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-4">
                <h3 className={cn(
                  "text-lg font-semibold transition-colors duration-300",
                  isOpen ? "text-white" : "text-white/80 group-hover:text-white"
                )}>
                  {faq.question}
                </h3>
                
                {/* Toggle indicator */}
                <motion.div
                  className="flex-shrink-0 w-8 h-8 rounded-full bg-white/[0.05] flex items-center justify-center"
                  animate={{ rotate: isOpen ? 45 : 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <span className={cn(
                    "text-xl font-light transition-colors",
                    isOpen ? "text-white" : "text-white/40"
                  )}>
                    +
                  </span>
                </motion.div>
              </div>
              
              {/* Answer with smooth height animation */}
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <motion.p 
                      initial={{ y: -10 }}
                      animate={{ y: 0 }}
                      exit={{ y: -10 }}
                      className="pt-4 text-white/50 leading-relaxed"
                    >
                      {faq.answer}
                    </motion.p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  
  return (
    <section id="faq" className="relative z-10 py-32 px-6 overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Gradient orbs */}
        <div className="absolute top-1/4 -left-32 w-64 h-64 bg-blue-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 -right-32 w-64 h-64 bg-violet-500/10 rounded-full blur-[120px]" />
        
        {/* Grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />
      </div>
      
      <div className="max-w-3xl mx-auto relative">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-2 mb-6 rounded-full bg-white/[0.05] border border-white/[0.1] backdrop-blur-sm"
          >
            <HelpCircle className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-white/60 font-medium">Got Questions?</span>
          </motion.div>
          
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-4">
            Frequently Asked{' '}
            <span className="relative">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-violet-400 to-purple-400">
                Questions
              </span>
              {/* Underline accent */}
              <motion.div
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="absolute -bottom-2 left-0 right-0 h-[3px] bg-gradient-to-r from-blue-400 via-violet-400 to-purple-400 rounded-full origin-left"
              />
            </span>
          </h2>
          
          <p className="mt-6 text-lg text-white/40 max-w-xl mx-auto">
            Everything you need to know about creating stunning AI videos
          </p>
        </motion.div>

        {/* FAQ Cards */}
        <div className="space-y-3">
          {FAQS.map((faq, i) => (
            <FAQCard
              key={i}
              faq={faq}
              index={i}
              isOpen={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? null : i)}
            />
          ))}
        </div>
        
        {/* Bottom CTA hint */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
          className="mt-12 text-center"
        >
          <p className="text-sm text-white/30">
            Still have questions?{' '}
            <a 
              href="/contact" 
              className="text-blue-400 hover:text-blue-300 transition-colors underline underline-offset-4"
            >
              Contact our support team
            </a>
          </p>
        </motion.div>
      </div>
    </section>
  );
}
