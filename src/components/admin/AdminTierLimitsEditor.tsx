import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Crown,
  Users,
  Clock,
  Film,
  RefreshCw,
  Loader2,
  Edit2,
  Zap,
  Layers,
  CheckCircle,
  XCircle,
  Star,
  Shield,
} from 'lucide-react';
import { toast } from 'sonner';
import { FloatSection, FloatTable, DeckButton, StatusPill } from '@/admin/ui/primitives';

interface TierLimit {
  id: string;
  tier: string;
  max_duration_minutes: number;
  max_clips_per_video: number;
  max_concurrent_projects: number;
  max_retries_per_clip: number;
  chunked_stitching: boolean;
  priority_queue: boolean;
  created_at: string;
  updated_at: string;
}

interface TierUserCount {
  tier: string;
  count: number;
}

const TIER_ICONS: Record<string, typeof Crown> = {
  free: Users,
  starter: Star,
  pro: Crown,
  enterprise: Shield,
};

export function AdminTierLimitsEditor() {
  const [tiers, setTiers] = useState<TierLimit[]>([]);
  const [userCounts, setUserCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    tier: TierLimit | null;
  }>({ open: false, tier: null });

  const [form, setForm] = useState({
    max_duration_minutes: '',
    max_clips_per_video: '',
    max_concurrent_projects: '',
    max_retries_per_clip: '',
    chunked_stitching: false,
    priority_queue: false,
  });

  useEffect(() => {
    fetchTiers();
    fetchUserCounts();
  }, []);

  const fetchTiers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tier_limits')
        .select('*')
        .order('max_duration_minutes', { ascending: true });

      if (error) throw error;
      setTiers(data || []);
    } catch (err) {
      console.error('Failed to fetch tier limits:', err);
      toast.error('Failed to load tier limits');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserCounts = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('account_tier');

      if (error) throw error;

      const counts: Record<string, number> = {};
      (data || []).forEach((profile: { account_tier: string }) => {
        counts[profile.account_tier] = (counts[profile.account_tier] || 0) + 1;
      });
      setUserCounts(counts);
    } catch (err) {
      console.error('Failed to fetch user counts:', err);
    }
  };

  const openEditDialog = (tier: TierLimit) => {
    setForm({
      max_duration_minutes: tier.max_duration_minutes.toString(),
      max_clips_per_video: tier.max_clips_per_video.toString(),
      max_concurrent_projects: tier.max_concurrent_projects.toString(),
      max_retries_per_clip: tier.max_retries_per_clip.toString(),
      chunked_stitching: tier.chunked_stitching,
      priority_queue: tier.priority_queue,
    });
    setEditDialog({ open: true, tier });
  };

  const handleSave = async () => {
    const maxDuration = parseInt(form.max_duration_minutes, 10);
    const maxClips = parseInt(form.max_clips_per_video, 10);
    const maxProjects = parseInt(form.max_concurrent_projects, 10);
    const maxRetries = parseInt(form.max_retries_per_clip, 10);

    if ([maxDuration, maxClips, maxProjects, maxRetries].some(v => isNaN(v) || v < 0)) {
      toast.error('All values must be valid positive numbers');
      return;
    }

    setSaving(true);
    try {
      // Note: RLS blocks client updates on tier_limits
      toast.error('Tier limit changes require database admin access. Use SQL editor to update.');
      setEditDialog({ open: false, tier: null });
    } catch (err) {
      console.error('Failed to save tier limits:', err);
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const getTierIcon = (tier: string) => {
    const Icon = TIER_ICONS[tier.toLowerCase()] || Users;
    return Icon;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-white/60" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-[17px] font-semibold tracking-tight text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-white/60" />
            Account Tier Limits
          </h2>
          <p className="text-[13px] text-white/55">
            Configure feature limits for each subscription tier
          </p>
        </div>
        <DeckButton onClick={() => { fetchTiers(); fetchUserCounts(); }}>
          <RefreshCw className="w-3.5 h-3.5 mr-2" />
          Refresh
        </DeckButton>
      </div>

      {/* Tier Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {tiers.map((tier) => {
          const TierIcon = getTierIcon(tier.tier);

          return (
            <div
              key={tier.id}
              className="rounded-2xl p-5"
              style={{ border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center">
                    <TierIcon className="w-4 h-4 text-white/70" />
                  </div>
                  <div>
                    <div className="font-display text-[15px] font-semibold capitalize text-white">{tier.tier}</div>
                    <div className="text-xs text-white/45">
                      {userCounts[tier.tier] || 0} users
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => openEditDialog(tier)}
                  className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-[13px] text-white/70">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3 h-3 text-white/40" />
                    <span>{tier.max_duration_minutes}m max</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Film className="w-3 h-3 text-white/40" />
                    <span>{tier.max_clips_per_video} clips</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Layers className="w-3 h-3 text-white/40" />
                    <span>{tier.max_concurrent_projects} projects</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-3 h-3 text-white/40" />
                    <span>{tier.max_retries_per_clip} retries</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  {tier.chunked_stitching ? (
                    <StatusPill tone="positive">
                      <CheckCircle className="w-2.5 h-2.5" />
                      Chunked
                    </StatusPill>
                  ) : (
                    <StatusPill tone="neutral">
                      <XCircle className="w-2.5 h-2.5" />
                      No Chunked
                    </StatusPill>
                  )}
                  {tier.priority_queue ? (
                    <StatusPill tone="warn">
                      <Zap className="w-2.5 h-2.5" />
                      Priority
                    </StatusPill>
                  ) : (
                    <StatusPill tone="neutral">
                      Standard Queue
                    </StatusPill>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Comparison Table */}
      <FloatSection title="Tier Comparison" meta="side-by-side">
        <div className="overflow-x-auto">
          <FloatTable
            columns={[
              { key: 'feature', label: 'Feature' },
              ...tiers.map((tier) => ({ key: tier.id, label: tier.tier, align: 'right' as const, className: 'capitalize' })),
            ]}
            rows={[
              {
                _key: 'duration',
                feature: 'Max Video Duration',
                ...Object.fromEntries(tiers.map((t) => [t.id, <span className="font-medium text-white/80">{t.max_duration_minutes} min</span>])),
              },
              {
                _key: 'clips',
                feature: 'Max Clips per Video',
                ...Object.fromEntries(tiers.map((t) => [t.id, <span className="font-medium text-white/80">{t.max_clips_per_video}</span>])),
              },
              {
                _key: 'projects',
                feature: 'Concurrent Projects',
                ...Object.fromEntries(tiers.map((t) => [t.id, <span className="font-medium text-white/80">{t.max_concurrent_projects}</span>])),
              },
              {
                _key: 'retries',
                feature: 'Retries per Clip',
                ...Object.fromEntries(tiers.map((t) => [t.id, <span className="font-medium text-white/80">{t.max_retries_per_clip}</span>])),
              },
              {
                _key: 'chunked',
                feature: 'Chunked Stitching',
                ...Object.fromEntries(tiers.map((t) => [t.id, t.chunked_stitching
                  ? <CheckCircle className="w-4 h-4 inline" style={{ color: 'hsl(188 92% 58%)' }} />
                  : <XCircle className="w-4 h-4 inline text-white/35" />])),
              },
              {
                _key: 'priority',
                feature: 'Priority Queue',
                ...Object.fromEntries(tiers.map((t) => [t.id, t.priority_queue
                  ? <Zap className="w-4 h-4 inline" style={{ color: 'hsl(38 96% 62%)' }} />
                  : <XCircle className="w-4 h-4 inline text-white/35" />])),
              },
              {
                _key: 'users',
                feature: <span className="font-medium text-white">Users on Tier</span>,
                ...Object.fromEntries(tiers.map((t) => [t.id, <StatusPill tone="neutral">{userCounts[t.tier] || 0}</StatusPill>])),
              },
            ]}
          />
        </div>
      </FloatSection>

      {/* Edit Dialog */}
      <Dialog open={editDialog.open} onOpenChange={(open) => !open && setEditDialog({ open: false, tier: null })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="capitalize">
              Edit {editDialog.tier?.tier} Tier Limits
            </DialogTitle>
            <DialogDescription>
              Configure limits for users on this tier
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="max_duration">Max Duration (min)</Label>
                <Input
                  id="max_duration"
                  type="number"
                  value={form.max_duration_minutes}
                  onChange={(e) => setForm({ ...form, max_duration_minutes: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_clips">Max Clips</Label>
                <Input
                  id="max_clips"
                  type="number"
                  value={form.max_clips_per_video}
                  onChange={(e) => setForm({ ...form, max_clips_per_video: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="max_projects">Concurrent Projects</Label>
                <Input
                  id="max_projects"
                  type="number"
                  value={form.max_concurrent_projects}
                  onChange={(e) => setForm({ ...form, max_concurrent_projects: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_retries">Max Retries</Label>
                <Input
                  id="max_retries"
                  type="number"
                  value={form.max_retries_per_clip}
                  onChange={(e) => setForm({ ...form, max_retries_per_clip: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Chunked Stitching</Label>
                  <p className="text-xs text-white/45">Process long videos in chunks</p>
                </div>
                <Switch
                  checked={form.chunked_stitching}
                  onCheckedChange={(checked) => setForm({ ...form, chunked_stitching: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Priority Queue</Label>
                  <p className="text-xs text-white/45">Faster processing priority</p>
                </div>
                <Switch
                  checked={form.priority_queue}
                  onCheckedChange={(checked) => setForm({ ...form, priority_queue: checked })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog({ open: false, tier: null })}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
