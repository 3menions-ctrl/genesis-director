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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Package,
  Plus,
  Edit2,
  Trash2,
  Star,
  DollarSign,
  Coins,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { FloatSection, FloatStat, FloatTable, DeckButton, StatusPill } from '@/admin/ui/primitives';

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price_cents: number;
  is_active: boolean;
  is_popular: boolean;
  stripe_price_id: string | null;
  created_at: string;
}

interface PackageStats {
  packageId: string;
  totalSales: number;
  totalRevenue: number;
}

export function AdminCreditPackagesManager() {
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [packageStats, setPackageStats] = useState<Record<string, PackageStats>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dialog states
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    package: CreditPackage | null;
    isNew: boolean;
  }>({ open: false, package: null, isNew: false });

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    package: CreditPackage | null;
  }>({ open: false, package: null });

  // Form state
  const [form, setForm] = useState({
    name: '',
    credits: '',
    price_cents: '',
    is_active: true,
    is_popular: false,
    stripe_price_id: '',
  });

  useEffect(() => {
    fetchPackages();
    fetchPackageStats();
  }, []);

  const fetchPackages = async () => {
    setLoading(true);
    try {
      // Fetch all packages including inactive (admin bypass)
      const { data, error } = await supabase
        .from('credit_packages')
        .select('*')
        .order('credits', { ascending: true });

      if (error) throw error;
      setPackages(data || []);
    } catch (err) {
      console.error('Failed to fetch packages:', err);
      toast.error('Failed to load credit packages');
    } finally {
      setLoading(false);
    }
  };

  const fetchPackageStats = async () => {
    try {
      // Get purchase transactions to calculate stats per package
      const { data: transactions } = await supabase
        .from('credit_transactions')
        .select('amount, description')
        .eq('transaction_type', 'purchase');

      // Parse and aggregate stats (would need package ID in description or separate column)
      // For now, we'll show total sales across all packages
      const stats: Record<string, PackageStats> = {};
      setPackageStats(stats);
    } catch (err) {
      console.error('Failed to fetch package stats:', err);
    }
  };

  const openEditDialog = (pkg: CreditPackage | null) => {
    if (pkg) {
      setForm({
        name: pkg.name,
        credits: pkg.credits.toString(),
        price_cents: pkg.price_cents.toString(),
        is_active: pkg.is_active ?? true,
        is_popular: pkg.is_popular ?? false,
        stripe_price_id: pkg.stripe_price_id || '',
      });
      setEditDialog({ open: true, package: pkg, isNew: false });
    } else {
      setForm({
        name: '',
        credits: '',
        price_cents: '',
        is_active: true,
        is_popular: false,
        stripe_price_id: '',
      });
      setEditDialog({ open: true, package: null, isNew: true });
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.credits || !form.price_cents) {
      toast.error('Please fill in all required fields');
      return;
    }

    const credits = parseInt(form.credits, 10);
    const priceCents = parseInt(form.price_cents, 10);

    if (isNaN(credits) || credits <= 0) {
      toast.error('Credits must be a positive number');
      return;
    }
    if (isNaN(priceCents) || priceCents <= 0) {
      toast.error('Price must be a positive number');
      return;
    }

    setSaving(true);
    try {
      if (editDialog.isNew) {
        const { data, error } = await supabase.rpc('admin_manage_credit_package', {
          p_action: 'create',
          p_name: form.name,
          p_credits: credits,
          p_price_cents: priceCents,
          p_is_active: form.is_active,
          p_is_popular: form.is_popular,
          p_stripe_price_id: form.stripe_price_id || null,
        });
        if (error) throw error;
        toast.success('Package created successfully');
      } else if (editDialog.package) {
        const { data, error } = await supabase.rpc('admin_manage_credit_package', {
          p_action: 'update',
          p_package_id: editDialog.package.id,
          p_name: form.name,
          p_credits: credits,
          p_price_cents: priceCents,
          p_is_active: form.is_active,
          p_is_popular: form.is_popular,
          p_stripe_price_id: form.stripe_price_id || null,
        });
        if (error) throw error;
        toast.success('Package updated successfully');
      }

      setEditDialog({ open: false, package: null, isNew: false });
      fetchPackages();
    } catch (err) {
      console.error('Failed to save package:', err);
      toast.error('Failed to save package');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.package) return;

    setSaving(true);
    try {
      const { error } = await supabase.rpc('admin_manage_credit_package', {
        p_action: 'delete',
        p_package_id: deleteDialog.package.id,
      });
      if (error) throw error;
      toast.success('Package deleted');
      setDeleteDialog({ open: false, package: null });
      fetchPackages();
    } catch (err) {
      console.error('Failed to delete package:', err);
      toast.error('Failed to delete package');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const getPricePerCredit = (credits: number, priceCents: number) => {
    if (!credits) return '0.000'; // guard a legacy/zero-credit row → no Infinity
    return (priceCents / credits / 100).toFixed(3);
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
            <Package className="w-5 h-5 text-white/60" />
            Credit Packages
          </h2>
          <p className="text-[13px] text-white/55">
            Manage credit packages available for purchase
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DeckButton onClick={fetchPackages}>
            <RefreshCw className="w-3.5 h-3.5 mr-2" />
            Refresh
          </DeckButton>
          <DeckButton primary onClick={() => openEditDialog(null)}>
            <Plus className="w-3.5 h-3.5 mr-2" />
            Add Package
          </DeckButton>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <FloatStat label="Total Packages" value={packages.length} icon={Package} index={0} />
        <FloatStat label="Active" value={packages.filter(p => p.is_active).length} icon={CheckCircle} index={1} />
        <FloatStat label="Featured" value={packages.filter(p => p.is_popular).length} icon={Star} index={2} />
        <FloatStat
          label="Total Credits Available"
          value={packages.filter(p => p.is_active).reduce((sum, p) => sum + p.credits, 0)}
          icon={Coins}
          index={3}
        />
      </div>

      {/* Packages Table */}
      <FloatSection title="All Packages" meta="click edit to modify">
        <div className="overflow-x-auto">
          <FloatTable
            columns={[
              { key: 'name', label: 'Package' },
              { key: 'credits', label: 'Credits', align: 'right' },
              { key: 'price', label: 'Price', align: 'right' },
              { key: 'perCredit', label: '$/Credit', align: 'right' },
              { key: 'status', label: 'Status' },
              { key: 'stripe', label: 'Stripe ID' },
              { key: 'actions', label: 'Actions', align: 'right' },
            ]}
            rows={packages.map((pkg) => ({
              _key: pkg.id,
              name: (
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white">{pkg.name}</span>
                  {pkg.is_popular && (
                    <StatusPill tone="warn">
                      <Star className="w-3 h-3" />
                      Popular
                    </StatusPill>
                  )}
                </div>
              ),
              credits: <span className="font-mono">{pkg.credits.toLocaleString()}</span>,
              price: <span className="font-medium" style={{ color: 'hsl(188 92% 58%)' }}>{formatCurrency(pkg.price_cents)}</span>,
              perCredit: <span className="text-white/50">${getPricePerCredit(pkg.credits, pkg.price_cents)}</span>,
              status: pkg.is_active ? (
                <StatusPill tone="positive">
                  <CheckCircle className="w-3 h-3" />
                  Active
                </StatusPill>
              ) : (
                <StatusPill tone="neutral">
                  <XCircle className="w-3 h-3" />
                  Inactive
                </StatusPill>
              ),
              stripe: pkg.stripe_price_id ? (
                <code className="text-[11px] font-mono text-white/60">
                  {pkg.stripe_price_id.slice(0, 15)}...
                </code>
              ) : (
                <span className="text-white/40 text-[13px]">Not set</span>
              ),
              actions: (
                <div className="flex items-center justify-end gap-1.5">
                  <button
                    onClick={() => openEditDialog(pkg)}
                    className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteDialog({ open: true, package: pkg })}
                    className="p-2 rounded-lg text-white/60 hover:text-[hsl(350_90%_70%)] hover:bg-[hsl(350_90%_70%/0.12)] transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ),
            }))}
            empty="No credit packages found"
          />
        </div>
      </FloatSection>

      {/* Info */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-white/[0.06] flex items-center justify-center flex-shrink-0">
          <DollarSign className="w-5 h-5 text-white/60" />
        </div>
        <div>
          <p className="font-medium text-white">Pricing Strategy Tips</p>
          <ul className="text-[13px] text-white/55 mt-2 space-y-1">
            <li>• Offer volume discounts - lower $/credit for larger packages</li>
            <li>• Keep one package marked as "Popular" to guide users</li>
            <li>• Ensure Stripe Price IDs are correctly configured for payments</li>
            <li>• Deactivate packages instead of deleting to preserve history</li>
          </ul>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialog.open} onOpenChange={(open) => !open && setEditDialog({ open: false, package: null, isNew: false })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editDialog.isNew ? 'Create Package' : 'Edit Package'}
            </DialogTitle>
            <DialogDescription>
              {editDialog.isNew
                ? 'Add a new credit package for users to purchase'
                : 'Modify package details'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Package Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Starter Pack"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="credits">Credits *</Label>
                <Input
                  id="credits"
                  type="number"
                  value={form.credits}
                  onChange={(e) => setForm({ ...form, credits: e.target.value })}
                  placeholder="100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Price (cents) *</Label>
                <Input
                  id="price"
                  type="number"
                  value={form.price_cents}
                  onChange={(e) => setForm({ ...form, price_cents: e.target.value })}
                  placeholder="999"
                />
              </div>
            </div>

            {form.credits && form.price_cents && (
              <div className="text-[13px] text-white/55 bg-white/[0.04] p-3 rounded-lg">
                Price per credit: ${getPricePerCredit(parseInt(form.credits) || 1, parseInt(form.price_cents) || 0)}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="stripe_id">Stripe Price ID</Label>
              <Input
                id="stripe_id"
                value={form.stripe_price_id}
                onChange={(e) => setForm({ ...form, stripe_price_id: e.target.value })}
                placeholder="price_..."
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Active</Label>
                <p className="text-xs text-white/45">Available for purchase</p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Popular</Label>
                <p className="text-xs text-white/45">Highlight as recommended</p>
              </div>
              <Switch
                checked={form.is_popular}
                onCheckedChange={(checked) => setForm({ ...form, is_popular: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog({ open: false, package: null, isNew: false })}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editDialog.isNew ? 'Create' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, package: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Package?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteDialog.package?.name}"?
              This action cannot be undone. Consider deactivating instead to preserve purchase history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
