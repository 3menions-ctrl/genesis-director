import { Globe, Sparkles, Rocket, Users, BookOpen, Zap, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import universeBackground from '@/assets/universe-background.jpg';

export default function Universes() {
  const navigate = useNavigate();
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
    <div className="min-h-screen relative overflow-hidden">
      {/* Universe Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${universeBackground})` }}
      />
      {/* Darker overlay for text readability */}
      <div className="absolute inset-0 bg-black/70" />
      
      {/* Back Button */}
      <div className="absolute top-6 left-6 z-20">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/projects')}
          className="gap-2 text-white/70 hover:text-white hover:bg-white/10 backdrop-blur-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </Button>
      </div>

      <div className="min-h-screen flex items-center justify-center p-6 relative z-10">
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
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20"
            >
              <Sparkles className="h-4 w-4 text-purple-300" />
              <span className="text-sm font-medium text-white">Coming Soon</span>
            </motion.div>

            {/* Icon */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="relative mx-auto w-24 h-24"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/30 to-blue-500/20 rounded-3xl rotate-6 blur-sm" />
              <div className="absolute inset-0 bg-gradient-to-br from-purple-400/40 to-blue-400/30 rounded-3xl -rotate-3 blur-sm" />
              <div className="relative w-full h-full bg-white/10 backdrop-blur-xl border border-white/30 rounded-3xl flex items-center justify-center shadow-2xl">
                <Globe className="h-10 w-10 text-white" />
              </div>
            </motion.div>

            {/* Title */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="space-y-4"
            >
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white drop-shadow-lg">
                Story Universes
              </h1>
              <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto leading-relaxed">
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
                className="group relative p-6 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 hover:border-white/30 hover:bg-white/10 transition-all duration-300 text-left"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-white/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <feature.icon className="h-6 w-6 text-purple-300" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-white">{feature.title}</h3>
                    <p className="text-sm text-white/60 leading-relaxed">{feature.description}</p>
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
                className="gap-2 px-8 bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-md shadow-lg"
                disabled
              >
                <Rocket className="h-5 w-5" />
                Get Notified at Launch
              </Button>
            </div>
            <p className="text-sm text-white/50">
              Be the first to know when Story Universes becomes available
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
