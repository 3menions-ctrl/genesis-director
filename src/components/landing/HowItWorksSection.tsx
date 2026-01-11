import { motion } from 'framer-motion';
import { FileText, Wand2, Film, Download, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = [
  {
    number: '01',
    icon: FileText,
    title: 'Describe Your Vision',
    description: 'Enter a text prompt or upload a reference image. Our AI understands cinematic language, story arcs, and visual styles.',
    color: 'from-blue-500/20 to-cyan-500/20',
    iconBg: 'bg-blue-500/20',
    iconColor: 'text-blue-400',
  },
  {
    number: '02',
    icon: Wand2,
    title: 'AI Generates Script',
    description: 'Our smart script engine breaks your idea into scenes, shots, and camera movements—complete with narration and timing.',
    color: 'from-purple-500/20 to-pink-500/20',
    iconBg: 'bg-purple-500/20',
    iconColor: 'text-purple-400',
  },
  {
    number: '03',
    icon: Film,
    title: 'Videos Come to Life',
    description: 'State-of-the-art AI models generate each scene with cinematic quality. Character consistency, smooth transitions, all handled.',
    color: 'from-amber-500/20 to-orange-500/20',
    iconBg: 'bg-amber-500/20',
    iconColor: 'text-amber-400',
  },
  {
    number: '04',
    icon: Download,
    title: 'Export & Share',
    description: 'Download your finished video in up to 4K HDR. Add to your content, share on social, or use for commercial projects.',
    color: 'from-emerald-500/20 to-teal-500/20',
    iconBg: 'bg-emerald-500/20',
    iconColor: 'text-emerald-400',
  },
];

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative z-10 py-24 px-4 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card mb-6">
            <Wand2 className="w-4 h-4 text-foreground" />
            <span className="text-sm font-medium text-foreground">Simple Process</span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground mb-4">
            How it works
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            From idea to cinematic video in four simple steps. No video editing skills required.
          </p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Connecting line - desktop only */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-foreground/10 to-transparent -translate-y-1/2" />
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="relative"
                >
                  <div className={cn(
                    "relative p-8 rounded-3xl bg-gradient-to-b border border-white/[0.08] h-full",
                    step.color,
                    "hover:border-white/20 transition-all duration-300 hover:-translate-y-1"
                  )}>
                    {/* Step number */}
                    <span className="absolute top-4 right-4 text-5xl font-bold text-foreground/5">
                      {step.number}
                    </span>
                    
                    {/* Icon */}
                    <div className={cn(
                      "w-14 h-14 rounded-2xl flex items-center justify-center mb-6",
                      step.iconBg
                    )}>
                      <Icon className={cn("w-7 h-7", step.iconColor)} />
                    </div>
                    
                    <h3 className="text-xl font-bold text-foreground mb-3">
                      {step.title}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                  
                  {/* Arrow connector - desktop only */}
                  {index < STEPS.length - 1 && (
                    <div className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-background border border-white/10 items-center justify-center">
                      <ArrowRight className="w-3 h-3 text-foreground/40" />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
