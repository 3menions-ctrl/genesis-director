import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  AlertTriangle,
  CheckCircle,
  XCircle,
  Star,
  Shield,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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

const TIER_COLORS: Record<string, string> = {
  free: 'from-muted/50 to-muted/30 border-muted',
  starter: 'from-info/10 to-info/5 border-info/20',
  pro: 'from-primary/10 to-primary/5 border-primary/20',
  enterprise: 'from-warning/10 to-warning/5 border-warning/20',
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
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            Account Tier Limits
          </h2>
          <p className="text-sm text-muted-foreground">
            Configure feature limits for each subscription tier
          </p>
        </div>
        <Button onClick={() => { fetchTiers(); fetchUserCounts(); }} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Tier Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {tiers.map((tier) => {
          const TierIcon = getTierIcon(tier.tier);
          const colorClass = TIER_COLORS[tier.tier.toLowerCase()] || TIER_COLORS.free;
          
          return (
            <Card key={tier.id} className={cn("bg-gradient-to-br border", colorClass)}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-background/50 flex items-center justify-center">
                      <TierIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base capitalize">{tier.tier}</CardTitle>
                      <CardDescription className="text-xs">
                        {userCounts[tier.tier] || 0} users
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEditDialog(tier)}
                  >
                    <Edit2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span>{tier.max_duration_minutes}m max</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Film className="w-3 h-3 text-muted-foreground" />
                    <span>{tier.max_clips_per_video} clips</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Layers className="w-3 h-3 text-muted-foreground" />
                    <span>{tier.max_concurrent_projects} projects</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-3 h-3 text-muted-foreground" />
                    <span>{tier.max_retries_per_clip} retries</span>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/50">
                  {tier.chunked_stitching ? (
                    <Badge className="bg-success/10 text-success border-success/20 text-xs">
                      <CheckCircle className="w-2.5 h-2.5 mr-1" />
                      Chunked
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      <XCircle className="w-2.5 h-2.5 mr-1" />
                      No Chunked
                    </Badge>
                  )}
                  {tier.priority_queue ? (
                    <Badge className="bg-warning/10 text-warning border-warning/20 text-xs">
                      <Zap className="w-2.5 h-2.5 mr-1" />
                      Priority
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      Standard Queue
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tier Comparison</CardTitle>
          <CardDescription>
            Side-by-side feature comparison across all tiers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Feature</th>
                  {tiers.map((tier) => (
                    <th key={tier.id} className="text-center py-3 px-4 text-sm font-medium text-muted-foreground capitalize">
                      {tier.tier}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/50">
                  <td className="py-3 px-4 text-sm">Max Video Duration</td>
                  {tiers.map((tier) => (
                    <td key={tier.id} className="py-3 px-4 text-sm text-center font-medium">
                      {tier.max_duration_minutes} min
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-3 px-4 text-sm">Max Clips per Video</td>
                  {tiers.map((tier) => (
                    <td key={tier.id} className="py-3 px-4 text-sm text-center font-medium">
                      {tier.max_clips_per_video}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-3 px-4 text-sm">Concurrent Projects</td>
                  {tiers.map((tier) => (
                    <td key={tier.id} className="py-3 px-4 text-sm text-center font-medium">
                      {tier.max_concurrent_projects}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-3 px-4 text-sm">Retries per Clip</td>
                  {tiers.map((tier) => (
                    <td key={tier.id} className="py-3 px-4 text-sm text-center font-medium">
                      {tier.max_retries_per_clip}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-3 px-4 text-sm">Chunked Stitching</td>
                  {tiers.map((tier) => (
                    <td key={tier.id} className="py-3 px-4 text-center">
                      {tier.chunked_stitching ? (
                        <CheckCircle className="w-4 h-4 text-success mx-auto" />
                      ) : (
                        <XCircle className="w-4 h-4 text-muted-foreground mx-auto" />
                      )}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-3 px-4 text-sm">Priority Queue</td>
                  {tiers.map((tier) => (
                    <td key={tier.id} className="py-3 px-4 text-center">
                      {tier.priority_queue ? (
                        <Zap className="w-4 h-4 text-warning mx-auto" />
                      ) : (
                        <XCircle className="w-4 h-4 text-muted-foreground mx-auto" />
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 px-4 text-sm font-medium">Users on Tier</td>
                  {tiers.map((tier) => (
                    <td key={tier.id} className="py-3 px-4 text-center">
                      <Badge variant="secondary">
                        {userCounts[tier.tier] || 0}
                      </Badge>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

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
                  <p className="text-xs text-muted-foreground">Process long videos in chunks</p>
                </div>
                <Switch
                  checked={form.chunked_stitching}
                  onCheckedChange={(checked) => setForm({ ...form, chunked_stitching: checked })}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Priority Queue</Label>
                  <p className="text-xs text-muted-foreground">Faster processing priority</p>
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
