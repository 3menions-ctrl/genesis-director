/**
 * Cinema Theme - Global Style Provider
 * 
 * Unified cinema-grade dark theme system ensuring consistency across:
 * - Credit system
 * - User profiles
 * - Production logs
 * - All future components
 * 
 * Design Philosophy:
 * - Glossy black (#030303) base
 * - High-fidelity glassmorphism
 * - Thematic color palettes per section
 * - GPU-accelerated animations
 */

// ============= Core Colors =============

export const CINEMA_COLORS = {
  // Base
  background: {
    primary: '#030303',
    secondary: '#0a0a0a',
    tertiary: '#111111',
    elevated: '#1a1a1a',
  },
  
  // Glass effects
  glass: {
    subtle: 'rgba(255, 255, 255, 0.02)',
    light: 'rgba(255, 255, 255, 0.04)',
    medium: 'rgba(255, 255, 255, 0.06)',
    strong: 'rgba(255, 255, 255, 0.08)',
  },
  
  // Borders
  border: {
    subtle: 'rgba(255, 255, 255, 0.04)',
    light: 'rgba(255, 255, 255, 0.08)',
    medium: 'rgba(255, 255, 255, 0.12)',
    strong: 'rgba(255, 255, 255, 0.16)',
  },
  
  // Text
  text: {
    primary: 'rgba(255, 255, 255, 1)',
    secondary: 'rgba(255, 255, 255, 0.7)',
    tertiary: 'rgba(255, 255, 255, 0.5)',
    muted: 'rgba(255, 255, 255, 0.3)',
    disabled: 'rgba(255, 255, 255, 0.15)',
  },
  
  // Accent colors
  accent: {
    primary: '#8b5cf6', // Violet
    secondary: '#06b6d4', // Cyan
    success: '#10b981', // Emerald
    warning: '#f59e0b', // Amber
    error: '#ef4444', // Red
    info: '#3b82f6', // Blue
  },
  
  // Thematic palettes (per section)
  themes: {
    projects: {
      primary: '#f97316', // Orange
      glow: 'rgba(249, 115, 22, 0.2)',
    },
    clips: {
      primary: '#a855f7', // Purple
      glow: 'rgba(168, 85, 247, 0.2)',
    },
    universes: {
      primary: '#f59e0b', // Amber
      glow: 'rgba(245, 158, 11, 0.2)',
    },
    profile: {
      primary: '#10b981', // Emerald
      glow: 'rgba(16, 185, 129, 0.2)',
    },
    production: {
      primary: '#06b6d4', // Cyan
      glow: 'rgba(6, 182, 212, 0.2)',
    },
    credits: {
      primary: '#fbbf24', // Gold
      glow: 'rgba(251, 191, 36, 0.2)',
    },
  },
} as const;

// ============= Gradients =============

export const CINEMA_GRADIENTS = {
  // Background gradients
  radialVignette: `radial-gradient(ellipse at center, transparent 0%, ${CINEMA_COLORS.background.primary} 70%)`,
  
  // Card gradients
  cardSubtle: `linear-gradient(135deg, ${CINEMA_COLORS.glass.light} 0%, ${CINEMA_COLORS.glass.subtle} 100%)`,
  cardElevated: `linear-gradient(135deg, ${CINEMA_COLORS.glass.medium} 0%, ${CINEMA_COLORS.glass.light} 100%)`,
  
  // Accent gradients
  primaryGlow: `linear-gradient(135deg, ${CINEMA_COLORS.accent.primary} 0%, ${CINEMA_COLORS.accent.secondary} 100%)`,
  successGlow: `linear-gradient(135deg, ${CINEMA_COLORS.accent.success} 0%, #34d399 100%)`,
  warningGlow: `linear-gradient(135deg, ${CINEMA_COLORS.accent.warning} 0%, #fbbf24 100%)`,
  errorGlow: `linear-gradient(135deg, ${CINEMA_COLORS.accent.error} 0%, #f87171 100%)`,
  
  // Credit-specific
  goldShimmer: 'linear-gradient(90deg, #fbbf24 0%, #f59e0b 50%, #fbbf24 100%)',
  
  // Production status
  processingPulse: 'linear-gradient(90deg, transparent 0%, rgba(6, 182, 212, 0.3) 50%, transparent 100%)',
} as const;

