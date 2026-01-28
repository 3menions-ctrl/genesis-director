import { motion } from 'framer-motion';

export default function ProjectsBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {/* Deep black base */}
      <div className="absolute inset-0 bg-[#030303]" />
      
      {/* Animated flowing circles - rich orange palette */}
      <svg 
        className="absolute inset-0 w-full h-full" 
        viewBox="0 0 1920 1080" 
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Premium orange gradients */}
          <linearGradient id="orangeGlow1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(25 100% 55%)" stopOpacity="0.6" />
            <stop offset="50%" stopColor="hsl(16 100% 50%)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="hsl(10 90% 45%)" stopOpacity="0.2" />
          </linearGradient>
          
          <linearGradient id="orangeGlow2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="hsl(35 100% 60%)" stopOpacity="0.5" />
            <stop offset="50%" stopColor="hsl(25 95% 55%)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="hsl(16 90% 48%)" stopOpacity="0.15" />
          </linearGradient>
          
          <linearGradient id="orangeGlow3" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="hsl(30 100% 65%)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="hsl(20 100% 50%)" stopOpacity="0.1" />
          </linearGradient>
          
          <linearGradient id="amberLine" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(35 100% 60%)" stopOpacity="0" />
            <stop offset="30%" stopColor="hsl(25 100% 55%)" stopOpacity="0.8" />
            <stop offset="70%" stopColor="hsl(16 100% 50%)" stopOpacity="0.6" />
            <stop offset="100%" stopColor="hsl(10 90% 45%)" stopOpacity="0" />
          </linearGradient>
          
          <linearGradient id="goldLine" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(40 100% 65%)" stopOpacity="0" />
            <stop offset="40%" stopColor="hsl(35 100% 60%)" stopOpacity="0.7" />
            <stop offset="60%" stopColor="hsl(30 100% 55%)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="hsl(25 95% 50%)" stopOpacity="0" />
          </linearGradient>
          
          {/* Radial glow for circles */}
          <radialGradient id="circleGlow1" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(25 100% 60%)" stopOpacity="0.3" />
            <stop offset="70%" stopColor="hsl(20 100% 50%)" stopOpacity="0.1" />
            <stop offset="100%" stopColor="hsl(16 90% 45%)" stopOpacity="0" />
          </radialGradient>
          
          <radialGradient id="circleGlow2" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(35 100% 65%)" stopOpacity="0.25" />
            <stop offset="60%" stopColor="hsl(30 100% 55%)" stopOpacity="0.08" />
            <stop offset="100%" stopColor="hsl(25 90% 50%)" stopOpacity="0" />
          </radialGradient>
          
          {/* Blur filter for soft glow */}
          <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="20" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          
          <filter id="heavyGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="40" result="blur" />
          </filter>
        </defs>
        
        {/* Large ambient orbs - deep background */}
        <motion.circle
          cx="15%"
          cy="20%"
          r="250"
          fill="url(#circleGlow1)"
          filter="url(#heavyGlow)"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ 
            scale: [0.8, 1.1, 0.9, 1],
            opacity: [0.3, 0.5, 0.4, 0.3],
            cx: ["15%", "18%", "14%", "15%"]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        />
        
        <motion.circle
          cx="85%"
          cy="75%"
          r="300"
          fill="url(#circleGlow2)"
          filter="url(#heavyGlow)"
          initial={{ scale: 1, opacity: 0 }}
          animate={{ 
            scale: [1, 0.85, 1.1, 1],
            opacity: [0.25, 0.4, 0.3, 0.25],
            cy: ["75%", "70%", "78%", "75%"]
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
        
        <motion.circle
          cx="50%"
          cy="50%"
          r="400"
          fill="url(#circleGlow1)"
          filter="url(#heavyGlow)"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ 
            scale: [0.9, 1.05, 0.95, 0.9],
            opacity: [0.15, 0.25, 0.2, 0.15]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 4 }}
        />
        
        {/* Flowing curved lines - premium aesthetic */}
        <motion.path
          d="M-100,400 Q300,200 600,350 T1200,300 T1800,450 T2200,350"
          stroke="url(#amberLine)"
          strokeWidth="2"
          fill="none"
          filter="url(#softGlow)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 3, ease: "easeOut" }}
        />
        
        <motion.path
          d="M-50,600 Q400,450 800,550 T1400,480 T2000,580"
          stroke="url(#goldLine)"
          strokeWidth="1.5"
          fill="none"
          filter="url(#softGlow)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.8 }}
          transition={{ duration: 3.5, ease: "easeOut", delay: 0.5 }}
        />
        
        <motion.path
          d="M-200,250 Q200,150 500,280 T1100,180 T1700,300 T2100,200"
          stroke="url(#amberLine)"
          strokeWidth="1"
          fill="none"
          filter="url(#softGlow)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.6 }}
          transition={{ duration: 4, ease: "easeOut", delay: 1 }}
        />
        
        {/* Elegant floating circles */}
        <motion.circle
          cx="20%"
          cy="60%"
          r="80"
          stroke="url(#orangeGlow1)"
          strokeWidth="1"
          fill="none"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ 
            opacity: [0.4, 0.6, 0.4],
            scale: [0.95, 1.05, 0.95],
            cy: ["60%", "55%", "60%"]
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        
        <motion.circle
          cx="75%"
          cy="25%"
          r="120"
          stroke="url(#orangeGlow2)"
          strokeWidth="1.5"
          fill="none"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ 
            opacity: [0.3, 0.5, 0.3],
            scale: [1, 1.08, 1],
            cx: ["75%", "78%", "75%"]
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
        
        <motion.circle
          cx="45%"
          cy="85%"
          r="60"
          stroke="url(#orangeGlow3)"
          strokeWidth="1"
          fill="none"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ 
            opacity: [0.5, 0.7, 0.5],
            scale: [0.9, 1.1, 0.9]
          }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
        
        {/* Small accent circles */}
        <motion.circle
          cx="90%"
          cy="45%"
          r="40"
          stroke="url(#amberLine)"
          strokeWidth="0.5"
          fill="none"
          animate={{ 
            opacity: [0.3, 0.6, 0.3],
            scale: [1, 1.15, 1]
          }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
        
        <motion.circle
          cx="10%"
          cy="90%"
          r="50"
          stroke="url(#goldLine)"
          strokeWidth="0.5"
          fill="none"
          animate={{ 
            opacity: [0.4, 0.6, 0.4],
            scale: [0.95, 1.1, 0.95]
          }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        />
        
        {/* Interconnecting arc lines */}
        <motion.path
          d="M200,800 Q600,600 400,400"
          stroke="url(#orangeGlow1)"
          strokeWidth="0.8"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: [0, 1, 1, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", times: [0, 0.4, 0.6, 1] }}
        />
        
        <motion.path
          d="M1600,200 Q1400,500 1700,700"
          stroke="url(#orangeGlow2)"
          strokeWidth="0.8"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: [0, 1, 1, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2, times: [0, 0.4, 0.6, 1] }}
        />
      </svg>
      
      {/* Vignette overlay */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 20%, rgba(0,0,0,0.6) 100%)',
        }}
      />
      
      {/* Noise texture for premium feel */}
      <div 
        className="absolute inset-0 opacity-[0.02] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}
