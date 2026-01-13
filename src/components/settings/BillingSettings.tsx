import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { BuyCreditsModal } from '@/components/credits/BuyCreditsModal';
import { 
  Coins, Plus, TrendingUp, TrendingDown, History,
  Zap, Gift, ShoppingCart, Download, CreditCard,
  BarChart3, Calendar, ArrowUpRight, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Transaction {
  id: string;
  amount: number;
  transaction_type: string;
  description: string | null;
  created_at: string;
  clip_duration_seconds: number | null;
}

interface UsageStats {
  thisMonth: number;
  lastMonth: number;
  thisWeek: number;
  avgPerDay: number;
}

export function BillingSettings() {
  const { user, profile, refreshProfile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [autoRecharge, setAutoRecharge] = useState(false);
  const [isSavingAutoRecharge, setIsSavingAutoRecharge] = useState(false);

  useEffect(() => {
    if (user) {
      fetchTransactions();
      fetchUsageStats();
    }
  }, [user]);

  // Load auto-recharge setting from profile
  useEffect(() => {
    if (profile) {
      setAutoRecharge(profile.auto_recharge_enabled || false);
    }
  }, [profile]);

  const fetchTransactions = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error) {
      setTransactions(data || []);
    }
    setLoadingTransactions(false);
  };

  const fetchUsageStats = async () => {
    if (!user) return;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);

    const { data } = await supabase
      .from('credit_transactions')
      .select('amount, created_at, transaction_type')
      .eq('user_id', user.id)
      .eq('transaction_type', 'usage');

    if (data) {
      const thisMonth = Math.abs(
        data
          .filter(t => new Date(t.created_at) >= startOfMonth)
          .reduce((sum, t) => sum + t.amount, 0)
      );
      const lastMonth = Math.abs(
        data
          .filter(t => 
            new Date(t.created_at) >= startOfLastMonth && 
            new Date(t.created_at) <= endOfLastMonth
          )
          .reduce((sum, t) => sum + t.amount, 0)
      );
      const thisWeek = Math.abs(
        data
          .filter(t => new Date(t.created_at) >= startOfWeek)
          .reduce((sum, t) => sum + t.amount, 0)
      );

      const daysInMonth = now.getDate();
      const avgPerDay = daysInMonth > 0 ? Math.round(thisMonth / daysInMonth) : 0;

      setUsageStats({ thisMonth, lastMonth, thisWeek, avgPerDay });
    }
  };

  const handlePurchaseComplete = () => {
    refreshProfile();
    fetchTransactions();
    fetchUsageStats();
    setShowBuyModal(false);
  };

  const handleAutoRechargeChange = async (checked: boolean) => {
    if (!user) return;
    
    setIsSavingAutoRecharge(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ auto_recharge_enabled: checked })
        .eq('id', user.id);

      if (error) throw error;

      setAutoRecharge(checked);
      await refreshProfile();
      toast.success(checked ? 'Auto-recharge enabled' : 'Auto-recharge disabled');
    } catch (error) {
      console.error('Error updating auto-recharge:', error);
      toast.error('Failed to update auto-recharge setting');
    } finally {
      setIsSavingAutoRecharge(false);
    }
  };

  const getTransactionIcon = (type: string, amount: number) => {
    if (type === 'bonus') return <Gift className="w-4 h-4 text-emerald-400" />;
    if (type === 'purchase') return <ShoppingCart className="w-4 h-4 text-blue-400" />;
    if (type === 'refund') return <TrendingUp className="w-4 h-4 text-emerald-400" />;
    if (amount < 0) return <Zap className="w-4 h-4 text-amber-400" />;
    return <TrendingUp className="w-4 h-4 text-emerald-400" />;
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleExportTransactions = () => {
    if (transactions.length === 0) {
      toast.error('No transactions to export');
      return;
    }

    const csvContent = [
      ['Date', 'Type', 'Description', 'Amount', 'Clip Duration (s)'].join(','),
      ...transactions.map(tx => [
        new Date(tx.created_at).toISOString(),
        tx.transaction_type,
        `"${tx.description || ''}"`,
        tx.amount,
        tx.clip_duration_seconds || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `credit-transactions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Transactions exported');
  };

  const monthlyChange = usageStats && usageStats.lastMonth > 0
    ? Math.round(((usageStats.thisMonth - usageStats.lastMonth) / usageStats.lastMonth) * 100)
    : usageStats?.thisMonth ? 100 : 0;

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Billing & Credits</h2>
          <p className="text-sm text-white/50">Manage your credits and view transaction history</p>
        </div>
        <Button
          onClick={() => setShowBuyModal(true)}
          className="bg-white text-black hover:bg-white/90"
        >
          <Plus className="w-4 h-4 mr-2" />
          Buy Credits
        </Button>
      </div>

      {/* Credit Balance Card */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-2xl overflow-hidden border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-6"
      >
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
              <Coins className="w-7 h-7 text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-white/50">Available Credits</p>
              <p className="text-4xl font-bold text-white">
                {profile?.credits_balance?.toLocaleString() || 0}
              </p>
            </div>
          </div>
          
          <div className="flex gap-6">
            <div className="text-right">
              <p className="text-xs text-white/40">Total Purchased</p>
              <p className="text-lg font-semibold text-white">
                {profile?.total_credits_purchased?.toLocaleString() || 0}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/40">Total Used</p>
              <p className="text-lg font-semibold text-white">
                {profile?.total_credits_used?.toLocaleString() || 0}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Usage Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { 
            label: 'This Month', 
            value: usageStats?.thisMonth || 0, 
            icon: Calendar,
            change: monthlyChange,
            color: 'from-blue-500/20 to-cyan-500/20',
            iconColor: 'text-blue-400'
          },
          { 
            label: 'Last Month', 
            value: usageStats?.lastMonth || 0, 
            icon: History,
            color: 'from-purple-500/20 to-pink-500/20',
            iconColor: 'text-purple-400'
          },
          { 
            label: 'This Week', 
            value: usageStats?.thisWeek || 0, 
            icon: BarChart3,
            color: 'from-emerald-500/20 to-teal-500/20',
            iconColor: 'text-emerald-400'
          },
          { 
            label: 'Avg / Day', 
            value: usageStats?.avgPerDay || 0, 
            icon: TrendingUp,
            color: 'from-amber-500/20 to-orange-500/20',
            iconColor: 'text-amber-400'
          },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="relative rounded-xl overflow-hidden border border-white/[0.06] bg-white/[0.02] p-4 group hover:bg-white/[0.04] transition-all"
          >
            <div className={cn("absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br", stat.color)} />
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <stat.icon className={cn("w-4 h-4", stat.iconColor)} />
                {stat.change !== undefined && (
                  <span className={cn(
                    "text-xs font-medium flex items-center gap-0.5",
                    stat.change >= 0 ? "text-emerald-400" : "text-rose-400"
                  )}>
                    {stat.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {Math.abs(stat.change)}%
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-white/40">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Auto-Recharge Option */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.02] p-6"
      >
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-white/40" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Auto-Recharge</h3>
              <p className="text-sm text-white/50">
                Automatically purchase credits when balance is low
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isSavingAutoRecharge && <Loader2 className="w-4 h-4 animate-spin text-white/40" />}
            <Switch
              checked={autoRecharge}
              onCheckedChange={handleAutoRechargeChange}
              disabled={isSavingAutoRecharge}
            />
          </div>
        </div>
        
        {autoRecharge && (
          <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <p className="text-sm text-amber-400">
              When your balance drops below 60 credits (1 video), we'll automatically add 250 credits to your account.
            </p>
          </div>
        )}
      </motion.div>

      {/* Transaction History */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="relative rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.02]"
      >
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        
        <div className="p-6 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center">
              <History className="w-5 h-5 text-white/40" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Transaction History</h3>
              <p className="text-xs text-white/40">Your recent credit activity</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-white/50 hover:text-white"
            onClick={handleExportTransactions}
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>

        <div className="divide-y divide-white/[0.04]">
          {loadingTransactions ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="px-6 py-4">
                <Skeleton className="h-12 w-full bg-white/5" />
              </div>
            ))
          ) : transactions.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <History className="w-12 h-12 text-white/20 mx-auto mb-3" />
              <p className="text-white/40">No transactions yet</p>
              <p className="text-sm text-white/25 mt-1">Start creating to see your history</p>
            </div>
          ) : (
            transactions.map((tx, i) => (
              <motion.div 
                key={tx.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    tx.amount >= 0 ? "bg-emerald-500/10" : "bg-white/[0.05]"
                  )}>
                    {getTransactionIcon(tx.transaction_type, tx.amount)}
                  </div>
                  <div>
                    <p className="font-medium text-white">
                      {tx.description || (
                        tx.transaction_type === 'bonus' ? 'Welcome Bonus' : 
                        tx.transaction_type === 'purchase' ? 'Credit Purchase' :
                        tx.transaction_type === 'refund' ? 'Credit Refund' :
                        'Video Generation'
                      )}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-white/40">
                      <span>{formatRelativeTime(tx.created_at)}</span>
                      {tx.clip_duration_seconds && (
                        <>
                          <span className="text-white/20">•</span>
                          <span>{tx.clip_duration_seconds}s clip</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <span className={cn(
                  "text-lg font-semibold tabular-nums",
                  tx.amount >= 0 ? 'text-emerald-400' : 'text-white/50'
                )}>
                  {tx.amount >= 0 ? '+' : ''}{tx.amount}
                </span>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>

      <BuyCreditsModal 
        open={showBuyModal} 
        onOpenChange={setShowBuyModal}
        onPurchaseComplete={handlePurchaseComplete}
      />
    </div>
  );
}