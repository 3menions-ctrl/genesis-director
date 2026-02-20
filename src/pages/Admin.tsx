import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { 
  DollarSign, 
  TrendingUp, 
  Coins, 
  BarChart3, 
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Users,
  FolderKanban,
  Shield,
  Search,
  Loader2,
  UserCog,
  History,
  Plus,
  Minus,
  Crown,
  AlertTriangle,
  MessageSquare,
  Mail,
  CheckCircle,
  Eye,
  Trash2,
  Calculator,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AppHeader } from '@/components/layout/AppHeader';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { CostAnalysisDashboard } from '@/components/admin/CostAnalysisDashboard';
import { AdminProjectsBrowser } from '@/components/admin/AdminProjectsBrowser';
import { AdminPipelineMonitor } from '@/components/admin/AdminPipelineMonitor';
import { AdminFailedClipsQueue } from '@/components/admin/AdminFailedClipsQueue';
import { AdminCreditPackagesManager } from '@/components/admin/AdminCreditPackagesManager';
import { AdminPricingConfigEditor } from '@/components/admin/AdminPricingConfigEditor';
import { AdminTierLimitsEditor } from '@/components/admin/AdminTierLimitsEditor';
import { AdminContentModeration } from '@/components/admin/AdminContentModeration';
import { AdminSystemConfig } from '@/components/admin/AdminSystemConfig';
import { AdminMessageCenter } from '@/components/admin/AdminMessageCenter';
import { AdminAvatarSeeder } from '@/components/admin/AdminAvatarSeeder';
import { AdminAvatarBatchV2 } from '@/components/admin/AdminAvatarBatchV2';
import { AdminGalleryManager } from '@/components/admin/AdminGalleryManager';

interface ProfitData {
  date: string;
  service: string;
  total_operations: number;
  total_credits_charged: number;
  total_real_cost_cents: number;
  estimated_revenue_cents: number;
  profit_margin_percent: number;
}

interface AdminStats {
  total_users: number;
  users_today: number;
  total_projects: number;
  projects_today: number;
  total_credits_sold: number;
  total_credits_used: number;
  active_generations: number;
  completed_videos: number;
}

interface UserRecord {
  id: string;
  email: string;
  display_name: string;
  full_name: string;
  credits_balance: number;
  total_credits_purchased: number;
  total_credits_used: number;
  account_tier: string;
  created_at: string;
  project_count: number;
  roles: string[];
}

interface AuditLogEntry {
  id: string;
  admin_id: string;
  action: string;
  target_type: string;
  target_id: string;
  details: Record<string, unknown>;
  created_at: string;
}

interface SupportMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  source: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

// Cost pricing constants (must match CostAnalysisDashboard)
const VEO_COST_PER_CLIP_CENTS = 8;
const OPENAI_TTS_COST_PER_CALL_CENTS = 2;
const CLOUD_RUN_STITCH_COST_CENTS = 2;
const OPENAI_SCRIPT_COST_CENTS = 12;
const DALLE_COST_PER_IMAGE_CENTS = 4;
const GEMINI_FLASH_COST_CENTS = 1;

interface CostSummary {
  totalApiCost: number;
  totalWastedCost: number;
  totalRetries: number;
  totalRefunds: number;
  failedClips: number;
  wastePercentage: number;
}

