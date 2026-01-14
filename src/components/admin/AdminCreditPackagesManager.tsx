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
  TrendingUp,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
      const packageData = {
        name: form.name,
        credits,
        price_cents: priceCents,
        is_active: form.is_active,
        is_popular: form.is_popular,
        stripe_price_id: form.stripe_price_id || null,
      };

      if (editDialog.isNew) {
        // Note: RLS blocks client inserts, this would need an admin function
        // For now, show a message about using SQL
        toast.error('Package creation requires database admin access. Use SQL editor to insert.');
      } else if (editDialog.package) {
        // Note: RLS blocks client updates, this would need an admin function
        toast.error('Package updates require database admin access. Use SQL editor to update.');
      }
      
      setEditDialog({ open: false, package: null, isNew: false });
    } catch (err) {
      console.error('Failed to save package:', err);
      toast.error('Failed to save package');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.package) return;
    
    // Note: RLS blocks client deletes
    toast.error('Package deletion requires database admin access. Use SQL editor to delete.');
    setDeleteDialog({ open: false, package: null });
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const getPricePerCredit = (credits: number, priceCents: number) => {
    return (priceCents / credits / 100).toFixed(3);
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
            <Package className="w-5 h-5 text-primary" />
            Credit Packages
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage credit packages available for purchase
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={fetchPackages} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => openEditDialog(null)} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Package
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              Total Packages
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{packages.length}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-success" />
              Active
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {packages.filter(p => p.is_active).length}
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Star className="w-4 h-4 text-warning" />
              Featured
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {packages.filter(p => p.is_popular).length}
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-info/10 to-info/5 border-info/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-info" />
              Total Credits Available
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {packages.filter(p => p.is_active).reduce((sum, p) => sum + p.credits, 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Packages Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Packages</CardTitle>
          <CardDescription>
            Click edit to modify package details. Changes require admin database access.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Package</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Credits</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Price</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">$/Credit</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Stripe ID</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {packages.map((pkg) => (
                  <tr key={pkg.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{pkg.name}</span>
                        {pkg.is_popular && (
                          <Badge className="bg-warning/10 text-warning border-warning/20">
                            <Star className="w-3 h-3 mr-1" />
                            Popular
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      {pkg.credits.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-success">
                      {formatCurrency(pkg.price_cents)}
                    </td>
                    <td className="py-3 px-4 text-right text-muted-foreground">
                      ${getPricePerCredit(pkg.credits, pkg.price_cents)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {pkg.is_active ? (
                        <Badge className="bg-success/10 text-success border-success/20">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <XCircle className="w-3 h-3 mr-1" />
                          Inactive
                        </Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {pkg.stripe_price_id ? (
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {pkg.stripe_price_id.slice(0, 15)}...
                        </code>
                      ) : (
                        <span className="text-muted-foreground text-sm">Not set</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(pkg)}
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setDeleteDialog({ open: true, package: pkg })}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {packages.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No credit packages found</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border-info/50 bg-info/5">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-info/10 flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-5 h-5 text-info" />
            </div>
            <div>
              <p className="font-medium text-foreground">Pricing Strategy Tips</p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                <li>• Offer volume discounts - lower $/credit for larger packages</li>
                <li>• Keep one package marked as "Popular" to guide users</li>
                <li>• Ensure Stripe Price IDs are correctly configured for payments</li>
                <li>• Deactivate packages instead of deleting to preserve history</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

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
              <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
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
                <p className="text-xs text-muted-foreground">Available for purchase</p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Popular</Label>
                <p className="text-xs text-muted-foreground">Highlight as recommended</p>
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
              {editDialog.isNew ? 'Create' : 'Save Changes'}
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
