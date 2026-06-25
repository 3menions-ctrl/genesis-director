import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
  Settings,
  Clock,
  Coins,
  RefreshCw,
  Loader2,
  Edit2,
  Plus,
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { CREDIT_SYSTEM } from '@/lib/creditSystem';
import {
  StatOrb, FloatSection, FloatTable, StatusPill, DeckButton,
  ACCENT_HSL, CYAN, AMBER, ROSE,
} from '@/admin/ui/primitives';

interface PricingConfig {
  id: string;
  clip_duration_seconds: number;
  credits_cost: number;
  description: string | null;
  is_active: boolean;
  updated_at: string;
}

// Known API costs for margin calculation (Kling V3 via Replicate)
const API_COSTS = {
  veo_per_clip: 5, // cents — Kling V3 cost per clip (~$0.05)
  tts_per_call: 2,
  stitch_per_call: 2,
};

export function AdminPricingConfigEditor() {
  const [configs, setConfigs] = useState<PricingConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    config: PricingConfig | null;
    isNew: boolean;
  }>({ open: false, config: null, isNew: false });

  const [form, setForm] = useState({
    clip_duration_seconds: '',
    credits_cost: '',
    description: '',
    is_active: true,
  });

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pricing_config')
        .select('*')
        .order('clip_duration_seconds', { ascending: true });

      if (error) throw error;
      setConfigs(data || []);
    } catch (err) {
      console.error('Failed to fetch pricing configs:', err);
      toast.error('Failed to load pricing configuration');
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (config: PricingConfig | null) => {
    if (config) {
      setForm({
        clip_duration_seconds: config.clip_duration_seconds.toString(),
        credits_cost: config.credits_cost.toString(),
        description: config.description || '',
        is_active: config.is_active ?? true,
      });
      setEditDialog({ open: true, config, isNew: false });
    } else {
      setForm({
        clip_duration_seconds: '',
        credits_cost: '',
        description: '',
        is_active: true,
      });
      setEditDialog({ open: true, config: null, isNew: true });
    }
  };

  const handleSave = async () => {
    if (!form.clip_duration_seconds || !form.credits_cost) {
      toast.error('Please fill in duration and credits');
      return;
    }

    const duration = parseInt(form.clip_duration_seconds, 10);
    const credits = parseInt(form.credits_cost, 10);

    if (isNaN(duration) || duration <= 0) {
      toast.error('Duration must be a positive number');
      return;
    }
    if (isNaN(credits) || credits <= 0) {
      toast.error('Credits must be a positive number');
      return;
    }

    setSaving(true);
    try {
      // Note: RLS blocks client updates on pricing_config
      toast.error('Pricing changes require database admin access. Use SQL editor to update.');
      setEditDialog({ open: false, config: null, isNew: false });
    } catch (err) {
      console.error('Failed to save config:', err);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const calculateMargin = (credits: number) => {
    // AUDIT FIX M-5: use the canonical price ($0.10/credit) from creditSystem
    // instead of a divergent hardcoded 11.6¢, which overstated revenue/margin by
    // 16% versus billing, invoices, and the business billing page.
    const revenuePerCredit = CREDIT_SYSTEM.CENTS_PER_CREDIT; // cents
    const revenue = credits * revenuePerCredit;

    // Cost per clip (Veo is the main cost)
    const cost = API_COSTS.veo_per_clip;

    const profit = revenue - cost;
    const margin = (profit / revenue) * 100;

    return {
      revenue: revenue.toFixed(1),
      cost: cost,
      profit: profit.toFixed(1),
      margin: margin.toFixed(1),
    };
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: ACCENT_HSL }} />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-white">
            <Settings className="h-5 w-5" style={{ color: ACCENT_HSL }} />
            Pricing Configuration
          </h2>
          <p className="text-sm text-white/55">
            Configure credit costs for video clip generation by duration
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DeckButton onClick={fetchConfigs}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </DeckButton>
          <DeckButton primary onClick={() => openEditDialog(null)}>
            <Plus className="h-4 w-4" />
            Add Tier
          </DeckButton>
        </div>
      </div>

      {/* Pricing Overview — floating figures */}
      <div className="grid grid-cols-1 gap-x-10 gap-y-10 md:grid-cols-3">
        <StatOrb index={0} icon={Clock} aura={ACCENT_HSL} label="Pricing Tiers" value={configs.length} sub={`${configs.filter(c => c.is_active).length} active`} />
        <StatOrb index={1} icon={Coins} aura={CYAN} label="Min Credits/Clip" value={configs.length > 0 ? Math.min(...configs.map(c => c.credits_cost)) : 0} sub="Lowest tier" />
        <StatOrb index={2} icon={TrendingUp} aura={AMBER} label="Max Credits/Clip" value={configs.length > 0 ? Math.max(...configs.map(c => c.credits_cost)) : 0} sub="Highest tier" />
      </div>

      {/* Pricing Table */}
      <FloatSection title="Duration-Based Pricing" meta="credits charged per clip by duration">
        <FloatTable
          empty="No pricing configuration found"
          columns={[
            { key: 'duration', label: 'Duration' },
            { key: 'credits', label: 'Credits', align: 'right' },
            { key: 'revenue', label: 'Est. Revenue', align: 'right' },
            { key: 'apiCost', label: 'API Cost', align: 'right' },
            { key: 'margin', label: 'Margin', align: 'right' },
            { key: 'status', label: 'Status' },
            { key: 'description', label: 'Description' },
            { key: 'actions', label: 'Actions', align: 'right' },
          ]}
          rows={configs.map((config) => {
            const margin = calculateMargin(config.credits_cost);
            const m = parseFloat(margin.margin);
            return {
              _key: config.id,
              duration: (
                <span className="flex items-center gap-2 font-medium text-white">
                  <Clock className="h-4 w-4 text-white/40" />
                  {formatDuration(config.clip_duration_seconds)}
                </span>
              ),
              credits: (
                <span className="inline-flex items-center justify-end gap-1 font-mono font-medium text-white">
                  <Coins className="h-4 w-4" style={{ color: AMBER }} />
                  {config.credits_cost}
                </span>
              ),
              revenue: <span style={{ color: CYAN }}>${(parseFloat(margin.revenue) / 100).toFixed(2)}</span>,
              apiCost: <span style={{ color: ROSE }}>${(margin.cost / 100).toFixed(2)}</span>,
              margin: <StatusPill tone={m >= 70 ? 'positive' : m >= 50 ? 'warn' : 'danger'}>{margin.margin}%</StatusPill>,
              status: config.is_active
                ? <StatusPill tone="positive"><CheckCircle className="h-3 w-3" /> Active</StatusPill>
                : <StatusPill tone="neutral">Inactive</StatusPill>,
              description: <span className="block max-w-48 truncate text-white/50">{config.description || '-'}</span>,
              actions: (
                <DeckButton onClick={() => openEditDialog(config)}>
                  <Edit2 className="h-3 w-3" />
                </DeckButton>
              ),
            };
          })}
        />
      </FloatSection>

      {/* Margin Warning */}
      {configs.some(c => parseFloat(calculateMargin(c.credits_cost).margin) < 50) && (
        <div className="rounded-2xl bg-white/[0.03] p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" style={{ color: AMBER }} />
            <div>
              <p className="font-medium text-white">Low Margin Warning</p>
              <p className="text-sm text-white/55">
                Some pricing tiers have margins below 50%. Consider increasing credit costs to maintain profitability.
                Target margin: 70-80%.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Info Card */}
      <div className="rounded-2xl bg-white/[0.03] p-4">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-5 w-5 flex-shrink-0" style={{ color: ACCENT_HSL }} />
          <div>
            <p className="font-medium text-white">Pricing Strategy</p>
            <p className="mt-1 text-sm text-white/55">
              Margins are calculated based on:
            </p>
            <ul className="mt-2 space-y-1 text-sm text-white/55">
              <li>• Kling V3 API cost: ~$0.05/clip</li>
              <li>• Credit value: ~$0.116/credit (based on package prices)</li>
              <li>• Additional costs (TTS, stitching) are separate</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialog.open} onOpenChange={(open) => !open && setEditDialog({ open: false, config: null, isNew: false })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editDialog.isNew ? 'Add Pricing Tier' : 'Edit Pricing Tier'}
            </DialogTitle>
            <DialogDescription>
              Configure credit cost for a specific clip duration
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="duration">Clip Duration (seconds) *</Label>
              <Input
                id="duration"
                type="number"
                value={form.clip_duration_seconds}
                onChange={(e) => setForm({ ...form, clip_duration_seconds: e.target.value })}
                placeholder="6"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="credits">Credits Cost *</Label>
              <Input
                id="credits"
                type="number"
                value={form.credits_cost}
                onChange={(e) => setForm({ ...form, credits_cost: e.target.value })}
                placeholder="5"
              />
            </div>

            {form.credits_cost && (
              <div className="space-y-1 rounded-2xl bg-white/[0.03] p-3 text-sm text-white/80">
                <p>Estimated margin: <strong>{calculateMargin(parseInt(form.credits_cost) || 0).margin}%</strong></p>
                <p className="text-white/50">
                  Revenue: ${(parseFloat(calculateMargin(parseInt(form.credits_cost) || 0).revenue) / 100).toFixed(2)} |
                  Cost: ${(API_COSTS.veo_per_clip / 100).toFixed(2)}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Standard clip duration"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Active</Label>
                <p className="text-xs text-white/50">Enable this pricing tier</p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <DeckButton onClick={() => setEditDialog({ open: false, config: null, isNew: false })}>
              Cancel
            </DeckButton>
            <DeckButton primary onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editDialog.isNew ? 'Create' : 'Save changes'}
            </DeckButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
