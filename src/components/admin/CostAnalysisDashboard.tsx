import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// REAL COST DEFINITIONS - UPDATE THESE VALUES
// ============================================

// Google Vertex AI Veo Pricing (per 6-second clip)
// Veo 3.1: $0.08 per 6-second clip (based on usage)
const VEO_COST_PER_CLIP_CENTS = 8;

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

interface DailyBreakdown {
  date: string;
  service: string;
  operation: string;
  calls: number;
  cost_cents: number;
}

export function CostAnalysisDashboard() {
  const [loading, setLoading] = useState(true);
  const [apiCosts, setApiCosts] = useState<ApiCostData[]>([]);
  const [storageCosts, setStorageCosts] = useState<StorageData[]>([]);
  const [dailyBreakdown, setDailyBreakdown] = useState<DailyBreakdown[]>([]);
  const [devHours, setDevHours] = useState(0);
  const [projectStartDate] = useState(new Date('2026-01-07')); // Update to your start date
  
  const fetchAllData = async () => {
    setLoading(true);
    try {
      // Fetch API costs grouped by service/operation
      const { data: apiData } = await supabase
        .from('api_cost_logs')
        .select('service, operation, credits_charged, real_cost_cents')
        .order('created_at', { ascending: false });
      
      // Aggregate API costs
      const apiAggregated: Record<string, ApiCostData> = {};
      (apiData || []).forEach((row: any) => {
        const key = `${row.service}|${row.operation}`;
        if (!apiAggregated[key]) {
          apiAggregated[key] = {
            service: row.service,
            operation: row.operation,
            total_calls: 0,
            total_credits: 0,
            logged_cost_cents: 0,
            calculated_cost_cents: 0,
          };
        }
        apiAggregated[key].total_calls++;
        apiAggregated[key].total_credits += row.credits_charged || 0;
        apiAggregated[key].logged_cost_cents += row.real_cost_cents || 0;
        
        // Calculate real costs based on service
        switch (row.service) {
          case 'google_veo':
            apiAggregated[key].calculated_cost_cents += VEO_COST_PER_CLIP_CENTS;
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
          default:
            // Use logged cost if available
            apiAggregated[key].calculated_cost_cents += row.real_cost_cents || 0;
        }
      });
      
      setApiCosts(Object.values(apiAggregated).sort((a, b) => b.calculated_cost_cents - a.calculated_cost_cents));

      // Storage data - calculated from actual usage
      // TODO: Create an admin edge function to get real-time storage stats
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
  }, []);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  // Calculate totals
  const totalApiCostCents = apiCosts.reduce((sum, c) => sum + c.calculated_cost_cents, 0);
  const totalStorageMB = storageCosts.reduce((sum, s) => sum + s.size_mb, 0);
  const totalStorageCostCents = Math.round((totalStorageMB / 1024) * STORAGE_COST_PER_GB_CENTS * 100);
  const devCostCents = devHours * DEV_HOURLY_RATE_DOLLARS * 100;
  const lovableCostCents = LOVABLE_MONTHLY_COST_DOLLARS * 100;
  const supabaseCostCents = SUPABASE_MONTHLY_COST_DOLLARS * 100;
  
  const totalMonthlyCostCents = totalApiCostCents + totalStorageCostCents + lovableCostCents + supabaseCostCents;
  const totalWithDevCents = totalMonthlyCostCents + devCostCents;

  // Revenue calculation (credits sold * price per credit)
  const CREDIT_PRICE_CENTS = 11.6; // $0.116 per credit (based on credit packages)
  const totalCreditsCharged = apiCosts.reduce((sum, c) => sum + c.total_credits, 0);
  const estimatedRevenueCents = Math.round(totalCreditsCharged * CREDIT_PRICE_CENTS);
  const netProfitCents = estimatedRevenueCents - totalMonthlyCostCents;
  const profitMargin = estimatedRevenueCents > 0 ? (netProfitCents / estimatedRevenueCents) * 100 : 0;

  const getServiceIcon = (service: string) => {
    switch (service) {
      case 'google_veo': return <Video className="w-4 h-4" />;
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Comprehensive Cost Analysis</h2>
          <p className="text-sm text-muted-foreground">Every dime tracked and calculated</p>
        </div>
        <Button onClick={fetchAllData} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Executive Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Total Monthly Cost
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalMonthlyCostCents)}</div>
            <p className="text-xs text-muted-foreground">Excl. development</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-success">
              <TrendingUp className="w-4 h-4" />
              Estimated Revenue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(estimatedRevenueCents)}</div>
            <p className="text-xs text-muted-foreground">{totalCreditsCharged.toLocaleString()} credits</p>
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
              Net Profit/Loss
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
            <p className="text-xs text-muted-foreground">{devHours} hours @ ${DEV_HOURLY_RATE_DOLLARS}/hr</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for detailed breakdown */}
      <Tabs defaultValue="api" className="space-y-4">
        <TabsList>
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
            Breakdown
          </TabsTrigger>
        </TabsList>

        {/* API Costs Tab */}
        <TabsContent value="api" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">API Cost Details</CardTitle>
              <CardDescription>Real-time tracking of all API calls and their costs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {apiCosts.map((cost, idx) => {
                  const percentage = (cost.calculated_cost_cents / totalApiCostCents) * 100;
                  return (
                    <div key={idx} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                            {getServiceIcon(cost.service)}
                          </div>
                          <div>
                            <p className="font-medium capitalize">{cost.service.replace(/_/g, ' ').replace(/-/g, ' ')}</p>
                            <p className="text-xs text-muted-foreground">{cost.operation}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{formatCurrency(cost.calculated_cost_cents)}</p>
                          <p className="text-xs text-muted-foreground">{cost.total_calls.toLocaleString()} calls</p>
                        </div>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 pt-4 border-t">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Total API Costs</span>
                  <span className="text-xl font-bold">{formatCurrency(totalApiCostCents)}</span>
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
                    <span className="font-medium">Veo 3.1</span>
                  </div>
                  <p className="text-lg font-bold">${(VEO_COST_PER_CLIP_CENTS / 100).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">per 6s clip</p>
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
                    <span className="font-mono text-success">{formatCurrency(estimatedRevenueCents)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-medium">Net Position</span>
                    <span className={cn(
                      "font-mono font-bold",
                      estimatedRevenueCents - totalWithDevCents >= 0 ? "text-success" : "text-destructive"
                    )}>
                      {formatCurrency(estimatedRevenueCents - totalWithDevCents)}
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
