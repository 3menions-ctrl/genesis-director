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
  Film, User, Briefcase, Sparkles, ArrowRight, ArrowLeft, Check,
  Video, Users, Building2, Rocket, Palette, GraduationCap, Loader2, Globe
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { z } from 'zod';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Popular countries list
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

// Sanitize text input to prevent XSS
const sanitizeText = (text: string): string => {
  return text
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
};

const onboardingSchema = z.object({
  fullName: z.string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name is too long')
    .regex(/^[a-zA-Z\s\-'.]+$/, 'Name contains invalid characters'),
  role: z.string().min(1, 'Please select your role'),
  useCase: z.string().min(1, 'Please select how you plan to use the app'),
  company: z.string()
    .max(100, 'Company name is too long')
    .regex(/^[a-zA-Z0-9\s\-'.&]*$/, 'Company name contains invalid characters')
    .optional(),
});

export default function Onboarding() {
  const { user, refreshProfile, loading: authLoading, isSessionVerified } = useAuth();
  const { navigate } = useSafeNavigation();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [direction, setDirection] = useState(1); // 1 for forward, -1 for backward
  
  const [formData, setFormData] = useState({
    fullName: '',
    role: '',
    useCase: '',
    company: '',
    country: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Check session on mount - redirect if not authenticated
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
    // Validate current step
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
    if (step > 1) {
      setDirection(-1);
      setStep(step - 1);
    }
  };

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !loading) {
        if (step < 3) {
          handleNext();
        } else if (formData.useCase) {
          handleComplete();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, formData, loading, handleNext]);

  const handleComplete = async () => {
    // Final validation
    const result = onboardingSchema.safeParse(formData);
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) {
          newErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(newErrors);
      return;
    }

    // Double-check session before save
    if (!user) {
      toast.error('Session expired. Please sign in again.');
      navigate('/auth', { replace: true });
      return;
    }

    setLoading(true);

    try {
      // Sanitize all text inputs before saving
      const sanitizedData = {
        full_name: sanitizeText(formData.fullName),
        display_name: sanitizeText(formData.fullName).split(' ')[0],
        role: formData.role,
        use_case: formData.useCase,
        company: formData.company ? sanitizeText(formData.company) : null,
        country: formData.country || null,
        onboarding_completed: true,
      };

      const { error } = await supabase
        .from('profiles')
        .update(sanitizedData)
        .eq('id', user.id);

      if (error) throw error;

      await refreshProfile();
      toast.success('Welcome to Apex Studio!');
      navigate('/projects', { replace: true });
    } catch (err) {
      console.error('Error saving onboarding:', err);
      toast.error('Failed to save your information');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    if (!user) {
      navigate('/auth', { replace: true });
      return;
    }

    setLoading(true);
    try {
      await supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('id', user.id);

      await refreshProfile();
      navigate('/projects', { replace: true });
    } catch (err) {
      navigate('/projects', { replace: true });
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking session
  if (authLoading || !isSessionVerified || !sessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg"
          >
            <Film className="w-8 h-8 text-white" />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center"
          >
            <p className="text-foreground font-medium">Setting up your studio...</p>
            <p className="text-muted-foreground text-xs mt-1">This only takes a moment</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin"
          />
        </div>
      </div>
    );
  }

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 50 : -50,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction > 0 ? -50 : 50,
      opacity: 0,
    }),
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      {/* Decorative elements - cinematic ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/15 blur-[140px] animate-morph" />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 rounded-full bg-accent/10 blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[180px]" />
      </div>

      <div className="relative w-full max-w-lg animate-fade-in">
        {/* Progress with step indicator */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-500 ease-out",
                  s === step 
                    ? "w-12 bg-primary shadow-sm" 
                    : s < step 
                      ? "w-8 bg-primary/60" 
                      : "w-8 bg-border"
                )}
              />
            ))}
          </div>
          <p className="text-xs text-white/30 font-medium">Step {step} of 3</p>
        </div>

        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent mb-4 shadow-lg shadow-primary/25">
            <span className="text-lg font-bold text-white">AS</span>
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <h1 className="text-2xl font-display font-bold text-white mb-2 tracking-tight">
                {step === 1 && "Welcome! Let's get to know you"}
                {step === 2 && "Select your account type"}
                {step === 3 && "What will you create?"}
              </h1>
              <p className="text-white/50 text-sm">
                {step === 1 && "This helps us personalize your experience"}
                {step === 2 && "Choose the option that best describes how you'll use Apex Studio"}
                {step === 3 && "Choose your primary use case"}
              </p>
            </motion.div>
          </AnimatePresence>
          
          {/* Show email context */}
          {user?.email && (
            <p className="text-xs text-white/30 mt-3 font-medium">
              Signed in as {user.email}
            </p>
          )}
        </div>

        {/* Form Card - Premium dark glass card */}
        <div className="glass-card-dark p-8">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            >
              {/* Step 1: Name */}
              {step === 1 && (
                <div className="space-y-6">
                  <div className="space-y-2.5">
                    <Label htmlFor="fullName" className="text-white text-sm font-medium">
                      What's your name?
                    </Label>
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="John Smith"
                      value={formData.fullName}
                      onChange={(e) => {
                        setFormData({ ...formData, fullName: e.target.value });
                        if (errors.fullName) setErrors({});
                      }}
                      className={cn(
                        "h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30",
                        "focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200",
                        errors.fullName && "border-destructive focus:ring-destructive/10"
                      )}
                      maxLength={100}
                      autoFocus
                    />
                    {errors.fullName && (
                      <p className="text-destructive text-xs font-medium">{errors.fullName}</p>
                    )}
                  </div>

                  <div className="space-y-2.5">
                    <Label htmlFor="company" className="text-white text-sm font-medium">
                      Company or brand <span className="text-white/40 font-normal">(optional)</span>
                    </Label>
                    <Input
                      id="company"
                      type="text"
                      placeholder="Acme Studios"
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      className="h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                      maxLength={100}
                    />
                    {errors.company && (
                      <p className="text-destructive text-xs font-medium">{errors.company}</p>
                    )}
                  </div>

                  <div className="space-y-2.5">
                    <Label htmlFor="country" className="text-white text-sm font-medium flex items-center gap-2">
                      <Globe className="w-4 h-4 text-white/40" />
                      Country <span className="text-white/40 font-normal">(optional)</span>
                    </Label>
                    <Select
                      value={formData.country}
                      onValueChange={(value) => setFormData({ ...formData, country: value })}
                    >
                      <SelectTrigger className="h-12 bg-white/5 border-white/10 text-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200">
                        <SelectValue placeholder="Select your country" className="text-white/30" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {COUNTRIES.map((country) => (
                          <SelectItem key={country.code} value={country.code}>
                            {country.name}
                          </SelectItem>
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
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05, duration: 0.2 }}
                      onClick={() => {
                        setFormData({ ...formData, role: accountType.id });
                        setErrors({});
                      }}
                      className={cn(
                        "w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 text-left group",
                        formData.role === accountType.id
                          ? "border-primary bg-primary/10 shadow-sm shadow-primary/10"
                          : "border-white/10 hover:border-primary/30 hover:bg-white/5"
                      )}
                    >
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200",
                        formData.role === accountType.id 
                          ? "bg-primary text-white shadow-lg shadow-primary/25" 
                          : "bg-white/5 text-white/50 group-hover:bg-white/10"
                      )}>
                        <accountType.icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-white">{accountType.label}</p>
                        <p className="text-xs text-white/40">{accountType.description}</p>
                      </div>
                      {formData.role === accountType.id && (
                        <Check className="w-5 h-5 text-primary shrink-0" />
                      )}
                    </motion.button>
                  ))}
                  {errors.role && (
                    <p className="text-destructive text-xs font-medium">{errors.role}</p>
                  )}
                </div>
              )}

              {/* Step 3: Use Case */}
              {step === 3 && (
                <div className="grid grid-cols-2 gap-3">
                  {USE_CASES.map((useCase, index) => (
                    <motion.button
                      key={useCase.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.04, duration: 0.2 }}
                      onClick={() => {
                        setFormData({ ...formData, useCase: useCase.id });
                        setErrors({});
                      }}
                      className={cn(
                        "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 text-center group",
                        formData.useCase === useCase.id
                          ? "border-primary bg-primary/10 shadow-sm shadow-primary/10"
                          : "border-white/10 hover:border-primary/30 hover:bg-white/5"
                      )}
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200",
                        formData.useCase === useCase.id 
                          ? "bg-primary text-white shadow-lg shadow-primary/25" 
                          : "bg-white/5 text-white/50 group-hover:bg-white/10"
                      )}>
                        <useCase.icon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium text-white text-sm">{useCase.label}</p>
                        <p className="text-white/40 text-xs leading-tight">{useCase.description}</p>
                      </div>
                    </motion.button>
                  ))}
                  {errors.useCase && (
                    <p className="text-destructive text-xs col-span-2 font-medium">{errors.useCase}</p>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Actions */}
          <div className="flex flex-col gap-4 mt-8 pt-6 border-t border-white/10">
            {/* Primary actions row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {step > 1 && (
                  <Button
                    onClick={handleBack}
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-white/50 hover:text-white hover:bg-white/5 transition-all"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </Button>
                )}
              </div>

              {step < 3 ? (
                <Button
                  onClick={handleNext}
                  className="btn-primary h-10 px-5 gap-2"
                >
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleComplete}
                  disabled={loading || !formData.useCase}
                  className="btn-primary h-10 px-5 gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Get Started
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Skip option - always visible and prominent */}
            <div className="text-center">
              <button
                onClick={handleSkip}
                disabled={loading}
                className="text-sm text-white/40 hover:text-white transition-colors font-medium inline-flex items-center gap-1.5 px-4 py-2 rounded-lg hover:bg-white/5"
              >
                Skip and start creating →
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-white/20 mt-4">
          Press Enter to continue
        </p>
      </div>
    </div>
  );
}
