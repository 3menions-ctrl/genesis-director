import { motion } from 'framer-motion';
import { 
  Megaphone, GraduationCap, Youtube, Building2, 
  ShoppingBag, Gamepad2, Target, Presentation
} from 'lucide-react';
import { cn } from '@/lib/utils';

const USE_CASES = [
  {
    icon: Megaphone,
    title: 'Marketing & Ads',
    description: 'Create scroll-stopping video ads in minutes. Perfect for social media campaigns, product launches, and brand storytelling.',
    examples: ['Product demos', 'Social ads', 'Brand videos'],
    color: 'bg-rose-500/10',
    iconColor: 'text-rose-400',
    borderColor: 'hover:border-rose-500/30',
  },
  {
    icon: Presentation,
    title: 'Training Videos',
    description: 'Create professional training content with AI-powered talking heads. Upload a character, add your script, and generate engaging presentations.',
    examples: ['Corporate training', 'Onboarding', 'How-to guides'],
    color: 'bg-amber-500/10',
    iconColor: 'text-amber-400',
    borderColor: 'hover:border-amber-500/30',
    featured: true,
  },
  {
    icon: GraduationCap,
    title: 'Education',
    description: 'Transform lessons into engaging visual content. Explain complex topics with animated explainers and educational narratives.',
    examples: ['Course content', 'Explainer videos', 'Training materials'],
    color: 'bg-blue-500/10',
    iconColor: 'text-blue-400',
    borderColor: 'hover:border-blue-500/30',
  },
  {
    icon: Youtube,
    title: 'Content Creators',
    description: 'Scale your content production without a team. Create consistent, high-quality videos for YouTube, TikTok, and Instagram.',
    examples: ['YouTube videos', 'Short-form content', 'Thumbnails'],
    color: 'bg-red-500/10',
    iconColor: 'text-red-400',
    borderColor: 'hover:border-red-500/30',
  },
  {
    icon: Building2,
    title: 'Enterprise',
    description: 'Produce internal communications, investor updates, and corporate videos at scale with brand-consistent quality.',
    examples: ['Internal comms', 'Investor updates', 'Training'],
    color: 'bg-slate-500/10',
    iconColor: 'text-slate-400',
    borderColor: 'hover:border-slate-500/30',
  },
  {
    icon: ShoppingBag,
    title: 'E-commerce',
    description: 'Showcase products with dynamic video content. Create lifestyle videos and product tours that convert browsers to buyers.',
    examples: ['Product videos', 'Lifestyle content', 'Unboxing'],
    color: 'bg-emerald-500/10',
    iconColor: 'text-emerald-400',
    borderColor: 'hover:border-emerald-500/30',
  },
];

export default function UseCasesSection() {
  return (
    <section className="relative z-10 py-24 px-4 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card mb-6">
            <Target className="w-4 h-4 text-foreground" />
            <span className="text-sm font-medium text-foreground">Use Cases</span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Built for every creator
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            From solo creators to enterprise teams, Apex Studio adapts to your workflow.
          </p>
        </div>

        {/* Use Cases Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {USE_CASES.map((useCase, index) => {
            const Icon = useCase.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                viewport={{ once: true }}
                className={cn(
                  "group relative p-8 rounded-3xl border border-white/[0.08] bg-white/[0.02]",
                  "hover:-translate-y-1 transition-all duration-300",
                  useCase.borderColor
                )}
              >
                {/* Icon */}
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center mb-6",
                  useCase.color
                )}>
                  <Icon className={cn("w-7 h-7", useCase.iconColor)} />
                </div>
                
                <h3 className="text-xl font-bold text-foreground mb-3">
                  {useCase.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  {useCase.description}
                </p>
                
                {/* Examples */}
                <div className="flex flex-wrap gap-2">
                  {useCase.examples.map((example, i) => (
                    <span 
                      key={i}
                      className="px-3 py-1 rounded-full bg-white/5 text-xs font-medium text-foreground/60 border border-white/5"
                    >
                      {example}
                    </span>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
