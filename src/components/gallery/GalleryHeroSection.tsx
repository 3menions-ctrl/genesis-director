 import { memo } from 'react';
 import { motion } from 'framer-motion';
 import { ChevronLeft, ChevronDown } from 'lucide-react';
 
 interface GalleryHeroSectionProps {
   onBack: () => void;
   onScrollToAvatars: () => void;
   showAvatarHint: boolean;
 }
 
 export const GalleryHeroSection = memo(function GalleryHeroSection({
   onBack,
   onScrollToAvatars,
   showAvatarHint,
 }: GalleryHeroSectionProps) {
   return (
     <>
       {/* Premium back button */}
       <motion.button
         initial={{ opacity: 0, x: -20 }}
         animate={{ opacity: 1, x: 0 }}
         transition={{ delay: 0.3, duration: 0.5 }}
         onClick={onBack}
         className="fixed top-6 left-6 z-50 flex items-center gap-2 text-zinc-500 hover:text-white transition-all duration-300 group"
       >
         <div className="w-10 h-10 rounded-full bg-white/[0.03] hover:bg-white/[0.08] backdrop-blur-xl border border-white/[0.06] hover:border-white/20 flex items-center justify-center transition-all">
           <ChevronLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
         </div>
         <span className="text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">Back</span>
       </motion.button>
       
       {/* Avatar collection button */}
       <motion.button
         initial={{ opacity: 0, scale: 0.9 }}
         animate={{ opacity: 1, scale: 1 }}
         transition={{ delay: 0.8, duration: 0.5 }}
         onClick={onScrollToAvatars}
         className="fixed bottom-8 left-8 z-50 group"
       >
         {/* Glow effect */}
         <div className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-500/30 to-fuchsia-500/30 blur-xl opacity-60 group-hover:opacity-100 transition-opacity scale-110" />
         
         <div className="relative px-6 py-3 rounded-full bg-gradient-to-r from-violet-600/80 to-fuchsia-600/80 hover:from-violet-500 hover:to-fuchsia-500 backdrop-blur-xl border border-white/20 text-white text-sm font-medium transition-all shadow-lg shadow-violet-500/25 group-hover:shadow-violet-500/40 group-hover:scale-105">
           View Avatar Collection
         </div>
       </motion.button>
       
       {/* Scroll indicator */}
       {showAvatarHint && (
         <motion.div
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           transition={{ delay: 1.2 }}
           className="fixed bottom-0 left-0 right-0 z-30 flex flex-col items-center pb-4 pointer-events-none"
         >
           <motion.div
             animate={{ y: [0, 8, 0] }}
             transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
             className="flex flex-col items-center gap-2"
           >
             <span className="text-white/20 text-xs tracking-wide">Scroll for Avatar Collection</span>
             <ChevronDown className="w-4 h-4 text-white/20" />
           </motion.div>
         </motion.div>
       )}
     </>
   );
 });
 
 export default GalleryHeroSection;