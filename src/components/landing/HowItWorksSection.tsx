import { motion } from 'framer-motion';
import { FileText, Wand2, Film, Download, Sparkles, Video, Image, Mic, Layers, Brain, Eye } from 'lucide-react';
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
  { icon: Video, label: 'Powered by Veo', description: 'Google\'s latest AI' },
  { icon: Image, label: 'Image-to-Video', description: 'Animate any image' },
  { icon: Layers, label: 'Cloud Stitch', description: 'Seamless merging' },
  { icon: Brain, label: 'Auto Retry', description: 'Quality assurance' },
  { icon: Mic, label: 'Voice Synthesis', description: 'AI narration' },
  { icon: Eye, label: 'Quality Checks', description: 'Smart analysis' },
];

export default function HowItWorksSection() {
  const [activeStep, setActiveStep] = useState(0);

  const currentStep = STEPS[activeStep];
  const CurrentIcon = currentStep.icon;

  return (
    <section id="how-it-works" className="relative z-10 py-24 lg:py-32 px-4 lg:px-8 overflow-hidden">
      {/* Subtle background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-foreground/[0.02] rounded-full blur-[100px]" />
      </div>

      <div className="max-w-7xl mx-auto relative">
        {/* Header */}
        <div className="text-center mb-16 lg:mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card mb-6">
            <Sparkles className="w-4 h-4 text-foreground" />
            <span className="text-sm font-medium text-foreground">AI-Powered Creation</span>
          </div>
          
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4">
            <span className="text-foreground">From Idea to </span>
            <span className="text-foreground">Cinematic Video</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Professional video creation made effortless
          </p>
        </div>

        {/* Main card */}
        <div className="relative max-w-4xl mx-auto mb-16">
          <div className="relative rounded-3xl bg-glossy-black border border-white/[0.08] overflow-hidden shadow-obsidian">
            {/* Top highlight */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            
            <div className="p-8 lg:p-12">
              {/* Step indicators */}
              <div className="flex items-center justify-between mb-12 relative">
                {/* Connection line */}
                <div className="absolute top-1/2 left-0 right-0 h-px bg-white/10 -translate-y-1/2" />
                
                {STEPS.map((step, index) => {
                  const Icon = step.icon;
                  const isActive = activeStep === index;
                  const isPast = index < activeStep;
                  
                  return (
                    <button
                      key={index}
                      onClick={() => setActiveStep(index)}
                      className={cn(
                        "relative z-10 w-14 h-14 lg:w-16 lg:h-16 rounded-2xl flex items-center justify-center transition-all duration-300",
                        isActive 
                          ? "bg-white text-black shadow-lg"
                          : isPast
                            ? "bg-white/20 text-white border border-white/20"
                            : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 hover:text-white/70"
                      )}
                    >
                      <Icon className="w-6 h-6 lg:w-7 lg:h-7" />
                      
                      {/* Step number */}
                      <span className={cn(
                        "absolute -top-2 -right-2 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center",
                        isActive 
                          ? "bg-black text-white" 
                          : isPast
                            ? "bg-white/30 text-white"
                            : "bg-white/10 text-white/50"
                      )}>
                        {index + 1}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Active step content */}
              <div className="text-center">
                {/* Large icon */}
                <div className="relative w-20 h-20 lg:w-24 lg:h-24 mx-auto mb-8 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center">
                  <CurrentIcon className="w-10 h-10 lg:w-12 lg:h-12 text-white" />
                </div>

                <h3 className="text-2xl lg:text-3xl font-bold text-white mb-3">
                  {currentStep.title}
                </h3>
                <p className="text-white/60 max-w-lg mx-auto text-base lg:text-lg leading-relaxed">
                  {currentStep.description}
                </p>

                {/* Step counter */}
                <div className="mt-8 text-white/40 text-sm">
                  Step {activeStep + 1} of {STEPS.length}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Capabilities grid */}
        <div className="text-center mb-10">
          <h3 className="text-xl font-semibold text-foreground mb-2">Powered by Advanced AI</h3>
          <p className="text-muted-foreground text-sm">Cutting-edge technology at your fingertips</p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {CAPABILITIES.map((cap, i) => {
            const Icon = cap.icon;
            return (
              <div
                key={cap.label}
                className="group p-5 rounded-2xl glass-card hover:bg-muted/30 transition-all duration-300 cursor-pointer"
              >
                <div className="w-11 h-11 rounded-xl bg-foreground text-background flex items-center justify-center mb-4 shadow-lg group-hover:scale-105 transition-transform">
                  <Icon className="w-5 h-5" />
                </div>
                
                <h4 className="text-sm font-semibold text-foreground mb-1">
                  {cap.label}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {cap.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
