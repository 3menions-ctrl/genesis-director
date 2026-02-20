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
  Settings, 
  Clock, 
  Coins,
  RefreshCw,
  Loader2,
  Edit2,
  Plus,
  Calculator,
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
    // Assume 1 credit = $0.116 (from credit packages average)
    const revenuePerCredit = 11.6; // cents
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
            <Settings className="w-5 h-5 text-primary" />
            Pricing Configuration
          </h2>
          <p className="text-sm text-muted-foreground">
            Configure credit costs for video clip generation by duration
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={fetchConfigs} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => openEditDialog(null)} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Tier
          </Button>
        </div>
      </div>

      {/* Pricing Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Pricing Tiers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{configs.length}</div>
            <p className="text-xs text-muted-foreground">
              {configs.filter(c => c.is_active).length} active
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-success" />
              Min Credits/Clip
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {configs.length > 0 ? Math.min(...configs.map(c => c.credits_cost)) : 0}
            </div>
            <p className="text-xs text-muted-foreground">Lowest tier</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-warning" />
              Max Credits/Clip
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {configs.length > 0 ? Math.max(...configs.map(c => c.credits_cost)) : 0}
            </div>
            <p className="text-xs text-muted-foreground">Highest tier</p>
          </CardContent>
        </Card>
      </div>

      {/* Pricing Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Duration-Based Pricing
          </CardTitle>
          <CardDescription>
            Credits charged per clip based on video duration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Duration</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Credits</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Est. Revenue</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">API Cost</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Margin</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Description</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {configs.map((config) => {
                  const margin = calculateMargin(config.credits_cost);
                  return (
                    <tr key={config.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">
                            {formatDuration(config.clip_duration_seconds)}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Coins className="w-4 h-4 text-warning" />
                          <span className="font-mono font-medium">
                            {config.credits_cost}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right text-success">
                        ${(parseFloat(margin.revenue) / 100).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right text-destructive">
                        ${(margin.cost / 100).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Badge className={cn(
                          parseFloat(margin.margin) >= 70 ? "bg-success/10 text-success border-success/20" :
                          parseFloat(margin.margin) >= 50 ? "bg-warning/10 text-warning border-warning/20" :
                          "bg-destructive/10 text-destructive border-destructive/20"
                        )}>
                          {margin.margin}%
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {config.is_active ? (
                          <Badge className="bg-success/10 text-success border-success/20">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground max-w-48 truncate">
                        {config.description || '-'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(config)}
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {configs.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No pricing configuration found</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Margin Warning */}
      {configs.some(c => parseFloat(calculateMargin(c.credits_cost).margin) < 50) && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Low Margin Warning</p>
                <p className="text-sm text-muted-foreground">
                  Some pricing tiers have margins below 50%. Consider increasing credit costs to maintain profitability.
                  Target margin: 70-80%.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="border-info/50 bg-info/5">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Pricing Strategy</p>
              <p className="text-sm text-muted-foreground mt-1">
                Margins are calculated based on:
              </p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                <li>• Kling V3 API cost: ~$0.05/clip</li>
                <li>• Credit value: ~$0.116/credit (based on package prices)</li>
                <li>• Additional costs (TTS, stitching) are separate</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

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
              <div className="text-sm bg-muted/50 p-3 rounded-lg space-y-1">
                <p>Estimated margin: <strong>{calculateMargin(parseInt(form.credits_cost) || 0).margin}%</strong></p>
                <p className="text-muted-foreground">
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
                <p className="text-xs text-muted-foreground">Enable this pricing tier</p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog({ open: false, config: null, isNew: false })}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editDialog.isNew ? 'Create' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
