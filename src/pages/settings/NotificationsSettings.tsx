/**
 * NotificationsSettings — native notification preferences, autosaved to
 * profiles.notification_settings (same shape the web uses).
 */
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { SettingsScaffold, Group, ToggleRow } from '@/components/native/SettingsPage';

interface Prefs {
  emailNotifications: boolean; videoComplete: boolean; videoFailed: boolean;
  lowCredits: boolean; weeklyDigest: boolean; productUpdates: boolean; tips: boolean; marketing: boolean;
}
const DEFAULTS: Prefs = { emailNotifications: true, videoComplete: true, videoFailed: true, lowCredits: true, weeklyDigest: false, productUpdates: true, tips: true, marketing: false };

export default function NotificationsSettings() {
  const { user, profile, refreshProfile } = useAuth();
  const [p, setP] = useState<Prefs>(DEFAULTS);

  useEffect(() => {
    const saved = profile?.notification_settings as Partial<Prefs> | null | undefined;
    if (saved) setP({ ...DEFAULTS, ...saved });
  }, [profile]);

  const set = async (k: keyof Prefs, v: boolean) => {
    const next = { ...p, [k]: v };
    setP(next);
    if (!user) return;
    try {
      const { error } = await supabase.from('profiles' as never).update({ notification_settings: next } as never).eq('id', user.id);
      if (error) throw error;
      void refreshProfile();
    } catch { toast.error('Could not save'); setP(p); }
  };

  return (
    <SettingsScaffold title="Notifications">
      <Group label="Activity">
        <ToggleRow label="Render complete" sub="When a video finishes generating" on={p.videoComplete} onChange={(v) => set('videoComplete', v)} />
        <ToggleRow label="Render failed" sub="If a generation errors out" on={p.videoFailed} onChange={(v) => set('videoFailed', v)} />
        <ToggleRow label="Low credits" sub="When your balance runs low" on={p.lowCredits} onChange={(v) => set('lowCredits', v)} />
      </Group>
      <Group label="Email">
        <ToggleRow label="Email notifications" on={p.emailNotifications} onChange={(v) => set('emailNotifications', v)} />
        <ToggleRow label="Weekly digest" on={p.weeklyDigest} onChange={(v) => set('weeklyDigest', v)} />
        <ToggleRow label="Product updates" on={p.productUpdates} onChange={(v) => set('productUpdates', v)} />
        <ToggleRow label="Tips & inspiration" on={p.tips} onChange={(v) => set('tips', v)} />
        <ToggleRow label="Marketing" on={p.marketing} onChange={(v) => set('marketing', v)} />
      </Group>
    </SettingsScaffold>
  );
}
