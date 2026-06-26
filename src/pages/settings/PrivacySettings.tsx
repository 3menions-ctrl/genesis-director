/**
 * PrivacySettings — DM permission, follow permission, default reel visibility.
 * Autosaved into profiles.preferences (same keys the web SettingsDashboard uses).
 */
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { SettingsScaffold, Group, Segmented } from '@/components/native/SettingsPage';

type DM = 'everyone' | 'followers' | 'nobody';
type Follow = 'everyone' | 'mutual_only';
type Vis = 'public' | 'unlisted' | 'private';
interface Prefs { dmPermission: DM; followPermission: Follow; defaultReelVisibility: Vis }
const DEFAULTS: Prefs = { dmPermission: 'everyone', followPermission: 'everyone', defaultReelVisibility: 'public' };

export default function PrivacySettings() {
  const { user, profile, refreshProfile } = useAuth();
  const [p, setP] = useState<Prefs>(DEFAULTS);

  useEffect(() => {
    const saved = (profile?.preferences ?? null) as Partial<Prefs> | null;
    if (saved) setP({ ...DEFAULTS, dmPermission: saved.dmPermission ?? 'everyone', followPermission: saved.followPermission ?? 'everyone', defaultReelVisibility: saved.defaultReelVisibility ?? 'public' });
  }, [profile]);

  const set = async <K extends keyof Prefs>(k: K, v: Prefs[K]) => {
    const next = { ...p, [k]: v };
    setP(next);
    if (!user) return;
    try {
      const merged = { ...(profile?.preferences ?? {}), ...next };
      const { error } = await supabase.from('profiles' as never).update({ preferences: merged } as never).eq('id', user.id);
      if (error) throw error;
      void refreshProfile();
    } catch { toast.error('Could not save'); setP(p); }
  };

  return (
    <SettingsScaffold title="Privacy & messaging">
      <Group label="Who can message you">
        <Segmented value={p.dmPermission} onChange={(v) => set('dmPermission', v)} options={[{ v: 'everyone', label: 'Everyone' }, { v: 'followers', label: 'Followers' }, { v: 'nobody', label: 'No one' }]} />
      </Group>
      <Group label="Who can follow you">
        <Segmented value={p.followPermission} onChange={(v) => set('followPermission', v)} options={[{ v: 'everyone', label: 'Everyone' }, { v: 'mutual_only', label: 'Mutual only' }]} />
      </Group>
      <Group label="Default film visibility">
        <Segmented value={p.defaultReelVisibility} onChange={(v) => set('defaultReelVisibility', v)} options={[{ v: 'public', label: 'Public' }, { v: 'unlisted', label: 'Unlisted' }, { v: 'private', label: 'Private' }]} />
      </Group>
      <p className="mt-7 px-1 text-center text-[11px] leading-relaxed text-white/30">Blocking is managed from a creator's profile. These choices apply to new films and incoming requests.</p>
    </SettingsScaffold>
  );
}
