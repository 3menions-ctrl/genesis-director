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
}

const features: Feature[] = [
  {
    title: 'Text to Video',
    subtitle: 'Words become cinema',
    description: 'Transform any description into stunning cinematic footage. Our AI understands context, emotion, and visual storytelling.',
    image: textToVideoHero,
    icon: <Type className="w-5 h-5" />,
    highlights: ['4K HDR Output', 'Cinematic Motion', 'Natural Physics'],
  },
  {
    title: 'Image to Video',
    subtitle: 'Bring stills to life',
    description: 'Upload any image and watch it transform into fluid, natural motion. Perfect for product shots or artwork.',
    image: imageToVideoHero,
    icon: <Image className="w-5 h-5" />,
    highlights: ['Fluid Animation', 'Camera Movement', 'Style Preservation'],
  },
  {
    title: 'Character Lock',
    subtitle: 'Perfect consistency',
    description: 'Keep characters identical across every scene. No more morphing faces or inconsistent appearances.',
    image: characterLockHero,
    icon: <UserCheck className="w-5 h-5" />,
    highlights: ['Face Mapping', 'Multi-Angle Memory', 'Outfit Lock'],
  },
  {
    title: 'AI Voiceover',
    subtitle: 'Professional narration',
    description: 'Generate lifelike voiceovers in dozens of voices and languages with perfect emotion control.',
    image: voiceoverHero,
    icon: <Mic className="w-5 h-5" />,
    highlights: ['50+ Voices', 'Multi-Language', 'Lip-Sync Ready'],
  },
  {
    title: 'AI Music',
    subtitle: 'Original scores',
    description: 'Generate royalty-free background music tailored to your scene. Custom composed for every moment.',
    image: musicHero,
    icon: <Music className="w-5 h-5" />,
    highlights: ['Any Genre', 'Scene-Synced', 'Royalty-Free'],
  },
  {
    title: 'Style Transfer',
    subtitle: 'Any aesthetic',
    description: 'Transform your videos into any artistic style. From hyperrealistic to anime—20+ cinema-grade presets.',
    image: styleTransferHero,
    icon: <Palette className="w-5 h-5" />,
    highlights: ['20+ Presets', 'Color Grading', 'Temporal Consistency'],
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
      <div className="max-w-6xl mx-auto">
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
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] mb-6"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            <span className="text-xs text-white/50 tracking-wide">Powered by Kling v2.6</span>
          </motion.div>
          
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-white mb-4">
            Built for creators
          </h2>
          <p className="text-base md:text-lg text-white/40 max-w-xl mx-auto">
            A complete production studio in your browser.
          </p>
        </motion.div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              className={`group relative rounded-2xl md:rounded-3xl overflow-hidden bg-transparent transition-all duration-500 ${
                index === 0 || index === 3 ? 'lg:col-span-2 lg:row-span-1' : ''
              }`}
            >
              {/* Image Container - Floating with glow */}
              <div className={`relative overflow-hidden rounded-2xl mx-4 mt-4 ${
                index === 0 || index === 3 ? 'aspect-[2.5/1]' : 'aspect-[16/10]'
              }`}>
                <img 
                  src={feature.image} 
                  alt={feature.title}
                  className="w-full h-full object-cover rounded-2xl transition-transform duration-700 group-hover:scale-105"
                />
                
                {/* Subtle glow effect on hover */}
                <div className="absolute inset-0 rounded-2xl ring-1 ring-white/[0.08] group-hover:ring-white/[0.15] transition-all duration-500" />
                
                {/* Icon Badge */}
                <div className="absolute top-3 left-3 p-2 rounded-xl bg-black/60 backdrop-blur-xl border border-white/[0.1]">
                  {feature.icon}
                </div>
              </div>
              
              {/* Content - Below image */}
              <div className="p-5 md:p-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] md:text-xs font-medium text-white/30 uppercase tracking-widest">
                    {feature.subtitle}
                  </span>
                </div>
                <h3 className="text-lg md:text-xl font-semibold text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-white/50 leading-relaxed mb-4">
                  {feature.description}
                </p>
                
                {/* Highlights */}
                <div className="flex flex-wrap gap-2">
                  {feature.highlights.map((highlight) => (
                    <span 
                      key={highlight}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-[10px] md:text-xs text-white/60"
                    >
                      <Check className="w-2.5 h-2.5 text-white/40" />
                      {highlight}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Additional Features Strip */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-8 md:mt-12"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {additionalFeatures.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]"
              >
                <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0">
                  {feature.icon}
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-medium text-white truncate">{feature.title}</h4>
                  <p className="text-xs text-white/40 truncate">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16 md:mt-20 text-center"
        >
          <a 
            href="/auth?mode=signup"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white text-black text-sm font-medium hover:bg-white/90 transition-all duration-300 shadow-[0_0_40px_rgba(255,255,255,0.08)]"
          >
            Start Creating
            <ArrowRight className="w-4 h-4" />
          </a>
          <p className="mt-4 text-xs text-white/30">
            Free credits included • No credit card required
          </p>
        </motion.div>
      </div>
    </section>
  );
}
