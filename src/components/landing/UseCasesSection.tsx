import { motion } from 'framer-motion';
import { 
  Megaphone, GraduationCap, Youtube, Building2, 
  ShoppingBag, Presentation, ArrowRight
} from 'lucide-react';

const USE_CASES = [
  {
    icon: Megaphone,
    title: 'Marketing',
    description: 'Video ads & campaigns that convert',
    gradient: 'from-orange-500/20 to-amber-500/10',
    iconBg: 'bg-orange-500/20',
    iconColor: 'text-orange-400',
  },
  {
    icon: Youtube,
    title: 'Creators',
    description: 'Scale your content production',
    gradient: 'from-red-500/20 to-pink-500/10',
    iconBg: 'bg-red-500/20',
    iconColor: 'text-red-400',
  },
  {
    icon: Presentation,
    title: 'Training',
    description: 'Professional learning materials',
    gradient: 'from-blue-500/20 to-cyan-500/10',
    iconBg: 'bg-blue-500/20',
    iconColor: 'text-blue-400',
  },
  {
    icon: GraduationCap,
    title: 'Education',
    description: 'Engaging visual lessons',
    gradient: 'from-emerald-500/20 to-teal-500/10',
    iconBg: 'bg-emerald-500/20',
    iconColor: 'text-emerald-400',
  },
  {
    icon: Building2,
    title: 'Enterprise',
    description: 'Corporate communications at scale',
    gradient: 'from-violet-500/20 to-purple-500/10',
    iconBg: 'bg-violet-500/20',
    iconColor: 'text-violet-400',
  },
  {
    icon: ShoppingBag,
    title: 'E-commerce',
    description: 'Product showcases that sell',
    gradient: 'from-pink-500/20 to-rose-500/10',
    iconBg: 'bg-pink-500/20',
    iconColor: 'text-pink-400',
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 100,
      damping: 15,
    },
  },
};

export default function UseCasesSection() {
  return (
    <section className="relative z-10 py-24 lg:py-32 px-4 lg:px-8 overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-gradient-radial from-white/[0.02] via-transparent to-transparent rounded-full blur-3xl" />
      </div>

      <div className="max-w-6xl mx-auto relative">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-block text-xs font-medium tracking-[0.2em] uppercase text-muted-foreground mb-4">
            Use Cases
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4 tracking-tight">
            Built for every creator
          </h2>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            From solo creators to enterprise teams
          </p>
        </motion.div>

        {/* Bento Grid */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4"
        >
          {USE_CASES.map((useCase, index) => {
            const Icon = useCase.icon;
            const isLarge = index === 0;
            
            return (
              <motion.div
                key={useCase.title}
                variants={itemVariants}
                className={`
                  group relative overflow-hidden rounded-2xl lg:rounded-3xl
                  ${isLarge ? 'col-span-2 lg:col-span-1 lg:row-span-2' : ''}
                  ${index === 4 ? 'col-span-2 lg:col-span-1' : ''}
                `}
              >
                {/* Card background */}
                <div className={`
                  absolute inset-0 bg-gradient-to-br ${useCase.gradient}
                  opacity-0 group-hover:opacity-100 transition-opacity duration-500
                `} />
                
                {/* Glass card */}
                <div className={`
                  relative h-full
                  bg-white/[0.03] backdrop-blur-sm
                  border border-white/[0.06]
                  group-hover:border-white/[0.12]
                  group-hover:bg-white/[0.05]
                  transition-all duration-500
                  ${isLarge ? 'p-6 sm:p-8 min-h-[200px] lg:min-h-[320px]' : 'p-5 sm:p-6'}
                `}>
                  {/* Content */}
                  <div className={`
                    flex flex-col h-full
                    ${isLarge ? 'justify-between' : 'gap-3'}
                  `}>
                    {/* Icon */}
                    <div className={`
                      ${useCase.iconBg} rounded-xl
                      flex items-center justify-center
                      transition-transform duration-500 group-hover:scale-110
                      ${isLarge ? 'w-14 h-14' : 'w-11 h-11'}
                    `}>
                      <Icon className={`${useCase.iconColor} ${isLarge ? 'w-7 h-7' : 'w-5 h-5'}`} />
                    </div>
                    
                    {/* Text */}
                    <div className={isLarge ? '' : ''}>
                      <h3 className={`
                        font-semibold text-foreground mb-1
                        ${isLarge ? 'text-xl sm:text-2xl' : 'text-base sm:text-lg'}
                      `}>
                        {useCase.title}
                      </h3>
                      <p className={`
                        text-muted-foreground leading-relaxed
                        ${isLarge ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'}
                      `}>
                        {useCase.description}
                      </p>
                    </div>
                    
                    {/* Hover arrow indicator */}
                    {isLarge && (
                      <div className="flex items-center gap-2 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors duration-300">
                        <span className="text-sm font-medium">Learn more</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                      </div>
                    )}
                  </div>
                  
                  {/* Subtle shine effect on hover */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none">
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.02] to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
