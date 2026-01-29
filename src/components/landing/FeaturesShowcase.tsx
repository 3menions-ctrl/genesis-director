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
  Sparkles
} from 'lucide-react';

// Import premium feature images
import textToVideoPremium from '@/assets/features/text-to-video-premium.jpg';
import imageToVideoPremium from '@/assets/features/image-to-video-premium.jpg';
import characterLockPremium from '@/assets/features/character-lock-premium.jpg';
import voiceoverPremium from '@/assets/features/voiceover-premium.jpg';
import musicPremium from '@/assets/features/music-premium.jpg';
import styleTransferPremium from '@/assets/features/style-transfer-premium.jpg';

interface Feature {
  title: string;
  subtitle: string;
  description: string;
  image: string;
  icon: React.ReactNode;
  highlights: string[];
  accentGradient: string;
  glowColor: string;
}

const features: Feature[] = [
  {
    title: 'Text to Video',
    subtitle: 'Words become cinema',
    description: 'Transform any description into stunning cinematic footage. Our AI understands context, emotion, and visual storytelling.',
    image: textToVideoPremium,
    icon: <Type className="w-5 h-5" />,
    highlights: ['4K HDR', 'Cinematic Motion', 'Natural Physics'],
    accentGradient: 'from-blue-500/30 via-cyan-500/20 to-transparent',
    glowColor: 'rgba(59, 130, 246, 0.4)',
  },
  {
    title: 'Image to Video',
    subtitle: 'Bring stills to life',
    description: 'Upload any image and watch it transform into fluid, natural motion. Perfect for product shots or artwork.',
    image: imageToVideoPremium,
    icon: <Image className="w-5 h-5" />,
    highlights: ['Fluid Animation', 'Camera Movement', 'Style Lock'],
    accentGradient: 'from-slate-400/30 via-zinc-500/20 to-transparent',
    glowColor: 'rgba(148, 163, 184, 0.4)',
  },
  {
    title: 'Character Lock',
    subtitle: 'Perfect consistency',
    description: 'Keep characters identical across every scene. No more morphing faces or inconsistent appearances.',
    image: characterLockPremium,
    icon: <UserCheck className="w-5 h-5" />,
    highlights: ['Face Mapping', 'Multi-Angle', 'Outfit Lock'],
    accentGradient: 'from-white/20 via-slate-300/15 to-transparent',
    glowColor: 'rgba(255, 255, 255, 0.3)',
  },
  {
    title: 'AI Voiceover',
    subtitle: 'Professional narration',
    description: 'Generate lifelike voiceovers in dozens of voices and languages with perfect emotion control.',
    image: voiceoverPremium,
    icon: <Mic className="w-5 h-5" />,
    highlights: ['50+ Voices', 'Multi-Language', 'Lip-Sync'],
    accentGradient: 'from-cyan-500/30 via-teal-500/20 to-transparent',
    glowColor: 'rgba(6, 182, 212, 0.4)',
  },
  {
    title: 'AI Music',
    subtitle: 'Original scores',
    description: 'Generate royalty-free background music tailored to your scene. Custom composed for every moment.',
    image: musicPremium,
    icon: <Music className="w-5 h-5" />,
    highlights: ['Any Genre', 'Scene-Synced', 'Royalty-Free'],
    accentGradient: 'from-amber-500/25 via-orange-500/15 to-transparent',
    glowColor: 'rgba(245, 158, 11, 0.35)',
  },
  {
    title: 'Style Transfer',
    subtitle: 'Any aesthetic',
    description: 'Transform your videos into any artistic style. From hyperrealistic to anime—20+ cinema-grade presets.',
    image: styleTransferPremium,
    icon: <Palette className="w-5 h-5" />,
    highlights: ['20+ Presets', 'Color Grading', 'Consistency'],
    accentGradient: 'from-violet-500/30 via-purple-500/20 to-transparent',
    glowColor: 'rgba(139, 92, 246, 0.4)',
  },
];

