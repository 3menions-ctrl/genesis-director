import { useState, useEffect, useMemo } from 'react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  PieChart,
  Video,
  Mic,
  Music,
  CalendarIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  StatOrb, FloatSection, FloatRow, StatusPill, DeckButton,
  ACCENT_HSL, CYAN, AMBER, ROSE, VIOLET,
} from '@/admin/ui/primitives';
import { TrendArea, CategoryBars, Donut, bucketByDay, sumBy, countBy } from '@/admin/ui/charts';

type DateRangePreset = 'today' | '7days' | '30days' | 'all' | 'custom';

// ============================================
// REAL COST DEFINITIONS — matched to actual DB services
// ============================================
// Services in api_cost_logs: replicate-kling, replicate_minimax, openai-tts, replicate-musicgen-stereo
// The DB already stores real_cost_cents per call — we use that as source of truth.
// These fallbacks are only used if real_cost_cents is 0/null.

const FALLBACK_COST_MAP: Record<string, number> = {
  'replicate-kling': 5,           // ~$0.05 per clip generation
  'replicate_minimax': 1,         // ~$0.01 per TTS call
  'openai-tts': 1,                // ~$0.01 per TTS call
  'replicate-musicgen-stereo': 8, // ~$0.08 per music generation
};

// Supabase Storage Pricing
const STORAGE_COST_PER_GB_CENTS = 2.1;

// Platform Monthly Costs
const LOVABLE_MONTHLY_COST_DOLLARS = 49;
const DEV_HOURLY_RATE_DOLLARS = 100;
const SUPABASE_MONTHLY_COST_DOLLARS = 25;

// ============================================

