import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { CostAnalysisDashboard } from '@/components/admin/CostAnalysisDashboard';

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

export default function AdminDashboard() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Overview state
  const [stats, setStats] = useState<AdminStats | null>(null);
  
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
    } else if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'financials') {
      fetchProfitData();
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
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Verifying admin access...</p>
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
  const financialSummary = profitData.reduce((acc, row) => ({
    totalRevenue: acc.totalRevenue + (row.estimated_revenue_cents || 0),
    totalCost: acc.totalCost + (row.total_real_cost_cents || 0),
    totalOperations: acc.totalOperations + (row.total_operations || 0),
    totalCreditsCharged: acc.totalCreditsCharged + (row.total_credits_charged || 0),
  }), { totalRevenue: 0, totalCost: 0, totalOperations: 0, totalCreditsCharged: 0 });

  const totalProfit = financialSummary.totalRevenue - financialSummary.totalCost;
  const profitMargin = financialSummary.totalRevenue > 0 
    ? (totalProfit / financialSummary.totalRevenue) * 100 
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/30">
      <AppHeader showCreate={false} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Premium Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
              <Shield className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Admin Dashboard
              </h1>
              <p className="text-sm text-muted-foreground">
                {user?.email}
              </p>
            </div>
          </div>
          <Badge className="bg-primary/10 text-primary border border-primary/20 shadow-sm">
            <Crown className="w-3.5 h-3.5 mr-1.5" />
            Administrator
          </Badge>
        </div>

        {/* Tabs Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="inline-flex h-12 items-center justify-center rounded-xl bg-muted/60 p-1.5 backdrop-blur-sm border border-border/50 shadow-sm">
            <TabsTrigger value="overview" className="rounded-lg px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground gap-2">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="messages" className="rounded-lg px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground gap-2 relative">
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Messages</span>
              {messages.filter(m => m.status === 'new').length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1.5 bg-destructive text-destructive-foreground text-xs font-semibold rounded-full flex items-center justify-center shadow-sm">
                  {messages.filter(m => m.status === 'new').length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="users" className="rounded-lg px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Users</span>
            </TabsTrigger>
            <TabsTrigger value="financials" className="rounded-lg px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground gap-2">
              <DollarSign className="w-4 h-4" />
              <span className="hidden sm:inline">Financials</span>
            </TabsTrigger>
            <TabsTrigger value="costs" className="rounded-lg px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground gap-2">
              <Calculator className="w-4 h-4" />
              <span className="hidden sm:inline">Cost Analysis</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="rounded-lg px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground gap-2">
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">Audit</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="card-premium hover:shadow-lg transition-shadow">
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2 text-muted-foreground">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Users className="w-4 h-4 text-primary" />
                    </div>
                    Total Users
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-foreground">{stats?.total_users?.toLocaleString() || 0}</div>
                  <p className="text-sm text-success flex items-center gap-1 mt-1">
                    <TrendingUp className="w-3 h-3" />
                    +{stats?.users_today || 0} today
                  </p>
                </CardContent>
              </Card>

              <Card className="card-premium hover:shadow-lg transition-shadow">
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2 text-muted-foreground">
                    <div className="w-8 h-8 rounded-lg bg-info/10 flex items-center justify-center">
                      <FolderKanban className="w-4 h-4 text-info" />
                    </div>
                    Total Projects
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-foreground">{stats?.total_projects?.toLocaleString() || 0}</div>
                  <p className="text-sm text-success flex items-center gap-1 mt-1">
                    <TrendingUp className="w-3 h-3" />
                    +{stats?.projects_today || 0} today
                  </p>
                </CardContent>
              </Card>

              <Card className="card-premium hover:shadow-lg transition-shadow">
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2 text-muted-foreground">
                    <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center">
                      <Coins className="w-4 h-4 text-warning" />
                    </div>
                    Credits Sold
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-foreground">{stats?.total_credits_sold?.toLocaleString() || 0}</div>
                  <p className="text-sm text-muted-foreground mt-1">{stats?.total_credits_used?.toLocaleString() || 0} used</p>
                </CardContent>
              </Card>

              <Card className="card-premium hover:shadow-lg transition-shadow">
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2 text-muted-foreground">
                    <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
                      <Activity className="w-4 h-4 text-success" />
                    </div>
                    Active Jobs
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-foreground">{stats?.active_generations || 0}</div>
                  <p className="text-sm text-muted-foreground mt-1">{stats?.completed_videos || 0} videos completed</p>
                </CardContent>
              </Card>
            </div>

            <Button onClick={fetchStats} variant="outline" size="sm" className="shadow-sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Stats
            </Button>
          </TabsContent>

          {/* Messages Tab */}
          <TabsContent value="messages" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Support Messages</h2>
                <p className="text-sm text-muted-foreground">Manage customer inquiries and feedback</p>
              </div>
              <Button onClick={fetchMessages} variant="outline" size="sm" disabled={messagesLoading} className="shadow-sm">
                {messagesLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Refresh
              </Button>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Message List */}
              <Card className="card-premium h-[600px] overflow-hidden">
                <CardHeader className="pb-2 border-b border-border/50">
                  <CardTitle className="text-base text-foreground">Inbox</CardTitle>
                  <CardDescription>
                    {messages.filter(m => m.status === 'new').length} unread messages
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0 overflow-auto h-[calc(100%-80px)]">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <Mail className="w-12 h-12 mb-4 opacity-50" />
                      <p>No messages yet</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {messages.map((msg) => (
                        <button
                          key={msg.id}
                          onClick={() => setSelectedMessage(msg)}
                          className={cn(
                            "w-full text-left p-4 hover:bg-muted/50 transition-colors",
                            selectedMessage?.id === msg.id && "bg-muted",
                            msg.status === 'new' && "border-l-2 border-l-primary"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                "font-medium truncate",
                                msg.status === 'new' && "text-foreground"
                              )}>
                                {msg.name}
                              </p>
                              <p className="text-sm text-muted-foreground truncate">{msg.subject}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(msg.created_at).toLocaleDateString()} • {msg.source}
                              </p>
                            </div>
                            <Badge 
                              variant={msg.status === 'new' ? 'default' : msg.status === 'resolved' ? 'success' : 'secondary'}
                              className="shrink-0"
                            >
                              {msg.status}
                            </Badge>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Message Detail */}
              <Card className="card-premium h-[600px] overflow-hidden">
                <CardHeader className="border-b border-border/50">
                  <CardTitle className="text-base text-foreground">Message Details</CardTitle>
                </CardHeader>
                <CardContent className="overflow-auto h-[calc(100%-80px)]">
                  {selectedMessage ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">{selectedMessage.subject}</h3>
                          <p className="text-sm text-muted-foreground">
                            From: {selectedMessage.name} ({selectedMessage.email})
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(selectedMessage.created_at).toLocaleString()}
                          </p>
                        </div>
                        <Badge 
                          variant={selectedMessage.source === 'contact' ? 'info' : 'secondary'}
                        >
                          {selectedMessage.source}
                        </Badge>
                      </div>
                      
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <p className="whitespace-pre-wrap">{selectedMessage.message}</p>
                      </div>

                      <div className="flex items-center gap-2 pt-4 border-t">
                        {selectedMessage.status === 'new' && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => updateMessageStatus(selectedMessage.id, 'read')}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            Mark Read
                          </Button>
                        )}
                        {selectedMessage.status !== 'resolved' && (
                          <Button 
                            size="sm"
                            onClick={() => updateMessageStatus(selectedMessage.id, 'resolved')}
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Mark Resolved
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          asChild
                        >
                          <a href={`mailto:${selectedMessage.email}?subject=Re: ${selectedMessage.subject}`}>
                            <Mail className="w-4 h-4 mr-2" />
                            Reply
                          </a>
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteMessage(selectedMessage.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <MessageSquare className="w-12 h-12 mb-4 opacity-50" />
                      <p>Select a message to view details</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email, name..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
                  className="pl-9"
                />
              </div>
              <Button onClick={fetchUsers} disabled={usersLoading}>
                {usersLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span className="ml-2">Search</span>
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">User</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Credits</th>
                        <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Projects</th>
                        <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Tier</th>
                        <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Roles</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-medium text-foreground">{u.display_name || u.full_name || 'Unknown'}</p>
                              <p className="text-sm text-muted-foreground">{u.email}</p>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="font-mono">{u.credits_balance?.toLocaleString()}</span>
                          </td>
                          <td className="py-3 px-4 text-center">{u.project_count}</td>
                          <td className="py-3 px-4 text-center">
                            <Badge variant="secondary">{u.account_tier}</Badge>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {u.roles?.includes('admin') && (
                              <Badge className="bg-primary text-primary-foreground">
                                <Crown className="w-3 h-3 mr-1" />
                                Admin
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setCreditDialog({ 
                                  open: true, 
                                  user: u, 
                                  amount: '', 
                                  reason: '' 
                                })}
                              >
                                <Coins className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant={u.roles?.includes('admin') ? 'destructive' : 'outline'}
                                onClick={() => handleToggleAdminRole(u)}
                              >
                                <UserCog className="w-3 h-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {users.length === 0 && !usersLoading && (
                    <div className="text-center py-12 text-muted-foreground">
                      No users found
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Financials Tab */}
          <TabsContent value="financials" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2 text-success">
                    <DollarSign className="w-4 h-4" />
                    Total Revenue
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(financialSummary.totalRevenue)}</div>
                  <p className="text-xs text-muted-foreground">{financialSummary.totalCreditsCharged.toLocaleString()} credits</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20">
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2 text-destructive">
                    <ArrowDownRight className="w-4 h-4" />
                    API Cost
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(financialSummary.totalCost)}</div>
                  <p className="text-xs text-muted-foreground">{financialSummary.totalOperations.toLocaleString()} operations</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2 text-primary">
                    <TrendingUp className="w-4 h-4" />
                    Net Profit
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">{formatCurrency(totalProfit)}</span>
                    {totalProfit >= 0 ? <ArrowUpRight className="w-4 h-4 text-success" /> : <ArrowDownRight className="w-4 h-4 text-destructive" />}
                  </div>
                </CardContent>
              </Card>

              <Card className={cn(
                "bg-gradient-to-br border",
                profitMargin >= 70 ? "from-success/10 to-success/5 border-success/20" :
                profitMargin >= 50 ? "from-warning/10 to-warning/5 border-warning/20" :
                "from-destructive/10 to-destructive/5 border-destructive/20"
              )}>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Profit Margin
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatPercent(profitMargin)}</div>
                  <p className="text-xs text-muted-foreground">Target: 70-80%</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Cost Breakdown by Service
                </CardTitle>
                <CardDescription>Detailed API cost tracking</CardDescription>
              </CardHeader>
              <CardContent>
                {profitData.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Coins className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No cost data yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Date</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Service</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Ops</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Revenue</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Cost</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Margin</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profitData.map((row, idx) => (
                          <tr key={idx} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="py-3 px-4 text-sm">{new Date(row.date).toLocaleDateString()}</td>
                            <td className="py-3 px-4">
                              <Badge variant="secondary">{row.service}</Badge>
                            </td>
                            <td className="py-3 px-4 text-sm text-right">{row.total_operations.toLocaleString()}</td>
                            <td className="py-3 px-4 text-sm text-right text-success">{formatCurrency(row.estimated_revenue_cents)}</td>
                            <td className="py-3 px-4 text-sm text-right text-destructive">{formatCurrency(row.total_real_cost_cents)}</td>
                            <td className="py-3 px-4 text-right">
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
              </CardContent>
            </Card>

            <Button onClick={fetchProfitData} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Data
            </Button>
          </TabsContent>

          {/* Comprehensive Cost Analysis Tab */}
          <TabsContent value="costs" className="space-y-4">
            <CostAnalysisDashboard />
          </TabsContent>

          {/* Audit Log Tab */}
          <TabsContent value="audit" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5" />
                  Admin Audit Log
                </CardTitle>
                <CardDescription>Track all admin actions</CardDescription>
              </CardHeader>
              <CardContent>
                {auditLog.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No audit entries yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {auditLog.map((entry) => (
                      <div key={entry.id} className="flex items-start gap-4 p-3 rounded-lg bg-muted/30 border border-border/50">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Shield className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{entry.action}</Badge>
                            {entry.target_type && (
                              <span className="text-sm text-muted-foreground">
                                on {entry.target_type}
                              </span>
                            )}
                          </div>
                          {entry.details && Object.keys(entry.details).length > 0 && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {JSON.stringify(entry.details)}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(entry.created_at).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Button onClick={fetchAuditLog} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Log
            </Button>
          </TabsContent>
        </Tabs>
      </main>
      {/* Credit Adjustment Dialog */}
      <Dialog open={creditDialog.open} onOpenChange={(open) => !open && setCreditDialog({ open: false, user: null, amount: '', reason: '' })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Credits</DialogTitle>
            <DialogDescription>
              Adjust credits for {creditDialog.user?.display_name || creditDialog.user?.email}
              <br />
              Current balance: <strong>{creditDialog.user?.credits_balance?.toLocaleString()}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="icon"
                variant="outline"
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
                className="flex-1"
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
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
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditDialog({ open: false, user: null, amount: '', reason: '' })}>
              Cancel
            </Button>
            <Button onClick={handleAdjustCredits}>
              Apply Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}