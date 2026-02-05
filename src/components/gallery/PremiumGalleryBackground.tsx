 import { memo } from 'react';
 import { motion } from 'framer-motion';
 
 type VideoCategory = 'all' | 'text-to-video' | 'image-to-video' | 'avatar';
 
 interface PremiumGalleryBackgroundProps {
   scrollProgress: number;
   activeCategory: VideoCategory;
 }
 
 // Category-specific color schemes
 const CATEGORY_COLORS = {
   'all': {
     primary: 'rgba(59, 130, 246, 0.4)',
     secondary: 'rgba(148, 163, 184, 0.3)',
     accent: '#3b82f6',
   },
   'text-to-video': {
     primary: 'rgba(59, 130, 246, 0.5)',
     secondary: 'rgba(96, 165, 250, 0.3)',
     accent: '#60a5fa',
   },
   'image-to-video': {
     primary: 'rgba(226, 232, 240, 0.3)',
     secondary: 'rgba(148, 163, 184, 0.4)',
     accent: '#94a3b8',
   },
   'avatar': {
     primary: 'rgba(139, 92, 246, 0.4)',
     secondary: 'rgba(217, 70, 239, 0.3)',
     accent: '#8b5cf6',
   },
 };
 
 export const PremiumGalleryBackground = memo(function PremiumGalleryBackground({ 
   scrollProgress, 
   activeCategory 
 }: PremiumGalleryBackgroundProps) {
   const parallaxY = scrollProgress * -50;
   const colors = CATEGORY_COLORS[activeCategory];
   
   return (
     <div className="fixed inset-0 overflow-hidden">
       {/* Base layer - Deep black */}
       <div className="absolute inset-0 bg-[#030303]" />
       
       {/* Animated mesh gradient orbs */}
       <motion.div 
         className="absolute inset-0"
         style={{ y: parallaxY * 0.2 }}
       >
         {/* Primary orb - top left */}
         <motion.div 
           className="absolute top-[10%] left-[15%] w-[600px] h-[600px] rounded-full blur-[120px]"
           style={{ background: `radial-gradient(circle, ${colors.primary} 0%, transparent 70%)` }}
           animate={{
             x: [0, 50, 0],
             y: [0, 30, 0],
             scale: [1, 1.1, 1],
           }}
           transition={{
             duration: 20,
             repeat: Infinity,
             ease: "easeInOut",
           }}
         />
         
         {/* Secondary orb - bottom right */}
         <motion.div 
           className="absolute bottom-[15%] right-[10%] w-[500px] h-[500px] rounded-full blur-[100px]"
           style={{ background: `radial-gradient(circle, ${colors.secondary} 0%, transparent 70%)` }}
           animate={{
             x: [0, -40, 0],
             y: [0, -50, 0],
             scale: [1, 1.15, 1],
           }}
           transition={{
             duration: 25,
             repeat: Infinity,
             ease: "easeInOut",
             delay: 2,
           }}
         />
         
         {/* Accent orb - center */}
         <motion.div 
           className="absolute top-[40%] left-[50%] w-[400px] h-[400px] rounded-full blur-[150px] opacity-30"
           style={{ background: `radial-gradient(circle, ${colors.primary} 0%, transparent 60%)` }}
           animate={{
             x: [-200, -150, -200],
             y: [0, -30, 0],
           }}
           transition={{
             duration: 30,
             repeat: Infinity,
             ease: "easeInOut",
           }}
         />
       </motion.div>
       
       {/* Aurora effect layer */}
       <motion.div 
         className="absolute inset-0 opacity-20"
         style={{ y: parallaxY * 0.3 }}
       >
         <div 
           className="absolute inset-0"
           style={{
             background: `
               linear-gradient(
                 125deg,
                 transparent 0%,
                 ${colors.primary} 25%,
                 transparent 50%,
                 ${colors.secondary} 75%,
                 transparent 100%
               )
             `,
             backgroundSize: '400% 400%',
             animation: 'aurora 15s ease infinite',
           }}
         />
       </motion.div>
       
       {/* Grid overlay for depth */}
       <div 
         className="absolute inset-0 opacity-[0.03]"
         style={{
           backgroundImage: `
             linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
             linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
           `,
           backgroundSize: '60px 60px',
         }}
       />
       
       {/* Animated horizontal lines */}
       <motion.svg 
         className="absolute inset-0 w-full h-full opacity-25"
         viewBox="0 0 1920 1080"
         preserveAspectRatio="xMidYMid slice"
         style={{ y: parallaxY * 0.4 }}
       >
         <defs>
           <linearGradient id="premiumSilverLine" x1="0%" y1="0%" x2="100%" y2="0%">
             <stop offset="0%" stopColor="transparent" />
             <stop offset="20%" stopColor="#4b5563">
               <animate attributeName="offset" values="0%;20%;0%" dur="8s" repeatCount="indefinite" />
             </stop>
             <stop offset="50%" stopColor="#9ca3af" />
             <stop offset="80%" stopColor="#4b5563">
               <animate attributeName="offset" values="80%;100%;80%" dur="8s" repeatCount="indefinite" />
             </stop>
             <stop offset="100%" stopColor="transparent" />
           </linearGradient>
           <linearGradient id="premiumAccentLine" x1="0%" y1="0%" x2="100%" y2="0%">
             <stop offset="0%" stopColor="transparent" />
             <stop offset="30%" stopColor={colors.accent} stopOpacity="0.4" />
             <stop offset="50%" stopColor={colors.accent} stopOpacity="0.8" />
             <stop offset="70%" stopColor={colors.accent} stopOpacity="0.4" />
             <stop offset="100%" stopColor="transparent" />
           </linearGradient>
         </defs>
         
         <line x1="0" y1="180" x2="1920" y2="180" stroke="url(#premiumSilverLine)" strokeWidth="0.5" />
         <line x1="0" y1="360" x2="1920" y2="360" stroke="url(#premiumAccentLine)" strokeWidth="1" />
         <line x1="0" y1="540" x2="1920" y2="540" stroke="url(#premiumSilverLine)" strokeWidth="0.5" />
         <line x1="0" y1="720" x2="1920" y2="720" stroke="url(#premiumAccentLine)" strokeWidth="1" />
         <line x1="0" y1="900" x2="1920" y2="900" stroke="url(#premiumSilverLine)" strokeWidth="0.5" />
       </motion.svg>
       
       {/* Floating particles with depth */}
       <motion.div 
         className="absolute inset-0 pointer-events-none"
         style={{ y: parallaxY * 0.6 }}
       >
         {[...Array(30)].map((_, i) => {
           const size = 1 + (i % 3);
           const depth = (i % 3) + 1;
           return (
             <motion.div
               key={i}
               className="absolute rounded-full"
               style={{
                 left: `${5 + (i * 3.2) % 90}%`,
                 top: `${10 + (i * 5.7) % 80}%`,
                 width: size,
                 height: size,
                 backgroundColor: i % 2 === 0 ? colors.accent : '#94a3b8',
                 opacity: 0.1 + (0.1 / depth),
                 filter: `blur(${depth - 1}px)`,
               }}
               animate={{
                 opacity: [0.1 + (0.1 / depth), 0.3 + (0.1 / depth), 0.1 + (0.1 / depth)],
                 scale: [1, 1.5, 1],
                 y: [0, -10 * depth, 0],
               }}
               transition={{
                 duration: 4 + (i % 4),
                 repeat: Infinity,
                 delay: i * 0.15,
                 ease: "easeInOut",
               }}
             />
           );
         })}
       </motion.div>
       
       {/* Star field layer */}
       <div className="absolute inset-0 pointer-events-none">
         {[...Array(50)].map((_, i) => (
           <div
             key={`star-${i}`}
             className="absolute w-px h-px bg-white rounded-full"
             style={{
               left: `${(i * 7.3) % 100}%`,
               top: `${(i * 11.7) % 100}%`,
               opacity: 0.1 + (i % 5) * 0.05,
               animation: `twinkle ${3 + (i % 4)}s ease-in-out infinite`,
               animationDelay: `${i * 0.1}s`,
             }}
           />
         ))}
       </div>
       
       {/* Vignette with category-aware intensity */}
       <div 
         className="absolute inset-0 pointer-events-none"
         style={{
           background: 'radial-gradient(ellipse at center, transparent 20%, rgba(3,3,3,0.4) 60%, rgba(3,3,3,0.95) 100%)',
         }}
       />
       
       {/* Subtle noise texture */}
       <div 
         className="absolute inset-0 opacity-[0.015] pointer-events-none mix-blend-overlay"
         style={{
           backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
         }}
       />
       
       {/* CSS for aurora animation */}
       <style>{`
         @keyframes aurora {
           0%, 100% { background-position: 0% 50%; }
           50% { background-position: 100% 50%; }
         }
         @keyframes twinkle {
           0%, 100% { opacity: 0.1; transform: scale(1); }
           50% { opacity: 0.4; transform: scale(1.2); }
         }
       `}</style>
     </div>
   );
 });
 
 export default PremiumGalleryBackground;