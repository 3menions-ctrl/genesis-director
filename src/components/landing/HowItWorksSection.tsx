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
    color: 'from-white/10 to-white/5',
  },
  {
    number: '02',
    icon: Wand2,
    title: 'AI Generates Script',
    description: 'Smart script engine breaks your idea into scenes with perfect timing.',
    color: 'from-white/10 to-white/5',
  },
  {
    number: '03',
    icon: Film,
    title: 'Videos Generated',
    description: 'AI generates each scene as video clips with seamless transitions.',
    color: 'from-white/10 to-white/5',
  },
  {
    number: '04',
    icon: Download,
    title: 'Export & Share',
    description: 'Download your finished video in up to 4K HDR quality.',
    color: 'from-white/10 to-white/5',
  },
];

const CAPABILITIES = [
  { icon: Video, label: 'Cinema AI', description: 'Professional video', featured: true },
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
      <div className="max-w-7xl mx-auto relative">
        {/* Main Container */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative rounded-[2.5rem] bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] p-8 lg:p-12 overflow-hidden"
        >
          {/* Header */}
          <div className="relative text-center mb-12 lg:mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.05] border border-white/[0.1] mb-6">
              <Sparkles className="w-4 h-4 text-white/70" />
              <span className="text-sm font-medium text-white/70">How It Works</span>
            </div>
            
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 text-white">
              From idea to video
            </h2>
            <p className="text-lg text-white/50 max-w-2xl mx-auto">
              Four simple steps to create professional videos
            </p>
          </div>

          {/* Steps Grid */}
          <div className="relative grid grid-cols-12 gap-4 mb-16">
            {/* Main Step Display */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="col-span-12 lg:col-span-7 relative rounded-3xl bg-white p-8 lg:p-10 overflow-hidden min-h-[320px]"
            >
              <div className="relative h-full flex flex-col justify-between">
                <div>
                  <span className="inline-block text-sm font-mono text-black/40 mb-4">Step {activeStep + 1} of 4</span>
                  
                  <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-2xl bg-black/5 flex items-center justify-center mb-6">
                    <CurrentIcon className="w-8 h-8 lg:w-10 lg:h-10 text-black" />
                  </div>
                  
                  <h3 className="text-2xl lg:text-3xl font-bold text-black mb-3">
                    {currentStep.title}
                  </h3>
                  <p className="text-black/60 max-w-md text-base lg:text-lg leading-relaxed">
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
                        i === activeStep ? "w-8 bg-black" : "w-1.5 bg-black/20 hover:bg-black/40"
                      )}
                    />
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Step Selectors */}
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
                        ? "bg-white text-black" 
                        : "bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06]"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110",
                        isActive ? "bg-black/10" : "bg-white/[0.05]"
                      )}>
                        <Icon className={cn("w-5 h-5", isActive ? "text-black" : "text-white/70")} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className={cn(
                            "text-sm font-bold truncate",
                            isActive ? "text-black" : "text-white"
                          )}>
                            {step.title}
                          </span>
                          <ChevronRight className={cn(
                            "w-4 h-4 shrink-0 transition-transform",
                            isActive ? "text-black/40" : "text-white/40"
                          )} />
                        </div>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Capabilities */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            <div className="text-center mb-8">
              <h3 className="text-xl font-semibold text-white">Advanced AI Technology</h3>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {CAPABILITIES.map((cap, i) => {
                const Icon = cap.icon;
                return (
                  <motion.div
                    key={cap.label}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.05 }}
                    className="group p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-all duration-300"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center mb-3 group-hover:bg-white/[0.1] transition-colors">
                      <Icon className="w-5 h-5 text-white/70" />
                    </div>
                    
                    <h4 className="text-sm font-semibold text-white mb-0.5">
                      {cap.label}
                    </h4>
                    <p className="text-xs text-white/40">
                      {cap.description}
                    </p>
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
