import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Wand2, Film, Download, Sparkles, Video, Image, Mic, Layers, Brain, Eye, Play, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

const STEPS = [
  {
    number: '01',
    icon: FileText,
    title: 'Describe Your Vision',
    description: 'Enter a text prompt or upload a reference image. Our AI understands cinematic language and visual styles.',
    gradient: 'from-violet-500 via-purple-500 to-fuchsia-500',
    glow: 'shadow-violet-500/25',
  },
  {
    number: '02',
    icon: Wand2,
    title: 'AI Generates Script',
    description: 'Smart script engine breaks your idea into scenes, shots, and camera movements with timing.',
    gradient: 'from-cyan-500 via-blue-500 to-indigo-500',
    glow: 'shadow-cyan-500/25',
  },
  {
    number: '03',
    icon: Film,
    title: 'Videos Generated',
    description: 'AI models generate each scene as video clips with seamless transitions and stitching.',
    gradient: 'from-amber-500 via-orange-500 to-red-500',
    glow: 'shadow-amber-500/25',
  },
  {
    number: '04',
    icon: Download,
    title: 'Export & Share',
    description: 'Download your finished video in up to 4K HDR for any project or platform.',
    gradient: 'from-emerald-500 via-green-500 to-teal-500',
    glow: 'shadow-emerald-500/25',
  },
];

const CAPABILITIES = [
  { icon: Video, label: 'Powered by Veo', description: 'Google\'s latest AI', gradient: 'from-red-500 to-rose-600' },
  { icon: Image, label: 'Image-to-Video', description: 'Animate any image', gradient: 'from-blue-500 to-cyan-600' },
  { icon: Layers, label: 'Cloud Stitch', description: 'Seamless merging', gradient: 'from-purple-500 to-violet-600' },
  { icon: Brain, label: 'Auto Retry', description: 'Quality assurance', gradient: 'from-amber-500 to-orange-600' },
  { icon: Mic, label: 'Voice Synthesis', description: 'AI narration', gradient: 'from-emerald-500 to-teal-600' },
  { icon: Eye, label: 'Quality Checks', description: 'Smart analysis', gradient: 'from-pink-500 to-rose-600' },
];

// Floating particles component
function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-primary/30 rounded-full"
          initial={{
            x: Math.random() * 100 + '%',
            y: Math.random() * 100 + '%',
            scale: Math.random() * 0.5 + 0.5,
          }}
          animate={{
            y: [null, '-20%'],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: Math.random() * 3 + 2,
            repeat: Infinity,
            delay: Math.random() * 2,
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  );
}

