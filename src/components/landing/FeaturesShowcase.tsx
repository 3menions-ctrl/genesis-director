import { motion } from 'framer-motion';
import { 
  Type, 
  Image, 
  UserCheck, 
  Mic, 
  Music, 
  Palette,
  Wand2,
  Layers,
  Zap,
  Film,
  ArrowRight
} from 'lucide-react';

// Import feature images
import textToVideoHero from '@/assets/features/text-to-video-hero.jpg';
import imageToVideoHero from '@/assets/features/image-to-video-hero.jpg';
import characterLockHero from '@/assets/features/character-lock-hero.jpg';
import voiceoverHero from '@/assets/features/voiceover-hero.jpg';
import musicHero from '@/assets/features/music-hero.jpg';
import styleTransferHero from '@/assets/features/style-transfer-hero.jpg';

interface Feature {
  title: string;
  subtitle: string;
  description: string;
  image: string;
  icon: React.ReactNode;
  capabilities: string[];
  accentColor: string;
}

const features: Feature[] = [
  {
    title: 'Text to Video',
    subtitle: 'Words become cinema',
    description: 'Transform any description into stunning cinematic footage. Our AI understands context, emotion, and visual storytelling to create scenes that match your vision perfectly.',
    image: textToVideoHero,
    icon: <Type className="w-5 h-5" />,
    capabilities: ['4K HDR Output', 'Multiple Aspect Ratios', 'Cinematic Camera Movement', 'Natural Physics'],
    accentColor: 'from-blue-500/20 to-cyan-500/20',
  },
  {
    title: 'Image to Video',
    subtitle: 'Bring stills to life',
    description: 'Upload any image and watch it transform into fluid, natural motion. Perfect for animating artwork, product shots, or creating dynamic content from static visuals.',
    image: imageToVideoHero,
    icon: <Image className="w-5 h-5" />,
    capabilities: ['Fluid Motion Synthesis', 'Camera Pan & Zoom', 'Physics-Aware Animation', 'Style Preservation'],
    accentColor: 'from-violet-500/20 to-purple-500/20',
  },
  {
    title: 'Character Lock',
    subtitle: 'Perfect consistency',
    description: 'Our Face Lock and Multi-View Identity system ensures your characters look identical across every scene. No more morphing faces or inconsistent appearances.',
    image: characterLockHero,
    icon: <UserCheck className="w-5 h-5" />,
    capabilities: ['Facial Feature Mapping', '5-Angle Identity Memory', 'Outfit Consistency', 'Expression Control'],
    accentColor: 'from-emerald-500/20 to-teal-500/20',
  },
  {
    title: 'AI Voiceover',
    subtitle: 'Professional narration',
    description: 'Generate lifelike voiceovers in dozens of voices and languages. From dramatic narration to conversational dialogue, our AI captures the perfect tone.',
    image: voiceoverHero,
    icon: <Mic className="w-5 h-5" />,
    capabilities: ['50+ Voice Options', 'Emotion Detection', 'Multi-Language Support', 'Lip-Sync Ready'],
    accentColor: 'from-amber-500/20 to-orange-500/20',
  },
  {
    title: 'AI Music',
    subtitle: 'Original scores',
    description: "Generate royalty-free background music tailored to your video's mood. From epic orchestral to ambient electronic—custom composed for every scene.",
    image: musicHero,
    icon: <Music className="w-5 h-5" />,
    capabilities: ['Genre Flexibility', 'Scene-Synced Timing', 'Royalty-Free Forever', 'Seamless Loops'],
    accentColor: 'from-rose-500/20 to-pink-500/20',
  },
  {
    title: 'Style Transfer',
    subtitle: 'Any aesthetic',
    description: 'Transform your videos into any artistic style. From hyper-realistic to anime, oil painting to cyberpunk—20+ cinema-grade presets at your fingertips.',
    image: styleTransferHero,
    icon: <Palette className="w-5 h-5" />,
    capabilities: ['20+ Style Presets', 'Custom Color Grading', 'Temporal Consistency', 'Real-Time Preview'],
    accentColor: 'from-indigo-500/20 to-blue-500/20',
  },
];

