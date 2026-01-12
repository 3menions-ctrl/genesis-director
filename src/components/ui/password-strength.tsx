import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Check, X } from 'lucide-react';

interface PasswordStrengthProps {
  password: string;
  className?: string;
}

interface PasswordRequirement {
  label: string;
  met: boolean;
}

export function PasswordStrength({ password, className }: PasswordStrengthProps) {
  const requirements = useMemo((): PasswordRequirement[] => {
    return [
      { label: 'At least 8 characters', met: password.length >= 8 },
      { label: 'Contains uppercase letter', met: /[A-Z]/.test(password) },
      { label: 'Contains lowercase letter', met: /[a-z]/.test(password) },
      { label: 'Contains number', met: /[0-9]/.test(password) },
      { label: 'Contains special character', met: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
    ];
  }, [password]);

  const strength = useMemo(() => {
    const metCount = requirements.filter(r => r.met).length;
    if (metCount === 0) return { level: 0, label: '', color: '' };
    if (metCount <= 2) return { level: 1, label: 'Weak', color: 'bg-red-500' };
    if (metCount <= 3) return { level: 2, label: 'Fair', color: 'bg-orange-500' };
    if (metCount <= 4) return { level: 3, label: 'Good', color: 'bg-yellow-500' };
    return { level: 4, label: 'Strong', color: 'bg-emerald-500' };
  }, [requirements]);

  if (!password) return null;

  return (
    <div className={cn('space-y-3', className)}>
      {/* Strength meter */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Password strength</span>
          <span className={cn(
            'text-xs font-medium',
            strength.level <= 1 && 'text-red-400',
            strength.level === 2 && 'text-orange-400',
            strength.level === 3 && 'text-yellow-400',
            strength.level === 4 && 'text-emerald-400',
          )}>
            {strength.label}
          </span>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((level) => (
            <div
              key={level}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors',
                level <= strength.level ? strength.color : 'bg-white/10'
              )}
            />
          ))}
        </div>
      </div>

      {/* Requirements checklist */}
      <div className="grid grid-cols-1 gap-1.5">
        {requirements.map((req, i) => (
          <div key={i} className="flex items-center gap-2">
            {req.met ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <X className="w-3.5 h-3.5 text-white/30" />
            )}
            <span className={cn(
              'text-xs',
              req.met ? 'text-white/60' : 'text-white/30'
            )}>
              {req.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
