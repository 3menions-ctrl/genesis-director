import { memo, useMemo, forwardRef, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
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
  videoUrl?: string; // Optional hover-play video
  icon: React.ReactNode;
  highlights: string[];
  accentColor: string;
  glowColor: string;
}

// Static data - defined outside component to prevent recreation
const FEATURES: Feature[] = [
  {
    title: 'Text to Video',
    subtitle: 'Words become cinema',
    description: 'Transform any description into stunning cinematic footage. Our AI understands context, emotion, and visual storytelling.',
    image: textToVideoPremium,
    videoUrl: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_099597a1-0cbf-4d71-b000-7d140ab896d1_1768171376851.mp4',
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
    videoUrl: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_dc255261-7bc3-465f-a9ec-ef2acd47b4fb_1768124786072.mp4',
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
    videoUrl: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_7434c756-78d3-4f68-8107-b205930027c4_1768120634478.mp4',
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
    videoUrl: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/avatar-videos/fc34967d-0fcc-4863-829e-29d2dee5e514/avatar_fc34967d-0fcc-4863-829e-29d2dee5e514_clip1_lipsync_1770421330974.mp4',
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
    videoUrl: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_1b0ac63f-643a-4d43-b8ed-44b8083257ed_1768157346652.mp4',
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
    videoUrl: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/gallery/Beautiful_Day_Vibes-final.mp4',
    icon: <Palette className="w-5 h-5" />,
    highlights: ['20+ Presets', 'Color Grading', 'Consistency'],
    accentColor: 'from-violet-400 to-purple-400',
    glowColor: 'rgba(139, 92, 246, 0.5)',
  },
];

const ADDITIONAL_FEATURES = [
  { icon: <Wand2 className="w-4 h-4" />, title: 'Smart Scripts', desc: 'AI-generated narratives' },
  { icon: <Layers className="w-4 h-4" />, title: 'Scene Breakdown', desc: 'Auto shot visualization' },
  { icon: <Zap className="w-4 h-4" />, title: 'One-Click Stitch', desc: 'Seamless assembly' },
  { icon: <Film className="w-4 h-4" />, title: 'Motion Transfer', desc: 'Apply movement' },
];

// Optimized animation variants - reusable
const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] as const }
  })
};

const fadeInVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};

// Memoized Feature Card component with hover-play video
const FeatureCard = memo(forwardRef<HTMLDivElement, { feature: Feature; index: number }>(
  function FeatureCard({ feature, index }, ref) {
    const isWide = index === 0 || index === 3;
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isHovering, setIsHovering] = useState(false);
    
    const handleMouseEnter = useCallback(() => {
      setIsHovering(true);
      if (videoRef.current && feature.videoUrl) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(() => {});
      }
    }, [feature.videoUrl]);
    
    const handleMouseLeave = useCallback(() => {
      setIsHovering(false);
      if (videoRef.current) {
        videoRef.current.pause();
      }
    }, []);
    
    return (
      <motion.div
        ref={ref}
        custom={index}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-50px" }}
        variants={cardVariants}
        className={`group relative ${isWide ? 'lg:col-span-2' : ''}`}
        style={{ willChange: 'transform, opacity' }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
    >
      {/* Ambient glow */}
      <div 
        className="absolute -inset-3 rounded-[2rem] opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-2xl pointer-events-none"
        style={{ background: `radial-gradient(ellipse at center, ${feature.glowColor} 0%, transparent 70%)` }}
      />
      
      {/* Premium Glass Card */}
      <div className="relative h-full rounded-2xl md:rounded-[1.5rem] overflow-hidden transition-transform duration-500 group-hover:translate-y-[-2px]" style={{ willChange: 'transform' }}>
        {/* Outer glass border */}
        <div className="absolute inset-0 rounded-2xl md:rounded-[1.5rem] p-px bg-gradient-to-br from-white/[0.15] via-white/[0.05] to-white/[0.02] group-hover:from-white/[0.25] group-hover:via-white/[0.08] group-hover:to-white/[0.05] transition-all duration-500">
          <div className="absolute inset-px rounded-[calc(1.5rem-1px)] bg-gradient-to-br from-black/80 via-black/60 to-black/40 backdrop-blur-3xl" />
        </div>
        
        {/* Inner content */}
        <div className="relative h-full rounded-2xl md:rounded-[1.5rem] overflow-hidden">
          {/* Floating Image/Video Container */}
          <div className={`relative overflow-hidden ${isWide ? 'aspect-[2.4/1]' : 'aspect-[16/10]'}`}>
            <div className="absolute inset-3 md:inset-4 rounded-xl md:rounded-2xl overflow-hidden shadow-2xl transition-transform duration-500 group-hover:scale-[1.02]" style={{ willChange: 'transform' }}>
              <div className="absolute -inset-px rounded-xl md:rounded-2xl bg-gradient-to-br from-white/20 via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              {/* Static image (shown when not hovering or no video) */}
              <img 
                src={feature.image} 
                alt={feature.title}
                loading="lazy"
                decoding="async"
                className={`w-full h-full object-cover transition-opacity duration-500 ${
                  isHovering && feature.videoUrl ? 'opacity-0' : 'opacity-100'
                }`}
                style={{ willChange: 'transform' }}
              />
              
              {/* Hover video */}
              {feature.videoUrl && (
                <video
                  ref={videoRef}
                  src={feature.videoUrl}
                  muted
                  playsInline
                  loop
                  preload="none"
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
                    isHovering ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              )}
              
              {/* Overlays */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/30" />
              
              {/* Playing indicator */}
              {isHovering && feature.videoUrl && (
                <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/50 backdrop-blur-sm z-10">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[10px] text-white/70 font-medium">LIVE PREVIEW</span>
                </div>
              )}
            </div>
            
            {/* Corner accents */}
            <div className="absolute top-0 left-0 w-16 h-16 border-l border-t border-white/[0.08] rounded-tl-2xl" />
            <div className="absolute top-0 right-0 w-16 h-16 border-r border-t border-white/[0.08] rounded-tr-2xl" />
            
            {/* Icon Badge */}
            <div className="absolute top-6 left-6 z-20">
              <div className="relative">
                <div className="absolute inset-0 rounded-xl blur-lg opacity-50" style={{ background: feature.glowColor }} />
                <div className="relative p-3 rounded-xl bg-black/60 backdrop-blur-2xl border border-white/[0.15] shadow-2xl group-hover:border-white/[0.25] group-hover:bg-black/50 transition-all duration-300">
                  <div className="text-white/80 group-hover:text-white transition-colors">
                    {feature.icon}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Content area */}
          <div className="relative p-5 md:p-6">
            <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            
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
            
            {/* Highlight pills */}
            <div className="flex flex-wrap gap-2">
              {feature.highlights.map((highlight) => (
                <span 
                  key={highlight}
                  className="px-3 py-1.5 rounded-full text-[11px] md:text-xs font-medium bg-white/[0.03] border border-white/[0.08] text-white/50 group-hover:bg-white/[0.06] group-hover:border-white/[0.15] group-hover:text-white/70 transition-all duration-300"
                >
                  {highlight}
                </span>
              ))}
            </div>
          </div>
          
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />
        </div>
      </div>
      </motion.div>
    );
  }
));