const additionalFeatures = [
  { icon: <Wand2 className="w-4 h-4" />, title: 'Smart Scripts', desc: 'AI-generated narratives' },
  { icon: <Layers className="w-4 h-4" />, title: 'Scene Breakdown', desc: 'Auto shot visualization' },
  { icon: <Zap className="w-4 h-4" />, title: 'One-Click Stitch', desc: 'Seamless assembly' },
  { icon: <Film className="w-4 h-4" />, title: 'Motion Transfer', desc: 'Apply movement' },
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
            <Sparkles className="w-3.5 h-3.5 text-white/50" />
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className={`group relative ${
                index === 0 || index === 3 ? 'lg:col-span-2' : ''
              }`}
            >
              {/* Ambient glow effect on hover */}
              <motion.div
                className="absolute -inset-px rounded-2xl md:rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-xl pointer-events-none"
                style={{ background: `radial-gradient(ellipse at center, ${feature.glowColor} 0%, transparent 70%)` }}
              />
              
              {/* Card with edge-to-edge image blend */}
              <div className="relative h-full rounded-2xl md:rounded-3xl overflow-hidden bg-black/40 backdrop-blur-2xl border border-white/[0.06] transition-all duration-500 hover:border-white/[0.15]">
                {/* Image Container - seamless blend */}
                <div className={`relative overflow-hidden ${
                  index === 0 || index === 3 ? 'aspect-[2.4/1]' : 'aspect-[16/11]'
                }`}>
                  {/* Background image */}
                  <img 
                    src={feature.image} 
                    alt={feature.title}
                    className="w-full h-full object-cover transition-all duration-700 group-hover:scale-[1.03]"
                  />
                  
                  {/* Multiple gradient overlays for seamless blend */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/10" />
                  <div className={`absolute inset-0 bg-gradient-to-br ${feature.accentGradient} opacity-0 group-hover:opacity-100 transition-opacity duration-700`} />
                  
                  {/* Animated shine effect on hover */}
                  <motion.div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                    style={{
                      background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.03) 45%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 55%, transparent 60%)',
                    }}
                    initial={{ x: '-100%' }}
                    whileHover={{ x: '100%' }}
                    transition={{ duration: 1.2, ease: 'easeInOut' }}
                  />
                  
                  {/* Top edge shine */}
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
                  
                  {/* Icon Badge - Premium glass */}
                  <div className="absolute top-4 left-4 p-2.5 rounded-xl bg-black/50 backdrop-blur-2xl border border-white/[0.12] shadow-2xl group-hover:border-white/[0.2] transition-all duration-300">
                    <div className="text-white/70 group-hover:text-white transition-colors">
                      {feature.icon}
                    </div>
                  </div>
                </div>
                
                {/* Content area - blends with image */}
                <div className="relative p-5 md:p-6 -mt-8">
                  {/* Title section */}
                  <div className="mb-4">
                    <span className="text-[10px] md:text-xs font-medium text-white/40 uppercase tracking-[0.2em] mb-1.5 block">
                      {feature.subtitle}
                    </span>
                    <h3 className="text-xl md:text-2xl font-semibold text-white group-hover:text-white transition-colors">
                      {feature.title}
                    </h3>
                  </div>
                  
                  <p className="text-sm md:text-[15px] text-white/45 leading-relaxed mb-5 group-hover:text-white/55 transition-colors">
                    {feature.description}
                  </p>
                  
                  {/* Highlights - minimal pills */}
                  <div className="flex flex-wrap gap-2">
                    {feature.highlights.map((highlight) => (
                      <span 
                        key={highlight}
                        className="px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px] md:text-xs text-white/50 font-medium group-hover:bg-white/[0.06] group-hover:border-white/[0.12] group-hover:text-white/60 transition-all duration-300"
                      >
                        {highlight}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Additional Features - Minimal glass row */}
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
                className="group flex items-center gap-3 p-4 md:p-5 rounded-xl md:rounded-2xl bg-white/[0.02] border border-white/[0.05] backdrop-blur-xl transition-all duration-300 hover:bg-white/[0.05] hover:border-white/[0.12]"
              >
                <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center shrink-0 border border-white/[0.06] group-hover:bg-white/[0.08] group-hover:border-white/[0.12] transition-all">
                  <div className="text-white/50 group-hover:text-white/80 transition-colors">
                    {feature.icon}
                  </div>
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-medium text-white truncate">{feature.title}</h4>
                  <p className="text-xs text-white/35 truncate">{feature.desc}</p>
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
