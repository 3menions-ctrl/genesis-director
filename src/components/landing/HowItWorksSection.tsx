import { motion } from 'framer-motion';
import { FileText, Wand2, Film, Download, Sparkles, Video, Image, Mic, Layers, Brain, Eye, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const STEPS = [
  {
    number: '01',
    icon: FileText,
    title: 'Describe Your Vision',
    description: 'Enter a text prompt or upload a reference image. Our AI understands cinematic language and visual styles.',
  },
  {
    number: '02',
    icon: Wand2,
    title: 'AI Generates Script',
    description: 'Smart script engine breaks your idea into scenes, shots, and camera movements with timing.',
  },
  {
    number: '03',
    icon: Film,
    title: 'Videos Generated',
    description: 'AI models generate each scene as video clips with seamless transitions and stitching.',
  },
  {
    number: '04',
    icon: Download,
    title: 'Export & Share',
    description: 'Download your finished video in up to 4K HDR for any project or platform.',
  },
];

const CAPABILITIES = [
  { icon: Video, label: 'Powered by Veo', description: 'Google\'s latest AI model' },
  { icon: Image, label: 'Image-to-Video', description: 'Animate any image' },
  { icon: Layers, label: 'Cloud Stitch', description: 'Seamless clip merging' },
  { icon: Brain, label: 'Auto Retry', description: 'Quality assurance' },
  { icon: Mic, label: 'Voice Synthesis', description: 'AI narration' },
  { icon: Eye, label: 'Quality Checks', description: 'Automated analysis' },
];

export default function HowItWorksSection() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <section id="how-it-works" className="relative z-10 py-24 lg:py-32 px-4 lg:px-8 overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-0 w-[500px] h-[500px] bg-accent/5 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-7xl mx-auto relative">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16 lg:mb-20"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">AI-Powered Creation</span>
          </div>
          <h2 className="text-4xl lg:text-6xl font-bold text-foreground mb-4">
            From Idea to{' '}
            <span className="bg-gradient-to-r from-primary via-primary/80 to-accent bg-clip-text text-transparent">
              Cinematic Video
            </span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Powerful AI technology makes professional video creation effortless
          </p>
        </motion.div>

        {/* Main content grid */}
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center mb-20">
          {/* Left: Interactive Steps */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-4"
          >
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = activeStep === index;
              
              return (
                <motion.div
                  key={index}
                  onClick={() => setActiveStep(index)}
                  whileHover={{ x: 4 }}
                  className={cn(
                    "group relative p-6 rounded-2xl cursor-pointer transition-all duration-300",
                    isActive 
                      ? "bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-l-4 border-primary" 
                      : "hover:bg-muted/30 border-l-4 border-transparent"
                  )}
                >
                  <div className="flex items-start gap-4">
                    {/* Step number + icon */}
                    <div className={cn(
                      "relative shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300",
                      isActive 
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30" 
                        : "bg-muted/50 text-muted-foreground group-hover:bg-muted group-hover:text-foreground"
                    )}>
                      <Icon className="w-6 h-6" />
                      <span className={cn(
                        "absolute -top-2 -right-2 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center",
                        isActive 
                          ? "bg-foreground text-background" 
                          : "bg-muted text-muted-foreground"
                      )}>
                        {step.number.replace('0', '')}
                      </span>
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className={cn(
                        "text-lg font-semibold mb-1 transition-colors",
                        isActive ? "text-foreground" : "text-foreground/70"
                      )}>
                        {step.title}
                      </h3>
                      <p className={cn(
                        "text-sm leading-relaxed transition-all duration-300",
                        isActive 
                          ? "text-muted-foreground opacity-100 max-h-20" 
                          : "text-muted-foreground/60 opacity-70 max-h-0 lg:max-h-20"
                      )}>
                        {step.description}
                      </p>
                    </div>
                  </div>
                  
                  {/* Progress indicator */}
                  {isActive && (
                    <motion.div
                      layoutId="stepProgress"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-transparent"
                    />
                  )}
                </motion.div>
              );
            })}
          </motion.div>

          {/* Right: Visual representation */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="relative aspect-square max-w-lg mx-auto">
              {/* Animated rings */}
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                  className="absolute w-full h-full rounded-full border border-dashed border-primary/20"
                />
                <motion.div 
                  animate={{ rotate: -360 }}
                  transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                  className="absolute w-[85%] h-[85%] rounded-full border border-primary/10"
                />
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="absolute w-[70%] h-[70%] rounded-full border border-dashed border-accent/15"
                />
              </div>
              
              {/* Center content */}
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  key={activeStep}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="relative w-40 h-40 rounded-3xl bg-gradient-to-br from-primary/20 via-background to-accent/10 border border-primary/20 flex flex-col items-center justify-center shadow-2xl"
                >
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                    {(() => {
                      const StepIcon = STEPS[activeStep].icon;
                      return <StepIcon className="w-8 h-8 text-primary" />;
                    })()}
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    Step {activeStep + 1}
                  </span>
                </motion.div>
              </div>
              
              {/* Orbiting capability icons */}
              {CAPABILITIES.slice(0, 4).map((cap, i) => {
                const angle = (i * 90 + 45) * (Math.PI / 180);
                const radius = 42; // percentage
                const x = 50 + radius * Math.cos(angle);
                const y = 50 + radius * Math.sin(angle);
                const Icon = cap.icon;
                
                return (
                  <motion.div
                    key={cap.label}
                    initial={{ opacity: 0, scale: 0 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                    className="absolute w-12 h-12 -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${x}%`, top: `${y}%` }}
                  >
                    <div className="w-full h-full rounded-xl bg-background border border-border shadow-lg flex items-center justify-center hover:scale-110 hover:border-primary/50 transition-all cursor-pointer group">
                      <Icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </div>

        {/* Capabilities grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4"
        >
          {CAPABILITIES.map((cap, i) => {
            const Icon = cap.icon;
            return (
              <motion.div
                key={cap.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ y: -4 }}
                className="group p-4 rounded-2xl bg-muted/30 border border-border/50 hover:border-primary/30 hover:bg-muted/50 transition-all cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h4 className="text-sm font-semibold text-foreground mb-1">{cap.label}</h4>
                <p className="text-xs text-muted-foreground">{cap.description}</p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
