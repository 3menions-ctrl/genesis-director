 import { memo } from 'react';
 import { motion, AnimatePresence } from 'framer-motion';
 import { Sparkles, Type, Image, User } from 'lucide-react';
 import { cn } from '@/lib/utils';
 
 type VideoCategory = 'all' | 'text-to-video' | 'image-to-video' | 'avatar';
 
 interface CategoryConfig {
   id: VideoCategory;
   label: string;
   icon: React.ElementType;
   description: string;
   gradient: string;
 }
 
 const CATEGORIES: CategoryConfig[] = [
   { id: 'all', label: 'All Videos', icon: Sparkles, description: 'Browse our complete collection', gradient: 'from-blue-500 to-cyan-400' },
   { id: 'text-to-video', label: 'Text to Video', icon: Type, description: 'Transform words into cinematic scenes', gradient: 'from-blue-500 to-blue-400' },
   { id: 'image-to-video', label: 'Image to Video', icon: Image, description: 'Bring static images to life', gradient: 'from-slate-400 to-slate-300' },
   { id: 'avatar', label: 'AI Avatar', icon: User, description: 'Realistic talking avatars', gradient: 'from-violet-500 to-fuchsia-400' },
 ];
 
 interface PremiumCategoryNavProps {
   activeCategory: VideoCategory;
   onCategoryChange: (category: VideoCategory) => void;
   categoryCounts: Record<VideoCategory, number>;
 }
 
 export const PremiumCategoryNav = memo(function PremiumCategoryNav({
   activeCategory,
   onCategoryChange,
   categoryCounts,
 }: PremiumCategoryNavProps) {
   return (
     <motion.div 
       initial={{ opacity: 0, y: -20 }}
       animate={{ opacity: 1, y: 0 }}
       transition={{ delay: 0.5, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-4 left-0 right-0 z-40 flex flex-col items-center gap-3 md:gap-5"
    >
       {/* Premium gallery title */}
       <div className="flex items-center gap-3">
         <div className="h-px w-8 bg-gradient-to-r from-transparent to-white/20 hidden md:block" />
         <h1 className="text-white/40 text-xs md:text-sm tracking-[0.4em] uppercase font-light">
           Gallery
         </h1>
         <div className="h-px w-8 bg-gradient-to-l from-transparent to-white/20 hidden md:block" />
       </div>
       
       {/* Glassmorphism category container */}
       <div className="relative">
         {/* Outer glow */}
         <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-blue-500/20 via-transparent to-violet-500/20 blur-xl opacity-50" />
         
         {/* Main container */}
         <div className="relative flex items-center gap-1 p-1.5 bg-black/60 backdrop-blur-2xl rounded-full border border-white/[0.08] shadow-2xl shadow-black/50">
           {CATEGORIES.map((cat) => {
             const Icon = cat.icon;
             const isActive = activeCategory === cat.id;
             const count = categoryCounts[cat.id];
             
             return (
               <motion.button
                 key={cat.id}
                 onClick={() => onCategoryChange(cat.id)}
                 className={cn(
                   "relative flex items-center gap-1.5 rounded-full font-medium transition-all duration-300",
                   "px-3 py-2 md:px-5 md:py-2.5",
                   "text-xs md:text-sm",
                   isActive 
                     ? "text-white" 
                     : "text-zinc-500 hover:text-zinc-300"
                 )}
                 whileHover={{ scale: 1.02 }}
                 whileTap={{ scale: 0.98 }}
               >
                 {/* Active background with gradient */}
                 {isActive && (
                   <motion.div
                     layoutId="premiumActiveCategory"
                     className={cn(
                       "absolute inset-0 rounded-full",
                       "bg-gradient-to-r",
                       cat.gradient
                     )}
                     style={{
                       boxShadow: '0 4px 20px rgba(59, 130, 246, 0.3), inset 0 1px 0 rgba(255,255,255,0.2)',
                     }}
                     transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                   />
                 )}
                 
                 {/* Hover glow for inactive */}
                 {!isActive && (
                   <motion.div
                     className="absolute inset-0 rounded-full bg-white/[0.03] opacity-0 hover:opacity-100 transition-opacity"
                   />
                 )}
                 
                 <span className="relative z-10 flex items-center gap-1.5">
                   <motion.div
                     animate={{ 
                       rotate: isActive ? [0, 5, -5, 0] : 0,
                       scale: isActive ? [1, 1.1, 1] : 1,
                     }}
                     transition={{ duration: 0.4 }}
                   >
                     <Icon className={cn(
                       "w-4 h-4 transition-colors",
                       isActive ? "text-white" : "text-zinc-500"
                     )} />
                   </motion.div>
                   
                   {/* Label - hidden on mobile */}
                   <span className="hidden md:inline">{cat.label}</span>
                   
                   {/* Count badge */}
                   <motion.span 
                     className={cn(
                       "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                       isActive 
                         ? "bg-white/25 text-white" 
                         : "bg-white/[0.05] text-zinc-500"
                     )}
                     animate={{ 
                       scale: isActive ? [1, 1.15, 1] : 1,
                     }}
                     transition={{ duration: 0.3, delay: 0.1 }}
                   >
                     {count}
                   </motion.span>
                 </span>
               </motion.button>
             );
           })}
         </div>
       </div>
       
       {/* Active category description with fade animation */}
       <AnimatePresence mode="wait">
         <motion.p
           key={activeCategory}
           initial={{ opacity: 0, y: 5 }}
           animate={{ opacity: 1, y: 0 }}
           exit={{ opacity: 0, y: -5 }}
           transition={{ duration: 0.25, ease: "easeOut" }}
           className="hidden md:block text-zinc-500 text-xs tracking-wide"
         >
           {CATEGORIES.find(c => c.id === activeCategory)?.description}
         </motion.p>
       </AnimatePresence>
     </motion.div>
   );
 });
 
 export default PremiumCategoryNav;