import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { motion } from 'framer-motion';

const FAQS = [
  {
    question: 'How does it work?',
    answer: 'Simply describe your video idea in text. Our AI generates professional video clips based on your description. You can then edit, combine, and export your final video.',
  },
  {
    question: 'What are credits?',
    answer: 'Credits are used to generate video clips. Each clip costs approximately 10 credits. You start with 60 free credits (about 6 clips) to try the platform.',
  },
  {
    question: 'Can I use videos commercially?',
    answer: 'Yes. All videos you create are yours to use for any purpose, including commercial projects, social media, marketing, and more.',
  },
  {
    question: 'What video quality is available?',
    answer: 'We support HD (1080p) and 4K exports. Higher tier plans include access to 4K HDR exports for the best quality.',
  },
  {
    question: 'How long are the generated clips?',
    answer: 'Each clip can be 5 or 10 seconds long. You can combine multiple clips to create longer videos using our built-in editor.',
  },
];

export default function FAQSection() {
  return (
    <section id="faq" className="relative z-10 py-32 px-6">
      <div className="max-w-2xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-white mb-4">
            FAQ
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <Accordion type="single" collapsible className="space-y-2">
            {FAQS.map((faq, i) => (
              <AccordionItem 
                key={i} 
                value={`item-${i}`}
                className="border-0 bg-white/[0.02] rounded-2xl px-6 data-[state=open]:bg-white/[0.04]"
              >
                <AccordionTrigger className="py-5 text-left text-white hover:no-underline text-base font-medium">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-white/50 pb-5 leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
}
