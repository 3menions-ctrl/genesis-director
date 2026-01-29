import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, AlertTriangle, Info, Sparkles, X } from "lucide-react";
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
  borderColor: string;
  glowColor: string;
  iconColor: string;
  iconGlow: string;
}> = {
  success: {
    icon: CheckCircle2,
    borderColor: 'border-emerald-500/20',
    glowColor: 'rgba(16, 185, 129, 0.15)',
    iconColor: 'text-emerald-400',
    iconGlow: 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.5))',
  },
  error: {
    icon: XCircle,
    borderColor: 'border-red-500/20',
    glowColor: 'rgba(239, 68, 68, 0.15)',
    iconColor: 'text-red-400',
    iconGlow: 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.5))',
  },
  warning: {
    icon: AlertTriangle,
    borderColor: 'border-amber-500/20',
    glowColor: 'rgba(245, 158, 11, 0.15)',
    iconColor: 'text-amber-400',
    iconGlow: 'drop-shadow(0 0 8px rgba(245, 158, 11, 0.5))',
  },
  info: {
    icon: Info,
    borderColor: 'border-white/[0.08]',
    glowColor: 'rgba(255, 255, 255, 0.05)',
    iconColor: 'text-white/60',
    iconGlow: 'drop-shadow(0 0 6px rgba(255, 255, 255, 0.3))',
  },
  epic: {
    icon: Sparkles,
    borderColor: 'border-white/[0.12]',
    glowColor: 'rgba(255, 255, 255, 0.1)',
    iconColor: 'text-white',
    iconGlow: 'drop-shadow(0 0 10px rgba(255, 255, 255, 0.6))',
  },
};

export function PremiumToast({ type, title, description, isVisible, onClose, action }: PremiumToastProps) {
  const config = toastConfig[type];
  const Icon = config.icon;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
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
              opacity: [0.4, 0.7, 0.4],
            }}
            transition={{ 
              duration: 2.5, 
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />

          {/* Main toast container - matching landing page black aesthetic */}
          <div
            className={cn(
              "relative overflow-hidden rounded-2xl border backdrop-blur-2xl bg-black/95",
              config.borderColor
            )}
            style={{ 
              boxShadow: `0 0 50px ${config.glowColor}, 0 0 100px ${config.glowColor.replace('0.15', '0.05')}, 0 25px 50px -12px rgba(0, 0, 0, 0.9), inset 0 1px 0 rgba(255, 255, 255, 0.05)`
            }}
          >
            {/* Top shine line */}
            <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

            {/* Subtle gradient overlay */}
            <div 
              className="absolute inset-0 pointer-events-none"
              style={{ 
                background: `linear-gradient(135deg, ${config.glowColor.replace('0.15', '0.05')} 0%, transparent 50%)` 
              }}
            />

            {/* Content */}
            <div className="relative flex items-start gap-4 p-5">
              {/* Animated icon container */}
              <div className="relative flex-shrink-0">
                {/* Pulse ring */}
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{ background: config.glowColor }}
                  animate={{ 
                    scale: [1, 2, 2],
                    opacity: [0.4, 0, 0]
                  }}
                  transition={{ 
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeOut"
                  }}
                />
                
                {/* Icon */}
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ 
                    type: "spring",
                    stiffness: 500,
                    damping: 20,
                    delay: 0.1
                  }}
                  className="relative"
                >
                  <Icon 
                    className={cn("w-5 h-5", config.iconColor)} 
                    style={{ filter: config.iconGlow }}
                  />
                </motion.div>
              </div>

              {/* Text content */}
              <div className="flex-1 min-w-0">
                <motion.h4
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 }}
                  className="text-sm font-medium text-white tracking-tight"
                >
                  {title}
                </motion.h4>
                {description && (
                  <motion.p
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="mt-1 text-sm text-white/50"
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
                    className="mt-3 px-4 py-1.5 text-xs font-medium rounded-full bg-white text-black hover:bg-white/90 transition-all duration-200"
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
                className="flex-shrink-0 p-1.5 rounded-full text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-all duration-200"
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>
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

