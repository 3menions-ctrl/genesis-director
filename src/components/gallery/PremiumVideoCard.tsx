 import { forwardRef, useState, useRef, useEffect, useCallback, memo } from 'react';
 import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';
 import { Play, Film, Sparkles } from 'lucide-react';
 import { cn } from '@/lib/utils';
 import { safePlay, safePause, safeSeek, isSafeVideoNumber } from '@/lib/video/safeVideoOperations';

// Detect if we should reduce motion (iOS/reduced motion preference)
const shouldReduceMotion = () => {
  if (typeof window === 'undefined') return false;
  const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  return prefersReduced || isIOS;
};
 
 type VideoCategory = 'all' | 'text-to-video' | 'image-to-video' | 'avatar';
 
 interface GalleryVideo {
   id: string;
   title: string;
   thumbnail_url: string | null;
   video_url: string | null;
   all_clips?: string[];
   category?: VideoCategory;
 }
 
 interface PremiumVideoCardProps {
   video: GalleryVideo;
   isActive: boolean;
   onClick: () => void;
   index?: number;
 }
 
 // Category-specific accent colors
 const CATEGORY_ACCENTS = {
   'all': { gradient: 'from-blue-500 to-cyan-400', glow: 'rgba(59, 130, 246, 0.5)', border: 'rgba(59, 130, 246, 0.3)' },
   'text-to-video': { gradient: 'from-blue-500 to-blue-400', glow: 'rgba(59, 130, 246, 0.6)', border: 'rgba(59, 130, 246, 0.4)' },
   'image-to-video': { gradient: 'from-slate-400 to-slate-300', glow: 'rgba(148, 163, 184, 0.5)', border: 'rgba(148, 163, 184, 0.3)' },
   'avatar': { gradient: 'from-violet-500 to-fuchsia-400', glow: 'rgba(139, 92, 246, 0.6)', border: 'rgba(139, 92, 246, 0.4)' },
 };
 
 export const PremiumVideoCard = memo(forwardRef<HTMLDivElement, PremiumVideoCardProps>(function PremiumVideoCard(
   { video, isActive, onClick, index = 0 }, 
   ref
 ) {
   const cardRef = useRef<HTMLDivElement>(null);
   const [isHovered, setIsHovered] = useState(false);
   const [thumbnailReady, setThumbnailReady] = useState(false);
   const [borderRotation, setBorderRotation] = useState(0);
   const videoRef = useRef<HTMLVideoElement>(null);
   
   const category = video.category || 'all';
   const accent = CATEGORY_ACCENTS[category];
  const reduceMotion = shouldReduceMotion();
   
   // Merge refs
   const mergedRef = useCallback((node: HTMLDivElement | null) => {
     cardRef.current = node;
     if (ref) {
       if (typeof ref === 'function') ref(node);
       else (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
     }
   }, [ref]);
   
   // 3D tilt motion values
   const x = useMotionValue(0);
   const y = useMotionValue(0);
   const rotateX = useTransform(y, [-0.5, 0.5], [12, -12]);
   const rotateY = useTransform(x, [-0.5, 0.5], [-12, 12]);
   const springConfig = { stiffness: 400, damping: 35 };
   const springRotateX = useSpring(rotateX, springConfig);
   const springRotateY = useSpring(rotateY, springConfig);
   
   // Animated border rotation
   useEffect(() => {
    // Skip border rotation animation on iOS to prevent performance issues
    if (!isHovered || reduceMotion) return;
     const interval = setInterval(() => {
       setBorderRotation(prev => (prev + 1) % 360);
    }, 50); // Slower interval for better performance
     return () => clearInterval(interval);
  }, [isHovered, reduceMotion]);
   
   const handleMouseMove = (e: React.MouseEvent) => {
    // Skip 3D tilt on iOS
    if (reduceMotion) return;
     if (!cardRef.current) return;
     const rect = cardRef.current.getBoundingClientRect();
     const centerX = rect.left + rect.width / 2;
     const centerY = rect.top + rect.height / 2;
     x.set((e.clientX - centerX) / rect.width);
     y.set((e.clientY - centerY) / rect.height);
   };
   
   const handleMouseLeave = () => {
     x.set(0);
     y.set(0);
     setIsHovered(false);
   };
   
   const videoSrc = video.video_url || (video.all_clips && video.all_clips[0]) || null;
   
   // Initialize thumbnail
   useEffect(() => {
     const vid = videoRef.current;
     if (!vid || !videoSrc) return;
     
     let mounted = true;
     
     const initThumbnail = async () => {
       try {
         vid.src = videoSrc;
         vid.load();
         
         await new Promise<void>((resolve) => {
           vid.onloadedmetadata = () => resolve();
           setTimeout(() => resolve(), 3000);
         });
         
         if (!mounted) return;
         const targetTime = vid.duration && isFinite(vid.duration) ? Math.min(vid.duration * 0.1, 0.5) : 0;
         vid.currentTime = targetTime;
         
         await new Promise<void>((resolve) => {
           vid.onseeked = () => resolve();
           setTimeout(() => resolve(), 1000);
         });
         
         if (mounted) setThumbnailReady(true);
       } catch {
         if (mounted) setThumbnailReady(true);
       }
     };
     
     initThumbnail();
     return () => { mounted = false; };
   }, [videoSrc]);
   
   // Auto-play on hover
   useEffect(() => {
     const vid = videoRef.current;
     if (!vid || !videoSrc) return;
     
     if (isHovered) {
       vid.muted = true;
       const attemptPlay = () => {
         if (!videoRef.current) return;
         safePlay(videoRef.current);
       };
       
       if (vid.readyState >= 3) {
         attemptPlay();
       } else {
         const onCanPlay = () => {
           vid.removeEventListener('canplay', onCanPlay);
           attemptPlay();
         };
         vid.addEventListener('canplay', onCanPlay);
         if (vid.readyState === 0) vid.load();
       }
     } else {
       safePause(vid);
       const targetTime = isSafeVideoNumber(vid.duration) ? Math.min(vid.duration * 0.1, 0.5) : 0;
       safeSeek(vid, targetTime);
     }
   }, [isHovered, videoSrc]);
   
   // Fallback timeout
   useEffect(() => {
     if (thumbnailReady) return;
     const timeout = setTimeout(() => setThumbnailReady(true), 2500);
     return () => clearTimeout(timeout);
   }, [thumbnailReady]);
   
   return (
     <motion.div
       ref={mergedRef}
       className="relative cursor-pointer"
       style={{
         perspective: 1200,
         transformStyle: 'preserve-3d',
       }}
       onMouseMove={handleMouseMove}
       onMouseEnter={() => setIsHovered(true)}
       onMouseLeave={handleMouseLeave}
       onClick={onClick}
       initial={{ opacity: 0, scale: 0.85, y: 20 }}
       animate={{ 
         opacity: isActive ? 1 : 0.35, 
          scale: isActive ? 1 : (reduceMotion ? 0.9 : 0.8),
         y: 0,
       }}
        whileHover={reduceMotion ? {} : { scale: isActive ? 1.03 : 0.85 }}
       transition={{ 
         duration: 0.6,
         ease: [0.16, 1, 0.3, 1],
         delay: index * 0.05,
       }}
     >
       <motion.div
         className="relative w-[280px] h-[420px] md:w-[420px] md:h-[600px] rounded-2xl overflow-visible"
         style={{
            rotateX: reduceMotion ? 0 : springRotateX,
            rotateY: reduceMotion ? 0 : springRotateY,
           transformStyle: 'preserve-3d',
         }}
       >
         {/* Animated gradient border */}
          {!reduceMotion && <div 
           className={cn(
             "absolute -inset-[2px] rounded-2xl transition-opacity duration-500",
             isHovered ? "opacity-100" : "opacity-0"
           )}
           style={{
             background: `conic-gradient(from ${borderRotation}deg, ${accent.border}, ${accent.glow}, ${accent.border}, transparent, ${accent.border})`,
             filter: 'blur(1px)',
           }}
          />}
         
         {/* Outer glow effect */}
          {!reduceMotion && <div 
           className={cn(
             "absolute -inset-4 rounded-3xl blur-2xl transition-all duration-700",
             isHovered ? "opacity-70" : "opacity-0"
           )}
           style={{ 
             background: `radial-gradient(ellipse at center, ${accent.glow} 0%, transparent 70%)`,
           }}
          />}
         
         {/* Holographic shine layer */}
          {!reduceMotion && <div 
           className={cn(
             "absolute inset-0 rounded-2xl pointer-events-none z-10 transition-opacity duration-300",
             isHovered ? "opacity-100" : "opacity-0"
           )}
           style={{
             background: `linear-gradient(
               ${105 + (borderRotation * 0.5)}deg, 
               transparent 0%,
               rgba(255, 255, 255, 0.03) 25%,
               rgba(255, 255, 255, 0.08) 50%,
               rgba(255, 255, 255, 0.03) 75%,
               transparent 100%
             )`,
           }}
          />}
         
         {/* Main card container with glassmorphism */}
         <div className="relative w-full h-full rounded-2xl overflow-hidden bg-zinc-950/80 backdrop-blur-sm border border-white/[0.08]">
           {/* Corner accent decorations */}
           <div className="absolute top-0 left-0 w-16 h-16 pointer-events-none z-20">
             <div className={cn("absolute top-0 left-0 w-8 h-[2px] rounded-full bg-gradient-to-r", accent.gradient, "opacity-60")} />
             <div className={cn("absolute top-0 left-0 h-8 w-[2px] rounded-full bg-gradient-to-b", accent.gradient, "opacity-60")} />
           </div>
           <div className="absolute bottom-0 right-0 w-16 h-16 pointer-events-none z-20">
             <div className={cn("absolute bottom-0 right-0 w-8 h-[2px] rounded-full bg-gradient-to-l", accent.gradient, "opacity-60")} />
             <div className={cn("absolute bottom-0 right-0 h-8 w-[2px] rounded-full bg-gradient-to-t", accent.gradient, "opacity-60")} />
           </div>
           
           {/* Video content */}
           {videoSrc ? (
             <>
               <video
                 ref={videoRef}
                 src={videoSrc}
                 className={cn(
                   "w-full h-full object-cover transition-all duration-700",
                   !thumbnailReady && "opacity-0",
                   isHovered && "scale-105"
                 )}
                 muted
                 playsInline
                 loop
                 preload="auto"
                 onError={(e) => {
                   e.preventDefault?.();
                   e.stopPropagation?.();
                 }}
               />
               
               {/* Premium loading shimmer */}
               {!thumbnailReady && (
                 <div className="absolute inset-0 bg-zinc-900 overflow-hidden">
                   <div className="absolute inset-0 animate-shimmer" 
                     style={{
                       background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)',
                       backgroundSize: '200% 100%',
                     }}
                   />
                   <div className="absolute inset-0 flex items-center justify-center">
                     <div className={cn("w-8 h-8 border-2 border-zinc-800 rounded-full animate-spin", `border-t-${accent.gradient.split('-')[1]}-400`)} />
                   </div>
                 </div>
               )}
             </>
           ) : (
             <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-950">
               <Film className="w-14 h-14 text-zinc-700" />
             </div>
           )}
           
           {/* Premium play button overlay */}
           <motion.div 
             className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-[2px] z-10"
             initial={{ opacity: 0 }}
             animate={{ opacity: isHovered ? 1 : 0 }}
           >
             <motion.div
               className="relative"
               initial={{ scale: 0.5 }}
               animate={{ scale: isHovered ? 1 : 0.5 }}
               transition={{ type: 'spring', stiffness: 400, damping: 25 }}
             >
               {/* Pulse rings */}
                {!reduceMotion && <motion.div
                 className="absolute inset-0 rounded-full"
                 style={{ border: `2px solid ${accent.glow}` }}
                 animate={{ scale: [1, 1.5, 1.5], opacity: [0.6, 0, 0] }}
                 transition={{ duration: 1.5, repeat: Infinity }}
                />}
                {!reduceMotion && <motion.div
                 className="absolute inset-0 rounded-full"
                 style={{ border: `2px solid ${accent.glow}` }}
                 animate={{ scale: [1, 1.8, 1.8], opacity: [0.4, 0, 0] }}
                 transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
                />}
               
               {/* Main button */}
               <div 
                 className={cn(
                   "w-20 h-20 rounded-full flex items-center justify-center",
                   "bg-white/10 backdrop-blur-xl border border-white/30"
                 )}
                 style={{
                   boxShadow: `0 0 40px ${accent.glow}, inset 0 0 20px rgba(255,255,255,0.1)`,
                 }}
               >
                 <Play className="w-8 h-8 text-white fill-white/80 ml-1" />
               </div>
             </motion.div>
           </motion.div>
           
           {/* Category badge */}
           {video.category && video.category !== 'all' && (
             <div className="absolute top-4 left-4 z-20">
               <div className={cn(
                 "px-3 py-1.5 rounded-full text-xs font-medium",
                 "bg-black/40 backdrop-blur-xl border border-white/10",
                 "flex items-center gap-1.5"
               )}>
                 <Sparkles className="w-3 h-3 text-white/60" />
                 <span className="text-white/80">
                   {video.category === 'text-to-video' ? 'Text → Video' : 
                    video.category === 'image-to-video' ? 'Image → Video' : 'Avatar'}
                 </span>
               </div>
             </div>
           )}
           
           {/* Bottom gradient for title */}
           <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none z-10" />
           
           {/* Video title */}
           {video.title && (
             <div className="absolute bottom-4 left-4 right-4 z-20">
               <h3 className="text-white/90 font-medium text-lg truncate">{video.title}</h3>
             </div>
           )}
           
           {/* Reflection layer */}
           <div 
             className="absolute inset-0 pointer-events-none z-5"
             style={{
               background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 40%, transparent 60%, rgba(255,255,255,0.02) 100%)',
             }}
           />
         </div>
       </motion.div>
       
       {/* CSS for shimmer animation */}
       <style>{`
         @keyframes shimmer {
           0% { background-position: -200% 0; }
           100% { background-position: 200% 0; }
         }
         .animate-shimmer {
           animation: shimmer 2s infinite linear;
         }
       `}</style>
     </motion.div>
   );
 }));
 
 export default PremiumVideoCard;