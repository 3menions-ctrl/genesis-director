import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { 
  Bell, Mail, Video, Coins, Megaphone, 
  CheckCircle2, AlertCircle, Save, Loader2,
  Clock, Sparkles, TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NotificationPreferences {
  emailNotifications: boolean;
  videoComplete: boolean;
  videoFailed: boolean;
  lowCredits: boolean;
  lowCreditsThreshold: number;
  weeklyDigest: boolean;
  productUpdates: boolean;
  tips: boolean;
  marketing: boolean;
}

const DEFAULT_NOTIFICATION_SETTINGS: NotificationPreferences = {
  emailNotifications: true,
  videoComplete: true,
  videoFailed: true,
  lowCredits: true,
  lowCreditsThreshold: 10,
  weeklyDigest: false,
  productUpdates: true,
  tips: true,
  marketing: false,
};

export function NotificationSettings() {
  const { user, profile, refreshProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_SETTINGS);

  // Load preferences from database
  useEffect(() => {
    if (profile) {
      const savedSettings = profile.notification_settings as unknown as NotificationPreferences | null;
      if (savedSettings) {
        setPreferences({ ...DEFAULT_NOTIFICATION_SETTINGS, ...savedSettings });
      }
      setIsLoading(false);
    }
  }, [profile]);

  const updatePreference = <K extends keyof NotificationPreferences>(
    key: K, 
    value: NotificationPreferences[K]
  ) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!user) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ notification_settings: preferences as any })
        .eq('id', user.id);

      if (error) throw error;

      await refreshProfile();
      setHasChanges(false);
      toast.success('Notification preferences saved');
    } catch (error) {
      console.error('Error saving notification preferences:', error);
      toast.error('Failed to save preferences');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-white/40" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Notifications</h2>
          <p className="text-sm text-white/50">Manage how and when we contact you</p>
        </div>
        {hasChanges && (
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-white text-black hover:bg-white/90"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Changes
          </Button>
        )}
      </div>

      {/* Master Toggle */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.02] p-6"
      >
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
              <Mail className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Email Notifications</h3>
              <p className="text-sm text-white/50">
                Receive email updates about your account and videos
              </p>
            </div>
          </div>
          <Switch
            checked={preferences.emailNotifications}
            onCheckedChange={(checked) => updatePreference('emailNotifications', checked)}
          />
        </div>
      </motion.div>

      {/* Video Notifications */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={cn(
          "relative rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.02] p-6",
          !preferences.emailNotifications && "opacity-50 pointer-events-none"
        )}
      >
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        
        <div className="flex items-center gap-4 mb-6">
          <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center">
            <Video className="w-5 h-5 text-white/40" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Video Updates</h3>
            <p className="text-sm text-white/50">Notifications about your video generations</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="font-medium text-white">Video Completed</p>
                <p className="text-sm text-white/50">When your video is ready to view</p>
              </div>
            </div>
            <Switch
              checked={preferences.videoComplete}
              onCheckedChange={(checked) => updatePreference('videoComplete', checked)}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400" />
              <div>
                <p className="font-medium text-white">Video Failed</p>
                <p className="text-sm text-white/50">When a video generation fails</p>
              </div>
            </div>
            <Switch
              checked={preferences.videoFailed}
              onCheckedChange={(checked) => updatePreference('videoFailed', checked)}
            />
          </div>
        </div>
      </motion.div>

      {/* Credit Notifications */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className={cn(
          "relative rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.02] p-6",
          !preferences.emailNotifications && "opacity-50 pointer-events-none"
        )}
      >
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        
        <div className="flex items-center gap-4 mb-6">
          <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center">
            <Coins className="w-5 h-5 text-white/40" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Credit Alerts</h3>
            <p className="text-sm text-white/50">Stay informed about your credit balance</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <div className="flex items-center gap-3">
              <Coins className="w-5 h-5 text-amber-400" />
              <div>
                <p className="font-medium text-white">Low Credit Warning</p>
                <p className="text-sm text-white/50">
                  When balance falls below {preferences.lowCreditsThreshold} credits
                </p>
              </div>
            </div>
            <Switch
              checked={preferences.lowCredits}
              onCheckedChange={(checked) => updatePreference('lowCredits', checked)}
            />
          </div>

          {preferences.lowCredits && (
            <div className="ml-8 pl-4 border-l-2 border-white/10">
              <Label className="text-white/60 text-sm">Alert threshold</Label>
              <div className="flex gap-2 mt-2">
                {[5, 10, 25, 50].map(threshold => (
                  <button
                    key={threshold}
                    onClick={() => updatePreference('lowCreditsThreshold', threshold)}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                      preferences.lowCreditsThreshold === threshold
                        ? "bg-white text-black"
                        : "bg-white/[0.05] text-white/60 hover:text-white hover:bg-white/10"
                    )}
                  >
                    {threshold}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Summary & Digest */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className={cn(
          "relative rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.02] p-6",
          !preferences.emailNotifications && "opacity-50 pointer-events-none"
        )}
      >
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        
        <div className="flex items-center gap-4 mb-6">
          <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center">
            <Clock className="w-5 h-5 text-white/40" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Summary & Reports</h3>
            <p className="text-sm text-white/50">Periodic updates about your activity</p>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-purple-400" />
            <div>
              <p className="font-medium text-white">Weekly Digest</p>
              <p className="text-sm text-white/50">Summary of your weekly activity</p>
            </div>
          </div>
          <Switch
            checked={preferences.weeklyDigest}
            onCheckedChange={(checked) => updatePreference('weeklyDigest', checked)}
          />
        </div>
      </motion.div>

      {/* Marketing & Updates */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className={cn(
          "relative rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.02] p-6",
          !preferences.emailNotifications && "opacity-50 pointer-events-none"
        )}
      >
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        
        <div className="flex items-center gap-4 mb-6">
          <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center">
            <Megaphone className="w-5 h-5 text-white/40" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Updates & Marketing</h3>
            <p className="text-sm text-white/50">Stay informed about new features</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-cyan-400" />
              <div>
                <p className="font-medium text-white">Product Updates</p>
                <p className="text-sm text-white/50">New features and improvements</p>
              </div>
            </div>
            <Switch
              checked={preferences.productUpdates}
              onCheckedChange={(checked) => updatePreference('productUpdates', checked)}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-blue-400" />
              <div>
                <p className="font-medium text-white">Tips & Tutorials</p>
                <p className="text-sm text-white/50">Learn how to make better videos</p>
              </div>
            </div>
            <Switch
              checked={preferences.tips}
              onCheckedChange={(checked) => updatePreference('tips', checked)}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-white/40" />
              <div>
                <p className="font-medium text-white">Promotional Emails</p>
                <p className="text-sm text-white/50">Special offers and discounts</p>
              </div>
            </div>
            <Switch
              checked={preferences.marketing}
              onCheckedChange={(checked) => updatePreference('marketing', checked)}
            />
          </div>
        </div>
      </motion.div>
    </div>
  );
}