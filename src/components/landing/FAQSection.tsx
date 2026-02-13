import { forwardRef, memo } from 'react';
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
    answer: 'Describe your video concept in text. Our AI generates video clips based on your description. You can regenerate clips until satisfied, then export your final video. Note: AI results vary and regeneration is normal—budget extra credits accordingly.',
  },
  {
    question: 'What are credits and how much do they cost?',
    answer: 'Credits power video generation. 1 credit = $0.10. Short clips (≤6 seconds) cost 10 credits ($1); longer clips (>6 seconds) cost 15 credits ($1.50). New users get 60 free credits. Purchase packs start at $9 for 90 credits.',
  },
  {
    question: 'Can I get a refund on credits?',
    answer: 'No. ALL credit purchases are final and non-refundable. This includes unused credits, dissatisfaction with AI results, or account closure. Please use your 60 free credits to thoroughly test the platform before purchasing.',
  },
  {
    question: 'What are the AI limitations I should know about?',
    answer: 'AI video generation has inherent limitations: visual artifacts, character inconsistencies between scenes, unrealistic physics, and unexpected interpretations of prompts. Regenerating clips multiple times is normal and expected—not a bug. We cannot guarantee specific results.',
  },
  {
    question: 'Can I use videos commercially?',
    answer: 'Yes. Videos you create are yours for any legal purpose, including commercial projects. However, you are responsible for reviewing content for accuracy and ensuring it meets legal requirements before publishing.',
  },
  {
    question: 'Do credits expire?',
    answer: 'No. Purchased credits never expire and remain in your account indefinitely while your account is active.',
  },
];

const FAQSection = memo(forwardRef<HTMLElement, Record<string, never>>(
  function FAQSection(_, ref) {
    return (
      <section ref={ref} className="relative z-10 py-32 px-6">
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
));

export default FAQSection;
