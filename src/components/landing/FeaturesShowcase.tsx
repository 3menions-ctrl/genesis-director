import { memo, useRef, useState, useCallback, forwardRef } from 'react';
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
  Clapperboard,
  Play
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
  gradientBorder: string;
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
    glowColor: 'rgba(56, 189, 248, 0.35)',
    gradientBorder: 'from-blue-500/30 via-cyan-400/10 to-blue-600/20',
  },
  {
    title: 'Image to Video',
    subtitle: 'One photo. Infinite motion.',
    description: 'Upload any image and our AI generates fluid, physics-accurate motion with camera movement and depth. Ideal for product reveals and art.',
    image: imageToVideoPremium,
    videoUrl: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_dc255261-7bc3-465f-a9ec-ef2acd47b4fb_1768124786072.mp4',
    icon: <Image className="w-5 h-5" />,
    highlights: ['Parallax Depth', 'Camera Choreography', 'Style Preservation'],
    accentColor: 'from-amber-300 to-orange-300',
    glowColor: 'rgba(251, 191, 36, 0.3)',
    gradientBorder: 'from-amber-400/25 via-orange-300/10 to-amber-500/15',
  },
  {
    title: 'Character Lock',
    subtitle: 'Same face. Every scene.',
    description: 'Lock a character\'s identity across your entire film. Face, wardrobe, proportions — perfectly consistent from scene one to the finale.',
    image: characterLockPremium,
    videoUrl: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/final-videos/stitched_7434c756-78d3-4f68-8107-b205930027c4_1768120634478.mp4',
    icon: <UserCheck className="w-5 h-5" />,
    highlights: ['Identity Persistence', 'Multi-Angle Consistency', 'Wardrobe Lock'],
    accentColor: 'from-cyan-300 to-teal-300',
    glowColor: 'rgba(103, 232, 249, 0.25)',
    gradientBorder: 'from-cyan-400/25 via-teal-300/10 to-cyan-500/15',
  },
  {
    title: 'AI Avatars',
    subtitle: 'Your digital presenter.',
    description: 'Create photorealistic talking avatars with synchronized lip movements. Choose from 50+ voices and languages for professional narration.',
    image: voiceoverPremium,
    videoUrl: 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/avatar-videos/fc34967d-0fcc-4863-829e-29d2dee5e514/avatar_fc34967d-0fcc-4863-829e-29d2dee5e514_clip1_lipsync_1770421330974.mp4',
    icon: <Mic className="w-5 h-5" />,
    highlights: ['50+ Voices', 'Precision Lip-Sync', 'Multi-Language'],
    accentColor: 'from-emerald-400 to-teal-300',
    glowColor: 'rgba(52, 211, 153, 0.3)',
    gradientBorder: 'from-emerald-400/25 via-teal-300/10 to-emerald-500/15',
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
    glowColor: 'rgba(245, 158, 11, 0.35)',
    gradientBorder: 'from-amber-400/30 via-orange-400/10 to-amber-500/20',
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
    glowColor: 'rgba(139, 92, 246, 0.35)',
    gradientBorder: 'from-violet-500/30 via-purple-400/10 to-violet-600/20',
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

// Memoized Feature Card
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
        style={{ animationDelay: `${index * 100}ms`, willChange: 'opacity, transform' }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Deep ambient glow */}
        <div 
          className="absolute -inset-6 rounded-[3rem] opacity-0 group-hover:opacity-100 transition-opacity duration-1000 blur-3xl pointer-events-none"
          style={{ background: `radial-gradient(ellipse at center, ${feature.glowColor} 0%, transparent 70%)` }}
        />
        
        {/* Card shell */}
        <div className="relative h-full rounded-2xl md:rounded-3xl overflow-hidden transition-all duration-700 group-hover:-translate-y-1.5 group-hover:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]" style={{ willChange: 'transform' }}>
          
          {/* Animated gradient border */}
          <div className={`absolute -inset-px rounded-2xl md:rounded-3xl bg-gradient-to-br ${feature.gradientBorder} opacity-60 group-hover:opacity-100 transition-opacity duration-700`} />
          
          {/* Inner glass surface */}
          <div className="absolute inset-px rounded-[calc(1rem-1px)] md:rounded-[calc(1.5rem-1px)] bg-gradient-to-br from-[#0c1018] via-[#080d15] to-[#060a12] backdrop-blur-xl" />
          
          {/* Subtle inner light streak */}
          <div className="absolute inset-px rounded-[calc(1rem-1px)] md:rounded-[calc(1.5rem-1px)] overflow-hidden pointer-events-none">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.1] to-transparent" />
            <div className="absolute top-0 left-0 bottom-0 w-px bg-gradient-to-b from-white/[0.08] via-transparent to-transparent" />
          </div>
          
          {/* Content */}
          <div className="relative h-full rounded-2xl md:rounded-3xl overflow-hidden">
            {/* Image/Video area */}
            <div className={`relative overflow-hidden ${isWide ? 'aspect-[2.4/1]' : 'aspect-[16/10]'}`}>
              <div className="absolute inset-3 md:inset-4 rounded-xl md:rounded-2xl overflow-hidden transition-all duration-700 group-hover:scale-[1.03] group-hover:shadow-[0_0_40px_rgba(0,0,0,0.5)]" style={{ willChange: 'transform' }}>
                
                {/* Static image */}
                <img 
                  src={feature.image} 
                  alt={feature.title}
                  loading="lazy"
                  decoding="async"
                  className={`w-full h-full object-cover transition-all duration-700 ${
                    isHovering && feature.videoUrl ? 'opacity-0 scale-105' : 'opacity-100 scale-100'
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
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
                      isHovering ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                )}
                
                {/* Cinematic gradient overlays */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#080d15] via-[#080d15]/30 to-transparent opacity-90" />
                <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-[#080d15]/50" />
                
                {/* Vignette */}
                <div className="absolute inset-0 shadow-[inset_0_0_60px_rgba(0,0,0,0.4)]" />
                
                {/* Play indicator on hover */}
                {isHovering && feature.videoUrl && (
                  <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/50 backdrop-blur-md border border-white/10 animate-fade-in">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[10px] text-white/70 font-medium tracking-[0.15em] uppercase">Live Preview</span>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Floating icon badge */}
              <div className="absolute top-5 left-5 z-20">
                <div className="relative">
                  <div className="absolute -inset-2 rounded-2xl blur-xl opacity-0 group-hover:opacity-50 transition-opacity duration-700" style={{ background: feature.glowColor }} />
                  <div className="relative p-3 rounded-xl bg-black/60 backdrop-blur-2xl border border-white/[0.08] shadow-2xl group-hover:border-white/[0.15] group-hover:bg-black/40 transition-all duration-500">
                    <div className="text-white/50 group-hover:text-white transition-colors duration-500">
                      {feature.icon}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Text content */}
            <div className="relative p-5 md:p-7 pt-4 md:pt-5">
              {/* Separator line */}
              <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
              
              <div className="mb-4">
                <span className={`text-[10px] md:text-[11px] font-semibold uppercase tracking-[0.3em] mb-2.5 block bg-gradient-to-r ${feature.accentColor} bg-clip-text text-transparent opacity-50 group-hover:opacity-90 transition-opacity duration-500`}>
                  {feature.subtitle}
                </span>
                <h3 className="text-xl md:text-2xl font-bold text-white/85 group-hover:text-white transition-colors duration-500 tracking-tight leading-tight">
                  {feature.title}
                </h3>
              </div>
              
              <p className="text-sm md:text-[14px] text-white/30 leading-[1.7] mb-5 group-hover:text-white/50 transition-colors duration-500">
                {feature.description}
              </p>
              
              {/* Highlight pills */}
              <div className="flex flex-wrap gap-2">
                {feature.highlights.map((highlight) => (
                  <span 
                    key={highlight}
                    className="px-3 py-1.5 rounded-lg text-[10px] md:text-[11px] font-medium bg-white/[0.03] border border-white/[0.05] text-white/35 group-hover:bg-white/[0.06] group-hover:border-white/[0.1] group-hover:text-white/65 transition-all duration-500"
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
        <div className="relative flex items-center gap-3.5 p-4 md:p-5 rounded-xl md:rounded-2xl overflow-hidden transition-all duration-500 border border-white/[0.04] hover:border-white/[0.1] bg-gradient-to-br from-white/[0.02] to-transparent hover:from-white/[0.04] hover:to-white/[0.01]">
          <div className="relative w-10 h-10 rounded-xl bg-white/[0.03] flex items-center justify-center shrink-0 border border-white/[0.06] group-hover:bg-white/[0.07] group-hover:border-white/[0.12] transition-all duration-500">
            <div className="text-white/35 group-hover:text-white/70 transition-colors duration-500">
              {feature.icon}
            </div>
          </div>
          <div className="relative min-w-0">
            <h4 className="text-sm font-medium text-white/80 truncate group-hover:text-white transition-colors duration-500">{feature.title}</h4>
            <p className="text-xs text-white/25 truncate group-hover:text-white/45 transition-colors duration-500">{feature.desc}</p>
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
        {/* Section divider */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
        
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-20 md:mb-28 animate-fade-in">
            <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-white/[0.02] border border-white/[0.05] backdrop-blur-xl mb-8">
              <Sparkles className="w-3.5 h-3.5 text-white/30" />
              <span className="text-[11px] text-white/35 tracking-[0.25em] uppercase font-medium">Production Suite</span>
            </div>
            
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white mb-7 leading-[1.05]">
              Built for creators<span className="text-white/15">.</span>
            </h2>
            <p className="text-lg md:text-xl text-white/30 max-w-2xl mx-auto leading-relaxed">
              A complete AI film studio in your browser. Write, generate, edit, 
              and publish — from first idea to final cut.
            </p>

            {/* Stats row */}
            <div className="flex items-center justify-center gap-8 md:gap-14 mt-14">
              {[
                { value: '6', label: 'Core Tools' },
                { value: '50+', label: 'AI Voices' },
                { value: '20+', label: 'Style Presets' },
                { value: '4K', label: 'Output Quality' },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-white/85 tracking-tight">{stat.value}</div>
                  <div className="text-[10px] md:text-xs text-white/20 mt-1.5 tracking-[0.15em] uppercase">{stat.label}</div>
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

          {/* Additional Features */}
          <div className="mt-16 md:mt-24">
            <div className="text-center mb-10">
              <p className="text-xs text-white/20 tracking-[0.25em] uppercase font-medium">And everything else you need</p>
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
              <div className="absolute inset-0 rounded-full bg-white shadow-[0_0_60px_rgba(255,255,255,0.08)] group-hover:shadow-[0_0_80px_rgba(255,255,255,0.15)] transition-shadow duration-300" />
              <span className="relative text-black font-semibold">Start Creating Free</span>
              <ArrowRight className="relative w-4 h-4 text-black transition-transform group-hover:translate-x-1" />
            </Link>
            <p className="mt-5 text-sm text-white/20">
              Affordable credits • No subscription • Pay as you go
            </p>
          </div>
        </div>
      </section>
    );
  }
));

export default FeaturesShowcase;
