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
    answer: 'Describe your scene in plain language. Small Bridges generates cinematic clips with native audio, lip-sync and character continuity, then lets you regenerate, edit and export the final film. AI output varies between runs — regenerating clips is part of the creative process, so plan a small credit buffer for iteration.',
  },
  {
    question: 'What are credits and how much do they cost?',
    answer: 'Credits power everything on Small Bridges — video generation, photo editing, avatars, voice and exports. Each credit is $0.10 USD, billed in pay-as-you-go packs. There are no subscriptions, no seats and no monthly minimums. Purchased credits never expire while your account remains active.',
  },
  {
    question: 'Can I get a refund on credits?',
    answer: 'No. All credit purchases are final and non-refundable — including unused credits, dissatisfaction with AI output, account closure or deactivation. If a generation fails for a technical reason on our side, the credits used for that specific job are automatically refunded to your balance. We recommend starting with the smallest credit pack to evaluate the platform before larger purchases.',
  },
  {
    question: 'What are the AI limitations I should know about?',
    answer: 'Generative AI has real limitations. Expect occasional visual artifacts, minor character drift between scenes, imperfect physics, hands or text rendering, and prompts that are interpreted differently than you imagined. Regenerating a clip several times to land the right take is normal — not a defect. We do not guarantee any specific creative result, likeness match, brand fidelity or factual accuracy.',
  },
  {
    question: 'Can I use videos commercially?',
    answer: 'Yes. You own the videos you generate and may use them for any lawful purpose, including paid advertising and commercial projects, subject to our Terms of Service. You are solely responsible for reviewing every output before publishing — including accuracy, rights clearance for any uploaded reference material, likeness/voice consent, disclosure of AI-generated content where required by law, and compliance with the platforms you distribute on.',
  },
  {
    question: 'What content is not allowed?',
    answer: 'Small Bridges prohibits non-consensual intimate imagery, sexual content involving minors, deceptive deepfakes of real people without consent, content that incites violence or hatred, election or medical disinformation, and any use that violates applicable law. We use multi-layer moderation; violating accounts can be suspended without refund.',
  },
  {
    question: 'How is my data handled?',
    answer: 'Your projects, prompts and generated assets are stored in your private workspace and protected by row-level security. We do not train foundation models on your private content. Account deletion permanently purges your projects and uploads; anonymized billing records are retained as required by tax and accounting law. Full details are in our Privacy Policy.',
  },
  {
    question: 'Do credits expire?',
    answer: 'No. Purchased credits never expire and remain in your account indefinitely while your account is active and in good standing.',
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
                  className="border-0 bg-glass rounded-2xl px-6 data-[state=open]:bg-glass-hover"
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