// ============= Shadows =============

export const CINEMA_SHADOWS = {
  // Elevation shadows
  sm: '0 1px 2px rgba(0, 0, 0, 0.5)',
  md: '0 4px 6px rgba(0, 0, 0, 0.5)',
  lg: '0 10px 15px rgba(0, 0, 0, 0.5)',
  xl: '0 20px 25px rgba(0, 0, 0, 0.5)',
  
  // Glow shadows
  primaryGlow: `0 0 20px ${CINEMA_COLORS.accent.primary}40`,
  successGlow: `0 0 20px ${CINEMA_COLORS.accent.success}40`,
  warningGlow: `0 0 20px ${CINEMA_COLORS.accent.warning}40`,
  errorGlow: `0 0 20px ${CINEMA_COLORS.accent.error}40`,
  
  // Inner shadows
  innerSubtle: 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
  innerGlow: 'inset 0 0 20px rgba(255, 255, 255, 0.02)',
} as const;

// ============= Animations =============

export const CINEMA_ANIMATIONS = {
  // Timing functions
  easing: {
    smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    cinematic: 'cubic-bezier(0.16, 1, 0.3, 1)',
  },
  
  // Durations
  duration: {
    instant: '50ms',
    fast: '150ms',
    normal: '250ms',
    slow: '400ms',
    cinematic: '600ms',
  },
  
  // Keyframes for CSS
  keyframes: {
    shimmer: `
      @keyframes shimmer {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }
    `,
    pulse: `
      @keyframes cinema-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
    `,
    glow: `
      @keyframes cinema-glow {
        0%, 100% { filter: drop-shadow(0 0 8px currentColor); }
        50% { filter: drop-shadow(0 0 16px currentColor); }
      }
    `,
  },
} as const;

// ============= Typography =============

export const CINEMA_TYPOGRAPHY = {
  // Font families
  fontFamily: {
    display: 'Inter, system-ui, sans-serif',
    mono: 'JetBrains Mono, monospace',
  },
  
  // Font sizes
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem', // 36px
    '5xl': '3rem',    // 48px
  },
  
  // Line heights
  lineHeight: {
    tight: '1.1',
    snug: '1.25',
    normal: '1.5',
    relaxed: '1.75',
  },
  
  // Letter spacing
  letterSpacing: {
    tight: '-0.025em',
    normal: '0',
    wide: '0.025em',
    wider: '0.05em',
  },
} as const;

// ============= Spacing =============

export const CINEMA_SPACING = {
  // Standard spacing scale
  px: '1px',
  0.5: '0.125rem', // 2px
  1: '0.25rem',    // 4px
  2: '0.5rem',     // 8px
  3: '0.75rem',    // 12px
  4: '1rem',       // 16px
  5: '1.25rem',    // 20px
  6: '1.5rem',     // 24px
  8: '2rem',       // 32px
  10: '2.5rem',    // 40px
  12: '3rem',      // 48px
  16: '4rem',      // 64px
  20: '5rem',      // 80px
  
  // Border radius
  radius: {
    sm: '0.375rem',  // 6px
    md: '0.5rem',    // 8px
    lg: '0.75rem',   // 12px
    xl: '1rem',      // 16px
    '2xl': '1.5rem', // 24px
    full: '9999px',
  },
} as const;

// ============= Component Styles =============

