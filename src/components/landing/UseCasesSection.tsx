import { motion } from 'framer-motion';
import { 
  Megaphone, GraduationCap, Youtube, Building2, 
  ShoppingBag, Presentation, Users, ArrowUpRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

const USE_CASES = [
  {
    icon: Megaphone,
    title: 'Marketing',
    description: 'Video ads & campaigns that convert',
    size: 'large',
  },
  {
    icon: Youtube,
    title: 'Creators',
    description: 'Scale your content production',
    size: 'medium',
  },
  {
    icon: Presentation,
    title: 'Training',
    description: 'Professional learning materials',
    size: 'small',
  },
  {
    icon: GraduationCap,
    title: 'Education',
    description: 'Engaging visual lessons',
    size: 'small',
  },
  {
    icon: Building2,
    title: 'Enterprise',
    description: 'Corporate communications',
    size: 'medium',
  },
  {
    icon: ShoppingBag,
    title: 'E-commerce',
    description: 'Product showcases',
    size: 'small',
  },
];

export default function UseCasesSection() {
  return (
    <section className="relative z-10 py-20 lg:py-28 px-4 lg:px-8 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-foreground/[0.02] rounded-full blur-[80px]" />
      </div>

      <div className="max-w-7xl mx-auto relative">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-foreground/5 border border-foreground/10 mb-6">
            <Users className="w-4 h-4 text-foreground" />
            <span className="text-sm font-medium text-foreground">Use Cases</span>
          </div>
          <h2 className="text-3xl lg:text-5xl font-bold text-foreground mb-3">
            Built for every creator
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            From solo creators to enterprise teams
          </p>
        </motion.div>

        {/* Bento Grid */}
        <div className="grid grid-cols-12 gap-4">
          {/* Marketing - Large Card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="col-span-12 md:col-span-6 lg:col-span-5 row-span-2 group relative p-6 lg:p-8 rounded-3xl bg-glossy-black border border-white/10 shadow-obsidian overflow-hidden hover:-translate-y-1 transition-all cursor-pointer"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.06] via-transparent to-transparent" />
            <div className="relative h-full flex flex-col justify-between min-h-[280px]">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Megaphone className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-2xl lg:text-3xl font-bold text-white mb-2">Marketing</h3>
                <p className="text-white/50 text-lg">Create video ads and campaigns that convert at scale.</p>
              </div>
              <div className="flex items-center gap-2 text-white/40 group-hover:text-white/60 transition-colors">
                <span className="text-sm font-medium">Learn more</span>
                <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </div>
            </div>
          </motion.div>

          {/* Creators - Medium Transparent */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="col-span-6 md:col-span-6 lg:col-span-4 group relative p-5 lg:p-6 rounded-2xl bg-white/50 backdrop-blur-sm border border-white/60 overflow-hidden hover:bg-white/60 hover:-translate-y-1 transition-all cursor-pointer"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-foreground text-background flex items-center justify-center shrink-0 shadow-lg group-hover:scale-110 transition-transform">
                <Youtube className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground mb-1">Creators</h3>
                <p className="text-sm text-muted-foreground">Scale your content production</p>
              </div>
            </div>
          </motion.div>

          {/* Training - Compact */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="col-span-6 md:col-span-6 lg:col-span-3 group relative p-5 rounded-2xl bg-foreground text-background overflow-hidden hover:-translate-y-1 transition-all cursor-pointer shadow-obsidian"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] to-transparent" />
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Presentation className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold mb-1">Training</h3>
              <p className="text-xs text-white/50">Professional learning</p>
            </div>
          </motion.div>

          {/* Education - Small Transparent */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="col-span-6 md:col-span-4 lg:col-span-3 group relative p-5 rounded-2xl bg-white/30 backdrop-blur-md border border-white/50 overflow-hidden hover:bg-white/40 hover:-translate-y-1 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-foreground/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <GraduationCap className="w-5 h-5 text-foreground" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Education</h3>
                <p className="text-xs text-muted-foreground">Visual lessons</p>
              </div>
            </div>
          </motion.div>

          {/* Enterprise - Medium */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="col-span-6 md:col-span-4 lg:col-span-4 group relative p-5 lg:p-6 rounded-2xl bg-gradient-to-br from-muted/80 to-muted/40 backdrop-blur-sm border border-foreground/5 overflow-hidden hover:border-foreground/10 hover:-translate-y-1 transition-all cursor-pointer"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-foreground text-background flex items-center justify-center shrink-0 shadow-lg group-hover:scale-110 transition-transform">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground mb-1">Enterprise</h3>
                <p className="text-sm text-muted-foreground">Corporate communications at scale</p>
              </div>
            </div>
          </motion.div>

          {/* E-commerce - Small */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="col-span-6 md:col-span-4 lg:col-span-2 group relative p-4 rounded-2xl bg-white/50 backdrop-blur-sm border border-white/60 overflow-hidden hover:bg-white/60 hover:-translate-y-1 transition-all cursor-pointer"
          >
            <div className="text-center">
              <div className="w-10 h-10 rounded-xl bg-foreground text-background flex items-center justify-center mx-auto mb-2 shadow-lg group-hover:scale-110 transition-transform">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-foreground">E-commerce</h3>
              <p className="text-xs text-muted-foreground">Products</p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
