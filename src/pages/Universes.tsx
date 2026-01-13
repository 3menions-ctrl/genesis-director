import { Globe, Sparkles, Rocket, Users, BookOpen, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { StudioLayout } from '@/components/layout/StudioLayout';
import { Button } from '@/components/ui/button';

export default function Universes() {
  const features = [
    {
      icon: Globe,
      title: 'Shared Worlds',
      description: 'Create persistent universes with consistent settings, physics, and aesthetics across all your videos',
    },
    {
      icon: Users,
      title: 'Character Lending',
      description: 'Share your characters with collaborators while maintaining ownership and creative control',
    },
    {
      icon: BookOpen,
      title: 'Living Lore',
      description: 'Build detailed lore documents that automatically influence story generation and maintain continuity',
    },
    {
      icon: Zap,
      title: 'Cross-Project Continuity',
      description: 'Events in one video automatically affect the timeline and state of your entire universe',
    },
  ];

  return (
    <StudioLayout>
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6">
        <div className="max-w-4xl w-full text-center space-y-12">
          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20"
            >
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">Coming Soon</span>
            </motion.div>

            {/* Icon */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="relative mx-auto w-24 h-24"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5 rounded-3xl rotate-6" />
              <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-primary/10 rounded-3xl -rotate-3" />
              <div className="relative w-full h-full bg-background border border-primary/20 rounded-3xl flex items-center justify-center shadow-lg">
                <Globe className="h-10 w-10 text-primary" />
              </div>
            </motion.div>

            {/* Title */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="space-y-4"
            >
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
                Story Universes
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Create expansive, interconnected worlds where your characters, settings, and stories 
                exist in perfect continuity across every video you produce.
              </p>
            </motion.div>
          </motion.div>

          {/* Features Grid */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="grid md:grid-cols-2 gap-6"
          >
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + index * 0.1, duration: 0.5 }}
                className="group relative p-6 rounded-2xl bg-gradient-to-br from-muted/50 to-transparent border border-border/50 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 text-left"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-foreground">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* CTA Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1, duration: 0.5 }}
            className="space-y-4 pt-4"
          >
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                className="gap-2 px-8 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
                disabled
              >
                <Rocket className="h-5 w-5" />
                Get Notified at Launch
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Be the first to know when Story Universes becomes available
            </p>
          </motion.div>

          {/* Decorative Elements */}
          <div className="absolute top-1/4 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-1/4 right-10 w-96 h-96 bg-primary/3 rounded-full blur-3xl pointer-events-none" />
        </div>
      </div>
    </StudioLayout>
  );
}
