import { memo, useMemo, forwardRef, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
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
  Sparkles,
  Globe,
  Clock,
  Shield,
  Clapperboard
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
  videoUrl?: string;
  icon: React.ReactNode;
  highlights: string[];
  accentColor: string;
  glowColor: string;
}

const FEATURES: Feature[] = [
  {
    title: 'Text to Video',
    subtitle: 'Describe it. Watch it come alive.',
    description: 'Type a prompt and get a fully produced cinematic film — complete with scenes, transitions, and professional pacing. No editing required.',
    image: textToVideoPremium,
    videoUrl: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_099597a1-0cbf-4d71-b000-7d140ab896d1_1768171376851.mp4',
    icon: <Type className="w-5 h-5" />,
    highlights: ['Multi-Scene Films', 'Auto Script & Storyboard', 'Cinematic Transitions'],
    accentColor: 'from-blue-400 to-cyan-300',
    glowColor: 'rgba(56, 189, 248, 0.4)',
  },
  {
    title: 'Image to Video',
    subtitle: 'One photo. Infinite motion.',
    description: 'Upload any image and our AI generates fluid, physics-accurate motion with camera movement and depth. Ideal for product reveals and art.',
    image: imageToVideoPremium,
    videoUrl: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_dc255261-7bc3-465f-a9ec-ef2acd47b4fb_1768124786072.mp4',
    icon: <Image className="w-5 h-5" />,
    highlights: ['Parallax Depth', 'Camera Choreography', 'Style Preservation'],
    accentColor: 'from-slate-200 to-zinc-400',
    glowColor: 'rgba(148, 163, 184, 0.4)',
  },
  {
    title: 'Character Lock',
    subtitle: 'Same face. Every scene.',
    description: 'Lock a character\'s identity across your entire film. Face, wardrobe, proportions — perfectly consistent from scene one to the finale.',
    image: characterLockPremium,
    videoUrl: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_7434c756-78d3-4f68-8107-b205930027c4_1768120634478.mp4',
    icon: <UserCheck className="w-5 h-5" />,
    highlights: ['Identity Persistence', 'Multi-Angle Consistency', 'Wardrobe Lock'],
    accentColor: 'from-white to-slate-300',
    glowColor: 'rgba(255, 255, 255, 0.3)',
  },
  {
    title: 'AI Avatars',
    subtitle: 'Your digital presenter.',
    description: 'Create photorealistic talking avatars with synchronized lip movements. Choose from 50+ voices and languages for professional narration.',
    image: voiceoverPremium,
    videoUrl: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/avatar-videos/fc34967d-0fcc-4863-829e-29d2dee5e514/avatar_fc34967d-0fcc-4863-829e-29d2dee5e514_clip1_lipsync_1770421330974.mp4',
    icon: <Mic className="w-5 h-5" />,
    highlights: ['50+ Voices', 'Precision Lip-Sync', 'Multi-Language'],
    accentColor: 'from-cyan-400 to-teal-300',
    glowColor: 'rgba(6, 182, 212, 0.4)',
  },
  {
    title: 'AI Soundtrack',
    subtitle: 'Music that feels the scene.',
    description: 'Generate original, royalty-free scores that adapt to the mood and pacing of every shot. From orchestral swells to ambient textures.',
    image: musicPremium,
    videoUrl: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_1b0ac63f-643a-4d43-b8ed-44b8083257ed_1768157346652.mp4',
    icon: <Music className="w-5 h-5" />,
    highlights: ['Scene-Aware', 'Any Genre', 'Royalty-Free'],
    accentColor: 'from-amber-300 to-orange-400',
    glowColor: 'rgba(245, 158, 11, 0.4)',
  },
  {
    title: 'Style Transfer',
    subtitle: 'Any look. Any world.',
    description: 'Apply cinematic presets or define your own visual language. From hyperrealistic to anime, noir to Wes Anderson — your vision, amplified.',
    image: styleTransferPremium,
    videoUrl: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/gallery/Beautiful_Day_Vibes-final.mp4',
    icon: <Palette className="w-5 h-5" />,
    highlights: ['20+ Cinema Presets', 'Custom Color Grading', 'Visual Consistency'],
    accentColor: 'from-violet-400 to-purple-400',
    glowColor: 'rgba(139, 92, 246, 0.4)',
  },
];

const ADDITIONAL_FEATURES = [
  { icon: <Wand2 className="w-4 h-4" />, title: 'Smart Screenplay', desc: 'AI writes & structures your story' },
  { icon: <Layers className="w-4 h-4" />, title: 'Scene Composer', desc: 'Visual shot-by-shot breakdown' },
  { icon: <Zap className="w-4 h-4" />, title: 'Auto Assembly', desc: 'One-click seamless stitching' },
  { icon: <Film className="w-4 h-4" />, title: 'HLS Streaming', desc: 'Gapless cinema-grade playback' },
  { icon: <Globe className="w-4 h-4" />, title: 'Genesis Universe', desc: 'Shared cinematic world-building' },
  { icon: <Clock className="w-4 h-4" />, title: 'Pipeline Engine', desc: 'Real-time generation progress' },
  { icon: <Shield className="w-4 h-4" />, title: 'Credit System', desc: 'Pay only for what you create' },
  { icon: <Clapperboard className="w-4 h-4" />, title: 'Video Editor', desc: 'Timeline-based post-production' },
];

