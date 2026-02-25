import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useSafeNavigation } from '@/lib/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Film, User, Sparkles, ArrowRight, ArrowLeft, Check,
  Video, Users, Building2, Rocket, Palette, GraduationCap, Loader2, Globe
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { z } from 'zod';
import { Logo } from '@/components/ui/Logo';
import landingAbstractBg from '@/assets/landing-abstract-bg.jpg';
import authHeroImage from '@/assets/auth-hero-mittens.png';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Floating Particles ─────────────────────────────────────────────
function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 18 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: Math.random() * 3 + 1,
            height: Math.random() * 3 + 1,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            background: i % 3 === 0 
              ? 'hsl(263, 70%, 58%)' 
              : i % 3 === 1 
                ? 'hsl(195, 90%, 50%)' 
                : 'rgba(255,255,255,0.4)',
          }}
          animate={{
            y: [0, -30 - Math.random() * 40, 0],
            opacity: [0, 0.7, 0],
            scale: [0.5, 1.2, 0.5],
          }}
          transition={{
            duration: 4 + Math.random() * 6,
            repeat: Infinity,
            delay: Math.random() * 5,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

// ─── Animated Orb ───────────────────────────────────────────────────
function AnimatedOrb({ className, delay = 0 }: { className?: string; delay?: number }) {
  return (
    <motion.div
      className={cn("absolute rounded-full blur-[120px] pointer-events-none", className)}
      animate={{ scale: [1, 1.2, 1], opacity: [0.15, 0.25, 0.15] }}
      transition={{ duration: 8, repeat: Infinity, delay, ease: 'easeInOut' }}
    />
  );
}

const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'IN', name: 'India' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'GH', name: 'Ghana' },
  { code: 'KE', name: 'Kenya' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
  { code: 'SG', name: 'Singapore' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'PH', name: 'Philippines' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'EG', name: 'Egypt' },
  { code: 'OTHER', name: 'Other' },
].sort((a, b) => a.name.localeCompare(b.name));

const USE_CASES = [
  { id: 'content_creator', label: 'Content Creator', icon: Video, description: 'YouTube, TikTok, Social Media' },
  { id: 'marketer', label: 'Marketing', icon: Rocket, description: 'Ads, Promos, Brand Content' },
  { id: 'filmmaker', label: 'Filmmaker', icon: Film, description: 'Short Films, Documentaries' },
  { id: 'business', label: 'Business', icon: Building2, description: 'Training, Presentations' },
  { id: 'creative', label: 'Creative Agency', icon: Palette, description: 'Client Projects' },
  { id: 'student', label: 'Student', icon: GraduationCap, description: 'Learning, Projects' },
];

const ACCOUNT_TYPES = [
  { id: 'individual', label: 'Individual', icon: User, description: 'Personal projects and solo creation' },
  { id: 'team', label: 'Team', icon: Users, description: 'Collaborate with team members' },
  { id: 'agency', label: 'Agency / Studio', icon: Building2, description: 'Client work and production' },
];

const sanitizeText = (text: string): string => {
  return text.replace(/[<>]/g, '').replace(/javascript:/gi, '').replace(/on\w+=/gi, '').trim();
};

const onboardingSchema = z.object({
  fullName: z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name is too long')
    .regex(/^[a-zA-Z\s\-'.]+$/, 'Name contains invalid characters'),
  role: z.string().min(1, 'Please select your role'),
  useCase: z.string().min(1, 'Please select how you plan to use the app'),
  company: z.string().max(100, 'Company name is too long')
    .regex(/^[a-zA-Z0-9\s\-'.&]*$/, 'Company name contains invalid characters').optional(),
});

const STEP_CONFIG = [
  { title: "What's your name?", subtitle: "Let's personalize your experience", badge: 'Profile setup', icon: User },
  { title: "How will you use Apex?", subtitle: "Select your account type", badge: 'Account type', icon: Users },
  { title: "What will you create?", subtitle: "Choose your primary use case", badge: 'Your focus', icon: Sparkles },
];

export default function Onboarding() {
  const { user, refreshProfile, loading: authLoading, isSessionVerified } = useAuth();
  const { navigate } = useSafeNavigation();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [direction, setDirection] = useState(1);
  
  const [formData, setFormData] = useState({
    fullName: '',
    role: '',
    useCase: '',
    company: '',
    country: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (authLoading || !isSessionVerified) return;
    if (!user) {
      toast.error('Please sign in first');
      navigate('/auth', { replace: true });
      return;
    }
    setSessionChecked(true);
  }, [user, authLoading, isSessionVerified, navigate]);

  const handleNext = useCallback(() => {
    if (step === 1) {
      const result = onboardingSchema.pick({ fullName: true }).safeParse({ fullName: formData.fullName });
      if (!result.success) {
        setErrors({ fullName: result.error.errors[0].message });
        return;
      }
    } else if (step === 2) {
      if (!formData.role) {
        setErrors({ role: 'Please select your role' });
        return;
      }
    }
    setErrors({});
    setDirection(1);
    setStep(step + 1);
  }, [step, formData.fullName, formData.role]);

  const handleBack = () => {
    if (step > 1) { setDirection(-1); setStep(step - 1); }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !loading) {
        if (step < 3) handleNext();
        else if (formData.useCase) handleComplete();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, formData, loading, handleNext]);

  const handleComplete = async () => {
    const result = onboardingSchema.safeParse(formData);
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.errors.forEach(err => { if (err.path[0]) newErrors[err.path[0] as string] = err.message; });
      setErrors(newErrors);
      return;
    }
    if (!user) { toast.error('Session expired.'); navigate('/auth', { replace: true }); return; }

    setLoading(true);
    try {
      const sanitizedData = {
        full_name: sanitizeText(formData.fullName),
        display_name: sanitizeText(formData.fullName).split(' ')[0],
        role: formData.role,
        use_case: formData.useCase,
        company: formData.company ? sanitizeText(formData.company) : null,
        country: formData.country || null,
        onboarding_completed: true,
      };
      const { error } = await supabase.from('profiles').update(sanitizedData).eq('id', user.id);
      if (error) throw error;
      await refreshProfile();
      toast.success('Welcome to Apex Studio!');
      navigate('/create', { replace: true });
    } catch (err) {
      console.error('Error saving onboarding:', err);
      toast.error('Failed to save your information');
    } finally {
      setLoading(false);
    }
  };

  // Onboarding is mandatory — no skip option

  if (authLoading || !isSessionVerified || !sessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(250,15%,3%)]">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4">
          <Logo size="xl" />
          <p className="text-white/60 text-sm">Setting up your studio...</p>
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </motion.div>
      </div>
    );
  }

  const slideVariants = {
    enter: (d: number) => ({ x: d > 0 ? 50 : -50, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -50 : 50, opacity: 0 }),
  };

  const currentStep = STEP_CONFIG[step - 1];

  return (
    <div className="min-h-screen flex relative overflow-hidden">
      {/* Deep cinematic background */}
      <div className="fixed inset-0 bg-[hsl(250,15%,3%)]" />
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-20"
        style={{ backgroundImage: `url(${landingAbstractBg})` }}
      />
      
      {/* Animated orbs */}
      <AnimatedOrb className="w-[700px] h-[700px] bg-primary/20 top-[-200px] left-[10%]" />
      <AnimatedOrb className="w-[500px] h-[500px] bg-accent/15 bottom-[-100px] right-[15%]" delay={3} />
      
      {/* Grid overlay */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />
      
      {/* Vignette */}
      <div className="fixed inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.7) 100%)' }}
      />

      {/* Left Side - Hero Image */}
      <div className="hidden lg:flex lg:w-1/2 relative z-10 items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <motion.img 
            src={authHeroImage}
            alt="Apex Studio"
            className="w-full h-full object-cover object-center"
            initial={{ scale: 1.1, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[hsl(250,15%,3%)]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[hsl(250,15%,3%)]/80 via-transparent to-[hsl(250,15%,3%)]/60" />
          <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-black/50 to-transparent" />
          <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-black/50 to-transparent" />
        </div>
        
        <FloatingParticles />
        
        <div className="relative z-10 p-12 xl:p-16 w-full h-full flex flex-col justify-between">
          <motion.div 
            className="flex items-center gap-3"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Logo size="xl" showText textClassName="text-2xl font-display font-bold drop-shadow-lg" />
          </motion.div>
          
          <div className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.8 }}
            >
              <h2 className="text-5xl xl:text-7xl font-display font-bold text-white leading-[1.05] tracking-tight">
                Almost<br />
                <span className="bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_auto] animate-[shimmer-bg_4s_ease-in-out_infinite] bg-clip-text text-transparent">
                  there.
                </span>
              </h2>
            </motion.div>
            
            <motion.p 
              className="text-lg text-white/40 max-w-md leading-relaxed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              Tell us a bit about yourself so we can personalize your creative studio experience.
            </motion.p>

            {/* Step indicators on the hero side */}
            <div className="space-y-3 max-w-xs">
              {STEP_CONFIG.map((s, i) => (
                <motion.div 
                  key={i} 
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-500",
                    step > i + 1
                      ? "bg-emerald-500/10 border border-emerald-500/20"
                      : step === i + 1
                        ? "bg-white/[0.08] border border-white/[0.15] shadow-[0_0_20px_rgba(124,58,237,0.1)]"
                        : "bg-white/[0.02] border border-white/[0.04]"
                  )}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 + i * 0.1 }}
                >
                  <div className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 transition-all duration-500",
                    step > i + 1
                      ? "bg-emerald-500/20 text-emerald-400"
                      : step === i + 1
                        ? "bg-gradient-to-br from-primary/30 to-accent/20 text-primary shadow-[0_0_15px_rgba(124,58,237,0.2)]"
                        : "bg-white/[0.03] text-white/20"
                  )}>
                    {step > i + 1 ? <Check className="w-4 h-4" /> : <s.icon className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className={cn(
                      "text-sm font-medium transition-colors duration-500",
                      step > i + 1 ? "text-emerald-400/80" : step === i + 1 ? "text-white" : "text-white/20"
                    )}>
                      {s.title}
                    </p>
                    <p className={cn(
                      "text-[11px] transition-colors duration-500",
                      step > i + 1 ? "text-emerald-400/40" : step === i + 1 ? "text-white/35" : "text-white/10"
                    )}>
                      {s.subtitle}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative z-10">
        <FloatingParticles />
        
        <motion.div 
          className="w-full max-w-[500px] relative"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center mb-4">
              <Logo size="xl" />
            </div>
            <h1 className="text-xl font-display font-bold text-white/90">Apex Studio</h1>
          </div>

          {/* Progress bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-white/25 font-medium">Step {step} of 3</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden relative">
              <motion.div
                className="h-full rounded-full relative overflow-hidden"
                style={{ background: 'linear-gradient(90deg, hsl(263, 70%, 58%), hsl(195, 90%, 50%))' }}
                initial={false}
                animate={{ width: `${(step / 3) * 100}%` }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              >
                {/* Shimmer on progress bar */}
                <div className="absolute inset-0 animate-[shimmer-bg_2s_ease-in-out_infinite]"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)', backgroundSize: '200% 100%' }}
                />
              </motion.div>
            </div>
          </div>

          {/* Glass container with animated border */}
          <div className="relative rounded-[28px] overflow-hidden">
            {/* Animated gradient border */}
            <div className="absolute inset-0 rounded-[28px] p-[1px] overflow-hidden">
              <div 
                className="absolute inset-[-100%] animate-[spin_8s_linear_infinite]"
                style={{ background: 'conic-gradient(from 0deg, transparent, hsl(263, 70%, 58%), transparent, hsl(195, 90%, 50%), transparent)' }}
              />
            </div>
            
            {/* Inner container */}
            <div className="relative rounded-[27px] m-[1px] bg-[hsl(250,15%,5%)]/95 backdrop-blur-2xl overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[200px] bg-primary/5 blur-[80px] rounded-full" />
              
              <div className="relative p-8 sm:p-10">
                {/* Header */}
                <div className="mb-8">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={step}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-gradient-to-r from-primary/15 to-accent/10 border border-primary/20 mb-5">
                        <motion.div 
                          className="w-1.5 h-1.5 rounded-full bg-primary"
                          animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                        <span className="text-xs font-medium bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                          {currentStep.badge}
                        </span>
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-display font-bold text-white mb-2 tracking-tight">
                        {currentStep.title}
                      </h2>
                      <p className="text-white/35 text-sm">{currentStep.subtitle}</p>
                    </motion.div>
                  </AnimatePresence>
                  
                  {user?.email && (
                    <p className="text-xs text-white/15 mt-3">{user.email}</p>
                  )}
                </div>

                {/* Step Content */}
                <AnimatePresence mode="wait" custom={direction}>
                  <motion.div
                    key={step}
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.35, ease: 'easeInOut' }}
                  >
                    {/* Step 1: Name */}
                    {step === 1 && (
                      <div className="space-y-5">
                        <div className="space-y-2">
                          <Label htmlFor="fullName" className="text-white/60 text-xs font-medium uppercase tracking-wider">
                            Full name
                          </Label>
                          <div className="relative group">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 group-focus-within:text-primary transition-colors duration-300" />
                            <Input
                              id="fullName"
                              type="text"
                              placeholder="John Smith"
                              value={formData.fullName}
                              onChange={(e) => { setFormData({ ...formData, fullName: e.target.value }); if (errors.fullName) setErrors({}); }}
                              className={cn(
                                "h-13 pl-11 bg-white/[0.03] border-white/[0.06] text-white placeholder:text-white/20",
                                "focus:border-primary/50 focus:ring-2 focus:ring-primary/15 focus:bg-white/[0.05]",
                                "rounded-xl transition-all duration-300 hover:border-white/[0.12] hover:bg-white/[0.04]",
                                errors.fullName && "border-destructive/50"
                              )}
                              maxLength={100}
                              autoFocus
                            />
                          </div>
                          {errors.fullName && <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-destructive text-xs">{errors.fullName}</motion.p>}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="company" className="text-white/60 text-xs font-medium uppercase tracking-wider">
                            Company <span className="text-white/20 normal-case">(optional)</span>
                          </Label>
                          <div className="relative group">
                            <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 group-focus-within:text-primary transition-colors duration-300" />
                            <Input
                              id="company"
                              type="text"
                              placeholder="Acme Studios"
                              value={formData.company}
                              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                              className="h-13 pl-11 bg-white/[0.03] border-white/[0.06] text-white placeholder:text-white/20 focus:border-primary/50 focus:ring-2 focus:ring-primary/15 focus:bg-white/[0.05] rounded-xl transition-all duration-300 hover:border-white/[0.12] hover:bg-white/[0.04]"
                              maxLength={100}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="country" className="text-white/60 text-xs font-medium uppercase tracking-wider flex items-center gap-2">
                            <Globe className="w-3.5 h-3.5 text-white/25" />
                            Country <span className="text-white/20 normal-case">(optional)</span>
                          </Label>
                          <Select value={formData.country} onValueChange={(value) => setFormData({ ...formData, country: value })}>
                            <SelectTrigger className="h-13 bg-white/[0.03] border-white/[0.06] text-white focus:border-primary/50 focus:ring-2 focus:ring-primary/15 rounded-xl transition-all hover:border-white/[0.12] hover:bg-white/[0.04]">
                              <SelectValue placeholder="Select your country" />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                              {COUNTRIES.map((c) => (
                                <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {/* Step 2: Account Type */}
                    {step === 2 && (
                      <div className="space-y-3">
                        {ACCOUNT_TYPES.map((accountType, index) => (
                          <motion.button
                            key={accountType.id}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.08 }}
                            onClick={() => { setFormData({ ...formData, role: accountType.id }); setErrors({}); }}
                            className={cn(
                              "w-full flex items-center gap-4 p-5 rounded-2xl border transition-all duration-300 text-left group",
                              formData.role === accountType.id
                                ? "border-primary/40 bg-primary/[0.08] shadow-[0_0_20px_rgba(124,58,237,0.1)]"
                                : "border-white/[0.05] hover:border-white/[0.1] hover:bg-white/[0.02]"
                            )}
                          >
                            <div className={cn(
                              "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 shrink-0",
                              formData.role === accountType.id 
                                ? "bg-gradient-to-br from-primary to-primary/80 text-white shadow-lg shadow-primary/25" 
                                : "bg-white/[0.04] text-white/30 group-hover:bg-white/[0.06] group-hover:text-white/50"
                            )}>
                              <accountType.icon className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-white text-sm">{accountType.label}</p>
                              <p className="text-xs text-white/30 truncate">{accountType.description}</p>
                            </div>
                            {formData.role === accountType.id && (
                              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300 }} className="shrink-0">
                                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                                  <Check className="w-3.5 h-3.5 text-primary" />
                                </div>
                              </motion.div>
                            )}
                          </motion.button>
                        ))}
                        {errors.role && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-destructive text-xs">{errors.role}</motion.p>}
                      </div>
                    )}

                    {/* Step 3: Use Case */}
                    {step === 3 && (
                      <div className="grid grid-cols-2 gap-3">
                        {USE_CASES.map((useCase, index) => (
                          <motion.button
                            key={useCase.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.05, type: 'spring', stiffness: 200 }}
                            onClick={() => { setFormData({ ...formData, useCase: useCase.id }); setErrors({}); }}
                            className={cn(
                              "flex flex-col items-center gap-3 p-5 rounded-2xl border transition-all duration-300 text-center group",
                              formData.useCase === useCase.id
                                ? "border-primary/40 bg-primary/[0.08] shadow-[0_0_20px_rgba(124,58,237,0.1)]"
                                : "border-white/[0.05] hover:border-white/[0.1] hover:bg-white/[0.02]"
                            )}
                          >
                            <div className={cn(
                              "w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300",
                              formData.useCase === useCase.id 
                                ? "bg-gradient-to-br from-primary to-primary/80 text-white shadow-lg shadow-primary/25" 
                                : "bg-white/[0.04] text-white/30 group-hover:bg-white/[0.06] group-hover:text-white/50"
                            )}>
                              <useCase.icon className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-semibold text-white text-sm">{useCase.label}</p>
                              <p className="text-white/25 text-[11px] leading-tight mt-0.5">{useCase.description}</p>
                            </div>
                          </motion.button>
                        ))}
                        {errors.useCase && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-destructive text-xs col-span-2">{errors.useCase}</motion.p>}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>

                {/* Actions */}
                <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/[0.04]">
                  <div>
                    {step > 1 && (
                      <Button onClick={handleBack} variant="ghost" size="sm"
                        className="gap-1.5 text-white/30 hover:text-white hover:bg-white/[0.04]">
                        <ArrowLeft className="w-4 h-4" /> Back
                      </Button>
                    )}
                  </div>

                  {step < 3 ? (
                    <Button onClick={handleNext}
                      className="h-12 px-8 bg-gradient-to-r from-white to-white/95 text-black hover:from-white/95 hover:to-white/90 rounded-xl font-semibold text-sm gap-2 shadow-[0_0_25px_rgba(255,255,255,0.08)] hover:shadow-[0_0_35px_rgba(255,255,255,0.12)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300">
                      Continue <ArrowRight className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Button onClick={handleComplete} disabled={loading || !formData.useCase}
                      className="h-12 px-8 bg-gradient-to-r from-primary to-primary/90 text-white hover:from-primary/90 hover:to-primary/80 rounded-xl font-semibold text-sm gap-2 shadow-[0_0_25px_rgba(124,58,237,0.2)] hover:shadow-[0_0_35px_rgba(124,58,237,0.35)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300">
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-4 h-4" /> Get Started</>}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <p className="text-center text-[11px] text-white/10 mt-5">Press Enter to continue</p>
        </motion.div>
      </div>
    </div>
  );
}
