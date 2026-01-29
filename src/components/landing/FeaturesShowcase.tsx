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
  accentColor: string;
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
    accentColor: 'from-blue-500 to-cyan-400',
    glowColor: 'rgba(59, 130, 246, 0.5)',
  },
  {
    title: 'Image to Video',
    subtitle: 'Bring stills to life',
    description: 'Upload any image and watch it transform into fluid, natural motion. Perfect for product shots or artwork.',
    image: imageToVideoPremium,
    icon: <Image className="w-5 h-5" />,
    highlights: ['Fluid Animation', 'Camera Movement', 'Style Lock'],
    accentColor: 'from-slate-300 to-zinc-400',
    glowColor: 'rgba(148, 163, 184, 0.5)',
  },
  {
    title: 'Character Lock',
    subtitle: 'Perfect consistency',
    description: 'Keep characters identical across every scene. No more morphing faces or inconsistent appearances.',
    image: characterLockPremium,
    icon: <UserCheck className="w-5 h-5" />,
    highlights: ['Face Mapping', 'Multi-Angle', 'Outfit Lock'],
    accentColor: 'from-white to-slate-300',
    glowColor: 'rgba(255, 255, 255, 0.4)',
  },
  {
    title: 'AI Voiceover',
    subtitle: 'Professional narration',
    description: 'Generate lifelike voiceovers in dozens of voices and languages with perfect emotion control.',
    image: voiceoverPremium,
    icon: <Mic className="w-5 h-5" />,
    highlights: ['50+ Voices', 'Multi-Language', 'Lip-Sync'],
    accentColor: 'from-cyan-400 to-teal-400',
    glowColor: 'rgba(6, 182, 212, 0.5)',
  },
  {
    title: 'AI Music',
    subtitle: 'Original scores',
    description: 'Generate royalty-free background music tailored to your scene. Custom composed for every moment.',
    image: musicPremium,
    icon: <Music className="w-5 h-5" />,
    highlights: ['Any Genre', 'Scene-Synced', 'Royalty-Free'],
    accentColor: 'from-amber-400 to-orange-400',
    glowColor: 'rgba(245, 158, 11, 0.5)',
  },
  {
    title: 'Style Transfer',
    subtitle: 'Any aesthetic',
    description: 'Transform your videos into any artistic style. From hyperrealistic to anime—20+ cinema-grade presets.',
    image: styleTransferPremium,
    icon: <Palette className="w-5 h-5" />,
    highlights: ['20+ Presets', 'Color Grading', 'Consistency'],
    accentColor: 'from-violet-400 to-purple-400',
    glowColor: 'rgba(139, 92, 246, 0.5)',
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
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
              {/* Multi-layer ambient glow on hover */}
              <motion.div
                className="absolute -inset-3 rounded-[2rem] opacity-0 group-hover:opacity-100 transition-all duration-700 blur-2xl pointer-events-none"
                style={{ background: `radial-gradient(ellipse at center, ${feature.glowColor} 0%, transparent 70%)` }}
              />
              <motion.div
                className="absolute -inset-1 rounded-[1.75rem] opacity-0 group-hover:opacity-60 transition-all duration-500 blur-lg pointer-events-none"
                style={{ background: `radial-gradient(ellipse at center, ${feature.glowColor} 0%, transparent 60%)` }}
              />
              
              {/* Premium Glass Card */}
              <div className="relative h-full rounded-2xl md:rounded-[1.5rem] overflow-hidden transition-all duration-500 group-hover:translate-y-[-2px]">
                {/* Outer glass border with gradient */}
                <div className="absolute inset-0 rounded-2xl md:rounded-[1.5rem] p-px bg-gradient-to-br from-white/[0.15] via-white/[0.05] to-white/[0.02] group-hover:from-white/[0.25] group-hover:via-white/[0.08] group-hover:to-white/[0.05] transition-all duration-500">
                  <div className="absolute inset-px rounded-[calc(1.5rem-1px)] bg-gradient-to-br from-black/80 via-black/60 to-black/40 backdrop-blur-3xl" />
                </div>
                
                {/* Inner content wrapper */}
                <div className="relative h-full rounded-2xl md:rounded-[1.5rem] overflow-hidden">
                  {/* Noise texture overlay */}
                  <div 
                    className="absolute inset-0 opacity-[0.015] mix-blend-overlay pointer-events-none z-10"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
                    }}
                  />
                  
                  {/* Floating Image Container */}
                  <div className={`relative overflow-hidden ${
                    index === 0 || index === 3 ? 'aspect-[2.4/1]' : 'aspect-[16/10]'
                  }`}>
                    {/* Premium floating image with parallax effect */}
                    <motion.div 
                      className="absolute inset-3 md:inset-4 rounded-xl md:rounded-2xl overflow-hidden shadow-2xl"
                      whileHover={{ scale: 1.02 }}
                      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    >
                      {/* Image border glow */}
                      <div className="absolute -inset-px rounded-xl md:rounded-2xl bg-gradient-to-br from-white/20 via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      
                      <img 
                        src={feature.image} 
                        alt={feature.title}
                        className="w-full h-full object-cover transition-all duration-700 group-hover:scale-[1.05]"
                      />
                      
                      {/* Image overlays */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/30" />
                      
                      {/* Animated light sweep */}
                      <motion.div
                        className="absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none"
                        initial={{ x: '-100%', opacity: 0 }}
                        whileHover={{ x: '200%', opacity: 1 }}
                        transition={{ duration: 1.5, ease: 'easeInOut' }}
                        style={{
                          background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.1) 45%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.1) 55%, transparent 70%)',
                        }}
                      />
                    </motion.div>
                    
                    {/* Decorative corner accents */}
                    <div className="absolute top-0 left-0 w-16 h-16 border-l border-t border-white/[0.08] rounded-tl-2xl" />
                    <div className="absolute top-0 right-0 w-16 h-16 border-r border-t border-white/[0.08] rounded-tr-2xl" />
                    
                    {/* Icon Badge - Premium floating glass */}
                    <div className="absolute top-6 left-6 z-20">
                      <div className="relative">
                        <div className="absolute inset-0 rounded-xl blur-lg opacity-50" style={{ background: feature.glowColor }} />
                        <div className="relative p-3 rounded-xl bg-black/60 backdrop-blur-2xl border border-white/[0.15] shadow-2xl group-hover:border-white/[0.25] group-hover:bg-black/50 transition-all duration-300">
                          <div className={`bg-gradient-to-br ${feature.accentColor} bg-clip-text text-transparent`}>
                            <div className="text-white/80 group-hover:text-white transition-colors">
                              {feature.icon}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Content area with glass effect */}
                  <div className="relative p-5 md:p-6">
                    {/* Subtle top border glow */}
                    <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                    
                    {/* Title section */}
                    <div className="mb-4">
                      <span className={`text-[10px] md:text-xs font-semibold uppercase tracking-[0.2em] mb-2 block bg-gradient-to-r ${feature.accentColor} bg-clip-text text-transparent opacity-70 group-hover:opacity-100 transition-opacity`}>
                        {feature.subtitle}
                      </span>
                      <h3 className="text-xl md:text-2xl font-semibold text-white/90 group-hover:text-white transition-colors">
                        {feature.title}
                      </h3>
                    </div>
                    
                    <p className="text-sm md:text-[15px] text-white/40 leading-relaxed mb-5 group-hover:text-white/55 transition-colors">
                      {feature.description}
                    </p>
                    
                    {/* Premium highlight pills */}
                    <div className="flex flex-wrap gap-2">
                      {feature.highlights.map((highlight, i) => (
                        <span 
                          key={highlight}
                          className="relative px-3 py-1.5 rounded-full text-[11px] md:text-xs font-medium overflow-hidden group/pill"
                        >
                          {/* Pill glass background */}
                          <span className="absolute inset-0 bg-white/[0.03] border border-white/[0.08] rounded-full group-hover:bg-white/[0.06] group-hover:border-white/[0.15] transition-all duration-300" />
                          {/* Pill hover shimmer */}
                          <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />
                          <span className="relative text-white/50 group-hover:text-white/70 transition-colors">
                            {highlight}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  {/* Bottom decorative line */}
                  <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Additional Features - Premium glass row */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-12 md:mt-16"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {additionalFeatures.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="group relative"
              >
                {/* Hover glow */}
                <div className="absolute -inset-1 rounded-2xl bg-white/[0.03] opacity-0 group-hover:opacity-100 blur-lg transition-all duration-500" />
                
                <div className="relative flex items-center gap-3 p-4 md:p-5 rounded-xl md:rounded-2xl overflow-hidden transition-all duration-300">
                  {/* Glass background */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-white/[0.01] border border-white/[0.06] rounded-xl md:rounded-2xl backdrop-blur-xl group-hover:from-white/[0.06] group-hover:to-white/[0.02] group-hover:border-white/[0.12] transition-all duration-300" />
                  
                  <div className="relative w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center shrink-0 border border-white/[0.08] group-hover:bg-white/[0.08] group-hover:border-white/[0.15] transition-all">
                    <div className="text-white/50 group-hover:text-white/80 transition-colors">
                      {feature.icon}
                    </div>
                  </div>
                  <div className="relative min-w-0">
                    <h4 className="text-sm font-medium text-white/90 truncate group-hover:text-white transition-colors">{feature.title}</h4>
                    <p className="text-xs text-white/35 truncate group-hover:text-white/50 transition-colors">{feature.desc}</p>
                  </div>
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
            className="group relative inline-flex items-center gap-3 px-10 py-4 rounded-full text-sm font-semibold transition-all duration-300 overflow-hidden"
          >
            {/* Button glow */}
            <div className="absolute -inset-1 rounded-full bg-white/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            {/* Button background */}
            <div className="absolute inset-0 rounded-full bg-white shadow-[0_0_60px_rgba(255,255,255,0.15)] group-hover:shadow-[0_0_80px_rgba(255,255,255,0.25)] transition-shadow duration-300" />
            <span className="relative text-black">Start Creating</span>
            <ArrowRight className="relative w-4 h-4 text-black transition-transform group-hover:translate-x-1" />
          </a>
          <p className="mt-5 text-sm text-white/30">
            Free credits included • No credit card required
          </p>
        </motion.div>
      </div>
    </section>
  );
}