// Memoized Feature Card with hover-play video
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
      <div
        ref={ref}
        className={`group relative ${isWide ? 'lg:col-span-2' : ''} animate-fade-in`}
        style={{ animationDelay: `${index * 80}ms`, willChange: 'opacity, transform' }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Ambient glow on hover */}
        <div 
          className="absolute -inset-4 rounded-[2.5rem] opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-3xl pointer-events-none"
          style={{ background: `radial-gradient(ellipse at center, ${feature.glowColor} 0%, transparent 70%)` }}
        />
        
        {/* Card */}
        <div className="relative h-full rounded-2xl md:rounded-3xl overflow-hidden transition-transform duration-500 group-hover:-translate-y-1" style={{ willChange: 'transform' }}>
          {/* Gradient border */}
          <div className="absolute inset-0 rounded-2xl md:rounded-3xl p-px bg-gradient-to-br from-white/[0.12] via-white/[0.04] to-white/[0.01] group-hover:from-white/[0.22] group-hover:via-white/[0.08] group-hover:to-white/[0.04] transition-all duration-500">
            <div className="absolute inset-px rounded-[calc(1.5rem-1px)] bg-gradient-to-br from-[#0d1117] via-[#0a0e16] to-[#080c14]" />
          </div>
          
          {/* Content */}
          <div className="relative h-full rounded-2xl md:rounded-3xl overflow-hidden">
            {/* Image/Video area */}
            <div className={`relative overflow-hidden ${isWide ? 'aspect-[2.4/1]' : 'aspect-[16/10]'}`}>
              <div className="absolute inset-3 md:inset-4 rounded-xl md:rounded-2xl overflow-hidden shadow-2xl transition-transform duration-500 group-hover:scale-[1.02]" style={{ willChange: 'transform' }}>
                {/* Hover border glow */}
                <div className="absolute -inset-px rounded-xl md:rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: `linear-gradient(135deg, ${feature.glowColor}, transparent 60%)` }} />
                
                {/* Static image */}
                <img 
                  src={feature.image} 
                  alt={feature.title}
                  loading="lazy"
                  decoding="async"
                  className={`w-full h-full object-cover transition-opacity duration-500 ${
                    isHovering && feature.videoUrl ? 'opacity-0' : 'opacity-100'
                  }`}
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
                
                {/* Gradient overlays */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e16]/80 via-[#0a0e16]/20 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-[#0a0e16]/40" />
                
                {/* Live preview badge */}
                {isHovering && feature.videoUrl && (
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 z-10">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] text-white/80 font-medium tracking-wider uppercase">Live Preview</span>
                  </div>
                )}
              </div>
              
              {/* Corner accents */}
              <div className="absolute top-0 left-0 w-16 h-16 border-l border-t border-white/[0.06] rounded-tl-2xl md:rounded-tl-3xl" />
              <div className="absolute top-0 right-0 w-16 h-16 border-r border-t border-white/[0.06] rounded-tr-2xl md:rounded-tr-3xl" />
              
              {/* Icon */}
              <div className="absolute top-6 left-6 z-20">
                <div className="relative">
                  <div className="absolute inset-0 rounded-xl blur-xl opacity-40" style={{ background: feature.glowColor }} />
                  <div className="relative p-3 rounded-xl bg-black/70 backdrop-blur-2xl border border-white/[0.12] shadow-2xl group-hover:border-white/[0.2] group-hover:bg-black/50 transition-all duration-300">
                    <div className="text-white/70 group-hover:text-white transition-colors">
                      {feature.icon}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Text content */}
            <div className="relative p-5 md:p-7">
              <div className="absolute top-0 left-7 right-7 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
              
              <div className="mb-4">
                <span className={`text-[10px] md:text-xs font-semibold uppercase tracking-[0.25em] mb-2 block bg-gradient-to-r ${feature.accentColor} bg-clip-text text-transparent opacity-60 group-hover:opacity-100 transition-opacity`}>
                  {feature.subtitle}
                </span>
                <h3 className="text-xl md:text-2xl font-semibold text-white/90 group-hover:text-white transition-colors tracking-tight">
                  {feature.title}
                </h3>
              </div>
              
              <p className="text-sm md:text-[15px] text-white/35 leading-relaxed mb-5 group-hover:text-white/55 transition-colors">
                {feature.description}
              </p>
              
              {/* Highlight pills */}
              <div className="flex flex-wrap gap-2">
                {feature.highlights.map((highlight) => (
                  <span 
                    key={highlight}
                    className="px-3 py-1.5 rounded-full text-[11px] md:text-xs font-medium bg-white/[0.03] border border-white/[0.06] text-white/45 group-hover:bg-white/[0.06] group-hover:border-white/[0.12] group-hover:text-white/70 transition-all duration-300"
                  >
                    {highlight}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
));

// Additional Feature pill
const AdditionalFeature = memo(forwardRef<HTMLDivElement, { feature: typeof ADDITIONAL_FEATURES[0]; index: number }>(
  function AdditionalFeature({ feature, index }, ref) {
    return (
      <div
        ref={ref}
        className="group relative animate-fade-in"
        style={{ animationDelay: `${100 + index * 60}ms` }}
      >
        <div className="absolute -inset-1 rounded-2xl bg-white/[0.02] opacity-0 group-hover:opacity-100 blur-lg transition-opacity duration-500" />
        
        <div className="relative flex items-center gap-3.5 p-4 md:p-5 rounded-xl md:rounded-2xl overflow-hidden transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.025] to-white/[0.008] border border-white/[0.05] rounded-xl md:rounded-2xl group-hover:from-white/[0.05] group-hover:to-white/[0.015] group-hover:border-white/[0.1] transition-all duration-300" />
          
          <div className="relative w-10 h-10 rounded-xl bg-white/[0.03] flex items-center justify-center shrink-0 border border-white/[0.06] group-hover:bg-white/[0.07] group-hover:border-white/[0.12] transition-all">
            <div className="text-white/40 group-hover:text-white/75 transition-colors">
              {feature.icon}
            </div>
          </div>
          <div className="relative min-w-0">
            <h4 className="text-sm font-medium text-white/85 truncate group-hover:text-white transition-colors">{feature.title}</h4>
            <p className="text-xs text-white/30 truncate group-hover:text-white/50 transition-colors">{feature.desc}</p>
          </div>
        </div>
      </div>
    );
  }
));

const FeaturesShowcase = memo(forwardRef<HTMLElement, Record<string, never>>(
  function FeaturesShowcase(_, ref) {
    return (
      <section ref={ref} className="relative z-10 py-28 md:py-44 px-6">
        {/* Subtle section divider glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
        
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-20 md:mb-28 animate-fade-in">
            <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-white/[0.025] border border-white/[0.06] backdrop-blur-xl mb-8">
              <Sparkles className="w-3.5 h-3.5 text-white/40" />
              <span className="text-[11px] text-white/40 tracking-[0.2em] uppercase font-medium">Production Suite</span>
            </div>
            
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white mb-7 leading-[1.05]">
              Built for creators<span className="text-white/20">.</span>
            </h2>
            <p className="text-lg md:text-xl text-white/35 max-w-2xl mx-auto leading-relaxed">
              A complete AI film studio in your browser. Write, generate, edit, 
              and publish — from first idea to final cut.
            </p>

            {/* Stats row */}
            <div className="flex items-center justify-center gap-8 md:gap-14 mt-12">
              {[
                { value: '6', label: 'Core Tools' },
                { value: '50+', label: 'AI Voices' },
                { value: '20+', label: 'Style Presets' },
                { value: '4K', label: 'Output Quality' },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-white/90 tracking-tight">{stat.value}</div>
                  <div className="text-[10px] md:text-xs text-white/25 mt-1 tracking-wider uppercase">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
            {FEATURES.map((feature, index) => (
              <FeatureCard key={feature.title} feature={feature} index={index} />
            ))}
          </div>

          {/* Additional Features — 2 rows of 4 */}
          <div className="mt-14 md:mt-20">
            <div className="text-center mb-8">
              <p className="text-xs text-white/25 tracking-[0.2em] uppercase font-medium">And everything else you need</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              {ADDITIONAL_FEATURES.map((feature, i) => (
                <AdditionalFeature key={feature.title} feature={feature} index={i} />
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="mt-20 md:mt-28 text-center animate-fade-in">
            <Link 
              to="/auth?mode=signup"
              className="group relative inline-flex items-center gap-3 px-12 py-4.5 rounded-full text-sm font-semibold transition-all duration-300 overflow-hidden"
            >
              <div className="absolute -inset-1 rounded-full bg-white/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="absolute inset-0 rounded-full bg-white shadow-[0_0_60px_rgba(255,255,255,0.1)] group-hover:shadow-[0_0_80px_rgba(255,255,255,0.2)] transition-shadow duration-300" />
              <span className="relative text-black font-semibold">Start Creating Free</span>
              <ArrowRight className="relative w-4 h-4 text-black transition-transform group-hover:translate-x-1" />
            </Link>
            <p className="mt-5 text-sm text-white/25">
              60 free credits • No credit card • Cancel anytime
            </p>
          </div>
        </div>
      </section>
    );
  }
));

export default FeaturesShowcase;
