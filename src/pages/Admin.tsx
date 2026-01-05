import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  DollarSign, 
  TrendingUp, 
  Coins, 
  BarChart3, 
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Navigate } from 'react-router-dom';

interface ProfitData {
  date: string;
  service: string;
  total_operations: number;
  total_credits_charged: number;
  total_real_cost_cents: number;
  estimated_revenue_cents: number;
  profit_margin_percent: number;
}

interface SummaryStats {
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  profitMargin: number;
  totalOperations: number;
  totalCreditsCharged: number;
}

// Admin emails that can access the dashboard
const ADMIN_EMAILS = ['admin@example.com']; // Add your admin emails here

export default function AdminDashboard() {
  const { user } = useAuth();
  const [profitData, setProfitData] = useState<ProfitData[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SummaryStats>({
    totalRevenue: 0,
    totalCost: 0,
    totalProfit: 0,
    profitMargin: 0,
    totalOperations: 0,
    totalCreditsCharged: 0,
  });

  // Check if user is admin
  const isAdmin = user?.email && ADMIN_EMAILS.includes(user.email);

  useEffect(() => {
    if (isAdmin) {
      fetchProfitData();
    }
  }, [isAdmin]);

  const fetchProfitData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_admin_profit_dashboard');
      
      if (error) throw error;
      
      const typedData = (data || []) as ProfitData[];
      setProfitData(typedData);
      
      // Calculate summary
      const totals = typedData.reduce((acc, row) => ({
        totalRevenue: acc.totalRevenue + (row.estimated_revenue_cents || 0),
        totalCost: acc.totalCost + (row.total_real_cost_cents || 0),
        totalOperations: acc.totalOperations + (row.total_operations || 0),
        totalCreditsCharged: acc.totalCreditsCharged + (row.total_credits_charged || 0),
      }), { totalRevenue: 0, totalCost: 0, totalOperations: 0, totalCreditsCharged: 0 });
      
      const totalProfit = totals.totalRevenue - totals.totalCost;
      const profitMargin = totals.totalRevenue > 0 
        ? (totalProfit / totals.totalRevenue) * 100 
        : 0;
      
      setSummary({
        ...totals,
        totalProfit,
        profitMargin,
      });
    } catch (err) {
      console.error('Failed to fetch profit data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Redirect non-admins
  if (!user || !isAdmin) {
    return <Navigate to="/" replace />;
  }

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">
              Profit Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">
              Real-time API cost tracking and margin analysis
            </p>
          </div>
          <Button onClick={fetchProfitData} disabled={loading} variant="outline">
            <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2 text-emerald-600">
                <DollarSign className="w-4 h-4" />
                Total Revenue
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-foreground">
                  {formatCurrency(summary.totalRevenue)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                From {summary.totalCreditsCharged.toLocaleString()} credits
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-rose-500/10 to-rose-600/5 border-rose-500/20">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2 text-rose-600">
                <ArrowDownRight className="w-4 h-4" />
                Total API Cost
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-foreground">
                  {formatCurrency(summary.totalCost)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.totalOperations.toLocaleString()} operations
              </p>
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
                <span className="text-2xl font-bold text-foreground">
                  {formatCurrency(summary.totalProfit)}
                </span>
                <span className={cn(
                  "text-sm font-medium",
                  summary.totalProfit >= 0 ? "text-emerald-500" : "text-rose-500"
                )}>
                  {summary.totalProfit >= 0 ? <ArrowUpRight className="w-4 h-4 inline" /> : <ArrowDownRight className="w-4 h-4 inline" />}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className={cn(
            "bg-gradient-to-br border",
            summary.profitMargin >= 70 
              ? "from-emerald-500/10 to-emerald-600/5 border-emerald-500/20"
              : summary.profitMargin >= 50
                ? "from-amber-500/10 to-amber-600/5 border-amber-500/20"
                : "from-rose-500/10 to-rose-600/5 border-rose-500/20"
          )}>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Profit Margin
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-foreground">
                  {formatPercent(summary.profitMargin)}
                </span>
                <span className={cn(
                  "text-xs font-medium",
                  summary.profitMargin >= 70 ? "text-emerald-500" : 
                  summary.profitMargin >= 50 ? "text-amber-500" : "text-rose-500"
                )}>
                  Target: 70-80%
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cost Breakdown by Service */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Cost Breakdown by Service
            </CardTitle>
            <CardDescription>
              Detailed API cost tracking per service
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : profitData.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Coins className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No cost data yet. Generate some videos to see metrics.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Date</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Service</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Operations</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Credits</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Revenue</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">API Cost</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profitData.map((row, idx) => (
                      <tr key={idx} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-3 px-4 text-sm">
                          {new Date(row.date).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          <span className={cn(
                            "text-xs px-2 py-1 rounded-full font-medium",
                            row.service === 'replicate' && "bg-purple-500/10 text-purple-500",
                            row.service === 'elevenlabs' && "bg-blue-500/10 text-blue-500",
                            row.service === 'openai' && "bg-emerald-500/10 text-emerald-500",
                          )}>
                            {row.service}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-right">
                          {row.total_operations.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-sm text-right">
                          {row.total_credits_charged.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-sm text-right text-emerald-500">
                          {formatCurrency(row.estimated_revenue_cents)}
                        </td>
                        <td className="py-3 px-4 text-sm text-right text-rose-500">
                          {formatCurrency(row.total_real_cost_cents)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={cn(
                            "text-sm font-medium",
                            row.profit_margin_percent >= 70 ? "text-emerald-500" :
                            row.profit_margin_percent >= 50 ? "text-amber-500" : "text-rose-500"
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

        {/* Pricing Guide */}
        <Card>
          <CardHeader>
            <CardTitle>Iron-Clad Pricing Guide</CardTitle>
            <CardDescription>
              Target: 70-80% profit margin with $0.80-$1.20 API cost per shot
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-muted/30 border border-border">
                <h4 className="font-semibold mb-2">Starter - $29</h4>
                <p className="text-sm text-muted-foreground">250 credits = 10 shots</p>
                <p className="text-sm text-muted-foreground">$2.90/video revenue</p>
                <p className="text-sm text-emerald-500">~$2.00 profit/video</p>
              </div>
              <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">
                <h4 className="font-semibold mb-2">Growth - $99 (Best Value)</h4>
                <p className="text-sm text-muted-foreground">1,000 credits = 40 shots</p>
                <p className="text-sm text-muted-foreground">$2.48/video revenue</p>
                <p className="text-sm text-emerald-500">~$1.58 profit/video</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/30 border border-border">
                <h4 className="font-semibold mb-2">Agency - $249</h4>
                <p className="text-sm text-muted-foreground">3,000 credits = 120 shots</p>
                <p className="text-sm text-muted-foreground">$2.07/video revenue</p>
                <p className="text-sm text-emerald-500">~$1.17 profit/video</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
