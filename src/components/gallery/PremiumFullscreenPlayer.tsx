 import { memo, useState, useRef, useEffect, useCallback } from 'react';
 import { motion, AnimatePresence } from 'framer-motion';
 import { Play, Pause, Volume2, VolumeX, X, SkipForward, SkipBack, Maximize2, Minimize2 } from 'lucide-react';
 import { cn } from '@/lib/utils';
 
 interface GalleryVideo {
   id: string;
   title: string;
   thumbnail_url: string | null;
   video_url: string | null;
   all_clips?: string[];
   category?: string;
 }
 
 interface PremiumFullscreenPlayerProps {
   video: GalleryVideo;
   onClose: () => void;
 }
 
 export const PremiumFullscreenPlayer = memo(function PremiumFullscreenPlayer({ 
   video, 
   onClose 
 }: PremiumFullscreenPlayerProps) {
   const [isMuted, setIsMuted] = useState(true);
   const [isPlaying, setIsPlaying] = useState(false);
   const [hasError, setHasError] = useState(false);
   const [currentClipIndex, setCurrentClipIndex] = useState(0);
   const [progress, setProgress] = useState(0);
   const [showControls, setShowControls] = useState(true);
   const [isFullscreen, setIsFullscreen] = useState(false);
   
   const containerRef = useRef<HTMLDivElement>(null);
   const videoARef = useRef<HTMLVideoElement>(null);
   const videoBRef = useRef<HTMLVideoElement>(null);
   const [activeVideo, setActiveVideo] = useState<'A' | 'B'>('A');
   const isTransitioningRef = useRef(false);
   const triggerTransitionRef = useRef<() => void>(() => {});
   const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
   
   const clips = video.all_clips && video.all_clips.length > 0 
     ? video.all_clips 
     : video.video_url ? [video.video_url] : [];
   
   const totalClips = clips.length;
  
  // MEMORY FIX: Cleanup controls timeout on unmount
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = null;
      }
    };
  }, []);
   
   const getActiveVideoRef = useCallback(() => {
     return activeVideo === 'A' ? videoARef : videoBRef;
   }, [activeVideo]);
   
   const getInactiveVideoRef = useCallback(() => {
     return activeVideo === 'A' ? videoBRef : videoARef;
   }, [activeVideo]);
   
   // Auto-hide controls
   const resetControlsTimeout = useCallback(() => {
     setShowControls(true);
     if (controlsTimeoutRef.current) {
       clearTimeout(controlsTimeoutRef.current);
     }
     controlsTimeoutRef.current = setTimeout(() => {
       if (isPlaying) setShowControls(false);
     }, 3000);
   }, [isPlaying]);
   
   const triggerTransition = useCallback(() => {
     if (isTransitioningRef.current || totalClips <= 1) return;
     isTransitioningRef.current = true;
     
     const nextIndex = (currentClipIndex + 1) % totalClips;
     const inactiveVideo = getInactiveVideoRef().current;
     const activeVideoEl = getActiveVideoRef().current;
     
     if (!inactiveVideo || !activeVideoEl) {
       isTransitioningRef.current = false;
       return;
     }
     
     inactiveVideo.currentTime = 0;
     inactiveVideo.muted = isMuted;
     inactiveVideo.play().catch(() => {});
     
     requestAnimationFrame(() => {
       requestAnimationFrame(() => {
         setActiveVideo(prev => prev === 'A' ? 'B' : 'A');
         setCurrentClipIndex(nextIndex);
         activeVideoEl.pause();
         isTransitioningRef.current = false;
         
         setTimeout(() => {
           const newNextIndex = (nextIndex + 1) % totalClips;
           const newInactiveVideo = activeVideoEl;
           if (newInactiveVideo && clips[newNextIndex]) {
             newInactiveVideo.src = clips[newNextIndex];
             newInactiveVideo.load();
             newInactiveVideo.muted = true;
           }
         }, 100);
       });
     });
   }, [totalClips, currentClipIndex, clips, getInactiveVideoRef, getActiveVideoRef, isMuted]);
   
   useEffect(() => {
     triggerTransitionRef.current = triggerTransition;
   }, [triggerTransition]);
   
   const handleTimeUpdate = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
     const vid = e.currentTarget;
     if (!vid.duration || isTransitioningRef.current) return;
     
     // Update progress
     setProgress((vid.currentTime / vid.duration) * 100);
     
     if (vid.currentTime >= vid.duration - 0.05) {
       triggerTransitionRef.current();
     }
   }, []);
   
   const handleClipEnded = useCallback(() => {
     if (!isTransitioningRef.current) {
       triggerTransitionRef.current();
     }
   }, []);
   
   // Start playback
   useEffect(() => {
     const startPlayback = async () => {
       const videoA = videoARef.current;
       const videoB = videoBRef.current;
       
       if (videoA && clips.length > 0) {
         videoA.src = clips[0];
         videoA.load();
         
         try {
           await videoA.play();
           setIsPlaying(true);
           
           if (videoB && clips.length > 1) {
             videoB.src = clips[1];
             videoB.load();
             videoB.muted = true;
           }
         } catch (err) {
           console.warn('Autoplay failed:', err);
         }
       }
     };
     startPlayback();
   }, [clips]);
   
   // Sync mute state
   useEffect(() => {
     if (videoARef.current) videoARef.current.muted = isMuted;
     if (videoBRef.current) videoBRef.current.muted = isMuted;
   }, [isMuted]);
   
   const togglePlay = async () => {
     const activeVideoEl = getActiveVideoRef().current;
     if (!activeVideoEl) return;
     try {
       if (isPlaying) {
         activeVideoEl.pause();
         setIsPlaying(false);
       } else {
         await activeVideoEl.play();
         setIsPlaying(true);
       }
     } catch {
       setHasError(true);
     }
   };
   
   const toggleFullscreen = useCallback(async () => {
     if (!containerRef.current) return;
     try {
       if (!document.fullscreenElement) {
         await containerRef.current.requestFullscreen();
         setIsFullscreen(true);
       } else {
         await document.exitFullscreen();
         setIsFullscreen(false);
       }
     } catch (e) {
       console.warn('Fullscreen error:', e);
     }
   }, []);
   
   const skipToClip = (index: number) => {
     if (index < 0 || index >= totalClips || index === currentClipIndex) return;
     const activeVideoEl = getActiveVideoRef().current;
     if (!activeVideoEl) return;
     
     activeVideoEl.src = clips[index];
     activeVideoEl.load();
     activeVideoEl.play().catch(() => {});
     setCurrentClipIndex(index);
     setProgress(0);
   };
   
   const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
     const rect = e.currentTarget.getBoundingClientRect();
     const percent = (e.clientX - rect.left) / rect.width;
     const activeVideoEl = getActiveVideoRef().current;
     if (activeVideoEl && activeVideoEl.duration) {
       activeVideoEl.currentTime = percent * activeVideoEl.duration;
     }
   };
   
   return (
     <motion.div
       ref={containerRef}
       initial={{ opacity: 0 }}
       animate={{ opacity: 1 }}
       exit={{ opacity: 0 }}
       className="fixed inset-0 z-[100] bg-black"
       onClick={onClose}
       onMouseMove={resetControlsTimeout}
     >
       {/* Ambient background glow from video */}
       <div 
         className="absolute inset-0 blur-3xl opacity-20 scale-110"
         style={{
           background: 'radial-gradient(ellipse at center, rgba(59, 130, 246, 0.3) 0%, transparent 60%)',
         }}
       />
       
       <div 
         className="absolute inset-0 flex items-center justify-center"
         onClick={(e) => e.stopPropagation()}
       >
         {clips.length > 0 && !hasError ? (
           <>
             {/* Video A */}
             <motion.video
               ref={videoARef}
               className="absolute inset-0 w-full h-full object-contain"
               initial={{ opacity: 0 }}
               animate={{ opacity: activeVideo === 'A' ? 1 : 0 }}
               style={{ zIndex: activeVideo === 'A' ? 2 : 1 }}
               muted={isMuted}
               playsInline
               onClick={togglePlay}
               onError={(e) => {
                 e.preventDefault?.();
                 e.stopPropagation?.();
                 setHasError(true);
               }}
               onEnded={handleClipEnded}
               onTimeUpdate={handleTimeUpdate}
             />
             {/* Video B */}
             <motion.video
               ref={videoBRef}
               className="absolute inset-0 w-full h-full object-contain"
               initial={{ opacity: 0 }}
               animate={{ opacity: activeVideo === 'B' ? 1 : 0 }}
               style={{ zIndex: activeVideo === 'B' ? 2 : 1 }}
               muted={isMuted}
               playsInline
               onClick={togglePlay}
               onError={(e) => {
                 e.preventDefault?.();
                 e.stopPropagation?.();
                 setHasError(true);
               }}
               onEnded={handleClipEnded}
               onTimeUpdate={handleTimeUpdate}
             />
           </>
         ) : (
           <div className="text-center">
             <div className="w-24 h-24 mx-auto mb-6 rounded-full border border-slate-500/30 flex items-center justify-center bg-slate-500/10">
               <Play className="w-10 h-10 text-slate-400/60" />
             </div>
             <p className="text-zinc-500 text-sm">Video unavailable</p>
           </div>
         )}
         
         {/* Premium Controls Overlay */}
         <AnimatePresence>
           {showControls && clips.length > 0 && !hasError && (
             <motion.div
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: 20 }}
               transition={{ duration: 0.2 }}
               className="absolute bottom-0 left-0 right-0 z-20"
             >
               {/* Gradient backdrop */}
               <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />
               
               <div className="relative px-6 pb-8 pt-16">
                 {/* Video title */}
                 <div className="mb-4">
                   <h2 className="text-white text-xl font-medium">{video.title}</h2>
                   {video.category && (
                     <p className="text-white/50 text-sm mt-1">
                       {video.category === 'text-to-video' ? 'Text to Video' : 
                        video.category === 'image-to-video' ? 'Image to Video' : 'AI Avatar'}
                     </p>
                   )}
                 </div>
                 
                 {/* Progress bar */}
                 <div 
                   className="w-full h-1.5 bg-white/10 rounded-full mb-4 cursor-pointer group"
                   onClick={handleProgressClick}
                 >
                   <div 
                     className="relative h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all"
                     style={{ width: `${progress}%` }}
                   >
                     {/* Glow effect on progress */}
                     <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-blue-400 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg shadow-blue-500/50" />
                   </div>
                 </div>
                 
                 {/* Clip indicators */}
                 {totalClips > 1 && (
                   <div className="flex items-center justify-center gap-2 mb-4">
                     {clips.map((_, idx) => (
                       <button
                         key={idx}
                         onClick={(e) => {
                           e.stopPropagation();
                           skipToClip(idx);
                         }}
                         className={cn(
                           "h-1.5 rounded-full transition-all duration-300",
                           idx === currentClipIndex 
                             ? "bg-blue-400 w-8 shadow-lg shadow-blue-500/30" 
                             : "bg-white/20 hover:bg-white/40 w-3"
                         )}
                       />
                     ))}
                   </div>
                 )}
                 
                 {/* Control buttons */}
                 <div className="flex items-center justify-center gap-4">
                   {/* Skip back */}
                   {totalClips > 1 && (
                     <button 
                       className="w-10 h-10 rounded-full bg-white/[0.05] hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all border border-white/[0.08]"
                       onClick={(e) => {
                         e.stopPropagation();
                         skipToClip(currentClipIndex > 0 ? currentClipIndex - 1 : totalClips - 1);
                       }}
                     >
                       <SkipBack className="w-4 h-4" />
                     </button>
                   )}
                   
                   {/* Play/Pause */}
                   <button 
                     className="w-16 h-16 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white backdrop-blur-xl border border-white/20 transition-all shadow-lg shadow-black/30"
                     onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                     style={{
                       boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
                     }}
                   >
                     {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1" />}
                   </button>
                   
                   {/* Skip forward */}
                   {totalClips > 1 && (
                     <button 
                       className="w-10 h-10 rounded-full bg-white/[0.05] hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all border border-white/[0.08]"
                       onClick={(e) => {
                         e.stopPropagation();
                         skipToClip((currentClipIndex + 1) % totalClips);
                       }}
                     >
                       <SkipForward className="w-4 h-4" />
                     </button>
                   )}
                   
                   {/* Volume */}
                   <button 
                     className="w-10 h-10 rounded-full bg-white/[0.05] hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all border border-white/[0.08]"
                     onClick={(e) => { 
                       e.stopPropagation(); 
                       const newMuted = !isMuted;
                       setIsMuted(newMuted);
                       if (videoARef.current) videoARef.current.muted = newMuted;
                       if (videoBRef.current) videoBRef.current.muted = newMuted;
                     }}
                   >
                     {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                   </button>
                   
                   {/* Fullscreen */}
                   <button 
                     className="w-10 h-10 rounded-full bg-white/[0.05] hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all border border-white/[0.08]"
                     onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                   >
                     {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                   </button>
                 </div>
               </div>
             </motion.div>
           )}
         </AnimatePresence>
       </div>
       
       {/* Close button */}
       <motion.button
         initial={{ opacity: 0, scale: 0.9 }}
         animate={{ opacity: showControls ? 1 : 0.3, scale: 1 }}
         onClick={onClose}
         className="absolute top-6 right-6 w-12 h-12 rounded-full bg-black/60 backdrop-blur-xl flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 border border-white/[0.08] z-30 transition-all"
       >
         <X className="w-5 h-5" />
       </motion.button>
     </motion.div>
   );
 });
 
 export default PremiumFullscreenPlayer;