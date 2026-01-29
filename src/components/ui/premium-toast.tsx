import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, AlertTriangle, Info, Sparkles, Zap, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'epic';

interface PremiumToastProps {
  type: ToastType;
  title: string;
  description?: string;
  isVisible: boolean;
  onClose: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const toastConfig: Record<ToastType, {
  icon: React.ElementType;
  gradient: string;
  borderColor: string;
  glowColor: string;
  iconColor: string;
  bgGradient: string;
  pulseColor: string;
}> = {
  success: {
    icon: CheckCircle2,
    gradient: 'from-emerald-500/20 via-emerald-500/10 to-transparent',
    borderColor: 'border-emerald-500/30',
    glowColor: 'rgba(16, 185, 129, 0.4)',
    iconColor: 'text-emerald-400',
    bgGradient: 'linear-gradient(135deg, rgba(6, 78, 59, 0.95) 0%, rgba(4, 47, 46, 0.98) 50%, rgba(17, 24, 39, 0.99) 100%)',
    pulseColor: 'bg-emerald-400',
  },
  error: {
    icon: XCircle,
    gradient: 'from-rose-500/20 via-rose-500/10 to-transparent',
    borderColor: 'border-rose-500/30',
    glowColor: 'rgba(244, 63, 94, 0.4)',
    iconColor: 'text-rose-400',
    bgGradient: 'linear-gradient(135deg, rgba(76, 29, 39, 0.95) 0%, rgba(51, 19, 26, 0.98) 50%, rgba(17, 24, 39, 0.99) 100%)',
    pulseColor: 'bg-rose-400',
  },
  warning: {
    icon: AlertTriangle,
    gradient: 'from-amber-500/20 via-amber-500/10 to-transparent',
    borderColor: 'border-amber-500/30',
    glowColor: 'rgba(245, 158, 11, 0.4)',
    iconColor: 'text-amber-400',
    bgGradient: 'linear-gradient(135deg, rgba(78, 53, 6, 0.95) 0%, rgba(55, 37, 4, 0.98) 50%, rgba(17, 24, 39, 0.99) 100%)',
    pulseColor: 'bg-amber-400',
  },
  info: {
    icon: Info,
    gradient: 'from-blue-500/20 via-blue-500/10 to-transparent',
    borderColor: 'border-blue-500/30',
    glowColor: 'rgba(59, 130, 246, 0.4)',
    iconColor: 'text-blue-400',
    bgGradient: 'linear-gradient(135deg, rgba(23, 37, 84, 0.95) 0%, rgba(15, 23, 42, 0.98) 50%, rgba(17, 24, 39, 0.99) 100%)',
    pulseColor: 'bg-blue-400',
  },
  epic: {
    icon: Sparkles,
    gradient: 'from-violet-500/20 via-fuchsia-500/10 to-cyan-500/5',
    borderColor: 'border-violet-500/40',
    glowColor: 'rgba(139, 92, 246, 0.5)',
    iconColor: 'text-violet-400',
    bgGradient: 'linear-gradient(135deg, rgba(76, 29, 149, 0.95) 0%, rgba(49, 10, 101, 0.98) 50%, rgba(17, 24, 39, 0.99) 100%)',
    pulseColor: 'bg-violet-400',
  },
};

export function PremiumToast({ type, title, description, isVisible, onClose, action }: PremiumToastProps) {
  const config = toastConfig[type];
  const Icon = config.icon;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ 
            type: "spring", 
            stiffness: 400, 
            damping: 25,
            mass: 0.8 
          }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] w-[90vw] max-w-md"
        >
          {/* Outer glow effect */}
          <motion.div
            className="absolute inset-0 rounded-2xl blur-xl"
            style={{ background: config.glowColor }}
            animate={{ 
              opacity: [0.3, 0.6, 0.3],
              scale: [1, 1.02, 1]
            }}
            transition={{ 
              duration: 2, 
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />

          {/* Main toast container */}
          <div
            className={cn(
              "relative overflow-hidden rounded-2xl border backdrop-blur-2xl",
              config.borderColor
            )}
            style={{ 
              background: config.bgGradient,
              boxShadow: `0 0 40px ${config.glowColor}, 0 0 80px ${config.glowColor.replace('0.4', '0.2')}, 0 25px 50px -12px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.1)`
            }}
          >
            {/* Animated gradient overlay */}
            <motion.div 
              className={cn(
                "absolute inset-0 bg-gradient-to-r opacity-50",
                config.gradient
              )}
              animate={{ 
                opacity: [0.3, 0.5, 0.3],
                x: ['-10%', '10%', '-10%']
              }}
              transition={{ 
                duration: 4, 
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />

            {/* Shine effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
              initial={{ x: '-100%' }}
              animate={{ x: '200%' }}
              transition={{ 
                duration: 1.5,
                delay: 0.2,
                ease: "easeInOut"
              }}
            />

            {/* Content */}
            <div className="relative flex items-start gap-4 p-5">
              {/* Animated icon container */}
              <div className="relative flex-shrink-0">
                {/* Pulse ring */}
                <motion.div
                  className={cn("absolute inset-0 rounded-full", config.pulseColor)}
                  animate={{ 
                    scale: [1, 1.8, 1.8],
                    opacity: [0.5, 0, 0]
                  }}
                  transition={{ 
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeOut"
                  }}
                />
                
                {/* Icon background */}
                <div className={cn(
                  "relative w-10 h-10 rounded-xl flex items-center justify-center",
                  "bg-white/10 backdrop-blur-sm border border-white/10"
                )}>
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ 
                      type: "spring",
                      stiffness: 500,
                      damping: 20,
                      delay: 0.1
                    }}
                  >
                    <Icon className={cn("w-5 h-5", config.iconColor)} />
                  </motion.div>
                </div>
              </div>

              {/* Text content */}
              <div className="flex-1 min-w-0">
                <motion.h4
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 }}
                  className="text-sm font-semibold text-white tracking-tight"
                >
                  {title}
                </motion.h4>
                {description && (
                  <motion.p
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="mt-1 text-sm text-white/60"
                  >
                    {description}
                  </motion.p>
                )}
                {action && (
                  <motion.button
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    onClick={action.onClick}
                    className={cn(
                      "mt-3 px-4 py-1.5 text-xs font-medium rounded-lg",
                      "bg-white/10 hover:bg-white/20 text-white/90",
                      "border border-white/10 hover:border-white/20",
                      "transition-all duration-200"
                    )}
                  >
                    {action.label}
                  </motion.button>
                )}
              </div>

              {/* Close button */}
              <motion.button
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
                onClick={onClose}
                className={cn(
                  "flex-shrink-0 p-1.5 rounded-lg",
                  "text-white/40 hover:text-white/80",
                  "hover:bg-white/10 transition-all duration-200"
                )}
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>

            {/* Bottom accent line */}
            <motion.div
              className={cn("h-0.5 w-full", config.pulseColor)}
              initial={{ scaleX: 0, opacity: 0.8 }}
              animate={{ scaleX: 1, opacity: [0.8, 0.4, 0.8] }}
              transition={{ 
                scaleX: { duration: 0.4, delay: 0.1 },
                opacity: { duration: 2, repeat: Infinity }
              }}
              style={{ transformOrigin: 'left' }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Hook for using premium toasts
interface ToastState {
  isVisible: boolean;
  type: ToastType;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function usePremiumToast() {
  const [toast, setToast] = React.useState<ToastState>({
    isVisible: false,
    type: 'info',
    title: '',
  });

  const showToast = React.useCallback((
    type: ToastType,
    title: string,
    description?: string,
    action?: { label: string; onClick: () => void },
    duration: number = 5000
  ) => {
    setToast({ isVisible: true, type, title, description, action });
    
    if (duration > 0) {
      setTimeout(() => {
        setToast(prev => ({ ...prev, isVisible: false }));
      }, duration);
    }
  }, []);

  const hideToast = React.useCallback(() => {
    setToast(prev => ({ ...prev, isVisible: false }));
  }, []);

  const success = React.useCallback((title: string, description?: string, action?: { label: string; onClick: () => void }) => {
    showToast('success', title, description, action);
  }, [showToast]);

  const error = React.useCallback((title: string, description?: string, action?: { label: string; onClick: () => void }) => {
    showToast('error', title, description, action);
  }, [showToast]);

  const warning = React.useCallback((title: string, description?: string, action?: { label: string; onClick: () => void }) => {
    showToast('warning', title, description, action);
  }, [showToast]);

  const info = React.useCallback((title: string, description?: string, action?: { label: string; onClick: () => void }) => {
    showToast('info', title, description, action);
  }, [showToast]);

  const epic = React.useCallback((title: string, description?: string, action?: { label: string; onClick: () => void }) => {
    showToast('epic', title, description, action, 7000);
  }, [showToast]);

  return {
    toast,
    showToast,
    hideToast,
    success,
    error,
    warning,
    info,
    epic,
    ToastComponent: () => (
      <PremiumToast
        type={toast.type}
        title={toast.title}
        description={toast.description}
        isVisible={toast.isVisible}
        onClose={hideToast}
        action={toast.action}
      />
    ),
  };
}

// Provider component
interface PremiumToastContextValue {
  success: (title: string, description?: string, action?: { label: string; onClick: () => void }) => void;
  error: (title: string, description?: string, action?: { label: string; onClick: () => void }) => void;
  warning: (title: string, description?: string, action?: { label: string; onClick: () => void }) => void;
  info: (title: string, description?: string, action?: { label: string; onClick: () => void }) => void;
  epic: (title: string, description?: string, action?: { label: string; onClick: () => void }) => void;
}

const PremiumToastContext = React.createContext<PremiumToastContextValue | null>(null);

export function PremiumToastProvider({ children }: { children: React.ReactNode }) {
  const { ToastComponent, success, error, warning, info, epic } = usePremiumToast();

  return (
    <PremiumToastContext.Provider value={{ success, error, warning, info, epic }}>
      {children}
      <ToastComponent />
    </PremiumToastContext.Provider>
  );
}

export function usePremiumToastContext() {
  const context = React.useContext(PremiumToastContext);
  if (!context) {
    throw new Error('usePremiumToastContext must be used within PremiumToastProvider');
  }
  return context;
}