/* ─── Stat Pill ─────────────────────────────────────────────────── */
function StatPill({ icon: Icon, label, value, sub, accent }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent?: 'primary' | 'success' | 'warning' | 'destructive' | 'info';
}) {
  const accentColor = {
    primary: 'text-primary',
    success: 'text-success',
    warning: 'text-warning',
    destructive: 'text-destructive',
    info: 'text-info',
  }[accent || 'primary'];

  return (
    <div className="glass-card-dark p-5 space-y-3">
      <div className="flex items-center gap-2.5">
        <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center bg-muted/50", accentColor)}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  // FIX: useAuth now returns safe fallback if context is missing
  // No try-catch needed - that violated React's hook rules
  const { user } = useAuth();
  
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Overview state
  const [stats, setStats] = useState<AdminStats | null>(null);
  
  // Cost summary for overview
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null);
  
  // Users state
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);
  
  // Credit adjustment dialog
  const [creditDialog, setCreditDialog] = useState<{
    open: boolean;
    user: UserRecord | null;
    amount: string;
    reason: string;
  }>({ open: false, user: null, amount: '', reason: '' });
  
  // Financials state
  const [profitData, setProfitData] = useState<ProfitData[]>([]);
  const [actualStripeRevenue, setActualStripeRevenue] = useState(0);
  const [calculatedApiCost, setCalculatedApiCost] = useState(0);
  const [totalOperations, setTotalOperations] = useState(0);
  
  // Audit log state
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  
  // Messages state
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<SupportMessage | null>(null);

  // Check admin status on mount
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      
      try {
        const { data, error } = await supabase.rpc('is_admin', { _user_id: user.id });
        if (error) throw error;
        setIsAdmin(data === true);
      } catch (err) {
        console.error('Failed to check admin status:', err);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };
    
    checkAdminStatus();
  }, [user]);

  // Fetch data based on active tab
  useEffect(() => {
    if (!isAdmin) return;
    
    // Always fetch messages for the badge count
    fetchMessages();
    
    if (activeTab === 'overview') {
      fetchStats();
      fetchCostSummary();
    } else if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'financials') {
      fetchProfitData();
      fetchActualRevenue();
      fetchCalculatedApiCost();
    } else if (activeTab === 'audit') {
      fetchAuditLog();
    }
  }, [isAdmin, activeTab]);

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase.rpc('get_admin_stats');
      if (error) throw error;
      setStats(data as unknown as AdminStats);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
      toast.error('Failed to load admin stats');
    }
  };

  const fetchCostSummary = async () => {
    try {
      const { data: apiData } = await supabase
        .from('api_cost_logs')
        .select('service, operation, status, credits_charged, real_cost_cents');
      
      const { data: clipsData } = await supabase
        .from('video_clips')
        .select('id, status, retry_count');
      
      const { data: refundsData } = await supabase
        .from('credit_transactions')
        .select('amount')
        .eq('transaction_type', 'refund');

      let totalApiCost = 0;
      let failedApiCost = 0;
      let failedClips = 0;

      (apiData || []).forEach((log: { service: string; status: string; real_cost_cents: number }) => {
        let costPerCall = 0;
        switch (log.service) {
          case 'google_veo': costPerCall = VEO_COST_PER_CLIP_CENTS; break;
          case 'openai-tts': costPerCall = 2; break;
          case 'cloud_run_stitcher': costPerCall = 2; break;
          case 'openai': costPerCall = 12; break;
          case 'dalle': costPerCall = 4; break;
          case 'gemini': costPerCall = 1; break;
          case 'music-generation': costPerCall = 0; break;
          default: costPerCall = log.real_cost_cents || 0;
        }
        
        totalApiCost += costPerCall;
        if (log.status === 'failed') {
          failedApiCost += costPerCall;
          failedClips++;
        }
      });

      let totalRetries = 0;
      (clipsData || []).forEach((clip: { retry_count: number | null }) => {
        totalRetries += clip.retry_count || 0;
      });
      const retryCost = totalRetries * VEO_COST_PER_CLIP_CENTS;

      const totalRefundCredits = (refundsData || []).reduce(
        (sum: number, r: { amount: number }) => sum + Math.abs(r.amount || 0), 
        0
      );

      const totalWastedCost = failedApiCost + retryCost;
      const wastePercentage = (totalApiCost + retryCost) > 0 
        ? (totalWastedCost / (totalApiCost + retryCost)) * 100 
        : 0;

      setCostSummary({
        totalApiCost: totalApiCost + retryCost,
        totalWastedCost,
        totalRetries,
        totalRefunds: totalRefundCredits,
        failedClips,
        wastePercentage,
      });
    } catch (err) {
      console.error('Failed to fetch cost summary:', err);
    }
  };

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const { data, error } = await supabase.rpc('admin_list_users', {
        p_limit: 100,
        p_offset: 0,
        p_search: userSearch || null,
      });
      if (error) throw error;
      setUsers((data || []) as UserRecord[]);
    } catch (err) {
      console.error('Failed to fetch users:', err);
      toast.error('Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  }, [userSearch]);

  const fetchProfitData = async () => {
    try {
      const { data, error } = await supabase.rpc('get_admin_profit_dashboard');
      if (error) throw error;
      setProfitData((data || []) as ProfitData[]);
    } catch (err) {
      console.error('Failed to fetch profit data:', err);
      toast.error('Failed to load financial data');
    }
  };

  const fetchActualRevenue = async () => {
    try {
      const { data: purchasesData } = await supabase
        .from('credit_transactions')
        .select('amount, stripe_payment_id')
        .eq('transaction_type', 'purchase')
        .not('stripe_payment_id', 'is', null);
      
      const { data: refundsData } = await supabase
        .from('credit_transactions')
        .select('amount')
        .eq('transaction_type', 'refund');
      
      const CREDIT_PRICE_CENTS = 10.0;
      const purchases = purchasesData || [];
      const refunds = refundsData || [];
      
      const purchasedCredits = purchases.reduce((sum, p) => sum + (p.amount || 0), 0);
      const refundedCredits = refunds.reduce((sum, r) => sum + Math.abs(r.amount || 0), 0);
      
      const revenue = Math.round((purchasedCredits - refundedCredits) * CREDIT_PRICE_CENTS);
      setActualStripeRevenue(Math.max(0, revenue));
    } catch (err) {
      console.error('Failed to fetch actual revenue:', err);
    }
  };

  const fetchCalculatedApiCost = async () => {
    try {
      const { data: apiData } = await supabase
        .from('api_cost_logs')
        .select('service, status');
      
      const { data: clipsData } = await supabase
        .from('video_clips')
        .select('retry_count');
      
      let totalCost = 0;
      let opCount = 0;
      
      (apiData || []).forEach((log: { service: string; status: string }) => {
        opCount++;
        switch (log.service) {
          case 'google_veo': totalCost += VEO_COST_PER_CLIP_CENTS; break;
          case 'openai-tts': totalCost += OPENAI_TTS_COST_PER_CALL_CENTS; break;
          case 'cloud_run_stitcher': totalCost += CLOUD_RUN_STITCH_COST_CENTS; break;
          case 'openai': totalCost += OPENAI_SCRIPT_COST_CENTS; break;
          case 'dalle': totalCost += DALLE_COST_PER_IMAGE_CENTS; break;
          case 'gemini': totalCost += GEMINI_FLASH_COST_CENTS; break;
          case 'music-generation': totalCost += 0; break;
          default: totalCost += 0;
        }
      });
      
      const totalRetries = (clipsData || []).reduce(
        (sum: number, clip: { retry_count: number | null }) => sum + (clip.retry_count || 0), 
        0
      );
      totalCost += totalRetries * VEO_COST_PER_CLIP_CENTS;
      
      setCalculatedApiCost(totalCost);
      setTotalOperations(opCount + totalRetries);
    } catch (err) {
      console.error('Failed to fetch calculated API cost:', err);
    }
  };

  const fetchAuditLog = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      setAuditLog((data || []) as AuditLogEntry[]);
    } catch (err) {
      console.error('Failed to fetch audit log:', err);
      toast.error('Failed to load audit log');
    }
  };

  const fetchMessages = async () => {
    setMessagesLoading(true);
    try {
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      setMessages((data || []) as SupportMessage[]);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
      toast.error('Failed to load messages');
    } finally {
      setMessagesLoading(false);
    }
  };

  const updateMessageStatus = async (messageId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('support_messages')
        .update({ status })
        .eq('id', messageId);
      if (error) throw error;
      toast.success(`Message marked as ${status}`);
      fetchMessages();
      setSelectedMessage(null);
    } catch (err) {
      console.error('Failed to update message:', err);
      toast.error('Failed to update message status');
    }
  };

  const deleteMessage = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('support_messages')
        .delete()
        .eq('id', messageId);
      if (error) throw error;
      toast.success('Message deleted');
      fetchMessages();
      setSelectedMessage(null);
    } catch (err) {
      console.error('Failed to delete message:', err);
      toast.error('Failed to delete message');
    }
  };

  const handleAdjustCredits = async () => {
    if (!creditDialog.user || !creditDialog.amount || !creditDialog.reason) {
      toast.error('Please fill in all fields');
      return;
    }

    const amount = parseInt(creditDialog.amount, 10);
    if (isNaN(amount) || amount === 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      const { data, error } = await supabase.rpc('admin_adjust_credits', {
        p_target_user_id: creditDialog.user.id,
        p_amount: amount,
        p_reason: creditDialog.reason,
      });
      
      if (error) throw error;
      
      toast.success(`Credits ${amount >= 0 ? 'added' : 'deducted'} successfully`);
      setCreditDialog({ open: false, user: null, amount: '', reason: '' });
      fetchUsers();
    } catch (err) {
      console.error('Failed to adjust credits:', err);
      toast.error('Failed to adjust credits');
    }
  };

  const handleToggleAdminRole = async (targetUser: UserRecord) => {
    const hasAdminRole = targetUser.roles?.includes('admin');
    const action = hasAdminRole ? 'revoke' : 'grant';
    
    if (targetUser.id === user?.id && action === 'revoke') {
      toast.error("You cannot remove your own admin role");
      return;
    }

    try {
      const { error } = await supabase.rpc('admin_manage_role', {
        p_target_user_id: targetUser.id,
        p_role: 'admin',
        p_action: action,
      });
      
      if (error) throw error;
      
      toast.success(`Admin role ${action === 'grant' ? 'granted' : 'revoked'}`);
      fetchUsers();
    } catch (err) {
      console.error('Failed to manage role:', err);
      toast.error('Failed to manage role');
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <p className="text-xs text-muted-foreground tracking-wider uppercase">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  // Redirect non-admins
  if (!user || isAdmin === false) {
    return <Navigate to="/" replace />;
  }

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  // Calculate financial summary
  const totalProfit = actualStripeRevenue - calculatedApiCost;
  const profitMargin = actualStripeRevenue > 0 
    ? (totalProfit / actualStripeRevenue) * 100 
    : 0;

  const newMessageCount = messages.filter(m => m.status === 'new').length;

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-8 animate-fade-in">
            {/* Key Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatPill icon={Users} label="Users" value={stats?.total_users?.toLocaleString() || '0'} sub={`+${stats?.users_today || 0} today`} accent="primary" />
              <StatPill icon={FolderKanban} label="Projects" value={stats?.total_projects?.toLocaleString() || '0'} sub={`+${stats?.projects_today || 0} today`} accent="info" />
              <StatPill icon={Coins} label="Credits Sold" value={stats?.total_credits_sold?.toLocaleString() || '0'} sub={`${stats?.total_credits_used?.toLocaleString() || 0} used`} accent="warning" />
              <StatPill icon={Activity} label="Active Jobs" value={stats?.active_generations || 0} sub={`${stats?.completed_videos || 0} completed`} accent="success" />
            </div>

            {/* Cost Overview */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-2">
                <Calculator className="w-3.5 h-3.5" />
                Cost Overview
              </h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatPill icon={DollarSign} label="API Spend" value={formatCurrency(costSummary?.totalApiCost || 0)} sub="All-time" accent="primary" />
                <StatPill icon={AlertTriangle} label="Wasted" value={formatCurrency(costSummary?.totalWastedCost || 0)} sub={`${(costSummary?.wastePercentage || 0).toFixed(1)}% of total`} accent="destructive" />
                <StatPill icon={RefreshCw} label="Retries" value={costSummary?.totalRetries?.toLocaleString() || '0'} sub={formatCurrency((costSummary?.totalRetries || 0) * VEO_COST_PER_CLIP_CENTS)} accent="warning" />
                <StatPill icon={ArrowDownRight} label="Refunds" value={costSummary?.totalRefunds?.toLocaleString() || '0'} sub="Credits refunded" accent="info" />
              </div>
            </div>

            {/* Failed Operations Warning */}
            {(costSummary?.failedClips || 0) > 0 && (
              <div className="glass-card-dark p-4 border-destructive/20">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {costSummary?.failedClips} failed operations
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(costSummary?.totalWastedCost || 0)} wasted — View Cost Analysis for breakdown
                    </p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-xs shrink-0"
                    onClick={() => setActiveTab('costs')}
                  >
                    Details →
                  </Button>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button onClick={() => { fetchStats(); fetchCostSummary(); }} variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground">
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Refresh
              </Button>
              <Button 
                onClick={async () => {
                  if (!confirm('Force-logout ALL users? They will need to sign in again. This cannot be undone.')) return;
                  try {
                    const { error } = await supabase.rpc('admin_force_logout_all');
                    if (error) throw error;
                    toast.success('All users have been logged out');
                  } catch (err) {
                    console.error(err);
                    toast.error('Failed to force logout users');
                  }
                }} 
                variant="ghost" 
                size="sm" 
                className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Shield className="w-3.5 h-3.5 mr-1.5" />
                Force Logout All
              </Button>
            </div>
          </div>
        );

      case 'messages':
        return <AdminMessageCenter />;

      case 'users':
        return (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
                  className="pl-9 h-9 text-sm bg-muted/30 border-border/50"
                />
              </div>
              <Button onClick={fetchUsers} variant="ghost" size="sm" disabled={usersLoading} className="h-9">
                {usersLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              </Button>
            </div>

            <div className="glass-card-dark overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left py-3 px-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">User</th>
                      <th className="text-right py-3 px-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Credits</th>
                      <th className="text-center py-3 px-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Projects</th>
                      <th className="text-center py-3 px-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Tier</th>
                      <th className="text-center py-3 px-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Roles</th>
                      <th className="text-right py-3 px-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-4">
                          <p className="text-sm font-medium text-foreground">{u.display_name || u.full_name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-mono text-sm">{u.credits_balance?.toLocaleString()}</span>
                        </td>
                        <td className="py-3 px-4 text-center text-sm text-muted-foreground">{u.project_count}</td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant="secondary" className="text-[10px] font-medium">{u.account_tier}</Badge>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {u.roles?.includes('admin') && (
                            <Badge className="bg-primary/10 text-primary border border-primary/20 text-[10px]">
                              <Crown className="w-2.5 h-2.5 mr-1" />
                              Admin
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => setCreditDialog({ 
                                open: true, 
                                user: u, 
                                amount: '', 
                                reason: '' 
                              })}
                              title="Adjust Credits"
                            >
                              <Coins className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant={u.roles?.includes('admin') ? 'destructive' : 'ghost'}
                              className="h-7 w-7 p-0"
                              onClick={() => handleToggleAdminRole(u)}
                              title={u.roles?.includes('admin') ? 'Revoke Admin' : 'Grant Admin'}
                            >
                              <UserCog className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-warning hover:text-warning hover:bg-warning/10"
                              title="Force Logout User"
                              onClick={async () => {
                                if (!confirm(`Force logout ${u.display_name || u.email}?`)) return;
                                try {
                                  const { error } = await supabase.rpc('admin_force_logout_user', {
                                    p_target_user_id: u.id,
                                  });
                                  if (error) throw error;
                                  toast.success(`${u.display_name || u.email} has been logged out`);
                                } catch (err) {
                                  console.error(err);
                                  toast.error('Failed to force logout user');
                                }
                              }}
                            >
                              <Shield className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {users.length === 0 && !usersLoading && (
                  <div className="text-center py-16 text-muted-foreground text-sm">
                    No users found
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'financials':
        return (
          <div className="space-y-8 animate-fade-in">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatPill icon={DollarSign} label="Revenue" value={formatCurrency(actualStripeRevenue)} sub={actualStripeRevenue === 0 ? 'No purchases yet' : 'Stripe purchases'} accent="success" />
              <StatPill icon={ArrowDownRight} label="API Cost" value={formatCurrency(calculatedApiCost)} sub={`${totalOperations.toLocaleString()} operations`} accent="destructive" />
              <StatPill icon={TrendingUp} label="Net Profit" value={formatCurrency(totalProfit)} accent="primary" />
              <StatPill 
                icon={BarChart3} 
                label="Margin" 
                value={formatPercent(profitMargin)} 
                sub="Target: 70-80%"
                accent={profitMargin >= 70 ? 'success' : profitMargin >= 50 ? 'warning' : 'destructive'} 
              />
            </div>

            <div className="glass-card-dark overflow-hidden">
              <div className="p-5 border-b border-border/30">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Activity className="w-4 h-4 text-muted-foreground" />
                  Cost Breakdown by Service
                </h3>
              </div>
              <div className="p-0">
                {profitData.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <Coins className="w-8 h-8 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No cost data yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border/30">
                          <th className="text-left py-3 px-5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                          <th className="text-left py-3 px-5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Service</th>
                          <th className="text-right py-3 px-5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Ops</th>
                          <th className="text-right py-3 px-5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Revenue</th>
                          <th className="text-right py-3 px-5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Cost</th>
                          <th className="text-right py-3 px-5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Margin</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profitData.map((row, idx) => (
                          <tr key={idx} className="border-b border-border/20 hover:bg-muted/15 transition-colors">
                            <td className="py-3 px-5 text-sm">{new Date(row.date).toLocaleDateString()}</td>
                            <td className="py-3 px-5">
                              <Badge variant="secondary" className="text-[10px]">{row.service}</Badge>
                            </td>
                            <td className="py-3 px-5 text-sm text-right text-muted-foreground">{row.total_operations.toLocaleString()}</td>
                            <td className="py-3 px-5 text-sm text-right text-success">{formatCurrency(row.estimated_revenue_cents)}</td>
                            <td className="py-3 px-5 text-sm text-right text-destructive">{formatCurrency(row.total_real_cost_cents)}</td>
                            <td className="py-3 px-5 text-right">
                              <span className={cn(
                                "text-sm font-medium",
                                row.profit_margin_percent >= 70 ? "text-success" :
                                row.profit_margin_percent >= 50 ? "text-warning" : "text-destructive"
                              )}>
                                {formatPercent(row.profit_margin_percent)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <Button onClick={fetchProfitData} variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground">
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Refresh
            </Button>
          </div>
        );

      case 'costs':
        return <CostAnalysisDashboard />;

      case 'audit':
        return (
          <div className="space-y-4 animate-fade-in">
            <div className="glass-card-dark overflow-hidden">
              <div className="p-5 border-b border-border/30">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <History className="w-4 h-4 text-muted-foreground" />
                  Audit Log
                </h3>
                <p className="text-xs text-muted-foreground mt-1">Track all admin actions</p>
              </div>
              <div className="p-4">
                {auditLog.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <History className="w-8 h-8 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No audit entries yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {auditLog.map((entry) => (
                      <div key={entry.id} className="flex items-start gap-3 p-3 rounded-xl bg-muted/20 border border-border/30 hover:bg-muted/30 transition-colors">
                        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Shield className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">{entry.action}</Badge>
                            {entry.target_type && (
                              <span className="text-xs text-muted-foreground">
                                on {entry.target_type}
                              </span>
                            )}
                          </div>
                          {entry.details && Object.keys(entry.details).length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1 font-mono truncate">
                              {JSON.stringify(entry.details)}
                            </p>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {new Date(entry.created_at).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <Button onClick={fetchAuditLog} variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground">
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Refresh
            </Button>
          </div>
        );

      case 'projects':
        return <AdminProjectsBrowser />;

      case 'pipeline':
        return <AdminPipelineMonitor />;

      case 'failed':
        return <AdminFailedClipsQueue />;

      case 'packages':
        return (
          <div className="space-y-6">
            <AdminCreditPackagesManager />
            <AdminPricingConfigEditor />
            <AdminTierLimitsEditor />
          </div>
        );

      case 'moderation':
        return <AdminContentModeration />;

      case 'config':
        return <AdminSystemConfig />;

      case 'avatars':
        return (
          <div className="space-y-6">
            <AdminAvatarBatchV2 />
            <AdminAvatarSeeder />
          </div>
        );

      case 'gallery':
        return <AdminGalleryManager />;

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      
      <AdminSidebar 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        messageCount={newMessageCount}
      />
      
      <main className="pl-16 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8 space-y-8">
          {/* Minimal Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Shield className="w-4.5 h-4.5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-foreground">
                  Admin
                </h1>
                <p className="text-[11px] text-muted-foreground">
                  {user?.email}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-[10px] font-medium text-muted-foreground border-border/50 gap-1.5">
              <Crown className="w-3 h-3" />
              Administrator
            </Badge>
          </div>

          {/* Hairline separator */}
          <div className="h-px bg-border/40" />

          {/* Content */}
          {renderContent()}
        </div>
      </main>

      {/* Credit Adjustment Dialog */}
      <Dialog open={creditDialog.open} onOpenChange={(open) => !open && setCreditDialog({ open: false, user: null, amount: '', reason: '' })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Adjust Credits</DialogTitle>
            <DialogDescription className="text-xs">
              {creditDialog.user?.display_name || creditDialog.user?.email} — Balance: <strong>{creditDialog.user?.credits_balance?.toLocaleString()}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-9 w-9 shrink-0"
                onClick={() => setCreditDialog(prev => ({ 
                  ...prev, 
                  amount: String(Math.abs(parseInt(prev.amount) || 0) * -1) 
                }))}
              >
                <Minus className="w-4 h-4" />
              </Button>
              <Input
                type="number"
                placeholder="Amount"
                value={creditDialog.amount}
                onChange={(e) => setCreditDialog(prev => ({ ...prev, amount: e.target.value }))}
                className="flex-1 h-9 text-sm"
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-9 w-9 shrink-0"
                onClick={() => setCreditDialog(prev => ({ 
                  ...prev, 
                  amount: String(Math.abs(parseInt(prev.amount) || 0)) 
                }))}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <Input
              placeholder="Reason for adjustment..."
              value={creditDialog.reason}
              onChange={(e) => setCreditDialog(prev => ({ ...prev, reason: e.target.value }))}
              className="h-9 text-sm"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setCreditDialog({ open: false, user: null, amount: '', reason: '' })}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleAdjustCredits}>
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
