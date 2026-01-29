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
  ArrowRight,
  Check
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
  highlights: string[];
  accent: string;
}

const features: Feature[] = [
  {
    title: 'Text to Video',
    subtitle: 'Words become cinema',
    description: 'Transform any description into stunning cinematic footage. Our AI understands context, emotion, and visual storytelling.',
    image: textToVideoHero,
    icon: <Type className="w-4 h-4" />,
    highlights: ['4K HDR Output', 'Cinematic Motion', 'Natural Physics'],
    accent: 'from-blue-500/20 to-cyan-500/10',
  },
  {
    title: 'Image to Video',
    subtitle: 'Bring stills to life',
    description: 'Upload any image and watch it transform into fluid, natural motion. Perfect for product shots or artwork.',
    image: imageToVideoHero,
    icon: <Image className="w-4 h-4" />,
    highlights: ['Fluid Animation', 'Camera Movement', 'Style Preservation'],
    accent: 'from-purple-500/20 to-pink-500/10',
  },
  {
    title: 'Character Lock',
    subtitle: 'Perfect consistency',
    description: 'Keep characters identical across every scene. No more morphing faces or inconsistent appearances.',
    image: characterLockHero,
    icon: <UserCheck className="w-4 h-4" />,
    highlights: ['Face Mapping', 'Multi-Angle Memory', 'Outfit Lock'],
    accent: 'from-cyan-500/20 to-teal-500/10',
  },
  {
    title: 'AI Voiceover',
    subtitle: 'Professional narration',
    description: 'Generate lifelike voiceovers in dozens of voices and languages with perfect emotion control.',
    image: voiceoverHero,
    icon: <Mic className="w-4 h-4" />,
    highlights: ['50+ Voices', 'Multi-Language', 'Lip-Sync Ready'],
    accent: 'from-amber-500/20 to-yellow-500/10',
  },
  {
    title: 'AI Music',
    subtitle: 'Original scores',
    description: 'Generate royalty-free background music tailored to your scene. Custom composed for every moment.',
    image: musicHero,
    icon: <Music className="w-4 h-4" />,
    highlights: ['Any Genre', 'Scene-Synced', 'Royalty-Free'],
    accent: 'from-pink-500/20 to-rose-500/10',
  },
  {
    title: 'Style Transfer',
    subtitle: 'Any aesthetic',
    description: 'Transform your videos into any artistic style. From hyperrealistic to anime—20+ cinema-grade presets.',
    image: styleTransferHero,
    icon: <Palette className="w-4 h-4" />,
    highlights: ['20+ Presets', 'Color Grading', 'Temporal Consistency'],
    accent: 'from-violet-500/20 to-indigo-500/10',
  },
];

const additionalFeatures = [
  { icon: <Wand2 className="w-4 h-4" />, title: 'Smart Scripts', desc: 'AI-generated compelling narratives' },
  { icon: <Layers className="w-4 h-4" />, title: 'Scene Breakdown', desc: 'Automatic shot visualization' },
  { icon: <Zap className="w-4 h-4" />, title: 'One-Click Stitch', desc: 'Seamless clip assembly' },
  { icon: <Film className="w-4 h-4" />, title: 'Motion Transfer', desc: 'Apply movement between videos' },
];

export default function FeaturesShowcase() {
  return (
    <section className="relative z-10 py-24 md:py-40 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16 md:mb-24"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl mb-8"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white/60" />
            <span className="text-xs text-white/50 tracking-widest uppercase">Professional Tools</span>
          </motion.div>
          
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-white mb-6">
            Built for creators
          </h2>
          <p className="text-lg md:text-xl text-white/40 max-w-2xl mx-auto leading-relaxed">
            Everything you need to produce cinema-quality content. 
            A complete production studio in your browser.
          </p>
        </motion.div>

        {/* Premium Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
              className={`group relative ${
                index === 0 || index === 3 ? 'lg:col-span-2' : ''
              }`}
            >
              {/* Card with glass-morphism */}
              <div className="relative h-full rounded-2xl md:rounded-3xl overflow-hidden bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-2xl border border-white/[0.06] transition-all duration-500 hover:border-white/[0.12] hover:bg-white/[0.06]">
                {/* Ambient glow on hover */}
                <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-gradient-to-br ${feature.accent} pointer-events-none`} />
                
                {/* Top shine line */}
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                
                {/* Image Container */}
                <div className={`relative overflow-hidden ${
                  index === 0 || index === 3 ? 'aspect-[2.2/1]' : 'aspect-[16/10]'
                }`}>
                  <img 
                    src={feature.image} 
                    alt={feature.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  
                  {/* Gradient overlays */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-80" />
                  <div className="absolute inset-0 bg-gradient-to-br from-black/30 to-transparent" />
                  
                  {/* Icon Badge - Glass style */}
                  <div className="absolute top-4 left-4 p-2.5 rounded-xl bg-black/40 backdrop-blur-2xl border border-white/[0.1] shadow-lg">
                    <div className="text-white/80">
                      {feature.icon}
                    </div>
                  </div>
                  
                  {/* Floating title on image */}
                  <div className="absolute bottom-4 left-4 right-4">
                    <span className="text-[10px] md:text-xs font-medium text-white/50 uppercase tracking-widest mb-1 block">
                      {feature.subtitle}
                    </span>
                    <h3 className="text-xl md:text-2xl font-semibold text-white">
                      {feature.title}
                    </h3>
                  </div>
                </div>
                
                {/* Content */}
                <div className="relative p-5 md:p-6">
                  <p className="text-sm md:text-base text-white/50 leading-relaxed mb-5">
                    {feature.description}
                  </p>
                  
                  {/* Highlights with premium style */}
                  <div className="flex flex-wrap gap-2">
                    {feature.highlights.map((highlight) => (
                      <span 
                        key={highlight}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-[11px] md:text-xs text-white/60 font-medium"
                      >
                        <Check className="w-3 h-3 text-white/40" />
                        {highlight}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Additional Features - Glass Cards */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-10 md:mt-14"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {additionalFeatures.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="group flex items-center gap-3 p-4 md:p-5 rounded-xl md:rounded-2xl bg-white/[0.02] border border-white/[0.05] backdrop-blur-xl transition-all duration-300 hover:bg-white/[0.04] hover:border-white/[0.1]"
              >
                <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center shrink-0 border border-white/[0.06] group-hover:bg-white/[0.08] transition-colors">
                  <div className="text-white/60 group-hover:text-white/80 transition-colors">
                    {feature.icon}
                  </div>
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-medium text-white truncate">{feature.title}</h4>
                  <p className="text-xs text-white/40 truncate">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* CTA - Premium Glass Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16 md:mt-24 text-center"
        >
          <a 
            href="/auth?mode=signup"
            className="group inline-flex items-center gap-3 px-10 py-4 rounded-full bg-white text-black text-sm font-semibold hover:bg-white/90 transition-all duration-300 shadow-[0_0_60px_rgba(255,255,255,0.1)] hover:shadow-[0_0_80px_rgba(255,255,255,0.2)]"
          >
            Start Creating
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </a>
          <p className="mt-5 text-sm text-white/30">
            Free credits included • No credit card required
          </p>
        </motion.div>
      </div>
    </section>
  );
}
