import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, ChevronDown, Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

const FAQS = [
  {
    question: "What is Apex Studio?",
    answer: "Apex Studio is an AI-powered video creation platform that transforms text descriptions or images into cinematic video content. Our AI handles script writing, scene generation, voice synthesis, and video production—all from a simple prompt."
  },
  {
    question: "How do credits work?",
    answer: "Credits are our usage currency. Each video clip (~5 seconds) costs 10 credits. Video lengths vary by tier: Free users get ~30 second videos (6 clips = 60 credits), Pro gets ~50 second videos (10 clips = 100 credits), Growth gets ~100 second videos (20 clips = 200 credits), and Agency gets ~150 second videos (30 clips = 300 credits). Voice narration and automatic retries are included at no extra cost."
  },
  {
    question: "What video quality can I expect?",
    answer: "Our AI generates high-quality video at up to 4K resolution with HDR support on Growth and Agency plans. The output quality rivals professional video production, with consistent characters, smooth camera movements, and cinematic lighting."
  },
  {
    question: "Can I use the videos commercially?",
    answer: "Yes! All videos generated on Apex Studio are yours to use commercially. This includes marketing content, YouTube videos, client work, and any other commercial purpose. No additional licensing required."
  },
  {
    question: "How long does video generation take?",
    answer: "A 5-second video clip typically generates in about 30 seconds. Full video projects with multiple clips, voice, and music usually complete in 3-5 minutes depending on length and complexity."
  },
  {
    question: "What is Character Lock?",
    answer: "Character Lock is our proprietary technology that maintains visual consistency for characters across multiple scenes and videos. Once you create a character, they'll look the same in every clip—essential for storytelling and brand mascots."
  },
  {
    question: "Can I edit or adjust generated videos?",
    answer: "Yes! You can regenerate individual clips with modified prompts, adjust scene timing, swap out voice tracks, and fine-tune your project before final export. Our script editor lets you tweak every detail."
  },
  {
    question: "Is there a free trial?",
    answer: "Yes! Every new account starts with 60 free credits — enough for 6 video clips or a complete 30-second video. No credit card required to start. This lets you try the platform before committing to a paid plan."
  },
  {
    question: "What file formats are supported?",
    answer: "We export videos in MP4 (H.264 and H.265), WebM, and MOV formats. For images, we support PNG, JPG, and WebP. Audio exports are available in MP3 and WAV formats."
  },
  {
    question: "Do you offer API access?",
    answer: "Yes, API access is available on our Agency plan. This allows you to integrate Apex Studio's video generation capabilities directly into your own applications and workflows. Contact our sales team for documentation and custom integrations."
  },
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="relative z-10 py-24 px-4 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card mb-6">
            <HelpCircle className="w-4 h-4 text-foreground" />
            <span className="text-sm font-medium text-foreground">FAQ</span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Frequently asked questions
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Everything you need to know about Apex Studio and how it works.
          </p>
        </div>

        {/* FAQ Items */}
        <div className="space-y-4">
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
                    ? "border-white/20 bg-white/[0.04]" 
                    : "border-white/[0.08] bg-white/[0.02] hover:border-white/15"
                )}
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="w-full flex items-center justify-between p-6 text-left"
                >
                  <span className={cn(
                    "font-semibold text-lg transition-colors",
                    isOpen ? "text-foreground" : "text-foreground/80"
                  )}>
                    {faq.question}
                  </span>
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0 ml-4 transition-colors",
                    isOpen ? "bg-foreground/10" : "bg-white/5"
                  )}>
                    {isOpen ? (
                      <Minus className="w-4 h-4 text-foreground" />
                    ) : (
                      <Plus className="w-4 h-4 text-foreground/60" />
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
                      <div className="px-6 pb-6 pt-0">
                        <p className="text-muted-foreground leading-relaxed">
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
        <div className="mt-12 text-center p-8 rounded-2xl border border-white/[0.08] bg-white/[0.02]">
          <p className="text-foreground/80 mb-2">Still have questions?</p>
          <a 
            href="/contact" 
            className="text-foreground font-semibold hover:underline underline-offset-4"
          >
            Contact our support team →
          </a>
        </div>
      </div>
    </section>
  );
}
