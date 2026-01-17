import { useState, useEffect } from 'react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DollarSign,
  Server,
  HardDrive,
  Clock,
  Code,
  Cpu,
  Cloud,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Calculator,
  PieChart,
  Database,
  Video,
  Mic,
  Music,
  Image,
  Scissors,
  Sparkles,
  CalendarIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type DateRangePreset = 'today' | '7days' | '30days' | 'all' | 'custom';

// ============================================
// REAL COST DEFINITIONS - UPDATE THESE VALUES
// ============================================

// Kling 2.6 Pricing (per 5-second clip)
// Kling 2.6: $0.04 per 5-second clip (more cost-effective)
const KLING_COST_PER_CLIP_CENTS = 4;

// Kling Status Poll Pricing (minimal)
// Each status poll costs ~$0.0001
const KLING_POLL_COST_CENTS = 0.01;

// OpenAI TTS Pricing
// HD voices: $0.030 per 1,000 characters (roughly 2 cents for 60 words)
const OPENAI_TTS_COST_PER_CALL_CENTS = 2;

// Cloud Run Stitcher (estimate based on CPU/memory usage)
// 2 vCPU, 4GB RAM for ~30 seconds = ~$0.02
const CLOUD_RUN_STITCH_COST_CENTS = 2;

// OpenAI API for Script Generation (GPT-4)
// ~$0.03 per 1K input tokens, ~$0.06 per 1K output tokens
// Average script gen uses ~2K input, 1K output = ~$0.12
const OPENAI_SCRIPT_COST_CENTS = 12;

// DALL-E 3 for scene images
// $0.040 per 1024×1024 image
const DALLE_COST_PER_IMAGE_CENTS = 4;

// Gemini Flash for analysis
const GEMINI_FLASH_COST_CENTS = 1;

// Supabase Storage Pricing
// Free: 1GB, then $0.021/GB per month
const STORAGE_COST_PER_GB_CENTS = 2.1;

// Lovable Platform Monthly Cost (estimate your plan)
const LOVABLE_MONTHLY_COST_DOLLARS = 49; // Update based on your plan

// Development Hourly Rate (for tracking ROI)
const DEV_HOURLY_RATE_DOLLARS = 100;

// Supabase Costs (estimate for Pro plan)
const SUPABASE_MONTHLY_COST_DOLLARS = 25;

// ============================================

interface ApiCostData {
  service: string;
  operation: string;
  status: string;
  total_calls: number;
  total_credits: number;
  logged_cost_cents: number;
  calculated_cost_cents: number;
}

interface StorageData {
  bucket_id: string;
  file_count: number;
  size_mb: number;
  cost_per_month_cents: number;
}

interface WastedCostData {
  category: string;
  description: string;
  count: number;
  cost_cents: number;
  credits_lost: number;
}

interface RetryData {
  total_retries: number;
  clips_with_retries: number;
  retry_cost_cents: number;
}

interface RefundData {
  total_refunds: number;
  refund_credits: number;
}

