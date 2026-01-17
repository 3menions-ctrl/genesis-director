import { motion } from 'framer-motion';
import { 
  Megaphone, GraduationCap, Youtube, Building2, 
  ShoppingBag, Presentation, Users
} from 'lucide-react';
import { cn } from '@/lib/utils';

const USE_CASES = [
  {
    icon: Megaphone,
    title: 'Marketing',
    description: 'Video ads & campaigns',
    gradient: 'from-rose-500 to-pink-600',
  },
  {
    icon: Presentation,
    title: 'Training',
    description: 'Professional learning',
    gradient: 'from-amber-500 to-orange-600',
  },
  {
    icon: GraduationCap,
    title: 'Education',
    description: 'Engaging lessons',
    gradient: 'from-blue-500 to-cyan-600',
  },
  {
    icon: Youtube,
    title: 'Creators',
    description: 'Scale your content',
    gradient: 'from-red-500 to-rose-600',
  },
  {
    icon: Building2,
    title: 'Enterprise',
    description: 'Corporate comms',
    gradient: 'from-slate-500 to-zinc-600',
  },
  {
    icon: ShoppingBag,
    title: 'E-commerce',
    description: 'Product showcases',
    gradient: 'from-emerald-500 to-teal-600',
  },
];

export default function UseCasesSection() {
  return (
    <section className="relative z-10 py-20 lg:py-24 px-4 lg:px-8 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/5 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-7xl mx-auto relative">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 border border-border mb-6">
            <Users className="w-4 h-4 text-foreground" />
            <span className="text-sm font-medium text-foreground">For Everyone</span>
          </div>
          <h2 className="text-3xl lg:text-5xl font-bold text-foreground mb-3">
            Built for every creator
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            From solo creators to enterprise teams
          </p>
        </motion.div>

        {/* Horizontal scrolling cards on mobile, grid on desktop */}
        <div className="relative">
          {/* Cards container */}
          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide lg:grid lg:grid-cols-6 lg:overflow-visible lg:pb-0"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {USE_CASES.map((useCase, index) => {
              const Icon = useCase.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ y: -8, scale: 1.02 }}
                  className="group relative flex-shrink-0 w-[160px] lg:w-auto snap-center"
                >
                  <div className="relative p-6 rounded-2xl bg-background border border-border hover:border-primary/30 transition-all duration-300 h-full overflow-hidden">
                    {/* Gradient overlay on hover */}
                    <div className={cn(
                      "absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300 bg-gradient-to-br",
                      useCase.gradient
                    )} />
                    
                    {/* Icon with gradient background */}
                    <div className={cn(
                      "relative w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br shadow-lg",
                      useCase.gradient
                    )}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    
                    <h3 className="text-base font-semibold text-foreground mb-1">
                      {useCase.title}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {useCase.description}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Fade edges on mobile */}
          <div className="absolute left-0 top-0 bottom-4 w-8 bg-gradient-to-r from-background to-transparent pointer-events-none lg:hidden" />
          <div className="absolute right-0 top-0 bottom-4 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none lg:hidden" />
        </div>
      </div>
    </section>
  );
}
