import { motion } from 'framer-motion';
import { FileText, Wand2, Film, Download, Sparkles, Video, Image, Mic, Layers, Brain, Eye, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const STEPS = [
  {
    number: '01',
    icon: FileText,
    title: 'Describe Your Vision',
    description: 'Enter a text prompt or upload a reference image. Our AI understands cinematic language.',
    color: 'from-blue-500/20 to-purple-500/20',
  },
  {
    number: '02',
    icon: Wand2,
    title: 'AI Generates Script',
    description: 'Smart script engine breaks your idea into scenes with perfect timing.',
    color: 'from-purple-500/20 to-pink-500/20',
  },
  {
    number: '03',
    icon: Film,
    title: 'Videos Generated',
    description: 'AI generates each scene as video clips with seamless transitions.',
    color: 'from-pink-500/20 to-orange-500/20',
  },
  {
    number: '04',
    icon: Download,
    title: 'Export & Share',
    description: 'Download your finished video in up to 4K HDR quality.',
    color: 'from-orange-500/20 to-yellow-500/20',
  },
];

const CAPABILITIES = [
  { icon: Video, label: 'Kling AI', description: 'Cinema-grade video', featured: true },
  { icon: Image, label: 'Image-to-Video', description: 'Animate images', featured: false },
  { icon: Layers, label: 'Cloud Stitch', description: 'Seamless merging', featured: false },
  { icon: Brain, label: 'Auto Retry', description: 'Quality assured', featured: false },
  { icon: Mic, label: 'Voice Synthesis', description: 'AI narration', featured: false },
  { icon: Eye, label: 'Quality Checks', description: 'Smart analysis', featured: false },
];

export default function HowItWorksSection() {
  const [activeStep, setActiveStep] = useState(0);
  const currentStep = STEPS[activeStep];
  const CurrentIcon = currentStep.icon;

  return (
    <section id="how-it-works" className="relative z-10 py-24 lg:py-32 px-4 lg:px-8 overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/5 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-7xl mx-auto relative">
        {/* Main Container - Transparent with accent border */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative rounded-[2.5rem] bg-gradient-to-br from-primary/[0.08] via-primary/[0.03] to-transparent backdrop-blur-xl border border-primary/20 p-8 lg:p-12 overflow-hidden"
        >
          {/* Inner glow effects */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] via-transparent to-transparent pointer-events-none rounded-[2.5rem]" />
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px] opacity-50" />
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-accent/5 rounded-full blur-[80px] opacity-40" />

          {/* Header */}
          <div className="relative text-center mb-12 lg:mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">How It Works</span>
            </div>
            
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 text-foreground">
              From idea to video
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Four simple steps to create professional videos
            </p>
          </div>

          {/* Steps Grid - Bento Style */}
          <div className="relative grid grid-cols-12 gap-4 mb-16">
            {/* Main Step Display */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="col-span-12 lg:col-span-7 relative rounded-3xl bg-foreground p-8 lg:p-10 overflow-hidden shadow-obsidian-xl min-h-[320px]"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] via-transparent to-transparent pointer-events-none" />
              <div className={cn("absolute top-0 right-0 w-[300px] h-[300px] rounded-full blur-[100px] opacity-40 bg-gradient-to-br", currentStep.color)} />
              
              <div className="relative h-full flex flex-col justify-between">
                <div>
                  <span className="inline-block text-sm font-mono text-background/40 mb-4">Step {activeStep + 1} of 4</span>
                  
                  <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-2xl bg-background/10 backdrop-blur-sm flex items-center justify-center mb-6 border border-background/10">
                    <CurrentIcon className="w-8 h-8 lg:w-10 lg:h-10 text-background" />
                  </div>
                  
                  <h3 className="text-2xl lg:text-3xl font-bold text-background mb-3">
                    {currentStep.title}
                  </h3>
                  <p className="text-background/60 max-w-md text-base lg:text-lg leading-relaxed">
                    {currentStep.description}
                  </p>
                </div>

                {/* Progress dots */}
                <div className="flex gap-2 mt-8">
                  {STEPS.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveStep(i)}
                      className={cn(
                        "h-1.5 rounded-full transition-all duration-300",
                        i === activeStep ? "w-8 bg-background" : "w-1.5 bg-background/30 hover:bg-background/50"
                      )}
                    />
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Step Selectors - Right Side */}
            <div className="col-span-12 lg:col-span-5 grid grid-cols-2 lg:grid-cols-1 gap-3">
              {STEPS.map((step, index) => {
                const Icon = step.icon;
                const isActive = activeStep === index;
                
                return (
                  <motion.button
                    key={index}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: index * 0.08 }}
                    onClick={() => setActiveStep(index)}
                    className={cn(
                      "relative p-4 lg:p-5 rounded-2xl text-left transition-all duration-300 group",
                      isActive 
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" 
                        : "bg-background/60 backdrop-blur-sm border border-border/50 hover:bg-background/80 hover:border-primary/30"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110",
                        isActive ? "bg-primary-foreground/20" : "bg-primary/10"
                      )}>
                        <Icon className={cn("w-5 h-5", isActive ? "text-primary-foreground" : "text-primary")} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className={cn(
                            "text-sm font-bold truncate",
                            isActive ? "text-primary-foreground" : "text-foreground"
                          )}>
                            {step.title}
                          </span>
                          <ChevronRight className={cn(
                            "w-4 h-4 shrink-0 transition-transform",
                            isActive ? "text-primary-foreground/60 translate-x-0" : "text-muted-foreground -translate-x-1 group-hover:translate-x-0"
                          )} />
                        </div>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Capabilities - Inside Container */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-primary/20 via-secondary/20 to-accent/20 border border-primary/30 mb-4">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-sm font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">Powered by Kling AI</span>
              </div>
              <h3 className="text-xl font-semibold text-foreground">Advanced AI Technology Stack</h3>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {CAPABILITIES.map((cap, i) => {
                const Icon = cap.icon;
                const isFeatured = cap.featured;
                return (
                  <motion.div
                    key={cap.label}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.05 }}
                    className={cn(
                      "group p-4 rounded-2xl backdrop-blur-sm transition-all duration-300",
                      isFeatured 
                        ? "bg-gradient-to-br from-primary/20 via-secondary/10 to-accent/10 border-2 border-primary/40 hover:border-primary/60 shadow-lg shadow-primary/10" 
                        : "bg-background/50 border border-border/30 hover:bg-background/70 hover:border-primary/20"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform",
                      isFeatured 
                        ? "bg-gradient-to-br from-primary to-secondary text-white shadow-lg shadow-primary/30" 
                        : "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                    )}>
                      <Icon className="w-5 h-5" />
                    </div>
                    
                    <h4 className={cn(
                      "text-sm font-semibold mb-0.5",
                      isFeatured ? "bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent" : "text-foreground"
                    )}>
                      {cap.label}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {cap.description}
                    </p>
                    {isFeatured && (
                      <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-[10px] font-medium text-primary">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        Core Engine
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