export default function HowItWorksSection() {
  const [activeStep, setActiveStep] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  // Auto-advance steps
  useEffect(() => {
    if (!isAutoPlaying) return;
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % STEPS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const currentStep = STEPS[activeStep];
  const CurrentIcon = currentStep.icon;

  return (
    <section id="how-it-works" className="relative z-10 py-24 lg:py-32 px-4 lg:px-8 overflow-hidden">
      {/* Epic background effects */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Large gradient orbs */}
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-0 left-1/4 w-[800px] h-[800px] bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-transparent rounded-full blur-[120px]" 
        />
        <motion.div 
          animate={{ 
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-gradient-to-tl from-cyan-500/10 via-blue-500/5 to-transparent rounded-full blur-[100px]" 
        />
        
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
        
        {/* Floating particles */}
        <FloatingParticles />
      </div>

      <div className="max-w-7xl mx-auto relative">
        {/* Header with animated badge */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16 lg:mb-24"
        >
          <motion.div 
            initial={{ scale: 0.9 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-primary/20 via-primary/10 to-accent/20 border border-primary/30 mb-8 backdrop-blur-sm"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            >
              <Sparkles className="w-4 h-4 text-primary" />
            </motion.div>
            <span className="text-sm font-medium bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              AI-Powered Creation
            </span>
          </motion.div>
          
          <h2 className="text-4xl sm:text-5xl lg:text-7xl font-bold mb-6">
            <span className="text-foreground">From Idea to</span>
            <br />
            <span className="relative inline-block mt-2">
              <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
                Cinematic Video
              </span>
              {/* Underline glow */}
              <motion.div
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5, duration: 0.8 }}
                className="absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500 rounded-full origin-left"
              />
            </span>
          </h2>
          <p className="text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto mt-6">
            Experience the future of video creation with our advanced AI pipeline
          </p>
        </motion.div>

        {/* Main epic visualization */}
        <div className="relative mb-20">
          {/* Central 3D-like showcase */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative max-w-4xl mx-auto"
          >
            {/* Outer glow ring */}
            <div className="absolute inset-0 -m-8 rounded-[3rem] bg-gradient-to-r from-violet-500/20 via-fuchsia-500/20 to-cyan-500/20 blur-2xl" />
            
            {/* Main card */}
            <div className="relative rounded-3xl bg-gradient-to-b from-background via-background to-muted/20 border border-white/10 overflow-hidden backdrop-blur-xl shadow-2xl">
              {/* Top reflection */}
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              
              {/* Content */}
              <div className="p-8 lg:p-12">
                {/* Step indicators - horizontal timeline */}
                <div className="flex items-center justify-between mb-12 relative">
                  {/* Connection line */}
                  <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-muted/30 -translate-y-1/2" />
                  <motion.div 
                    className="absolute top-1/2 left-0 h-0.5 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500 -translate-y-1/2 origin-left"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: (activeStep + 1) / STEPS.length }}
                    transition={{ duration: 0.5 }}
                  />
                  
                  {STEPS.map((step, index) => {
                    const Icon = step.icon;
                    const isActive = activeStep === index;
                    const isPast = index < activeStep;
                    
                    return (
                      <motion.button
                        key={index}
                        onClick={() => {
                          setActiveStep(index);
                          setIsAutoPlaying(false);
                        }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        className={cn(
                          "relative z-10 w-14 h-14 lg:w-16 lg:h-16 rounded-2xl flex items-center justify-center transition-all duration-500",
                          isActive 
                            ? `bg-gradient-to-br ${step.gradient} shadow-lg ${step.glow}`
                            : isPast
                              ? "bg-primary/20 border border-primary/30"
                              : "bg-muted/50 border border-border hover:border-primary/30"
                        )}
                      >
                        <Icon className={cn(
                          "w-6 h-6 lg:w-7 lg:h-7 transition-colors",
                          isActive ? "text-white" : isPast ? "text-primary" : "text-muted-foreground"
                        )} />
                        
                        {/* Step number */}
                        <span className={cn(
                          "absolute -top-2 -right-2 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center transition-all",
                          isActive 
                            ? "bg-white text-black shadow-lg" 
                            : isPast
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                        )}>
                          {index + 1}
                        </span>
                        
                        {/* Active pulse */}
                        {isActive && (
                          <motion.div
                            initial={{ scale: 1, opacity: 0.5 }}
                            animate={{ scale: 1.5, opacity: 0 }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                            className={cn("absolute inset-0 rounded-2xl bg-gradient-to-br", step.gradient)}
                          />
                        )}
                      </motion.button>
                    );
                  })}
                </div>

                {/* Active step content */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeStep}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.4 }}
                    className="text-center"
                  >
                    {/* Large icon showcase */}
                    <motion.div
                      initial={{ scale: 0.8, rotate: -10 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 200, damping: 20 }}
                      className={cn(
                        "relative w-24 h-24 lg:w-32 lg:h-32 mx-auto mb-8 rounded-3xl bg-gradient-to-br flex items-center justify-center shadow-2xl",
                        currentStep.gradient,
                        currentStep.glow
                      )}
                    >
                      {/* Inner glow */}
                      <div className="absolute inset-0 rounded-3xl bg-white/20 blur-xl" />
                      <CurrentIcon className="relative w-12 h-12 lg:w-16 lg:h-16 text-white" />
                      
                      {/* Orbiting dot */}
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-0"
                      >
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-lg shadow-white/50" />
                      </motion.div>
                    </motion.div>

                    <h3 className="text-2xl lg:text-3xl font-bold text-foreground mb-3">
                      {currentStep.title}
                    </h3>
                    <p className="text-muted-foreground max-w-lg mx-auto text-base lg:text-lg leading-relaxed">
                      {currentStep.description}
                    </p>

                    {/* Auto-play indicator */}
                    <div className="mt-8 flex items-center justify-center gap-2">
                      <button
                        onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                        className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 hover:bg-muted transition-colors text-sm text-muted-foreground"
                      >
                        {isAutoPlaying ? (
                          <>
                            <motion.div
                              animate={{ scale: [1, 1.2, 1] }}
                              transition={{ duration: 1, repeat: Infinity }}
                              className="w-2 h-2 rounded-full bg-green-500"
                            />
                            <span>Auto-playing</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3" />
                            <span>Resume</span>
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
              
              {/* Bottom gradient */}
              <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-primary/5 to-transparent pointer-events-none" />
            </div>
          </motion.div>
        </div>

        {/* Capabilities - floating cards */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative"
        >
          <div className="text-center mb-10">
            <h3 className="text-xl lg:text-2xl font-semibold text-foreground mb-2">Powered by Advanced AI</h3>
            <p className="text-muted-foreground">Cutting-edge technology at your fingertips</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {CAPABILITIES.map((cap, i) => {
              const Icon = cap.icon;
              return (
                <motion.div
                  key={cap.label}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  whileHover={{ y: -8, scale: 1.02 }}
                  className="group relative"
                >
                  {/* Card glow on hover */}
                  <div className={cn(
                    "absolute inset-0 rounded-2xl bg-gradient-to-br opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-500",
                    cap.gradient
                  )} />
                  
                  <div className="relative p-5 rounded-2xl bg-background/80 backdrop-blur-sm border border-border/50 hover:border-primary/40 transition-all duration-300 h-full">
                    {/* Icon with gradient */}
                    <div className={cn(
                      "w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center mb-4 shadow-lg transition-transform group-hover:scale-110",
                      cap.gradient
                    )}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    
                    <h4 className="text-sm font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                      {cap.label}
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {cap.description}
                    </p>
                    
                    {/* Hover arrow */}
                    <motion.div
                      initial={{ opacity: 0, x: -5 }}
                      whileHover={{ opacity: 1, x: 0 }}
                      className="absolute top-5 right-5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <ChevronRight className="w-4 h-4 text-primary" />
                    </motion.div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
