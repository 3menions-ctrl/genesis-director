import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

const FAQS = [
  {
    question: "What is Apex Studio?",
    answer: "Apex Studio is an AI-powered video creation platform that transforms text descriptions or images into cinematic video content. Our AI handles script writing, scene generation, voice synthesis, and video production—all from a simple prompt."
  },
  {
    question: "How do credits work?",
    answer: "Credits are our usage currency. Each video clip costs 10 credits regardless of length. New users get 60 free credits (6 clips) to start. Voice narration and automatic retries are included at no extra cost."
  },
  {
    question: "What video quality can I expect?",
    answer: "Our AI generates high-quality video at up to 4K resolution with HDR support on Growth and Agency plans. The output quality rivals professional video production, with consistent characters and cinematic lighting."
  },
  {
    question: "Can I use the videos commercially?",
    answer: "Yes! All videos generated on Apex Studio are yours to use commercially. This includes marketing content, YouTube videos, client work, and any other commercial purpose."
  },
  {
    question: "How long does video generation take?",
    answer: "Each video clip typically renders in 2-4 minutes. Full video projects with multiple clips, voice, and music usually complete in 10-20 minutes depending on length and complexity."
  },
  {
    question: "Is there a free trial?",
    answer: "Yes! Every new account starts with 60 free credits — enough for 6 video clips. No credit card required to start."
  },
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="relative z-10 py-24 lg:py-32 px-4 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.05] border border-white/[0.1] mb-6">
            <HelpCircle className="w-4 h-4 text-white/70" />
            <span className="text-sm font-medium text-white/70">FAQ</span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-4">
            Common questions
          </h2>
          <p className="text-lg text-white/50 max-w-2xl mx-auto">
            Everything you need to know about Apex Studio
          </p>
        </motion.div>

        {/* FAQ Items */}
        <div className="space-y-3">
          {FAQS.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                viewport={{ once: true }}
                className={cn(
                  "rounded-2xl border transition-all duration-300",
                  isOpen 
                    ? "border-white/[0.15] bg-white/[0.04]" 
                    : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1]"
                )}
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="w-full flex items-center justify-between p-5 text-left"
                >
                  <span className={cn(
                    "font-medium text-base transition-colors",
                    isOpen ? "text-white" : "text-white/80"
                  )}>
                    {faq.question}
                  </span>
                  <div className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center shrink-0 ml-4 transition-colors",
                    isOpen ? "bg-white/10" : "bg-white/[0.05]"
                  )}>
                    {isOpen ? (
                      <Minus className="w-4 h-4 text-white" />
                    ) : (
                      <Plus className="w-4 h-4 text-white/60" />
                    )}
                  </div>
                </button>
                
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 pt-0">
                        <p className="text-white/50 leading-relaxed">
                          {faq.answer}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* Contact CTA */}
        <div className="mt-10 text-center p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
          <p className="text-white/60 mb-2">Still have questions?</p>
          <a 
            href="/contact" 
            className="text-white font-medium hover:underline underline-offset-4"
          >
            Contact our support team →
          </a>
        </div>
      </div>
    </section>
  );
}
