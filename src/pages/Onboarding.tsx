import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  Film, User, Briefcase, Sparkles, ArrowRight, Check,
  Video, Users, Building2, Rocket, Palette, GraduationCap
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

const onboardingSchema = z.object({
  fullName: z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name is too long'),
  role: z.string().min(1, 'Please select your role'),
  useCase: z.string().min(1, 'Please select how you plan to use the app'),
  company: z.string().max(100, 'Company name is too long').optional(),
});

export default function Onboarding() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    fullName: '',
    role: '',
    useCase: '',
    company: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleNext = () => {
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
    setStep(step + 1);
  };

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

    if (!user) {
      toast.error('Please sign in first');
      navigate('/auth');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.fullName.trim(),
          display_name: formData.fullName.trim().split(' ')[0],
          role: formData.role,
          use_case: formData.useCase,
          company: formData.company.trim() || null,
          onboarding_completed: true,
        })
        .eq('id', user.id);

      if (error) throw error;

      await refreshProfile();
      toast.success('Welcome to Apex Studio!');
      navigate('/projects');
    } catch (err) {
      console.error('Error saving onboarding:', err);
      toast.error('Failed to save your information');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    setLoading(true);
    try {
      await supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('id', user.id);

      await refreshProfile();
      navigate('/projects');
    } catch (err) {
      navigate('/projects');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{
      background: 'linear-gradient(135deg, hsl(262 35% 15%) 0%, hsl(262 40% 8%) 100%)'
    }}>
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-violet-500/10 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-purple-500/10 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                s === step ? "w-12 bg-violet-500" : s < step ? "w-8 bg-violet-500/50" : "w-8 bg-white/10"
              )}
            />
          ))}
        </div>

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 mb-4 shadow-xl shadow-violet-500/25">
            <Film className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-display font-bold text-white mb-2">
            {step === 1 && "Welcome! Let's get to know you"}
            {step === 2 && "How will you be using Apex Studio?"}
            {step === 3 && "What will you create?"}
          </h1>
          <p className="text-violet-300/70 text-sm">
            {step === 1 && "This helps us personalize your experience"}
            {step === 2 && "Select what best describes you"}
            {step === 3 && "Choose your primary use case"}
          </p>
        </div>

        {/* Form Card */}
        <div className="card-dark p-8">
          {/* Step 1: Name */}
          {step === 1 && (
            <div className="space-y-6 animate-fade-in">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-violet-200 text-sm">
                  What's your name?
                </Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="John Smith"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="h-12 bg-white/5 border-white/10 text-white placeholder:text-violet-400/50 focus:border-violet-500 focus:ring-violet-500/20"
                  maxLength={100}
                />
                {errors.fullName && (
                  <p className="text-red-400 text-xs">{errors.fullName}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="company" className="text-violet-200 text-sm">
                  Company or brand <span className="text-violet-400/50">(optional)</span>
                </Label>
                <Input
                  id="company"
                  type="text"
                  placeholder="Acme Studios"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="h-12 bg-white/5 border-white/10 text-white placeholder:text-violet-400/50 focus:border-violet-500 focus:ring-violet-500/20"
                  maxLength={100}
                />
              </div>
            </div>
          )}

          {/* Step 2: Role */}
          {step === 2 && (
            <div className="space-y-3 animate-fade-in">
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
                      ? "border-violet-500 bg-violet-500/10"
                      : "border-white/10 hover:border-white/20 hover:bg-white/5"
                  )}
                >
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
                    formData.role === role.id 
                      ? "bg-violet-500 text-white" 
                      : "bg-white/10 text-violet-300"
                  )}>
                    <role.icon className="w-5 h-5" />
                  </div>
                  <span className="font-medium text-white">{role.label}</span>
                  {formData.role === role.id && (
                    <Check className="w-5 h-5 text-violet-400 ml-auto" />
                  )}
                </button>
              ))}
              {errors.role && (
                <p className="text-red-400 text-xs">{errors.role}</p>
              )}
            </div>
          )}

          {/* Step 3: Use Case */}
          {step === 3 && (
            <div className="grid grid-cols-2 gap-3 animate-fade-in">
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
                      ? "border-violet-500 bg-violet-500/10"
                      : "border-white/10 hover:border-white/20 hover:bg-white/5"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                    formData.useCase === useCase.id 
                      ? "bg-violet-500 text-white" 
                      : "bg-white/10 text-violet-300"
                  )}>
                    <useCase.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-medium text-white text-sm">{useCase.label}</p>
                    <p className="text-violet-400/60 text-xs">{useCase.description}</p>
                  </div>
                </button>
              ))}
              {errors.useCase && (
                <p className="text-red-400 text-xs col-span-2">{errors.useCase}</p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/10">
            <button
              onClick={handleSkip}
              disabled={loading}
              className="text-sm text-violet-400/60 hover:text-violet-300 transition-colors"
            >
              Skip for now
            </button>

            {step < 3 ? (
              <Button
                onClick={handleNext}
                className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-medium gap-2"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                onClick={handleComplete}
                disabled={loading || !formData.useCase}
                className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-medium gap-2"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
      </div>
    </div>
  );
}
