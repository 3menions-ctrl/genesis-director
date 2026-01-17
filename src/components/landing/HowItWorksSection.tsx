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
  { icon: Video, label: 'Veo Powered', description: 'Google\'s latest AI' },
  { icon: Image, label: 'Image-to-Video', description: 'Animate images' },
  { icon: Layers, label: 'Cloud Stitch', description: 'Seamless merging' },
  { icon: Brain, label: 'Auto Retry', description: 'Quality assured' },
  { icon: Mic, label: 'Voice Synthesis', description: 'AI narration' },
  { icon: Eye, label: 'Quality Checks', description: 'Smart analysis' },
];

export default function HowItWorksSection() {
  const [activeStep, setActiveStep] = useState(0);
  const currentStep = STEPS[activeStep];
  const CurrentIcon = currentStep.icon;

  return (
    <section id="how-it-works" className="relative z-10 py-24 lg:py-32 px-4 lg:px-8 overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-foreground/[0.015] rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-foreground/[0.01] rounded-full blur-[80px]" />
      </div>

      <div className="max-w-7xl mx-auto relative">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16 lg:mb-20"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-foreground/5 border border-foreground/10 mb-6">
            <Sparkles className="w-4 h-4 text-foreground" />
            <span className="text-sm font-medium text-foreground">How It Works</span>
          </div>
          
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 text-foreground">
            From idea to video
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Four simple steps to create professional videos
          </p>
        </motion.div>

        {/* Steps Grid - Bento Style */}
        <div className="grid grid-cols-12 gap-4 mb-20">
          {/* Main Step Display */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="col-span-12 lg:col-span-7 relative rounded-3xl bg-glossy-black p-8 lg:p-10 overflow-hidden border border-white/10 shadow-obsidian-xl min-h-[320px]"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.06] via-transparent to-transparent pointer-events-none" />
            <div className={cn("absolute top-0 right-0 w-[300px] h-[300px] rounded-full blur-[100px] opacity-30 bg-gradient-to-br", currentStep.color)} />
            
            <div className="relative h-full flex flex-col justify-between">
              <div>
                <span className="inline-block text-sm font-mono text-white/40 mb-4">Step {activeStep + 1} of 4</span>
                
                <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center mb-6">
                  <CurrentIcon className="w-8 h-8 lg:w-10 lg:h-10 text-white" />
                </div>
                
                <h3 className="text-2xl lg:text-3xl font-bold text-white mb-3">
                  {currentStep.title}
                </h3>
                <p className="text-white/50 max-w-md text-base lg:text-lg leading-relaxed">
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
                      i === activeStep ? "w-8 bg-white" : "w-1.5 bg-white/30 hover:bg-white/50"
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
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  onClick={() => setActiveStep(index)}
                  className={cn(
                    "relative p-4 lg:p-5 rounded-2xl text-left transition-all duration-300 group",
                    isActive 
                      ? "bg-foreground text-background shadow-obsidian" 
                      : "bg-white/50 backdrop-blur-sm border border-white/60 hover:bg-white/70"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110",
                      isActive ? "bg-white/20" : "bg-foreground/10"
                    )}>
                      <Icon className={cn("w-5 h-5", isActive ? "text-background" : "text-foreground")} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={cn(
                          "text-sm font-bold truncate",
                          isActive ? "text-background" : "text-foreground"
                        )}>
                          {step.title}
                        </span>
                        <ChevronRight className={cn(
                          "w-4 h-4 shrink-0 transition-transform",
                          isActive ? "text-background/60 translate-x-0" : "text-muted-foreground -translate-x-1 group-hover:translate-x-0"
                        )} />
                      </div>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Capabilities - Compact Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="text-center mb-8">
            <h3 className="text-xl font-semibold text-foreground">Powered by Advanced AI</h3>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {CAPABILITIES.map((cap, i) => {
              const Icon = cap.icon;
              return (
                <div
                  key={cap.label}
                  className="group p-4 rounded-2xl bg-white/40 backdrop-blur-sm border border-white/50 hover:bg-white/60 transition-all duration-300"
                >
                  <div className="w-10 h-10 rounded-xl bg-foreground text-background flex items-center justify-center mb-3 shadow-lg group-hover:scale-110 transition-transform">
                    <Icon className="w-5 h-5" />
                  </div>
                  
                  <h4 className="text-sm font-semibold text-foreground mb-0.5">
                    {cap.label}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {cap.description}
                  </p>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
