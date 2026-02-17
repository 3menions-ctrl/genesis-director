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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  { title: "What's your name?", subtitle: "Let's personalize your experience" },
  { title: "How will you use Apex?", subtitle: "Select your account type" },
  { title: "What will you create?", subtitle: "Choose your primary use case" },
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
      navigate('/projects', { replace: true });
    } catch (err) {
      console.error('Error saving onboarding:', err);
      toast.error('Failed to save your information');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    if (!user) { navigate('/auth', { replace: true }); return; }
    setLoading(true);
    try {
      await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', user.id);
      await refreshProfile();
      navigate('/projects', { replace: true });
    } catch { navigate('/projects', { replace: true }); } finally { setLoading(false); }
  };

  if (authLoading || !isSessionVerified || !sessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(240,10%,4%)]">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Film className="w-7 h-7 text-white" />
          </div>
          <p className="text-white/60 text-sm">Setting up your studio...</p>
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </motion.div>
      </div>
    );
  }

  const slideVariants = {
    enter: (d: number) => ({ x: d > 0 ? 40 : -40, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -40 : 40, opacity: 0 }),
  };

  const currentStep = STEP_CONFIG[step - 1];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[hsl(240,10%,4%)] relative overflow-hidden">
      {/* Ambient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] rounded-full bg-primary/8 blur-[180px]" />
        <div className="absolute bottom-1/4 right-1/3 w-[400px] h-[400px] rounded-full bg-accent/6 blur-[150px]" />
      </div>

      <motion.div 
        className="relative w-full max-w-[480px]"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Progress bar */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-white/30 font-medium">Step {step} of 3</span>
            <button
              onClick={handleSkip}
              disabled={loading}
              className="text-xs text-white/30 hover:text-white/60 transition-colors"
            >
              Skip →
            </button>
          </div>
          <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
              initial={false}
              animate={{ width: `${(step / 3) * 100}%` }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-white mb-2 tracking-tight">
                {currentStep.title}
              </h1>
              <p className="text-white/40 text-sm">{currentStep.subtitle}</p>
            </motion.div>
          </AnimatePresence>
          
          {user?.email && (
            <p className="text-xs text-white/20 mt-3">{user.email}</p>
          )}
        </div>

        {/* Card */}
        <div className="relative rounded-3xl overflow-hidden">
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-white/[0.10] to-white/[0.03] p-px">
            <div className="w-full h-full rounded-3xl bg-[hsl(240,10%,6%)]/90 backdrop-blur-xl" />
          </div>
          
          <div className="relative p-8">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={step}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: 'easeInOut' }}
              >
                {/* Step 1: Name */}
                {step === 1 && (
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="fullName" className="text-white/70 text-xs font-medium uppercase tracking-wider">
                        Full name
                      </Label>
                      <Input
                        id="fullName"
                        type="text"
                        placeholder="John Smith"
                        value={formData.fullName}
                        onChange={(e) => { setFormData({ ...formData, fullName: e.target.value }); if (errors.fullName) setErrors({}); }}
                        className={cn(
                          "h-12 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25",
                          "focus:border-primary/40 focus:ring-2 focus:ring-primary/10 rounded-xl transition-all",
                          errors.fullName && "border-destructive/50"
                        )}
                        maxLength={100}
                        autoFocus
                      />
                      {errors.fullName && <p className="text-destructive text-xs">{errors.fullName}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="company" className="text-white/70 text-xs font-medium uppercase tracking-wider">
                        Company <span className="text-white/30 normal-case">(optional)</span>
                      </Label>
                      <Input
                        id="company"
                        type="text"
                        placeholder="Acme Studios"
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        className="h-12 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25 focus:border-primary/40 focus:ring-2 focus:ring-primary/10 rounded-xl transition-all"
                        maxLength={100}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="country" className="text-white/70 text-xs font-medium uppercase tracking-wider flex items-center gap-2">
                        <Globe className="w-3.5 h-3.5 text-white/30" />
                        Country <span className="text-white/30 normal-case">(optional)</span>
                      </Label>
                      <Select value={formData.country} onValueChange={(value) => setFormData({ ...formData, country: value })}>
                        <SelectTrigger className="h-12 bg-white/[0.04] border-white/[0.08] text-white focus:border-primary/40 focus:ring-2 focus:ring-primary/10 rounded-xl transition-all">
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
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.06 }}
                        onClick={() => { setFormData({ ...formData, role: accountType.id }); setErrors({}); }}
                        className={cn(
                          "w-full flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300 text-left group",
                          formData.role === accountType.id
                            ? "border-primary/40 bg-primary/[0.08]"
                            : "border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.03]"
                        )}
                      >
                        <div className={cn(
                          "w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 shrink-0",
                          formData.role === accountType.id 
                            ? "bg-primary text-white shadow-lg shadow-primary/25" 
                            : "bg-white/[0.05] text-white/40 group-hover:bg-white/[0.08]"
                        )}>
                          <accountType.icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white text-sm">{accountType.label}</p>
                          <p className="text-xs text-white/35 truncate">{accountType.description}</p>
                        </div>
                        {formData.role === accountType.id && (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="shrink-0">
                            <Check className="w-4 h-4 text-primary" />
                          </motion.div>
                        )}
                      </motion.button>
                    ))}
                    {errors.role && <p className="text-destructive text-xs">{errors.role}</p>}
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
                        transition={{ delay: index * 0.04 }}
                        onClick={() => { setFormData({ ...formData, useCase: useCase.id }); setErrors({}); }}
                        className={cn(
                          "flex flex-col items-center gap-2.5 p-4 rounded-2xl border transition-all duration-300 text-center group",
                          formData.useCase === useCase.id
                            ? "border-primary/40 bg-primary/[0.08]"
                            : "border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.03]"
                        )}
                      >
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300",
                          formData.useCase === useCase.id 
                            ? "bg-primary text-white shadow-lg shadow-primary/25" 
                            : "bg-white/[0.05] text-white/40 group-hover:bg-white/[0.08]"
                        )}>
                          <useCase.icon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-medium text-white text-sm">{useCase.label}</p>
                          <p className="text-white/30 text-[11px] leading-tight mt-0.5">{useCase.description}</p>
                        </div>
                      </motion.button>
                    ))}
                    {errors.useCase && <p className="text-destructive text-xs col-span-2">{errors.useCase}</p>}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Actions */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/[0.06]">
              <div>
                {step > 1 && (
                  <Button onClick={handleBack} variant="ghost" size="sm"
                    className="gap-1.5 text-white/40 hover:text-white hover:bg-white/[0.05]">
                    <ArrowLeft className="w-4 h-4" /> Back
                  </Button>
                )}
              </div>

              {step < 3 ? (
                <Button onClick={handleNext}
                  className="h-10 px-6 bg-white text-black hover:bg-white/90 rounded-xl font-semibold text-sm gap-2 shadow-lg shadow-white/5 hover:scale-[1.02] active:scale-[0.98] transition-all">
                  Continue <ArrowRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button onClick={handleComplete} disabled={loading || !formData.useCase}
                  className="h-10 px-6 bg-white text-black hover:bg-white/90 rounded-xl font-semibold text-sm gap-2 shadow-lg shadow-white/5 hover:scale-[1.02] active:scale-[0.98] transition-all">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-4 h-4" /> Get Started</>}
                </Button>
              )}
            </div>
          </div>
        </div>

        <p className="text-center text-[11px] text-white/15 mt-5">Press Enter to continue</p>
      </motion.div>
    </div>
  );
}
