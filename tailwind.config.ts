import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
          muted: "hsl(var(--destructive-muted))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
          muted: "hsl(var(--warning-muted))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
          muted: "hsl(var(--success-muted))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
          muted: "hsl(var(--info-muted))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // Glass overlay semantic colors
        glass: {
          DEFAULT: "hsl(var(--glass-bg))",
          hover: "hsl(var(--glass-bg-hover))",
          active: "hsl(var(--glass-bg-active))",
          border: "hsl(var(--glass-border))",
          "border-hover": "hsl(var(--glass-border-hover))",
          text: "hsl(var(--glass-text))",
          "text-muted": "hsl(var(--glass-text-muted))",
          "text-subtle": "hsl(var(--glass-text-subtle))",
        },
      },
      fontFamily: {
        sans: ['Instrument Sans', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        display: ['Sora', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
        "3xl": "calc(var(--radius) + 16px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "1" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(100%)", opacity: "0" },
          "10%": { opacity: "1" },
          "90%": { opacity: "1" },
          "100%": { transform: "translateY(-100vh)", opacity: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        waveform: {
          "0%, 100%": { transform: "scaleY(0.5)" },
          "50%": { transform: "scaleY(1)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.8", transform: "scale(0.98)" },
        },
        orbit: {
          "0%": { transform: "rotate(0deg) translateX(40px) rotate(0deg)" },
          "100%": { transform: "rotate(360deg) translateX(40px) rotate(-360deg)" },
        },
        // GPU-accelerated loader animations
        "loader-ring-pulse": {
          "0%, 100%": { transform: "scale(1)", opacity: "0.3" },
          "50%": { transform: "scale(1.2)", opacity: "0.1" },
        },
        "loader-ring-inner": {
          "0%, 100%": { transform: "scale(1)", opacity: "0.5" },
          "50%": { transform: "scale(1.1)", opacity: "0.2" },
        },
        "loader-glow": {
          "0%, 100%": { transform: "scale(1)", opacity: "0.3" },
          "50%": { transform: "scale(1.3)", opacity: "0.6" },
        },
        "loader-progress": {
          "0%": { width: "0%" },
          "30%": { width: "30%" },
          "60%": { width: "60%" },
          "80%": { width: "80%" },
          "100%": { width: "100%" },
        },
        "loader-shine": {
          "0%": { left: "-10%" },
          "100%": { left: "100%" },
        },
        "loader-light-ray": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        "loader-particle": {
          "0%, 100%": { transform: "translate(0, 0) scale(0.5)", opacity: "0" },
          "50%": { opacity: "0.8", transform: "var(--particle-end) scale(1)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-glow": "pulse-glow 2.5s ease-in-out infinite",
        shimmer: "shimmer 2s linear infinite",
        "spin-slow": "spin-slow 3s linear infinite",
        float: "float 4s ease-in-out infinite",
        "fade-in": "fade-in 0.5s ease-out forwards",
        "scale-in": "scale-in 0.35s ease-out forwards",
        waveform: "waveform 0.8s ease-in-out infinite",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        orbit: "orbit 3s linear infinite",
        // GPU-accelerated loader animations
        "loader-ring-pulse": "loader-ring-pulse 2s ease-in-out infinite",
        "loader-ring-inner": "loader-ring-inner 2s ease-in-out infinite 0.3s",
        "loader-glow": "loader-glow 3s ease-in-out infinite",
        "loader-progress": "loader-progress 3s ease-in-out infinite",
        "loader-shine": "loader-shine 1.5s ease-in-out infinite",
        "loader-particle": "loader-particle 3s ease-in-out infinite",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        shimmer: "linear-gradient(90deg, transparent, hsl(45 60% 100% / 0.4), transparent)",
        aurora: "linear-gradient(135deg, hsl(45 60% 97%), hsl(340 60% 95%), hsl(195 60% 95%), hsl(45 60% 97%))",
        "warm-gradient": "linear-gradient(135deg, hsl(16 100% 58%), hsl(45 100% 55%), hsl(340 85% 58%))",
        "sunset-gradient": "linear-gradient(180deg, hsl(16 100% 58% / 0.12), hsl(45 100% 55% / 0.08), hsl(340 85% 58% / 0.05), transparent)",
        "vibrant-mesh": "radial-gradient(at 40% 20%, hsl(16 100% 58% / 0.15) 0px, transparent 50%), radial-gradient(at 80% 0%, hsl(340 85% 58% / 0.12) 0px, transparent 50%), radial-gradient(at 0% 50%, hsl(45 100% 55% / 0.1) 0px, transparent 50%), radial-gradient(at 80% 100%, hsl(195 100% 50% / 0.1) 0px, transparent 50%)",
      },
      boxShadow: {
        'glass': '0 8px 32px hsl(20 30% 20% / 0.05), inset 0 0 0 1px hsl(30 30% 100% / 0.15)',
        'glass-dark': '0 8px 32px hsl(20 20% 10% / 0.3), inset 0 1px 0 hsl(30 30% 100% / 0.08)',
        'premium': '0 4px 24px hsl(20 30% 20% / 0.05), 0 1px 4px hsl(20 30% 20% / 0.03)',
        'premium-hover': '0 8px 40px hsl(20 30% 20% / 0.08), 0 2px 8px hsl(20 30% 20% / 0.04)',
        'warm-glow': '0 0 40px hsl(24 95% 53% / 0.2)',
        'golden-glow': '0 0 40px hsl(38 92% 50% / 0.25)',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
