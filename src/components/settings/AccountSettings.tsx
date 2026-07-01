import { useState, useRef, useEffect, memo, forwardRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeNavigation } from '@/lib/navigation';
import { supabase } from '@/integrations/supabase/client';
import { confirmAsync } from '@/components/ui/global-confirm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { 
  User, Camera, Mail, Building2, Briefcase, 
  Save, Loader2, CheckCircle2, Edit3, Crown, AlertCircle, UserX, Power
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { z } from 'zod';

const emailSchema = z.string().email('Please enter a valid email address').max(255);

export const AccountSettings = memo(forwardRef<HTMLDivElement, Record<string, never>>(function AccountSettings(_, ref) {
  const { user, profile, refreshProfile } = useAuth();
  const { navigate } = useSafeNavigation();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState(''); // P2-3: edge fn requires it
  const [emailError, setEmailError] = useState('');
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  


  const [trackingOptedOut, setTrackingOptedOut] = useState(false);
  const [isLoadingPrivacy, setIsLoadingPrivacy] = useState(true);
  const [isSavingPrivacy, setIsSavingPrivacy] = useState(false);
  
  const [formData, setFormData] = useState({
    display_name: '',
    full_name: '',
    company: '',
    role: '',
    use_case: '',
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        display_name: profile.display_name || '',
        full_name: profile.full_name || '',
        company: profile.company || '',
        role: profile.role || '',
        use_case: profile.use_case || '',
      });
    }
  }, [profile]);

  // Load privacy preferences from user_gamification
  useEffect(() => {
    if (!user) return;
    const loadPrivacy = async () => {
      setIsLoadingPrivacy(true);
      try {
        // P2-4: read the CANONICAL column that track_event actually checks
        // (profiles.tracking_opted_out). The old code read user_gamification, a
        // non-canonical copy that tracking never consults.
        const { data: prof } = await supabase
          .from('profiles')
          .select('tracking_opted_out')
          .eq('id', user.id)
          .maybeSingle();
        if (prof) setTrackingOptedOut(prof.tracking_opted_out ?? false);
        // Leaderboards are removed product-wide; force-hide regardless of stored pref.
        const { data: gam } = await supabase
          .from('user_gamification')
          .select('hide_from_leaderboard')
          .eq('user_id', user.id)
          .maybeSingle();
        if (gam?.hide_from_leaderboard === false) {
          await supabase.from('user_gamification').update({ hide_from_leaderboard: true }).eq('user_id', user.id);
        }
      } catch (e) {
        console.error('Failed to load privacy prefs:', e);
      } finally {
        setIsLoadingPrivacy(false);
      }
    };
    loadPrivacy();
  }, [user]);

  const handlePrivacyToggle = async (field: 'tracking_opted_out', value: boolean) => {
    if (!user) return;
    const prev = trackingOptedOut;
    setTrackingOptedOut(value);

    setIsSavingPrivacy(true);
    try {
      // P2-4: write the CANONICAL column track_event reads (profiles.tracking_opted_out).
      const { error } = await supabase
        .from('profiles')
        .update({ [field]: value })
        .eq('id', user.id);
      if (error) throw error;
      toast.success('Privacy preference updated');
    } catch (e) {
      setTrackingOptedOut(prev);
      toast.error('Failed to update preference');
    } finally {
      setIsSavingPrivacy(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // P2-5: deactivate inline. The button used to route to the redirect-only
  // deactivate sub-page, which App.tsx sends straight back to /account — a dead
  // end where nothing happened. Mirror the working SettingsDashboard.deactivate flow.
  const handleDeactivate = async () => {
    if (!user) return;
    const ok = await confirmAsync({
      title: 'Deactivate your account?',
      description: 'Your profile will be hidden but your data stays. Sign back in anytime to reactivate.',
      confirmLabel: 'Deactivate',
      cancelLabel: 'Cancel',
    });
    if (!ok) return;
    const { error } = await supabase
      .from('profiles' as never)
      .update({ deactivated_at: new Date().toISOString() } as never)
      .eq('id', user.id);
    if (error) { toast.error('Could not deactivate your account.'); return; }
    await supabase.auth.signOut();
    window.location.href = '/auth?deactivated=1';
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      await refreshProfile();
      toast.success('Avatar updated successfully');
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Failed to upload avatar');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: formData.display_name || null,
          full_name: formData.full_name || null,
          company: formData.company || null,
          role: formData.role || null,
          use_case: formData.use_case || null,
        })
        .eq('id', user.id);

      if (error) throw error;

      await refreshProfile();
      setIsEditing(false);
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEmailChange = async () => {
    const result = emailSchema.safeParse(newEmail.trim());
    if (!result.success) {
      setEmailError(result.error.errors[0].message);
      return;
    }

    if (newEmail.trim() === user?.email) {
      setEmailError('New email must be different from current email');
      return;
    }

    // P2-3: the edge fn ALWAYS requires the current password to re-auth before
    // changing email. Previously we sent only { newEmail } → 400 every time.
    if (!emailPassword) {
      setEmailError('Confirm your password to change your email');
      return;
    }

    setIsChangingEmail(true);
    setEmailError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please sign in again');
        return;
      }

      const response = await supabase.functions.invoke('update-user-email', {
        body: { newEmail: newEmail.trim(), password: emailPassword },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (response.error) throw response.error;

      toast.success('Confirmation email sent to your new address');
      setShowEmailDialog(false);
      setNewEmail('');
      setEmailPassword('');
    } catch (error) {
      console.error('Error changing email:', error);
      toast.error('Couldn\'t change email. Please try again.');
    } finally {
      setIsChangingEmail(false);
    }
  };


  const memberSince = profile?.created_at 
    ? new Date(profile.created_at).toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
      })
    : 'Unknown';

  const getTierInfo = (tier: string | undefined) => {
    switch (tier) {
      case 'pro':
        return { label: 'Pro', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
      case 'enterprise':
        return { label: 'Enterprise', color: 'text-[hsl(215,100%,72%)]', bg: 'bg-[hsl(215,100%,60%)]/12', border: 'border-[hsl(215,100%,60%)]/22' };
      default:
        return { label: 'Free', color: 'text-white/60', bg: 'bg-white/5', border: 'border-white/10' };
    }
  };

  const tierInfo = getTierInfo((profile as any)?.account_tier);

  return (
    <div ref={ref} className="space-y-12">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground/55 font-mono">◆ Account</div>
          <h2 className="mt-2 font-display italic text-[clamp(1.4rem,2.2vw,1.9rem)] font-light tracking-tight text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>Profile and personal information.</h2>
        </div>
        {!isEditing ? (
          <Button
            onClick={() => setIsEditing(true)}
            variant="ghost"
            className="text-white/70 hover:bg-white/[0.06] hover:text-white rounded-xl transition-colors"
          >
            <Edit3 className="w-4 h-4 mr-2" />
            Edit Profile
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              onClick={() => {
                setIsEditing(false);
                if (profile) {
                  setFormData({
                    display_name: profile.display_name || '',
                    full_name: profile.full_name || '',
                    company: profile.company || '',
                    role: profile.role || '',
                    use_case: profile.use_case || '',
                  });
                }
              }}
              variant="ghost"
              className="text-white/40 hover:text-white rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              variant="ghost"
              className="text-foreground hover:bg-white/[0.06] rounded-xl transition-colors"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2 text-[hsl(215,100%,72%)]" />
              )}
              Save Changes
            </Button>
          </div>
        )}
      </div>

      {/* Avatar Section */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="py-2"
      >
        <div className="flex items-center gap-6">
          <div className="relative group">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[hsl(215,100%,60%)]/22 to-[hsl(195,100%,55%)]/18 border border-[hsl(215,100%,60%)]/22 flex items-center justify-center overflow-hidden ring-2 ring-[hsl(215,100%,60%)]/12 ring-offset-2 ring-offset-[#06060a]">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <User className="w-10 h-10 text-[hsl(215,100%,80%)]/40" />
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingAvatar}
              className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"
            >
              {isUploadingAvatar ? (
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              ) : (
                <Camera className="w-6 h-6 text-white" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>

          <div>
            <h3 className="font-semibold text-white">Profile Photo</h3>
            <p className="text-sm text-white/40 mt-1">
              Upload a photo to personalize your profile
            </p>
            <p className="text-xs text-white/20 mt-2">
              JPG, PNG or GIF. Max 5MB.
            </p>
          </div>
        </div>
      </motion.section>

      {/* Profile Info */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="py-2"
      >
        <div className="mb-5">
          <div className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground/55 font-mono">◆ Personal information</div>
          <h3 className="mt-2 font-display italic text-[clamp(1.4rem,2.2vw,1.9rem)] font-light tracking-tight text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>Who you are.</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-white/45 text-xs uppercase tracking-wider font-medium">Display Name</Label>
            {isEditing ? (
              <Input
                value={formData.display_name}
                onChange={(e) => handleInputChange('display_name', e.target.value)}
                placeholder="How should we call you?"
                className="bg-glass border-white/[0.08] text-white placeholder:text-white/20 rounded-xl focus:border-[hsl(215,100%,60%)]/40 focus:ring-[hsl(215,100%,60%)]/22"
              />
            ) : (
              <p className="text-white py-2 text-sm">{profile?.display_name || '—'}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-white/45 text-xs uppercase tracking-wider font-medium">Full Name</Label>
            {isEditing ? (
              <Input
                value={formData.full_name}
                onChange={(e) => handleInputChange('full_name', e.target.value)}
                placeholder="Your full name"
                className="bg-glass border-white/[0.08] text-white placeholder:text-white/20 rounded-xl focus:border-[hsl(215,100%,60%)]/40 focus:ring-[hsl(215,100%,60%)]/22"
              />
            ) : (
              <p className="text-white py-2 text-sm">{profile?.full_name || '—'}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-white/45 text-xs uppercase tracking-wider font-medium flex items-center gap-2">
              <Mail className="w-3 h-3" />
              Email Address
            </Label>
            <div className="flex items-center gap-2">
              <p className="text-white py-2 text-sm">{user?.email || '—'}</p>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-medium text-emerald-400 uppercase tracking-wider">
                Verified
              </span>
              <Button
                onClick={() => setShowEmailDialog(true)}
                variant="ghost"
                size="sm"
                className="text-white/30 hover:text-white text-xs rounded-lg"
              >
                Change
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-white/45 text-xs uppercase tracking-wider font-medium flex items-center gap-2">
              <Building2 className="w-3 h-3" />
              Company
            </Label>
            {isEditing ? (
              <Input
                value={formData.company}
                onChange={(e) => handleInputChange('company', e.target.value)}
                placeholder="Your company name"
                className="bg-glass border-white/[0.08] text-white placeholder:text-white/20 rounded-xl focus:border-[hsl(215,100%,60%)]/40 focus:ring-[hsl(215,100%,60%)]/22"
              />
            ) : (
              <p className="text-white py-2 text-sm">{profile?.company || '—'}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-white/45 text-xs uppercase tracking-wider font-medium flex items-center gap-2">
              <Briefcase className="w-3 h-3" />
              Role
            </Label>
            {isEditing ? (
              <Input
                value={formData.role}
                onChange={(e) => handleInputChange('role', e.target.value)}
                placeholder="Your role or title"
                className="bg-glass border-white/[0.08] text-white placeholder:text-white/20 rounded-xl focus:border-[hsl(215,100%,60%)]/40 focus:ring-[hsl(215,100%,60%)]/22"
              />
            ) : (
              <p className="text-white py-2 text-sm">{profile?.role || '—'}</p>
            )}
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label className="text-white/45 text-xs uppercase tracking-wider font-medium">What do you use this for?</Label>
            {isEditing ? (
              <Textarea
                value={formData.use_case}
                onChange={(e) => handleInputChange('use_case', e.target.value)}
                placeholder="Tell us about your use case..."
                rows={3}
                className="bg-glass border-white/[0.08] text-white placeholder:text-white/20 resize-none rounded-xl focus:border-[hsl(215,100%,60%)]/40 focus:ring-[hsl(215,100%,60%)]/22"
              />
            ) : (
              <p className="text-white py-2 text-sm">{profile?.use_case || '—'}</p>
            )}
          </div>
        </div>
      </motion.section>

      {/* Account Info */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="py-2"
      >
        <div className="mb-5">
          <div className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground/55 font-mono">◆ Account details</div>
          <h3 className="mt-2 font-display italic text-[clamp(1.4rem,2.2vw,1.9rem)] font-light tracking-tight text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>The essentials.</h3>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Member Since', value: memberSince },
            { label: 'Account ID', value: `${user?.id?.slice(0, 8)}...`, mono: true },
            { label: 'Account Tier', value: tierInfo.label, icon: <Crown className={cn("w-4 h-4", tierInfo.color)} />, valueColor: tierInfo.color },
            { label: 'Status', value: 'Active', icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />, valueColor: 'text-emerald-400' },
          ].map((item, i) => (
            <div key={i} className="p-4 rounded-xl">
              <p className="text-[10px] text-white/30 uppercase tracking-wider font-medium">{item.label}</p>
              <div className="flex items-center gap-2 mt-1.5">
                {item.icon}
                <span className={cn(
                  "font-medium text-sm",
                  item.valueColor || 'text-white',
                  item.mono && 'font-mono text-xs'
                )}>{item.value}</span>
              </div>
            </div>
          ))}
        </div>
      </motion.section>

      {/* Privacy Preferences */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="py-2"
      >
        <div className="mb-5">
          <div className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground/55 font-mono">◆ Privacy preferences</div>
          <h3 className="mt-2 font-display italic text-[clamp(1.4rem,2.2vw,1.9rem)] font-light tracking-tight text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>Control how your activity data is used.</h3>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl">
            <div className="pr-4">
              <p className="text-sm font-medium text-white">Opt out of activity tracking</p>
              <p className="text-xs text-white/35 mt-0.5">Stop usage-pattern analytics on your account. Your data stays private to you regardless.</p>
            </div>
            <Switch
              checked={trackingOptedOut}
              onCheckedChange={(v) => handlePrivacyToggle('tracking_opted_out', v)}
              disabled={isLoadingPrivacy || isSavingPrivacy}
            />
          </div>

          <div className="p-4 rounded-xl">
            <p className="text-sm font-medium text-white">No public ranking</p>
            <p className="text-xs text-white/35 mt-0.5">
              Leaderboards, XP and ranking points have been removed. Your credits, usage and activity are visible only to you.
            </p>
          </div>
        </div>
      </motion.section>

      {/* Account Deactivation */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="py-2"
      >
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
            <UserX className="w-5 h-5 text-red-400/80" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-white">Deactivate Account</h3>
            <p className="text-sm text-white/40 mt-1">
              Temporarily disable your account. Your data will be preserved and you can reactivate anytime by signing back in.
            </p>
            <div className="mt-4">
              <Button
                onClick={handleDeactivate}
                variant="ghost"
                className="text-red-400/80 hover:bg-red-500/10 hover:text-red-300 rounded-xl"
              >
                <Power className="w-4 h-4 mr-2" />
                Deactivate Account
              </Button>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Email Change Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="bg-background/98 backdrop-blur-2xl border-white/[0.08] rounded-2xl max-w-md mx-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-[hsl(215,100%,60%)]/12 border border-[hsl(215,100%,60%)]/22 flex items-center justify-center">
                <Mail className="w-5 h-5 text-[hsl(215,100%,72%)]" />
              </div>
              <DialogTitle className="text-white">Change Email Address</DialogTitle>
            </div>
            <DialogDescription className="text-white/50">
              Enter your new email address. You'll receive a confirmation link at the new address.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-4 rounded-xl">
              <p className="text-xs text-white/30 uppercase tracking-wider">Current email</p>
              <p className="text-white font-medium mt-1 text-sm">{user?.email}</p>
            </div>

            <div className="space-y-2">
              <Label className="text-white/50 text-xs">New Email Address</Label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => {
                  setNewEmail(e.target.value);
                  setEmailError('');
                }}
                placeholder="Enter new email address"
                className="bg-glass border-white/[0.08] text-white placeholder:text-white/20 rounded-xl"
              />
              {emailError && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {emailError}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-white/50 text-xs">Confirm your password</Label>
              <Input
                type="password"
                value={emailPassword}
                onChange={(e) => { setEmailPassword(e.target.value); setEmailError(''); }}
                placeholder="Your password"
                autoComplete="current-password"
                className="bg-glass border-white/[0.08] text-white placeholder:text-white/20 rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              onClick={() => {
                setShowEmailDialog(false);
                setNewEmail('');
                setEmailPassword('');
                setEmailError('');
              }}
              variant="ghost"
              className="text-white/40 hover:text-white rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEmailChange}
              disabled={!newEmail || !emailPassword || isChangingEmail}
              variant="ghost"
              className="text-foreground hover:bg-white/[0.06] rounded-xl"
            >
              {isChangingEmail ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Mail className="w-4 h-4 mr-2 text-[hsl(215,100%,72%)]" />
              )}
              Send Confirmation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}));
