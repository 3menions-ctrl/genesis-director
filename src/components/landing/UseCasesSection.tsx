import { motion } from 'framer-motion';
import { 
  Megaphone, GraduationCap, Youtube, Building2, 
  ShoppingBag, Presentation, Users
} from 'lucide-react';

const USE_CASES = [
  {
    icon: Megaphone,
    title: 'Marketing',
    description: 'Video ads & campaigns',
  },
  {
    icon: Presentation,
    title: 'Training',
    description: 'Professional learning',
  },
  {
    icon: GraduationCap,
    title: 'Education',
    description: 'Engaging lessons',
  },
  {
    icon: Youtube,
    title: 'Creators',
    description: 'Scale your content',
  },
  {
    icon: Building2,
    title: 'Enterprise',
    description: 'Corporate comms',
  },
  {
    icon: ShoppingBag,
    title: 'E-commerce',
    description: 'Product showcases',
  },
];

export default function UseCasesSection() {
  return (
    <section className="relative z-10 py-20 lg:py-24 px-4 lg:px-8 overflow-hidden">
      {/* Subtle background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-foreground/[0.02] rounded-full blur-[80px]" />
      </div>

      <div className="max-w-7xl mx-auto relative">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card mb-6">
            <Users className="w-4 h-4 text-foreground" />
            <span className="text-sm font-medium text-foreground">For Everyone</span>
          </div>
          <h2 className="text-3xl lg:text-5xl font-bold text-foreground mb-3">
            Built for every creator
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            From solo creators to enterprise teams
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {USE_CASES.map((useCase, index) => {
            const Icon = useCase.icon;
            return (
              <div
                key={index}
                className="group p-5 rounded-2xl glass-card hover:bg-muted/30 transition-all duration-300 cursor-pointer"
              >
                {/* Black and white icon */}
                <div className="w-11 h-11 rounded-xl bg-foreground text-background flex items-center justify-center mb-4 shadow-lg group-hover:scale-105 transition-transform">
                  <Icon className="w-5 h-5" />
                </div>
                
                <h3 className="text-sm font-semibold text-foreground mb-1">
                  {useCase.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {useCase.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