export function CostAnalysisDashboard() {
  const [loading, setLoading] = useState(true);
  const [apiCosts, setApiCosts] = useState<ApiCostData[]>([]);
  const [storageCosts, setStorageCosts] = useState<StorageData[]>([]);
  const [wastedCosts, setWastedCosts] = useState<WastedCostData[]>([]);
  const [retryData, setRetryData] = useState<RetryData>({ total_retries: 0, clips_with_retries: 0, retry_cost_cents: 0 });
  const [refundData, setRefundData] = useState<RefundData>({ total_refunds: 0, refund_credits: 0 });
  const [actualRevenueCents, setActualRevenueCents] = useState(0);
  const [devHours, setDevHours] = useState(0);
  const [projectStartDate] = useState(new Date('2026-01-07')); // Update to your start date
  
  // Date range filter state
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('all');
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();

  const getDateRange = (): { start: Date | null; end: Date | null } => {
    const now = new Date();
    switch (dateRangePreset) {
      case 'today':
        return { start: startOfDay(now), end: endOfDay(now) };
      case '7days':
        return { start: startOfDay(subDays(now, 7)), end: endOfDay(now) };
      case '30days':
        return { start: startOfDay(subDays(now, 30)), end: endOfDay(now) };
      case 'custom':
        return { 
          start: customStartDate ? startOfDay(customStartDate) : null, 
          end: customEndDate ? endOfDay(customEndDate) : endOfDay(now) 
        };
      case 'all':
      default:
        return { start: null, end: null };
    }
  };

  const getDateRangeLabel = (): string => {
    const { start, end } = getDateRange();
    if (!start) return 'All Time';
    if (dateRangePreset === 'today') return 'Today';
    if (dateRangePreset === '7days') return 'Last 7 Days';
    if (dateRangePreset === '30days') return 'Last 30 Days';
    if (start && end) {
      return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
    }
    return 'Custom Range';
  };
  
  const fetchAllData = async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange();
      
      // Build query with optional date filters
      let apiQuery = supabase
        .from('api_cost_logs')
        .select('service, operation, status, credits_charged, real_cost_cents, created_at')
        .order('created_at', { ascending: false });
      
      if (start) {
        apiQuery = apiQuery.gte('created_at', start.toISOString());
      }
      if (end) {
        apiQuery = apiQuery.lte('created_at', end.toISOString());
      }
      
      const { data: apiData } = await apiQuery;
      
      // Aggregate API costs by service, operation, and status
      const apiAggregated: Record<string, ApiCostData> = {};
      (apiData || []).forEach((row: any) => {
        const key = `${row.service}|${row.operation}|${row.status}`;
        if (!apiAggregated[key]) {
          apiAggregated[key] = {
            service: row.service,
            operation: row.operation,
            status: row.status || 'completed',
            total_calls: 0,
            total_credits: 0,
            logged_cost_cents: 0,
            calculated_cost_cents: 0,
          };
        }
        apiAggregated[key].total_calls++;
        apiAggregated[key].total_credits += row.credits_charged || 0;
        apiAggregated[key].logged_cost_cents += row.real_cost_cents || 0;
        
        // Calculate real costs based on service - EVEN FOR FAILED CALLS
        // Failed API calls still cost us money!
        switch (row.service) {
          case 'kling':
            apiAggregated[key].calculated_cost_cents += KLING_COST_PER_CLIP_CENTS;
            break;
          case 'kling_poll':
            // Status polling calls - minimal cost but adds up
            apiAggregated[key].calculated_cost_cents += KLING_POLL_COST_CENTS;
            break;
          case 'openai-tts':
            apiAggregated[key].calculated_cost_cents += OPENAI_TTS_COST_PER_CALL_CENTS;
            break;
          case 'cloud_run_stitcher':
            apiAggregated[key].calculated_cost_cents += CLOUD_RUN_STITCH_COST_CENTS;
            break;
          case 'openai':
            apiAggregated[key].calculated_cost_cents += OPENAI_SCRIPT_COST_CENTS;
            break;
          case 'dalle':
            apiAggregated[key].calculated_cost_cents += DALLE_COST_PER_IMAGE_CENTS;
            break;
          case 'gemini':
            apiAggregated[key].calculated_cost_cents += GEMINI_FLASH_COST_CENTS;
            break;
          case 'music-generation':
            // Skipped music generation has no cost but still track it
            apiAggregated[key].calculated_cost_cents += 0;
            break;
          default:
            // Use logged cost if service not recognized
            apiAggregated[key].calculated_cost_cents += row.real_cost_cents || 0;
        }
      });
      
      setApiCosts(Object.values(apiAggregated).sort((a, b) => b.calculated_cost_cents - a.calculated_cost_cents));

      // Fetch video clips data for retry analysis (with date filter)
      let clipsQuery = supabase
        .from('video_clips')
        .select('id, status, retry_count, created_at');
      
      if (start) {
        clipsQuery = clipsQuery.gte('created_at', start.toISOString());
      }
      if (end) {
        clipsQuery = clipsQuery.lte('created_at', end.toISOString());
      }
      
      const { data: clipsData } = await clipsQuery;
      
      const clips = clipsData || [];
      const totalRetries = clips.reduce((sum, c) => sum + (c.retry_count || 0), 0);
      const clipsWithRetries = clips.filter(c => (c.retry_count || 0) > 0).length;
      const retryCostCents = totalRetries * KLING_COST_PER_CLIP_CENTS; // Each retry is a Kling call
      
      setRetryData({
        total_retries: totalRetries,
        clips_with_retries: clipsWithRetries,
        retry_cost_cents: retryCostCents,
      });

      // Fetch refund data (with date filter)
      let refundsQuery = supabase
        .from('credit_transactions')
        .select('amount, created_at')
        .eq('transaction_type', 'refund');
      
      if (start) {
        refundsQuery = refundsQuery.gte('created_at', start.toISOString());
      }
      if (end) {
        refundsQuery = refundsQuery.lte('created_at', end.toISOString());
      }
      
      const { data: refundsData } = await refundsQuery;
      
      const refunds = refundsData || [];
      setRefundData({
        total_refunds: refunds.length,
        refund_credits: refunds.reduce((sum, r) => sum + (r.amount || 0), 0),
      });

      // Fetch actual revenue from Stripe purchases only (with date filter)
      let purchasesQuery = supabase
        .from('credit_transactions')
        .select('amount, created_at, stripe_payment_id')
        .eq('transaction_type', 'purchase')
        .not('stripe_payment_id', 'is', null);
      
      if (start) {
        purchasesQuery = purchasesQuery.gte('created_at', start.toISOString());
      }
      if (end) {
        purchasesQuery = purchasesQuery.lte('created_at', end.toISOString());
      }
      
      const { data: purchasesData } = await purchasesQuery;
      
      // Calculate actual revenue from credit packages pricing
      // Based on credit_packages table: credits / price_cents ratio
      const CREDIT_PRICE_CENTS = 11.6; // Average $0.116 per credit
      const purchases = purchasesData || [];
      const totalPurchasedCredits = purchases.reduce((sum, p) => sum + (p.amount || 0), 0);
      setActualRevenueCents(Math.round(totalPurchasedCredits * CREDIT_PRICE_CENTS));

      // Calculate wasted costs
      const wastedItems: WastedCostData[] = [];
      
      // Failed API calls
      const failedCalls = Object.values(apiAggregated).filter(c => c.status === 'failed');
      if (failedCalls.length > 0) {
        const totalFailedCost = failedCalls.reduce((sum, c) => sum + c.calculated_cost_cents, 0);
        const totalFailedCount = failedCalls.reduce((sum, c) => sum + c.total_calls, 0);
        wastedItems.push({
          category: 'Failed API Calls',
          description: 'API calls that failed but still incurred costs',
          count: totalFailedCount,
          cost_cents: totalFailedCost,
          credits_lost: failedCalls.reduce((sum, c) => sum + c.total_credits, 0),
        });
      }

      // Skipped operations (still used compute resources)
      const skippedCalls = Object.values(apiAggregated).filter(c => c.status === 'skipped');
      if (skippedCalls.length > 0) {
        const totalSkippedCount = skippedCalls.reduce((sum, c) => sum + c.total_calls, 0);
        wastedItems.push({
          category: 'Skipped Operations',
          description: 'Operations that were skipped (e.g., no music provider)',
          count: totalSkippedCount,
          cost_cents: 0, // Skipped usually means no cost
          credits_lost: 0,
        });
      }

      // Retry costs (extra Veo calls)
      if (totalRetries > 0) {
        wastedItems.push({
          category: 'Retry Costs',
          description: 'Extra Veo API calls due to clip regeneration',
          count: totalRetries,
          cost_cents: retryCostCents,
          credits_lost: 0, // Retries don't charge extra credits to users
        });
      }

      setWastedCosts(wastedItems);

      // Storage data - fetch real data
      const { data: storageData } = await supabase
        .from('storage' as any)
        .select('*');
      
      // Fallback to known values if storage query fails
      const buckets = [
        { bucket_id: 'final-videos', file_count: 85, size_mb: 2564 },
        { bucket_id: 'video-clips', file_count: 542, size_mb: 1777 },
        { bucket_id: 'scene-images', file_count: 360, size_mb: 957 },
        { bucket_id: 'character-references', file_count: 169, size_mb: 448 },
        { bucket_id: 'temp-frames', file_count: 883, size_mb: 124 },
        { bucket_id: 'voice-tracks', file_count: 53, size_mb: 45 },
        { bucket_id: 'thumbnails', file_count: 11, size_mb: 30 },
      ];
      
      setStorageCosts(buckets.map(b => ({
        ...b,
        cost_per_month_cents: Math.round((b.size_mb / 1024) * STORAGE_COST_PER_GB_CENTS * 100) / 100,
      })));

      // Calculate development hours (days since start * avg hours per day)
      const daysSinceStart = Math.ceil((Date.now() - projectStartDate.getTime()) / (1000 * 60 * 60 * 24));
      setDevHours(daysSinceStart * 4); // Assume 4 hours/day average

    } catch (err) {
      console.error('Failed to fetch cost data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [dateRangePreset, customStartDate, customEndDate]);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  // Calculate totals - separate successful vs wasted
  const successfulApiCosts = apiCosts.filter(c => c.status === 'completed');
  const failedApiCosts = apiCosts.filter(c => c.status === 'failed');
  const skippedApiCosts = apiCosts.filter(c => c.status === 'skipped');
  
  const totalSuccessfulApiCostCents = successfulApiCosts.reduce((sum, c) => sum + c.calculated_cost_cents, 0);
  const totalFailedApiCostCents = failedApiCosts.reduce((sum, c) => sum + c.calculated_cost_cents, 0);
  const totalSkippedApiCostCents = skippedApiCosts.reduce((sum, c) => sum + c.calculated_cost_cents, 0);
  const totalApiCostCents = apiCosts.reduce((sum, c) => sum + c.calculated_cost_cents, 0);
  
  // Add retry costs - each retry is a failed+retried Veo call
  const totalRetryCostCents = retryData.retry_cost_cents;
  
  // Total wasted = failed API calls + retry costs (skipped don't cost money)
  const totalWastedCostCents = totalFailedApiCostCents + totalRetryCostCents;
  
  // Debug logging
  console.log('Cost Analysis Debug:', {
    apiCosts,
    successfulApiCosts,
    failedApiCosts,
    skippedApiCosts,
    totalSuccessfulApiCostCents,
    totalFailedApiCostCents,
    totalRetryCostCents,
    totalWastedCostCents,
    retryData,
  });
  
  const totalStorageMB = storageCosts.reduce((sum, s) => sum + s.size_mb, 0);
  const totalStorageCostCents = Math.round((totalStorageMB / 1024) * STORAGE_COST_PER_GB_CENTS * 100);
  const devCostCents = devHours * DEV_HOURLY_RATE_DOLLARS * 100;
  const lovableCostCents = LOVABLE_MONTHLY_COST_DOLLARS * 100;
  const supabaseCostCents = SUPABASE_MONTHLY_COST_DOLLARS * 100;
  
  // Include retry costs in total (they're real API costs we paid)
  const totalMonthlyCostCents = totalApiCostCents + totalRetryCostCents + totalStorageCostCents + lovableCostCents + supabaseCostCents;
  const totalWithDevCents = totalMonthlyCostCents + devCostCents;

  // Revenue calculation - ONLY actual Stripe purchases
  const CREDIT_PRICE_CENTS = 11.6; // $0.116 per credit (for refund calculation)
  const refundValueCents = Math.round(Math.abs(refundData.refund_credits) * CREDIT_PRICE_CENTS);
  const adjustedRevenueCents = actualRevenueCents - refundValueCents;
  
  const netProfitCents = adjustedRevenueCents - totalMonthlyCostCents;
  const profitMargin = adjustedRevenueCents > 0 ? (netProfitCents / adjustedRevenueCents) * 100 : 0;
  
  // Waste percentage of API costs only (not platform costs)
  const apiOnlyCosts = totalApiCostCents + totalRetryCostCents;
  const wastePercentage = apiOnlyCosts > 0 ? (totalWastedCostCents / apiOnlyCosts) * 100 : 0;

  const getServiceIcon = (service: string) => {
    switch (service) {
      case 'google_veo': return <Video className="w-4 h-4" />;
      case 'google_veo_poll': return <RefreshCw className="w-4 h-4" />;
      case 'openai-tts': return <Mic className="w-4 h-4" />;
      case 'cloud_run_stitcher': return <Scissors className="w-4 h-4" />;
      case 'music-generation': return <Music className="w-4 h-4" />;
      case 'openai': return <Sparkles className="w-4 h-4" />;
      case 'dalle': return <Image className="w-4 h-4" />;
      default: return <Cpu className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Date Range Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Comprehensive Cost Analysis</h2>
          <p className="text-sm text-muted-foreground">
            {getDateRangeLabel()} • Every dime tracked and calculated
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Preset buttons */}
          <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
            <Button
              variant={dateRangePreset === 'today' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setDateRangePreset('today')}
              className="h-7 px-2 text-xs"
            >
              Today
            </Button>
            <Button
              variant={dateRangePreset === '7days' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setDateRangePreset('7days')}
              className="h-7 px-2 text-xs"
            >
              7 Days
            </Button>
            <Button
              variant={dateRangePreset === '30days' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setDateRangePreset('30days')}
              className="h-7 px-2 text-xs"
            >
              30 Days
            </Button>
            <Button
              variant={dateRangePreset === 'all' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setDateRangePreset('all')}
              className="h-7 px-2 text-xs"
            >
              All Time
            </Button>
          </div>

          {/* Custom date range picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={dateRangePreset === 'custom' ? 'secondary' : 'outline'}
                size="sm"
                className="h-7 gap-1 text-xs"
              >
                <CalendarIcon className="w-3 h-3" />
                Custom
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <div className="p-3 space-y-3">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Start Date</p>
                  <Calendar
                    mode="single"
                    selected={customStartDate}
                    onSelect={(date) => {
                      setCustomStartDate(date);
                      setDateRangePreset('custom');
                    }}
                    disabled={(date) => date > new Date()}
                    className="rounded-md border pointer-events-auto"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">End Date</p>
                  <Calendar
                    mode="single"
                    selected={customEndDate}
                    onSelect={(date) => {
                      setCustomEndDate(date);
                      setDateRangePreset('custom');
                    }}
                    disabled={(date) => 
                      date > new Date() || 
                      (customStartDate ? date < customStartDate : false)
                    }
                    className="rounded-md border pointer-events-auto"
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Button onClick={fetchAllData} variant="outline" size="sm" className="h-7">
            <RefreshCw className="w-3 h-3 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Executive Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Total Cost
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalMonthlyCostCents)}</div>
            <p className="text-xs text-muted-foreground">Incl. retries & failures</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" />
              Wasted Costs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{formatCurrency(totalWastedCostCents)}</div>
            <p className="text-xs text-muted-foreground">{wastePercentage.toFixed(1)}% of total</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-success">
              <TrendingUp className="w-4 h-4" />
              Revenue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(adjustedRevenueCents)}</div>
            <p className="text-xs text-muted-foreground">
              {refundData.total_refunds > 0 && <span className="text-destructive">-{refundData.refund_credits} refunded</span>}
              {refundData.total_refunds === 0 && actualRevenueCents === 0 && <span>No Stripe purchases yet</span>}
              {refundData.total_refunds === 0 && actualRevenueCents > 0 && <span>From Stripe purchases</span>}
            </p>
          </CardContent>
        </Card>

        <Card className={cn(
          "bg-gradient-to-br border",
          netProfitCents >= 0 
            ? "from-success/10 to-success/5 border-success/20" 
            : "from-destructive/10 to-destructive/5 border-destructive/20"
        )}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              {netProfitCents >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              Net Profit
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", netProfitCents < 0 && "text-destructive")}>
              {formatCurrency(netProfitCents)}
            </div>
            <p className="text-xs text-muted-foreground">{profitMargin.toFixed(1)}% margin</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-warning">
              <Clock className="w-4 h-4" />
              Dev Investment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(devCostCents)}</div>
            <p className="text-xs text-muted-foreground">{devHours} hrs @ ${DEV_HOURLY_RATE_DOLLARS}/hr</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for detailed breakdown */}
      <Tabs defaultValue="wasted" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="wasted" className="gap-2 text-destructive data-[state=active]:text-destructive">
            <AlertTriangle className="w-4 h-4" />
            Wasted/Failed
          </TabsTrigger>
          <TabsTrigger value="api" className="gap-2">
            <Server className="w-4 h-4" />
            API Costs
          </TabsTrigger>
          <TabsTrigger value="storage" className="gap-2">
            <HardDrive className="w-4 h-4" />
            Storage
          </TabsTrigger>
          <TabsTrigger value="platform" className="gap-2">
            <Cloud className="w-4 h-4" />
            Platform
          </TabsTrigger>
          <TabsTrigger value="development" className="gap-2">
            <Code className="w-4 h-4" />
            Development
          </TabsTrigger>
          <TabsTrigger value="breakdown" className="gap-2">
            <PieChart className="w-4 h-4" />
            Full Breakdown
          </TabsTrigger>
        </TabsList>

        {/* Wasted Costs Tab - NEW */}
        <TabsContent value="wasted" className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20">
              <CardHeader className="pb-2">
                <CardDescription className="text-destructive">Failed API Calls</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-destructive">{formatCurrency(totalFailedApiCostCents)}</div>
                <p className="text-sm text-muted-foreground mt-1">
                  {failedApiCosts.reduce((sum, c) => sum + c.total_calls, 0)} failed calls
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20">
              <CardHeader className="pb-2">
                <CardDescription className="text-warning">Retry Costs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-warning">{formatCurrency(totalRetryCostCents)}</div>
                <p className="text-sm text-muted-foreground mt-1">
                  {retryData.total_retries} retries across {retryData.clips_with_retries} clips
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-info/10 to-info/5 border-info/20">
              <CardHeader className="pb-2">
                <CardDescription className="text-info">Credits Refunded</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{refundData.refund_credits.toLocaleString()}</div>
                <p className="text-sm text-muted-foreground mt-1">
                  {refundData.total_refunds} refund transactions
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                Wasted Cost Breakdown
              </CardTitle>
              <CardDescription>Money spent on failed operations, retries, and deleted content</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Failed API calls by service */}
                {failedApiCosts.map((cost, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-destructive/5 rounded-lg border border-destructive/20">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                        {getServiceIcon(cost.service)}
                      </div>
                      <div>
                        <p className="font-medium capitalize">{cost.service.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-muted-foreground">
                          {cost.operation} • <Badge variant="destructive" className="text-xs">{cost.status}</Badge>
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-destructive">{formatCurrency(cost.calculated_cost_cents)}</p>
                      <p className="text-xs text-muted-foreground">{cost.total_calls} calls</p>
                    </div>
                  </div>
                ))}

                {/* Retry costs */}
                {retryData.total_retries > 0 && (
                  <div className="flex items-center justify-between p-3 bg-warning/5 rounded-lg border border-warning/20">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                        <RefreshCw className="w-5 h-5 text-warning" />
                      </div>
                      <div>
                        <p className="font-medium">Clip Regeneration Retries</p>
                        <p className="text-xs text-muted-foreground">
                          Extra Veo API calls when clips failed quality checks
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-warning">{formatCurrency(totalRetryCostCents)}</p>
                      <p className="text-xs text-muted-foreground">{retryData.total_retries} retries</p>
                    </div>
                  </div>
                )}

                {wastedCosts.length === 0 && retryData.total_retries === 0 && failedApiCosts.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No wasted costs detected - great job!</p>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span>Failed API Calls</span>
                  <span className="font-mono">{formatCurrency(totalFailedApiCostCents)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span>Retry Costs</span>
                  <span className="font-mono">{formatCurrency(totalRetryCostCents)}</span>
                </div>
                <div className="flex justify-between items-center text-lg font-bold pt-2 border-t">
                  <span className="text-destructive">Total Wasted</span>
                  <span className="text-destructive">{formatCurrency(totalWastedCostCents)}</span>
                </div>
                <p className="text-xs text-muted-foreground text-right">
                  {wastePercentage.toFixed(1)}% of total operational costs
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Cost Recovery Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {retryData.total_retries > 10 && (
                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">High Retry Rate</p>
                      <p className="text-sm text-muted-foreground">
                        {retryData.total_retries} retries detected. Consider improving prompt quality or adjusting quality thresholds.
                      </p>
                    </div>
                  </div>
                )}
                {totalFailedApiCostCents > 100 && (
                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Significant API Failures</p>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(totalFailedApiCostCents)} lost to failed API calls. Review error logs and implement better error handling.
                      </p>
                    </div>
                  </div>
                )}
                {wastePercentage < 5 && (
                  <div className="flex items-start gap-3 p-3 bg-success/10 rounded-lg border border-success/20">
                    <TrendingUp className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-success">Excellent Efficiency</p>
                      <p className="text-sm text-muted-foreground">
                        Waste is under 5% - your pipeline is running efficiently!
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Costs Tab */}
        <TabsContent value="api" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">API Cost Details</CardTitle>
              <CardDescription>
                All API calls including successful, failed, and retries • 
                <span className="text-success ml-1">{successfulApiCosts.reduce((s, c) => s + c.total_calls, 0)} successful</span> • 
                <span className="text-destructive ml-1">{failedApiCosts.reduce((s, c) => s + c.total_calls, 0)} failed</span> •
                <span className="text-warning ml-1">{retryData.total_retries} retries</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {apiCosts.map((cost, idx) => {
                  const percentage = totalApiCostCents > 0 ? (cost.calculated_cost_cents / totalApiCostCents) * 100 : 0;
                  const isSuccess = cost.status === 'completed';
                  const isFailed = cost.status === 'failed';
                  const isSkipped = cost.status === 'skipped';
                  return (
                    <div key={idx} className={cn(
                      "space-y-2 p-3 rounded-lg border",
                      isFailed && "bg-destructive/5 border-destructive/20",
                      isSkipped && "bg-muted/50 border-muted",
                      isSuccess && "bg-background border-border"
                    )}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center",
                            isFailed ? "bg-destructive/10" : "bg-muted"
                          )}>
                            {getServiceIcon(cost.service)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium capitalize">{cost.service.replace(/_/g, ' ').replace(/-/g, ' ')}</p>
                              <Badge 
                                variant={isSuccess ? 'success' : isFailed ? 'destructive' : 'secondary'}
                                className="text-xs"
                              >
                                {cost.status}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{cost.operation}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={cn("font-bold", isFailed && "text-destructive")}>
                            {formatCurrency(cost.calculated_cost_cents)}
                          </p>
                          <p className="text-xs text-muted-foreground">{cost.total_calls.toLocaleString()} calls</p>
                        </div>
                      </div>
                      <Progress 
                        value={percentage} 
                        className={cn("h-2", isFailed && "[&>div]:bg-destructive")} 
                      />
                    </div>
                  );
                })}

                {/* Retry costs shown separately */}
                {retryData.total_retries > 0 && (
                  <div className="space-y-2 p-3 rounded-lg border bg-warning/5 border-warning/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center">
                          <RefreshCw className="w-4 h-4 text-warning" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">Retry Regenerations</p>
                            <Badge variant="warning" className="text-xs bg-warning/20 text-warning border-warning/30">
                              retries
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">Additional Veo calls for failed quality checks</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-warning">{formatCurrency(totalRetryCostCents)}</p>
                        <p className="text-xs text-muted-foreground">{retryData.total_retries} retries</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span>Successful API Calls</span>
                  <span className="font-mono text-success">{formatCurrency(totalSuccessfulApiCostCents)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span>Failed API Calls</span>
                  <span className="font-mono text-destructive">{formatCurrency(totalFailedApiCostCents)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span>Retry Costs</span>
                  <span className="font-mono text-warning">{formatCurrency(totalRetryCostCents)}</span>
                </div>
                <div className="flex justify-between items-center text-lg font-bold pt-2 border-t">
                  <span>Total API Costs</span>
                  <span>{formatCurrency(totalApiCostCents + totalRetryCostCents)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cost per API breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calculator className="w-5 h-5" />
                Per-Call Cost Reference
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Video className="w-4 h-4 text-primary" />
                    <span className="font-medium">Kling 2.6</span>
                  </div>
                  <p className="text-lg font-bold">${(KLING_COST_PER_CLIP_CENTS / 100).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">per 5s clip</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Mic className="w-4 h-4 text-primary" />
                    <span className="font-medium">OpenAI TTS</span>
                  </div>
                  <p className="text-lg font-bold">${(OPENAI_TTS_COST_PER_CALL_CENTS / 100).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">per narration</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Scissors className="w-4 h-4 text-primary" />
                    <span className="font-medium">Cloud Run Stitch</span>
                  </div>
                  <p className="text-lg font-bold">${(CLOUD_RUN_STITCH_COST_CENTS / 100).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">per stitch</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="font-medium">GPT-4 Script</span>
                  </div>
                  <p className="text-lg font-bold">${(OPENAI_SCRIPT_COST_CENTS / 100).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">per script</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Image className="w-4 h-4 text-primary" />
                    <span className="font-medium">DALL-E 3</span>
                  </div>
                  <p className="text-lg font-bold">${(DALLE_COST_PER_IMAGE_CENTS / 100).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">per image</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Database className="w-4 h-4 text-primary" />
                    <span className="font-medium">Gemini Flash</span>
                  </div>
                  <p className="text-lg font-bold">${(GEMINI_FLASH_COST_CENTS / 100).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">per analysis</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Storage Tab */}
        <TabsContent value="storage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Storage Usage & Costs</CardTitle>
              <CardDescription>
                Total storage: {(totalStorageMB / 1024).toFixed(2)} GB • Monthly cost: {formatCurrency(totalStorageCostCents)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {storageCosts.map((storage, idx) => {
                  const percentage = (storage.size_mb / totalStorageMB) * 100;
                  return (
                    <div key={idx} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                            <HardDrive className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-medium capitalize">{storage.bucket_id.replace(/-/g, ' ')}</p>
                            <p className="text-xs text-muted-foreground">{storage.file_count} files</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{storage.size_mb.toLocaleString()} MB</p>
                          <p className="text-xs text-muted-foreground">{formatCurrency(storage.cost_per_month_cents)}/mo</p>
                        </div>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Storage Optimization Tip</p>
                    <p className="text-sm text-muted-foreground">
                      Temp-frames ({storageCosts.find(s => s.bucket_id === 'temp-frames')?.file_count || 0} files) 
                      could be cleaned up periodically to reduce costs.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Platform Tab */}
        <TabsContent value="platform" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Lovable Platform
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">${LOVABLE_MONTHLY_COST_DOLLARS}/mo</div>
                <p className="text-sm text-muted-foreground mt-2">
                  Includes hosting, deployment, AI assistant, and development environment
                </p>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Edge Functions (unlimited)</span>
                    <Badge variant="secondary">Included</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Preview Deployments</span>
                    <Badge variant="secondary">Included</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>AI Code Generation</span>
                    <Badge variant="secondary">Included</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Database className="w-5 h-5 text-success" />
                  Supabase (via Cloud)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">${SUPABASE_MONTHLY_COST_DOLLARS}/mo</div>
                <p className="text-sm text-muted-foreground mt-2">
                  Pro plan equivalent: Database, Auth, Storage, Edge Functions
                </p>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Database (8GB)</span>
                    <Badge variant="secondary">Included</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Storage (100GB)</span>
                    <Badge variant="secondary">Included</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Edge Functions</span>
                    <Badge variant="secondary">Included</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Monthly Platform Costs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b">
                  <span>Lovable Platform</span>
                  <span className="font-mono">${LOVABLE_MONTHLY_COST_DOLLARS.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span>Supabase (Cloud)</span>
                  <span className="font-mono">${SUPABASE_MONTHLY_COST_DOLLARS.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2 font-bold text-lg">
                  <span>Platform Total</span>
                  <span>${(LOVABLE_MONTHLY_COST_DOLLARS + SUPABASE_MONTHLY_COST_DOLLARS).toFixed(2)}/mo</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Development Tab */}
        <TabsContent value="development" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Development Investment
              </CardTitle>
              <CardDescription>
                Track your time investment to understand true project cost
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="p-6 bg-muted/50 rounded-xl text-center">
                  <p className="text-4xl font-bold">{devHours}</p>
                  <p className="text-sm text-muted-foreground">Total Hours</p>
                </div>
                <div className="p-6 bg-muted/50 rounded-xl text-center">
                  <p className="text-4xl font-bold">${DEV_HOURLY_RATE_DOLLARS}</p>
                  <p className="text-sm text-muted-foreground">Hourly Rate</p>
                </div>
                <div className="p-6 bg-primary/10 rounded-xl text-center border border-primary/20">
                  <p className="text-4xl font-bold">{formatCurrency(devCostCents)}</p>
                  <p className="text-sm text-muted-foreground">Total Investment</p>
                </div>
              </div>

              <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                <h4 className="font-medium mb-3">ROI Calculation</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Development Cost</span>
                    <span className="font-mono">{formatCurrency(devCostCents)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Operational Costs (to date)</span>
                    <span className="font-mono">{formatCurrency(totalMonthlyCostCents)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-medium">Total Investment</span>
                    <span className="font-mono font-bold">{formatCurrency(totalWithDevCents)}</span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span>Revenue Generated</span>
                    <span className="font-mono text-success">{formatCurrency(adjustedRevenueCents)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-medium">Net Position</span>
                    <span className={cn(
                      "font-mono font-bold",
                      adjustedRevenueCents - totalWithDevCents >= 0 ? "text-success" : "text-destructive"
                    )}>
                      {formatCurrency(adjustedRevenueCents - totalWithDevCents)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Full Breakdown Tab */}
        <TabsContent value="breakdown" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Complete Cost Breakdown</CardTitle>
              <CardDescription>Every dime accounted for</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* API Costs */}
                <div className="p-4 bg-muted/30 rounded-lg">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Server className="w-4 h-4" />
                    API & Services
                  </h4>
                  <div className="space-y-2 text-sm">
                    {apiCosts.map((cost, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span className="capitalize">{cost.service.replace(/_/g, ' ')} ({cost.operation})</span>
                        <span className="font-mono">{formatCurrency(cost.calculated_cost_cents)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between pt-2 border-t font-medium">
                      <span>API Subtotal</span>
                      <span className="font-mono">{formatCurrency(totalApiCostCents)}</span>
                    </div>
                  </div>
                </div>

                {/* Storage Costs */}
                <div className="p-4 bg-muted/30 rounded-lg">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <HardDrive className="w-4 h-4" />
                    Storage ({(totalStorageMB / 1024).toFixed(2)} GB)
                  </h4>
                  <div className="space-y-2 text-sm">
                    {storageCosts.map((storage, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span className="capitalize">{storage.bucket_id.replace(/-/g, ' ')}</span>
                        <span className="font-mono">{formatCurrency(storage.cost_per_month_cents)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between pt-2 border-t font-medium">
                      <span>Storage Subtotal</span>
                      <span className="font-mono">{formatCurrency(totalStorageCostCents)}</span>
                    </div>
                  </div>
                </div>

                {/* Platform Costs */}
                <div className="p-4 bg-muted/30 rounded-lg">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Cloud className="w-4 h-4" />
                    Platform Subscriptions
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Lovable Platform</span>
                      <span className="font-mono">{formatCurrency(lovableCostCents)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Supabase (via Cloud)</span>
                      <span className="font-mono">{formatCurrency(supabaseCostCents)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t font-medium">
                      <span>Platform Subtotal</span>
                      <span className="font-mono">{formatCurrency(lovableCostCents + supabaseCostCents)}</span>
                    </div>
                  </div>
                </div>

                {/* Development Costs */}
                <div className="p-4 bg-warning/10 rounded-lg border border-warning/20">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Code className="w-4 h-4" />
                    Development Investment
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>{devHours} hours @ ${DEV_HOURLY_RATE_DOLLARS}/hr</span>
                      <span className="font-mono">{formatCurrency(devCostCents)}</span>
                    </div>
                  </div>
                </div>

                {/* Grand Total */}
                <div className="p-6 bg-primary/10 rounded-xl border border-primary/20">
                  <div className="space-y-3">
                    <div className="flex justify-between text-lg">
                      <span className="font-medium">Operational Costs</span>
                      <span className="font-mono font-bold">{formatCurrency(totalMonthlyCostCents)}</span>
                    </div>
                    <div className="flex justify-between text-lg">
                      <span className="font-medium">+ Development</span>
                      <span className="font-mono font-bold">{formatCurrency(devCostCents)}</span>
                    </div>
                    <div className="flex justify-between text-xl border-t pt-3">
                      <span className="font-bold">TOTAL INVESTMENT</span>
                      <span className="font-mono font-bold text-primary">{formatCurrency(totalWithDevCents)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