/** Thin borderless gradient progress bar (replaces shadcn <Progress>). */
function Bar({ value, color }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color || `linear-gradient(90deg, ${ACCENT_HSL}, ${CYAN})` }}
      />
    </div>
  );
}

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
  // Raw rows kept for charts — same fetch the aggregates use, no extra queries.
  const [rawApiLogs, setRawApiLogs] = useState<{ service: string; real_cost_cents: number | null; created_at: string }[]>([]);
  const [rawClips, setRawClips] = useState<{ status: string | null }[]>([]);
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

        // Use the real_cost_cents from DB as source of truth
        // Fall back to estimate only if real_cost_cents is 0
        const realCost = row.real_cost_cents || 0;
        if (realCost > 0) {
          apiAggregated[key].calculated_cost_cents += realCost;
        } else {
          apiAggregated[key].calculated_cost_cents += FALLBACK_COST_MAP[row.service] || 0;
        }
      });

      setApiCosts(Object.values(apiAggregated).sort((a, b) => b.calculated_cost_cents - a.calculated_cost_cents));
      setRawApiLogs((apiData || []) as { service: string; real_cost_cents: number | null; created_at: string }[]);

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
      setRawClips(clips.map((c) => ({ status: c.status })));
      const totalRetries = clips.reduce((sum, c) => sum + (c.retry_count || 0), 0);
      const clipsWithRetries = clips.filter(c => (c.retry_count || 0) > 0).length;
      const retryCostCents = totalRetries * (FALLBACK_COST_MAP['replicate-kling'] || 5);

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
      const CREDIT_PRICE_CENTS = 10.0; // $0.10 per credit (1 dollar = 10 credits)
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

      // Storage data - fetch real file counts per bucket from storage.objects
      const knownBuckets = ['final-videos', 'video-clips', 'scene-images', 'character-references', 'temp-frames', 'voice-tracks', 'thumbnails'];
      const storageBuckets: { bucket_id: string; file_count: number; size_mb: number }[] = [];

      for (const bucketId of knownBuckets) {
        try {
          const { data: files } = await supabase.storage.from(bucketId).list('', { limit: 1000 });
          const fileCount = files?.length || 0;
          // Estimate size: average file sizes vary by bucket type
          const avgSizeMb = bucketId === 'final-videos' ? 30 : bucketId === 'video-clips' ? 3.5 : bucketId === 'scene-images' ? 2.5 : bucketId === 'voice-tracks' ? 0.8 : 0.15;
          storageBuckets.push({ bucket_id: bucketId, file_count: fileCount, size_mb: Math.round(fileCount * avgSizeMb) });
        } catch {
          storageBuckets.push({ bucket_id: bucketId, file_count: 0, size_mb: 0 });
        }
      }

      setStorageCosts(storageBuckets.map(b => ({
        ...b,
        cost_per_month_cents: Math.round((b.size_mb / 1024) * STORAGE_COST_PER_GB_CENTS * 100) / 100,
      })));

      // Calculate development hours from real project age
      const daysSinceStart = Math.ceil((Date.now() - projectStartDate.getTime()) / (1000 * 60 * 60 * 24));
      setDevHours(daysSinceStart);

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
  const totalStorageCostCents = Math.round((totalStorageMB / 1024) * STORAGE_COST_PER_GB_CENTS * 100) / 100;
  const devCostCents = devHours * DEV_HOURLY_RATE_DOLLARS * 100;
  const lovableCostCents = LOVABLE_MONTHLY_COST_DOLLARS * 100;
  const supabaseCostCents = SUPABASE_MONTHLY_COST_DOLLARS * 100;

  // Include retry costs in total (they're real API costs we paid)
  const totalMonthlyCostCents = totalApiCostCents + totalRetryCostCents + totalStorageCostCents + lovableCostCents + supabaseCostCents;
  const totalWithDevCents = totalMonthlyCostCents + devCostCents;

  // Revenue calculation - ONLY actual Stripe purchases.
  // LOGIC FIX AD-5: do NOT subtract `refund_credits` from revenue. Those are
  // INTERNAL credit grants for failed generations (type 'refund', positive
  // amount) — not cash refunds — so subtracting them understated revenue and
  // Net Profit, contradicting AdminFinancialsPage's stated rule.
  const CREDIT_PRICE_CENTS = 10.0; // $0.10 per credit
  const adjustedRevenueCents = actualRevenueCents;

  const netProfitCents = adjustedRevenueCents - totalMonthlyCostCents;
  const profitMargin = adjustedRevenueCents > 0 ? (netProfitCents / adjustedRevenueCents) * 100 : 0;

  // Waste percentage of API costs only (not platform costs)
  const apiOnlyCosts = totalApiCostCents + totalRetryCostCents;
  const wastePercentage = apiOnlyCosts > 0 ? (totalWastedCostCents / apiOnlyCosts) * 100 : 0;

  // Charts derived from the same raw rows the aggregates use (no extra fetch).
  const chartDays = dateRangePreset === 'today' ? 1 : dateRangePreset === '7days' ? 7 : dateRangePreset === '30days' ? 30 : 30;
  const dailyCostSeries = useMemo(
    () => bucketByDay(rawApiLogs, (r) => r.created_at, { days: chartDays, value: (r) => (r.real_cost_cents || 0) / 100 }),
    [rawApiLogs, chartDays],
  );
  const costByService = useMemo(
    () => sumBy(rawApiLogs, (r) => r.service.replace(/[_-]/g, ' '), (r) => (r.real_cost_cents || 0) / 100),
    [rawApiLogs],
  );
  const clipStatusBreakdown = useMemo(() => countBy(rawClips, (r) => r.status), [rawClips]);

  const getServiceIcon = (service: string) => {
    switch (service) {
      case 'replicate-kling': return <Video className="w-4 h-4" />;
      case 'replicate_minimax': return <Mic className="w-4 h-4" />;
      case 'openai-tts': return <Mic className="w-4 h-4" />;
      case 'replicate-musicgen-stereo': return <Music className="w-4 h-4" />;
      default: return <Cpu className="w-4 h-4" />;
    }
  };

  const revenueSub = refundData.total_refunds > 0
    ? `-${refundData.refund_credits} refunded`
    : actualRevenueCents === 0 ? 'No Stripe purchases yet' : 'From Stripe purchases';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: ACCENT_HSL }} />
      </div>
    );
  }

  const triggerCls = "rounded-full px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/50 gap-2 data-[state=active]:bg-white/[0.08] data-[state=active]:text-white";

  return (
    <div className="space-y-10">
      {/* Header with Date Range Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-white">Comprehensive Cost Analysis</h2>
          <p className="text-sm text-white/55">
            {getDateRangeLabel()} • Every dime tracked and calculated
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Preset buttons */}
          <div className="flex items-center gap-1 rounded-full bg-white/[0.04] p-1">
            <DeckButton accent={dateRangePreset === 'today'} onClick={() => setDateRangePreset('today')}>Today</DeckButton>
            <DeckButton accent={dateRangePreset === '7days'} onClick={() => setDateRangePreset('7days')}>7 Days</DeckButton>
            <DeckButton accent={dateRangePreset === '30days'} onClick={() => setDateRangePreset('30days')}>30 Days</DeckButton>
            <DeckButton accent={dateRangePreset === 'all'} onClick={() => setDateRangePreset('all')}>All Time</DeckButton>
          </div>

          {/* Custom date range picker */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-4 py-2 font-mono text-[10px] uppercase tracking-[0.22em] transition-colors",
                  dateRangePreset === 'custom' ? "text-white" : "bg-white/[0.06] text-white/60 hover:bg-white/[0.1] hover:text-white",
                )}
                style={dateRangePreset === 'custom' ? { background: 'hsl(214 90% 62% / 0.12)', color: 'hsl(214 90% 62%)' } : undefined}
              >
                <CalendarIcon className="w-3 h-3" />
                Custom
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <div className="p-3 space-y-3">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-white/55">Start Date</p>
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
                  <p className="text-xs font-medium text-white/55">End Date</p>
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

          <DeckButton onClick={fetchAllData}>
            <RefreshCw className="w-3 h-3" />
            Refresh
          </DeckButton>
        </div>
      </div>

      {/* Executive Summary — floating figures */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-5">
        <StatOrb index={0} icon={DollarSign} aura={ACCENT_HSL} accentNumber label="Total Cost" value={formatCurrency(totalMonthlyCostCents)} sub="Incl. retries & failures" />
        <StatOrb index={1} icon={AlertTriangle} aura={ROSE} label="Wasted Costs" value={formatCurrency(totalWastedCostCents)} sub={`${wastePercentage.toFixed(1)}% of total`} />
        <StatOrb index={2} icon={TrendingUp} aura={CYAN} label="Revenue" value={formatCurrency(adjustedRevenueCents)} sub={revenueSub} />
        <StatOrb index={3} icon={netProfitCents >= 0 ? TrendingUp : TrendingDown} aura={netProfitCents >= 0 ? CYAN : ROSE} label="Net Profit" value={formatCurrency(netProfitCents)} sub={`${profitMargin.toFixed(1)}% margin`} />
        <StatOrb index={4} icon={Clock} aura={AMBER} label="Dev Investment" value={formatCurrency(devCostCents)} sub={`${devHours} days since launch`} />
      </div>

      {/* Analytics — real figures from the api_cost_logs / video_clips rows already fetched */}
      {(rawApiLogs.length > 0 || rawClips.length > 0) && (
        <div className="space-y-10">
          <FloatSection title="Daily API cost" meta={`${getDateRangeLabel()} · USD`}>
            <TrendArea data={dailyCostSeries} valueLabel="cost ($)" height={240} emptyLabel="No API cost in this window." />
          </FloatSection>
          <div className="grid grid-cols-1 gap-x-14 gap-y-14 lg:grid-cols-2">
            <FloatSection title="Cost by service" meta="real API spend">
              <CategoryBars data={costByService} formatValue={(v) => formatCurrency(v * 100)} />
            </FloatSection>
            <FloatSection title="Clip outcomes" meta={`${rawClips.length} clips`}>
              <Donut data={clipStatusBreakdown} centerLabel="clips" />
            </FloatSection>
          </div>
        </div>
      )}

      {/* Tabs for detailed breakdown */}
      <Tabs defaultValue="wasted" className="space-y-6">
        <TabsList className="h-auto flex-wrap gap-1 border-0 bg-transparent p-0">
          <TabsTrigger value="wasted" className={cn(triggerCls, "data-[state=active]:!text-[hsl(350_90%_70%)]")}>
            <AlertTriangle className="w-4 h-4" />
            Wasted/Failed
          </TabsTrigger>
          <TabsTrigger value="api" className={triggerCls}>
            <Server className="w-4 h-4" />
            API Costs
          </TabsTrigger>
          <TabsTrigger value="storage" className={triggerCls}>
            <HardDrive className="w-4 h-4" />
            Storage
          </TabsTrigger>
          <TabsTrigger value="platform" className={triggerCls}>
            <Cloud className="w-4 h-4" />
            Platform
          </TabsTrigger>
          <TabsTrigger value="development" className={triggerCls}>
            <Code className="w-4 h-4" />
            Development
          </TabsTrigger>
          <TabsTrigger value="breakdown" className={triggerCls}>
            <PieChart className="w-4 h-4" />
            Full Breakdown
          </TabsTrigger>
        </TabsList>

        {/* Wasted Costs Tab */}
        <TabsContent value="wasted" className="space-y-10">
          <div className="grid gap-x-8 gap-y-10 md:grid-cols-3">
            <StatOrb index={0} aura={ROSE} label="Failed API Calls" value={formatCurrency(totalFailedApiCostCents)} sub={`${failedApiCosts.reduce((sum, c) => sum + c.total_calls, 0)} failed calls`} />
            <StatOrb index={1} aura={AMBER} label="Retry Costs" value={formatCurrency(totalRetryCostCents)} sub={`${retryData.total_retries} retries across ${retryData.clips_with_retries} clips`} />
            <StatOrb index={2} aura={VIOLET} label="Credits Refunded" value={refundData.refund_credits} sub={`${refundData.total_refunds} refund transactions`} />
          </div>

          <FloatSection title="Wasted Cost Breakdown" meta="failed ops · retries · deleted content">
            <div>
              {/* Failed API calls by service */}
              {failedApiCosts.map((cost, idx) => (
                <FloatRow key={idx}
                  left={
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.04]" style={{ color: ROSE }}>
                        {getServiceIcon(cost.service)}
                      </span>
                      <div>
                        <p className="font-medium capitalize text-white">{cost.service.replace(/_/g, ' ')}</p>
                        <p className="flex items-center gap-1.5 text-xs text-white/50">
                          {cost.operation} <StatusPill tone="danger">{cost.status}</StatusPill>
                        </p>
                      </div>
                    </div>
                  }
                  right={
                    <div>
                      <p className="font-bold" style={{ color: ROSE }}>{formatCurrency(cost.calculated_cost_cents)}</p>
                      <p className="text-xs text-white/50">{cost.total_calls} calls</p>
                    </div>
                  }
                />
              ))}

              {/* Retry costs */}
              {retryData.total_retries > 0 && (
                <FloatRow
                  left={
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.04]" style={{ color: AMBER }}>
                        <RefreshCw className="w-5 h-5" />
                      </span>
                      <div>
                        <p className="font-medium text-white">Clip Regeneration Retries</p>
                        <p className="text-xs text-white/50">Extra Veo API calls when clips failed quality checks</p>
                      </div>
                    </div>
                  }
                  right={
                    <div>
                      <p className="font-bold" style={{ color: AMBER }}>{formatCurrency(totalRetryCostCents)}</p>
                      <p className="text-xs text-white/50">{retryData.total_retries} retries</p>
                    </div>
                  }
                />
              )}

              {wastedCosts.length === 0 && retryData.total_retries === 0 && failedApiCosts.length === 0 && (
                <div className="py-8 text-center text-white/50">
                  <AlertTriangle className="mx-auto mb-4 h-12 w-12 opacity-50" />
                  <p>No wasted costs detected - great job!</p>
                </div>
              )}
            </div>

            <div className="mt-6 space-y-2 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center justify-between text-sm text-white/70">
                <span>Failed API Calls</span>
                <span className="font-mono">{formatCurrency(totalFailedApiCostCents)}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-white/70">
                <span>Retry Costs</span>
                <span className="font-mono">{formatCurrency(totalRetryCostCents)}</span>
              </div>
              <div className="flex items-center justify-between pt-2 text-lg font-bold" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                <span style={{ color: ROSE }}>Total Wasted</span>
                <span style={{ color: ROSE }}>{formatCurrency(totalWastedCostCents)}</span>
              </div>
              <p className="text-right text-xs text-white/50">
                {wastePercentage.toFixed(1)}% of total operational costs
              </p>
            </div>
          </FloatSection>

          <FloatSection title="Cost Recovery Recommendations">
            <div className="space-y-3">
              {retryData.total_retries > 10 && (
                <div className="flex items-start gap-3 rounded-2xl bg-white/[0.03] p-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" style={{ color: AMBER }} />
                  <div>
                    <p className="font-medium text-white">High Retry Rate</p>
                    <p className="text-sm text-white/55">
                      {retryData.total_retries} retries detected. Consider improving prompt quality or adjusting quality thresholds.
                    </p>
                  </div>
                </div>
              )}
              {totalFailedApiCostCents > 100 && (
                <div className="flex items-start gap-3 rounded-2xl bg-white/[0.03] p-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" style={{ color: ROSE }} />
                  <div>
                    <p className="font-medium text-white">Significant API Failures</p>
                    <p className="text-sm text-white/55">
                      {formatCurrency(totalFailedApiCostCents)} lost to failed API calls. Review error logs and implement better error handling.
                    </p>
                  </div>
                </div>
              )}
              {wastePercentage < 5 && (
                <div className="flex items-start gap-3 rounded-2xl bg-white/[0.03] p-3">
                  <TrendingUp className="mt-0.5 h-5 w-5 flex-shrink-0" style={{ color: CYAN }} />
                  <div>
                    <p className="font-medium" style={{ color: CYAN }}>Excellent Efficiency</p>
                    <p className="text-sm text-white/55">
                      Waste is under 5% - your pipeline is running efficiently!
                    </p>
                  </div>
                </div>
              )}
            </div>
          </FloatSection>
        </TabsContent>

        {/* API Costs Tab */}
        <TabsContent value="api" className="space-y-10">
          <FloatSection title="API Cost Details">
            <p className="mb-4 text-sm text-white/55">
              All API calls including successful, failed, and retries •
              <span className="ml-1" style={{ color: CYAN }}>{successfulApiCosts.reduce((s, c) => s + c.total_calls, 0)} successful</span> •
              <span className="ml-1" style={{ color: ROSE }}>{failedApiCosts.reduce((s, c) => s + c.total_calls, 0)} failed</span> •
              <span className="ml-1" style={{ color: AMBER }}>{retryData.total_retries} retries</span>
            </p>
            <div className="space-y-4">
              {apiCosts.map((cost, idx) => {
                const percentage = totalApiCostCents > 0 ? (cost.calculated_cost_cents / totalApiCostCents) * 100 : 0;
                const isSuccess = cost.status === 'completed';
                const isFailed = cost.status === 'failed';
                return (
                  <div key={idx} className="space-y-2 rounded-2xl bg-white/[0.02] p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04]" style={isFailed ? { color: ROSE } : undefined}>
                          {getServiceIcon(cost.service)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium capitalize text-white">{cost.service.replace(/_/g, ' ').replace(/-/g, ' ')}</p>
                            <StatusPill tone={isSuccess ? 'positive' : isFailed ? 'danger' : 'neutral'}>
                              {cost.status}
                            </StatusPill>
                          </div>
                          <p className="text-xs text-white/50">{cost.operation}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold" style={isFailed ? { color: ROSE } : { color: '#fff' }}>
                          {formatCurrency(cost.calculated_cost_cents)}
                        </p>
                        <p className="text-xs text-white/50">{cost.total_calls.toLocaleString()} calls</p>
                      </div>
                    </div>
                    <Bar value={percentage} color={isFailed ? ROSE : undefined} />
                  </div>
                );
              })}

              {/* Retry costs shown separately */}
              {retryData.total_retries > 0 && (
                <div className="space-y-2 rounded-2xl bg-white/[0.02] p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04]" style={{ color: AMBER }}>
                        <RefreshCw className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-white">Retry Regenerations</p>
                          <StatusPill tone="warn">retries</StatusPill>
                        </div>
                        <p className="text-xs text-white/50">Additional Veo calls for failed quality checks</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold" style={{ color: AMBER }}>{formatCurrency(totalRetryCostCents)}</p>
                      <p className="text-xs text-white/50">{retryData.total_retries} retries</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 space-y-2 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center justify-between text-sm text-white/70">
                <span>Successful API Calls</span>
                <span className="font-mono" style={{ color: CYAN }}>{formatCurrency(totalSuccessfulApiCostCents)}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-white/70">
                <span>Failed API Calls</span>
                <span className="font-mono" style={{ color: ROSE }}>{formatCurrency(totalFailedApiCostCents)}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-white/70">
                <span>Retry Costs</span>
                <span className="font-mono" style={{ color: AMBER }}>{formatCurrency(totalRetryCostCents)}</span>
              </div>
              <div className="flex items-center justify-between pt-2 text-lg font-bold text-white" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                <span>Total API Costs</span>
                <span>{formatCurrency(totalApiCostCents + totalRetryCostCents)}</span>
              </div>
            </div>
          </FloatSection>

          {/* Cost per API breakdown */}
          <FloatSection title="Per-Call Cost Reference">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-white/[0.03] p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Video className="h-4 w-4" style={{ color: ACCENT_HSL }} />
                  <span className="font-medium text-white">Replicate Kling</span>
                </div>
                <p className="text-lg font-bold text-white">${(FALLBACK_COST_MAP['replicate-kling'] / 100).toFixed(2)}</p>
                <p className="text-xs text-white/50">per clip generation</p>
              </div>
              <div className="rounded-2xl bg-white/[0.03] p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Mic className="h-4 w-4" style={{ color: ACCENT_HSL }} />
                  <span className="font-medium text-white">Minimax TTS</span>
                </div>
                <p className="text-lg font-bold text-white">${(FALLBACK_COST_MAP['replicate_minimax'] / 100).toFixed(2)}</p>
                <p className="text-xs text-white/50">per narration</p>
              </div>
              <div className="rounded-2xl bg-white/[0.03] p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Mic className="h-4 w-4" style={{ color: ACCENT_HSL }} />
                  <span className="font-medium text-white">OpenAI TTS</span>
                </div>
                <p className="text-lg font-bold text-white">${(FALLBACK_COST_MAP['openai-tts'] / 100).toFixed(2)}</p>
                <p className="text-xs text-white/50">per narration</p>
              </div>
              <div className="rounded-2xl bg-white/[0.03] p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Music className="h-4 w-4" style={{ color: ACCENT_HSL }} />
                  <span className="font-medium text-white">MusicGen Stereo</span>
                </div>
                <p className="text-lg font-bold text-white">${(FALLBACK_COST_MAP['replicate-musicgen-stereo'] / 100).toFixed(2)}</p>
                <p className="text-xs text-white/50">per track</p>
              </div>
            </div>
          </FloatSection>
        </TabsContent>

        {/* Storage Tab */}
        <TabsContent value="storage" className="space-y-10">
          <FloatSection title="Storage Usage & Costs" meta={`${(totalStorageMB / 1024).toFixed(2)} GB · ${formatCurrency(totalStorageCostCents)}/mo`}>
            <div className="space-y-4">
              {storageCosts.map((storage, idx) => {
                const percentage = (storage.size_mb / totalStorageMB) * 100;
                return (
                  <div key={idx} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04]">
                          <HardDrive className="h-4 w-4 text-white/70" />
                        </div>
                        <div>
                          <p className="font-medium capitalize text-white">{storage.bucket_id.replace(/-/g, ' ')}</p>
                          <p className="text-xs text-white/50">{storage.file_count} files</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-white">{storage.size_mb.toLocaleString()} MB</p>
                        <p className="text-xs text-white/50">{formatCurrency(storage.cost_per_month_cents)}/mo</p>
                      </div>
                    </div>
                    <Bar value={percentage} />
                  </div>
                );
              })}
            </div>

            <div className="mt-6 rounded-2xl bg-white/[0.03] p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" style={{ color: AMBER }} />
                <div>
                  <p className="font-medium text-white">Storage Optimization Tip</p>
                  <p className="text-sm text-white/55">
                    Temp-frames ({storageCosts.find(s => s.bucket_id === 'temp-frames')?.file_count || 0} files)
                    could be cleaned up periodically to reduce costs.
                  </p>
                </div>
              </div>
            </div>
          </FloatSection>
        </TabsContent>

        {/* Platform Tab */}
        <TabsContent value="platform" className="space-y-10">
          <div className="grid gap-x-14 gap-y-10 md:grid-cols-2">
            <FloatSection title="Lovable Platform">
              <div className="text-3xl font-bold text-white">${LOVABLE_MONTHLY_COST_DOLLARS}/mo</div>
              <p className="mt-2 text-sm text-white/55">
                Includes hosting, deployment, AI assistant, and development environment
              </p>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm text-white/70">
                  <span>Edge Functions (unlimited)</span>
                  <StatusPill tone="neutral">Included</StatusPill>
                </div>
                <div className="flex justify-between text-sm text-white/70">
                  <span>Preview Deployments</span>
                  <StatusPill tone="neutral">Included</StatusPill>
                </div>
                <div className="flex justify-between text-sm text-white/70">
                  <span>AI Code Generation</span>
                  <StatusPill tone="neutral">Included</StatusPill>
                </div>
              </div>
            </FloatSection>

            <FloatSection title="Supabase (via Cloud)">
              <div className="text-3xl font-bold text-white">${SUPABASE_MONTHLY_COST_DOLLARS}/mo</div>
              <p className="mt-2 text-sm text-white/55">
                Pro plan equivalent: Database, Auth, Storage, Edge Functions
              </p>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm text-white/70">
                  <span>Database (8GB)</span>
                  <StatusPill tone="neutral">Included</StatusPill>
                </div>
                <div className="flex justify-between text-sm text-white/70">
                  <span>Storage (100GB)</span>
                  <StatusPill tone="neutral">Included</StatusPill>
                </div>
                <div className="flex justify-between text-sm text-white/70">
                  <span>Edge Functions</span>
                  <StatusPill tone="neutral">Included</StatusPill>
                </div>
              </div>
            </FloatSection>
          </div>

          <FloatSection title="Monthly Platform Costs">
            <div className="space-y-3">
              <div className="flex justify-between py-2 text-white/70" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <span>Lovable Platform</span>
                <span className="font-mono">${LOVABLE_MONTHLY_COST_DOLLARS.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2 text-white/70" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <span>Supabase (Cloud)</span>
                <span className="font-mono">${SUPABASE_MONTHLY_COST_DOLLARS.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2 text-lg font-bold text-white">
                <span>Platform Total</span>
                <span>${(LOVABLE_MONTHLY_COST_DOLLARS + SUPABASE_MONTHLY_COST_DOLLARS).toFixed(2)}/mo</span>
              </div>
            </div>
          </FloatSection>
        </TabsContent>

        {/* Development Tab */}
        <TabsContent value="development" className="space-y-10">
          <FloatSection title="Development Investment" meta="track your time investment">
            <div className="grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl bg-white/[0.03] p-6 text-center">
                <p className="text-4xl font-bold text-white">{devHours}</p>
                <p className="text-sm text-white/55">Days Since Launch</p>
              </div>
              <div className="rounded-2xl bg-white/[0.03] p-6 text-center">
                <p className="text-4xl font-bold text-white">${DEV_HOURLY_RATE_DOLLARS}</p>
                <p className="text-sm text-white/55">Daily Rate (est.)</p>
              </div>
              <div className="rounded-2xl bg-white/[0.04] p-6 text-center">
                <p className="text-4xl font-bold" style={{ color: ACCENT_HSL }}>{formatCurrency(devCostCents)}</p>
                <p className="text-sm text-white/55">Est. Investment</p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl bg-white/[0.02] p-4">
              <h4 className="mb-3 font-medium text-white">ROI Calculation</h4>
              <div className="space-y-2 text-sm text-white/70">
                <div className="flex justify-between">
                  <span>Development Cost</span>
                  <span className="font-mono">{formatCurrency(devCostCents)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Operational Costs (to date)</span>
                  <span className="font-mono">{formatCurrency(totalMonthlyCostCents)}</span>
                </div>
                <div className="flex justify-between pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                  <span className="font-medium text-white">Total Investment</span>
                  <span className="font-mono font-bold text-white">{formatCurrency(totalWithDevCents)}</span>
                </div>
                <div className="flex justify-between pt-2">
                  <span>Revenue Generated</span>
                  <span className="font-mono" style={{ color: CYAN }}>{formatCurrency(adjustedRevenueCents)}</span>
                </div>
                <div className="flex justify-between pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                  <span className="font-medium text-white">Net Position</span>
                  <span className="font-mono font-bold" style={{ color: adjustedRevenueCents - totalWithDevCents >= 0 ? CYAN : ROSE }}>
                    {formatCurrency(adjustedRevenueCents - totalWithDevCents)}
                  </span>
                </div>
              </div>
            </div>
          </FloatSection>
        </TabsContent>

        {/* Full Breakdown Tab */}
        <TabsContent value="breakdown" className="space-y-10">
          <FloatSection title="Complete Cost Breakdown" meta="every dime accounted for">
            <div className="space-y-4">
              {/* API Costs */}
              <div className="rounded-2xl bg-white/[0.02] p-4">
                <h4 className="mb-3 flex items-center gap-2 font-semibold text-white">
                  <Server className="h-4 w-4" />
                  API & Services
                </h4>
                <div className="space-y-2 text-sm text-white/70">
                  {apiCosts.map((cost, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span className="capitalize">{cost.service.replace(/_/g, ' ')} ({cost.operation})</span>
                      <span className="font-mono">{formatCurrency(cost.calculated_cost_cents)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 font-medium text-white" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                    <span>API Subtotal</span>
                    <span className="font-mono">{formatCurrency(totalApiCostCents)}</span>
                  </div>
                </div>
              </div>

              {/* Storage Costs */}
              <div className="rounded-2xl bg-white/[0.02] p-4">
                <h4 className="mb-3 flex items-center gap-2 font-semibold text-white">
                  <HardDrive className="h-4 w-4" />
                  Storage ({(totalStorageMB / 1024).toFixed(2)} GB)
                </h4>
                <div className="space-y-2 text-sm text-white/70">
                  {storageCosts.map((storage, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span className="capitalize">{storage.bucket_id.replace(/-/g, ' ')}</span>
                      <span className="font-mono">{formatCurrency(storage.cost_per_month_cents)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 font-medium text-white" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                    <span>Storage Subtotal</span>
                    <span className="font-mono">{formatCurrency(totalStorageCostCents)}</span>
                  </div>
                </div>
              </div>

              {/* Platform Costs */}
              <div className="rounded-2xl bg-white/[0.02] p-4">
                <h4 className="mb-3 flex items-center gap-2 font-semibold text-white">
                  <Cloud className="h-4 w-4" />
                  Platform Subscriptions
                </h4>
                <div className="space-y-2 text-sm text-white/70">
                  <div className="flex justify-between">
                    <span>Lovable Platform</span>
                    <span className="font-mono">{formatCurrency(lovableCostCents)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Supabase (via Cloud)</span>
                    <span className="font-mono">{formatCurrency(supabaseCostCents)}</span>
                  </div>
                  <div className="flex justify-between pt-2 font-medium text-white" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                    <span>Platform Subtotal</span>
                    <span className="font-mono">{formatCurrency(lovableCostCents + supabaseCostCents)}</span>
                  </div>
                </div>
              </div>

              {/* Development Costs */}
              <div className="rounded-2xl bg-white/[0.03] p-4">
                <h4 className="mb-3 flex items-center gap-2 font-semibold text-white">
                  <Code className="h-4 w-4" />
                  Development Investment
                </h4>
                <div className="space-y-2 text-sm text-white/70">
                  <div className="flex justify-between">
                    <span>{devHours} days × ${DEV_HOURLY_RATE_DOLLARS}/day</span>
                    <span className="font-mono">{formatCurrency(devCostCents)}</span>
                  </div>
                </div>
              </div>

              {/* Grand Total */}
              <div className="rounded-2xl bg-white/[0.04] p-6">
                <div className="space-y-3">
                  <div className="flex justify-between text-lg text-white">
                    <span className="font-medium">Operational Costs</span>
                    <span className="font-mono font-bold">{formatCurrency(totalMonthlyCostCents)}</span>
                  </div>
                  <div className="flex justify-between text-lg text-white">
                    <span className="font-medium">+ Development</span>
                    <span className="font-mono font-bold">{formatCurrency(devCostCents)}</span>
                  </div>
                  <div className="flex justify-between pt-3 text-xl" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                    <span className="font-bold text-white">TOTAL INVESTMENT</span>
                    <span className="font-mono font-bold" style={{ color: ACCENT_HSL }}>{formatCurrency(totalWithDevCents)}</span>
                  </div>
                </div>
              </div>
            </div>
          </FloatSection>
        </TabsContent>
      </Tabs>
    </div>
  );
}