// Memoized Additional Feature component
const AdditionalFeature = memo(forwardRef<HTMLDivElement, { feature: typeof ADDITIONAL_FEATURES[0]; index: number }>(
  function AdditionalFeature({ feature, index }, ref) {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.1 + index * 0.05 }}
        className="group relative"
      >
      <div className="absolute -inset-1 rounded-2xl bg-white/[0.03] opacity-0 group-hover:opacity-100 blur-lg transition-opacity duration-500" />
      
      <div className="relative flex items-center gap-3 p-4 md:p-5 rounded-xl md:rounded-2xl overflow-hidden transition-all duration-300">
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
    );
  }
));

const FeaturesShowcase = memo(forwardRef<HTMLElement, Record<string, never>>(
  function FeaturesShowcase(_, ref) {
    return (
      <section ref={ref} className="relative z-10 py-24 md:py-40 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInVariants}
            className="text-center mb-16 md:mb-24"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl mb-8">
              <Sparkles className="w-3.5 h-3.5 text-white/50" />
              <span className="text-xs text-white/50 tracking-widest uppercase">Professional Tools</span>
            </div>
            
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
            {FEATURES.map((feature, index) => (
              <FeatureCard key={feature.title} feature={feature} index={index} />
            ))}
          </div>

          {/* Additional Features */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInVariants}
            className="mt-12 md:mt-16"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              {ADDITIONAL_FEATURES.map((feature, i) => (
                <AdditionalFeature key={feature.title} feature={feature} index={i} />
              ))}
            </div>
          </motion.div>

          {/* CTA */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInVariants}
            className="mt-16 md:mt-24 text-center"
          >
            <Link 
              to="/auth?mode=signup"
              className="group relative inline-flex items-center gap-3 px-10 py-4 rounded-full text-sm font-semibold transition-all duration-300 overflow-hidden"
            >
              <div className="absolute -inset-1 rounded-full bg-white/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="absolute inset-0 rounded-full bg-white shadow-[0_0_60px_rgba(255,255,255,0.15)] group-hover:shadow-[0_0_80px_rgba(255,255,255,0.25)] transition-shadow duration-300" />
              <span className="relative text-black">Start Creating</span>
              <ArrowRight className="relative w-4 h-4 text-black transition-transform group-hover:translate-x-1" />
            </Link>
            <p className="mt-5 text-sm text-white/30">
              Free credits included • No credit card required
            </p>
          </motion.div>
        </div>
      </section>
    );
  }
));

export default FeaturesShowcase;
