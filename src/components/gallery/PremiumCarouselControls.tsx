 import { memo } from 'react';
 import { motion, AnimatePresence } from 'framer-motion';
 import { ChevronLeft, ChevronRight } from 'lucide-react';
 import { cn } from '@/lib/utils';
 
 type VideoCategory = 'all' | 'text-to-video' | 'image-to-video' | 'avatar';
 
 interface PremiumCarouselControlsProps {
   currentIndex: number;
   totalCount: number;
   onPrev: () => void;
   onNext: () => void;
   onDotClick: (index: number) => void;
   activeCategory: VideoCategory;
 }
 
 const CATEGORY_LABELS: Record<VideoCategory, string> = {
   'all': 'All Videos',
   'text-to-video': 'Text to Video',
   'image-to-video': 'Image to Video',
   'avatar': 'AI Avatar',
 };
 
 export const PremiumCarouselControls = memo(function PremiumCarouselControls({
   currentIndex,
   totalCount,
   onPrev,
   onNext,
   onDotClick,
   activeCategory,
 }: PremiumCarouselControlsProps) {
   return (
     <>
       {/* Navigation arrows */}
       <AnimatePresence>
         {currentIndex > 0 && (
           <motion.button
             initial={{ opacity: 0, x: 20 }}
             animate={{ opacity: 1, x: 0 }}
             exit={{ opacity: 0, x: 20 }}
             whileHover={{ scale: 1.1, x: -4 }}
             whileTap={{ scale: 0.95 }}
             onClick={onPrev}
             className="fixed left-6 md:left-10 top-1/2 -translate-y-1/2 z-50 group"
           >
             {/* Glow effect */}
             <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity scale-150" />
             
             <div className="relative w-14 h-14 md:w-16 md:h-16 rounded-full bg-white/[0.03] hover:bg-white/[0.08] backdrop-blur-2xl border border-white/[0.08] hover:border-white/20 flex items-center justify-center text-white/50 hover:text-white transition-all duration-300 shadow-2xl shadow-black/50">
               <ChevronLeft className="w-6 h-6 md:w-7 md:h-7" />
             </div>
           </motion.button>
         )}
       </AnimatePresence>
       
       <AnimatePresence>
         {currentIndex < totalCount - 1 && (
           <motion.button
             initial={{ opacity: 0, x: -20 }}
             animate={{ opacity: 1, x: 0 }}
             exit={{ opacity: 0, x: -20 }}
             whileHover={{ scale: 1.1, x: 4 }}
             whileTap={{ scale: 0.95 }}
             onClick={onNext}
             className="fixed right-6 md:right-10 top-1/2 -translate-y-1/2 z-50 group"
           >
             {/* Glow effect */}
             <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity scale-150" />
             
             <div className="relative w-14 h-14 md:w-16 md:h-16 rounded-full bg-white/[0.03] hover:bg-white/[0.08] backdrop-blur-2xl border border-white/[0.08] hover:border-white/20 flex items-center justify-center text-white/50 hover:text-white transition-all duration-300 shadow-2xl shadow-black/50">
               <ChevronRight className="w-6 h-6 md:w-7 md:h-7" />
             </div>
           </motion.button>
         )}
       </AnimatePresence>
       
       {/* Progress dots */}
       <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40">
         <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/40 backdrop-blur-xl border border-white/[0.06]">
           {Array.from({ length: totalCount }).map((_, idx) => (
             <motion.button
               key={idx}
               onClick={() => onDotClick(idx)}
               className={cn(
                 "relative rounded-full transition-all duration-300",
                 idx === currentIndex 
                   ? "w-8 h-2" 
                   : "w-2 h-2 hover:scale-125"
               )}
               whileHover={{ scale: idx === currentIndex ? 1 : 1.3 }}
               whileTap={{ scale: 0.9 }}
             >
              {/* Active glow - STABILITY: Removed layoutId which caused crashes */}
                {idx === currentIndex && (
                  <div 
                    className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-200"
                    style={{
                      boxShadow: '0 0 20px rgba(59, 130, 246, 0.5)',
                    }}
                  />
                )}
               
               {/* Inactive dot */}
               {idx !== currentIndex && (
                 <div className="absolute inset-0 rounded-full bg-white/20 hover:bg-white/40 transition-colors" />
               )}
             </motion.button>
           ))}
         </div>
       </div>
       
       {/* Video counter */}
       <motion.div 
         className="fixed bottom-8 right-8 z-40"
         initial={{ opacity: 0, y: 10 }}
         animate={{ opacity: 1, y: 0 }}
         transition={{ delay: 0.6 }}
       >
         <div className="flex flex-col items-end gap-1.5 px-4 py-3 rounded-xl bg-black/40 backdrop-blur-xl border border-white/[0.06]">
           <div className="flex items-baseline gap-1">
             <span className="text-white text-2xl font-light tabular-nums">
               {String(currentIndex + 1).padStart(2, '0')}
             </span>
             <span className="text-white/30 text-sm">/</span>
             <span className="text-white/40 text-sm tabular-nums">
               {String(totalCount).padStart(2, '0')}
             </span>
           </div>
           {activeCategory !== 'all' && (
             <span className="text-blue-400/60 text-xs tracking-wide">
               {CATEGORY_LABELS[activeCategory]}
             </span>
           )}
         </div>
       </motion.div>
     </>
   );
 });
 
 export default PremiumCarouselControls;