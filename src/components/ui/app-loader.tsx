import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface AppLoaderProps {
  message?: string;
  className?: string;
}

export function AppLoader({ message = 'Loading...', className }: AppLoaderProps) {
  return (
    <div className={cn(
      "fixed inset-0 z-[100] flex items-center justify-center",
      "bg-gradient-to-br from-background via-background to-secondary/20",
      className
    )}>
      {/* Subtle ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[150px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-primary/3 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '0.5s' }} />
      </div>
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex flex-col items-center gap-6"
      >
        {/* Logo mark */}
        <motion.div 
          className="relative"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          {/* Outer ring */}
          <div className="absolute inset-[-8px] rounded-3xl border border-primary/10 animate-pulse" />
          
          {/* Inner glow */}
          <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-xl" />
          
          {/* Main logo container */}
          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/90 flex items-center justify-center shadow-xl shadow-primary/25">
            <span className="text-xl font-bold text-primary-foreground tracking-tight">AS</span>
            
            {/* Shimmer effect */}
            <div className="absolute inset-0 rounded-2xl overflow-hidden">
              <motion.div 
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                animate={{ x: ['-100%', '200%'] }}
                transition={{ 
                  duration: 1.5, 
                  repeat: Infinity, 
                  repeatDelay: 1,
                  ease: 'easeInOut'
                }}
              />
            </div>
          </div>
        </motion.div>
        
        {/* Loading indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="flex flex-col items-center gap-3"
        >
          {/* Progress bar */}
          <div className="w-48 h-1 rounded-full bg-muted overflow-hidden">
            <motion.div 
              className="h-full bg-gradient-to-r from-primary/60 via-primary to-primary/60 rounded-full"
              animate={{ 
                x: ['-100%', '100%'],
              }}
              transition={{ 
                duration: 1.2, 
                repeat: Infinity, 
                ease: 'easeInOut',
              }}
              style={{ width: '50%' }}
            />
          </div>
          
          {/* Message */}
          <motion.p 
            key={message}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-muted-foreground font-medium"
          >
            {message}
          </motion.p>
        </motion.div>
      </motion.div>
    </div>
  );
}