const additionalCapabilities = [
  { icon: <Wand2 className="w-5 h-5" />, title: 'Smart Script Generation', desc: 'AI writes compelling scripts from a simple idea' },
  { icon: <Layers className="w-5 h-5" />, title: 'Scene Breakdown', desc: 'Automatic shot-by-shot visualization' },
  { icon: <Zap className="w-5 h-5" />, title: 'One-Click Stitching', desc: 'Seamless clip assembly with transitions' },
  { icon: <Film className="w-5 h-5" />, title: 'Motion Transfer', desc: 'Apply movement from one video to another' },
];

export default function FeaturesShowcase() {
  return (
    <section className="relative z-10 py-32 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.06] mb-6"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm text-white/50">Powered by Kling v2.6 Pro</span>
          </motion.div>
          
          <h2 className="text-4xl md:text-6xl font-semibold tracking-tight text-white mb-6">
            Built for creators
          </h2>
          <p className="text-lg md:text-xl text-white/40 max-w-2xl mx-auto leading-relaxed">
            A complete production studio in your browser. Everything you need to create 
            professional videos—from script to final cut.
          </p>
        </motion.div>

        {/* Main Features Grid - Alternating Layout */}
        <div className="space-y-24 md:space-y-32">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6 }}
              className={`grid md:grid-cols-2 gap-8 md:gap-16 items-center ${
                index % 2 === 1 ? 'md:grid-flow-dense' : ''
              }`}
            >
              {/* Image */}
              <motion.div
                className={`relative group ${index % 2 === 1 ? 'md:col-start-2' : ''}`}
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.3 }}
              >
                <div className="relative rounded-3xl overflow-hidden aspect-video">
                  {/* Gradient overlay */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${feature.accentColor} opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10`} />
                  
                  {/* Image */}
                  <img 
                    src={feature.image} 
                    alt={feature.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  
                  {/* Bottom gradient for text readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  
                  {/* Icon badge */}
                  <div className="absolute top-4 left-4 p-3 rounded-2xl bg-black/50 backdrop-blur-xl border border-white/10">
                    {feature.icon}
                  </div>
                </div>
                
                {/* Glow effect */}
                <div className={`absolute -inset-1 bg-gradient-to-r ${feature.accentColor} rounded-3xl blur-2xl opacity-0 group-hover:opacity-50 transition-opacity duration-500 -z-10`} />
              </motion.div>
              
              {/* Content */}
              <div className={index % 2 === 1 ? 'md:col-start-1 md:row-start-1' : ''}>
                <motion.span 
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 }}
                  className="text-sm font-medium text-white/30 uppercase tracking-widest"
                >
                  {feature.subtitle}
                </motion.span>
                
                <motion.h3 
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 }}
                  className="text-3xl md:text-4xl font-semibold text-white mt-2 mb-4"
                >
                  {feature.title}
                </motion.h3>
                
                <motion.p 
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.4 }}
                  className="text-lg text-white/50 leading-relaxed mb-8"
                >
                  {feature.description}
                </motion.p>
                
                {/* Capabilities */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5 }}
                  className="grid grid-cols-2 gap-3"
                >
                  {feature.capabilities.map((cap, i) => (
                    <div 
                      key={cap}
                      className="flex items-center gap-2 text-sm text-white/60"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-white/40" />
                      {cap}
                    </div>
                  ))}
                </motion.div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Additional Capabilities */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-32"
        >
          <div className="text-center mb-12">
            <h3 className="text-2xl md:text-3xl font-semibold text-white mb-3">
              And so much more
            </h3>
            <p className="text-white/40">
              Every tool you need for professional video production
            </p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-4">
            {additionalCapabilities.map((cap, i) => (
              <motion.div
                key={cap.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] hover:border-white/[0.08] transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center mb-4 group-hover:bg-white/[0.08] transition-colors">
                  {cap.icon}
                </div>
                <h4 className="text-base font-medium text-white mb-1">{cap.title}</h4>
                <p className="text-sm text-white/40">{cap.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-20 text-center"
        >
          <a 
            href="/auth?mode=signup"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white text-black font-medium hover:bg-white/90 transition-all duration-300 shadow-[0_0_40px_rgba(255,255,255,0.1)] hover:shadow-[0_0_60px_rgba(255,255,255,0.15)]"
          >
            Start Creating
            <ArrowRight className="w-4 h-4" />
          </a>
        </motion.div>
      </div>
    </section>
  );
}
