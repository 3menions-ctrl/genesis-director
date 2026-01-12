import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Film, User, Briefcase, Sparkles, ArrowRight, ArrowLeft, Check,
  Video, Users, Building2, Rocket, Palette, GraduationCap, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { z } from 'zod';

const USE_CASES = [
  { id: 'content_creator', label: 'Content Creator', icon: Video, description: 'YouTube, TikTok, Social Media' },
  { id: 'marketer', label: 'Marketing', icon: Rocket, description: 'Ads, Promos, Brand Content' },
  { id: 'filmmaker', label: 'Filmmaker', icon: Film, description: 'Short Films, Documentaries' },
  { id: 'business', label: 'Business', icon: Building2, description: 'Training, Presentations' },
  { id: 'creative', label: 'Creative Agency', icon: Palette, description: 'Client Projects' },
  { id: 'student', label: 'Student', icon: GraduationCap, description: 'Learning, Projects' },
];

const ROLES = [
  { id: 'individual', label: 'Individual Creator', icon: User },
  { id: 'team', label: 'Part of a Team', icon: Users },
  { id: 'agency', label: 'Agency/Studio', icon: Building2 },
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
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [direction, setDirection] = useState(1); // 1 for forward, -1 for backward
  
  const [formData, setFormData] = useState({
    fullName: '',
    role: '',
    useCase: '',
    company: '',
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
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center animate-pulse">
            <Loader2 className="w-8 h-8 text-primary-foreground animate-spin" />
          </div>
          <p className="text-muted-foreground text-sm">Loading...</p>
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
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-primary/5 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-lg">
        {/* Progress with step indicator */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  s === step ? "w-12 bg-primary" : s < step ? "w-8 bg-primary/50" : "w-8 bg-muted"
                )}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Step {step} of 3</p>
        </div>

        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4 shadow-xl shadow-primary/25">
            <Film className="w-7 h-7 text-primary-foreground" />
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <h1 className="text-2xl font-display font-bold text-foreground mb-2">
                {step === 1 && "Welcome! Let's get to know you"}
                {step === 2 && "How will you be using Apex Studio?"}
                {step === 3 && "What will you create?"}
              </h1>
              <p className="text-muted-foreground text-sm">
                {step === 1 && "This helps us personalize your experience"}
                {step === 2 && "Select what best describes you"}
                {step === 3 && "Choose your primary use case"}
              </p>
            </motion.div>
          </AnimatePresence>
          
          {/* Show email context */}
          {user?.email && (
            <p className="text-xs text-muted-foreground/60 mt-3">
              Signed in as {user.email}
            </p>
          )}
        </div>

        {/* Form Card */}
        <div className="p-8 rounded-2xl bg-card border border-border overflow-hidden">
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
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-foreground text-sm">
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
                        "h-12 bg-muted border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20",
                        errors.fullName && "border-destructive"
                      )}
                      maxLength={100}
                      autoFocus
                    />
                    {errors.fullName && (
                      <p className="text-destructive text-xs">{errors.fullName}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="company" className="text-foreground text-sm">
                      Company or brand <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="company"
                      type="text"
                      placeholder="Acme Studios"
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      className="h-12 bg-muted border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20"
                      maxLength={100}
                    />
                    {errors.company && (
                      <p className="text-destructive text-xs">{errors.company}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Step 2: Role */}
              {step === 2 && (
                <div className="space-y-3">
                  {ROLES.map((role) => (
                    <button
                      key={role.id}
                      onClick={() => {
                        setFormData({ ...formData, role: role.id });
                        setErrors({});
                      }}
                      className={cn(
                        "w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left",
                        formData.role === role.id
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-muted-foreground/30 hover:bg-muted/50"
                      )}
                    >
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
                        formData.role === role.id 
                          ? "bg-primary text-primary-foreground" 
                          : "bg-muted text-muted-foreground"
                      )}>
                        <role.icon className="w-5 h-5" />
                      </div>
                      <span className="font-medium text-foreground">{role.label}</span>
                      {formData.role === role.id && (
                        <Check className="w-5 h-5 text-primary ml-auto" />
                      )}
                    </button>
                  ))}
                  {errors.role && (
                    <p className="text-destructive text-xs">{errors.role}</p>
                  )}
                </div>
              )}

              {/* Step 3: Use Case */}
              {step === 3 && (
                <div className="grid grid-cols-2 gap-3">
                  {USE_CASES.map((useCase) => (
                    <button
                      key={useCase.id}
                      onClick={() => {
                        setFormData({ ...formData, useCase: useCase.id });
                        setErrors({});
                      }}
                      className={cn(
                        "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center",
                        formData.useCase === useCase.id
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-muted-foreground/30 hover:bg-muted/50"
                      )}
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                        formData.useCase === useCase.id 
                          ? "bg-primary text-primary-foreground" 
                          : "bg-muted text-muted-foreground"
                      )}>
                        <useCase.icon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground text-sm">{useCase.label}</p>
                        <p className="text-muted-foreground text-xs">{useCase.description}</p>
                      </div>
                    </button>
                  ))}
                  {errors.useCase && (
                    <p className="text-destructive text-xs col-span-2">{errors.useCase}</p>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Actions */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
            <div className="flex items-center gap-3">
              {step > 1 && (
                <Button
                  onClick={handleBack}
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
              )}
              {step === 1 && (
                <button
                  onClick={handleSkip}
                  disabled={loading}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Skip for now
                </button>
              )}
            </div>

            {step < 3 ? (
              <Button
                onClick={handleNext}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-2"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                onClick={handleComplete}
                disabled={loading || !formData.useCase}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-2"
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
        </div>

        {/* Keyboard hint */}
        <p className="text-center text-xs text-muted-foreground/50 mt-4">
          Press Enter to continue
        </p>
      </div>
    </div>
  );
}