export const CINEMA_COMPONENTS = {
  // Card styles
  card: {
    base: `
      background: ${CINEMA_COLORS.glass.light};
      border: 1px solid ${CINEMA_COLORS.border.light};
      border-radius: ${CINEMA_SPACING.radius.xl};
      backdrop-filter: blur(12px);
    `,
    elevated: `
      background: ${CINEMA_GRADIENTS.cardElevated};
      border: 1px solid ${CINEMA_COLORS.border.medium};
      border-radius: ${CINEMA_SPACING.radius.xl};
      backdrop-filter: blur(16px);
      box-shadow: ${CINEMA_SHADOWS.lg};
    `,
  },
  
  // Button styles
  button: {
    primary: `
      background: ${CINEMA_GRADIENTS.primaryGlow};
      color: white;
      border: none;
      border-radius: ${CINEMA_SPACING.radius.lg};
      box-shadow: ${CINEMA_SHADOWS.primaryGlow};
      transition: all ${CINEMA_ANIMATIONS.duration.fast} ${CINEMA_ANIMATIONS.easing.smooth};
    `,
    ghost: `
      background: transparent;
      color: ${CINEMA_COLORS.text.secondary};
      border: 1px solid ${CINEMA_COLORS.border.subtle};
      border-radius: ${CINEMA_SPACING.radius.lg};
      transition: all ${CINEMA_ANIMATIONS.duration.fast} ${CINEMA_ANIMATIONS.easing.smooth};
    `,
  },
  
  // Input styles
  input: {
    base: `
      background: ${CINEMA_COLORS.glass.subtle};
      border: 1px solid ${CINEMA_COLORS.border.light};
      border-radius: ${CINEMA_SPACING.radius.lg};
      color: ${CINEMA_COLORS.text.primary};
      transition: all ${CINEMA_ANIMATIONS.duration.fast} ${CINEMA_ANIMATIONS.easing.smooth};
    `,
    focus: `
      border-color: ${CINEMA_COLORS.accent.primary};
      box-shadow: 0 0 0 2px ${CINEMA_COLORS.accent.primary}20;
    `,
  },
} as const;

// ============= Tailwind Class Generators =============

/**
 * Generate glassmorphism classes
 */
export function glassClasses(intensity: 'subtle' | 'light' | 'medium' | 'strong' = 'light'): string {
  const bgOpacity = {
    subtle: 'bg-white/[0.02]',
    light: 'bg-white/[0.04]',
    medium: 'bg-white/[0.06]',
    strong: 'bg-white/[0.08]',
  };
  
  const borderOpacity = {
    subtle: 'border-white/[0.04]',
    light: 'border-white/[0.08]',
    medium: 'border-white/[0.12]',
    strong: 'border-white/[0.16]',
  };
  
  return `${bgOpacity[intensity]} backdrop-blur-xl border ${borderOpacity[intensity]}`;
}

/**
 * Generate theme-specific accent classes
 */
export function themeAccentClasses(
  theme: keyof typeof CINEMA_COLORS.themes
): { text: string; bg: string; border: string; glow: string } {
  const themeMap = {
    projects: { text: 'text-orange-400', bg: 'bg-orange-500/20', border: 'border-orange-500/30', glow: 'shadow-orange-500/20' },
    clips: { text: 'text-purple-400', bg: 'bg-purple-500/20', border: 'border-purple-500/30', glow: 'shadow-purple-500/20' },
    universes: { text: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-500/30', glow: 'shadow-amber-500/20' },
    profile: { text: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', glow: 'shadow-emerald-500/20' },
    production: { text: 'text-cyan-400', bg: 'bg-cyan-500/20', border: 'border-cyan-500/30', glow: 'shadow-cyan-500/20' },
    credits: { text: 'text-amber-300', bg: 'bg-amber-500/20', border: 'border-amber-500/30', glow: 'shadow-amber-500/20' },
  };
  
  return themeMap[theme];
}

/**
 * Standard cinema card classes
 */
export const cinemaCardClasses = 
  'bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl transition-all duration-200 hover:border-white/[0.12]';

/**
 * Standard cinema button classes
 */
export const cinemaButtonClasses = {
  primary: 'bg-gradient-to-r from-violet-500 to-cyan-500 text-white border-none shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30 transition-all',
  secondary: 'bg-white/[0.05] text-white/80 border border-white/[0.08] hover:bg-white/[0.08] transition-all',
  ghost: 'bg-transparent text-white/60 hover:text-white hover:bg-white/[0.05] transition-all',
};
