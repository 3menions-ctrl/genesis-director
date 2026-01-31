import React from 'react';
import { motion } from 'framer-motion';
import { 
  Film, Zap, Clock, TrendingUp, Heart, Eye, 
  FolderOpen, Activity, Sparkles, CheckCircle2, 
  AlertCircle, Loader2 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { RealAnalytics } from '@/hooks/useRealAnalytics';
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell 
} from 'recharts';

interface RealAnalyticsCardsProps {
  analytics: RealAnalytics | null;
  loading: boolean;
}

function AnalyticsCard({ 
  icon: Icon, 
  label, 
  value, 
  subValue,
  trend,
  color = 'default',
  delay = 0,
  className,
}: { 
  icon: React.ElementType;
  label: string;
  value: string | number;
  subValue?: string;
  trend?: { value: number; positive: boolean };
  color?: 'default' | 'emerald' | 'amber' | 'blue' | 'violet' | 'rose';
  delay?: number;
  className?: string;
}) {
  const colorConfig = {
    default: { iconBg: 'bg-zinc-800', icon: 'text-zinc-400' },
    emerald: { iconBg: 'bg-emerald-500/15', icon: 'text-emerald-400' },
    amber: { iconBg: 'bg-amber-500/15', icon: 'text-amber-400' },
    blue: { iconBg: 'bg-blue-500/15', icon: 'text-blue-400' },
    violet: { iconBg: 'bg-violet-500/15', icon: 'text-violet-400' },
    rose: { iconBg: 'bg-rose-500/15', icon: 'text-rose-400' },
  };
  const config = colorConfig[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative p-4 rounded-2xl bg-zinc-900/60 border border-white/[0.06] backdrop-blur-xl",
        "hover:bg-zinc-900/80 hover:border-white/[0.1] transition-all duration-300",
        className
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", config.iconBg)}>
          <Icon className={cn("w-5 h-5", config.icon)} />
        </div>
        {trend && (
          <span className={cn(
            "text-xs font-medium px-2 py-0.5 rounded-full",
            trend.positive ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"
          )}>
            {trend.positive ? '+' : ''}{trend.value}%
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
        <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
        {subValue && (
          <p className="text-[11px] text-zinc-600 mt-1">{subValue}</p>
        )}
      </div>
    </motion.div>
  );
}

function ActivityChart({ data }: { data: { date: string; clips: number; credits: number }[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="p-4 rounded-2xl bg-zinc-900/60 border border-white/[0.06] backdrop-blur-xl col-span-2"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Weekly Activity</h3>
          <p className="text-xs text-zinc-500">Clips generated per day</p>
        </div>
        <Activity className="w-4 h-4 text-zinc-500" />
      </div>
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="clipGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(210, 100%, 60%)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(210, 100%, 60%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="date" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#71717a', fontSize: 10 }}
            />
            <YAxis hide />
            <Tooltip 
              contentStyle={{ 
                background: 'rgba(24, 24, 27, 0.95)', 
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                fontSize: '12px'
              }}
              labelStyle={{ color: '#fff' }}
            />
            <Area 
              type="monotone" 
              dataKey="clips" 
              stroke="hsl(210, 100%, 60%)" 
              strokeWidth={2}
              fill="url(#clipGradient)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}

const ModeDistributionChart = React.forwardRef<
  HTMLDivElement,
  { data: { mode: string; count: number }[] }
>(function ModeDistributionChart({ data }, ref) {
  const COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444'];
  const modeLabels: Record<string, string> = {
    'text-to-video': 'Cinematic',
    'avatar': 'Avatar',
    'motion-transfer': 'Motion',
    'video-to-video': 'Style',
    'b-roll': 'B-Roll',
  };

  if (!data.length) return null;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.35 }}
      className="p-4 rounded-2xl bg-zinc-900/60 border border-white/[0.06] backdrop-blur-xl"
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Mode Usage</h3>
          <p className="text-xs text-zinc-500">Project distribution</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="w-20 h-20">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="mode"
                cx="50%"
                cy="50%"
                innerRadius={20}
                outerRadius={35}
                strokeWidth={0}
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-1">
          {data.slice(0, 4).map((item, i) => (
            <div key={item.mode} className="flex items-center gap-2">
              <div 
                className="w-2 h-2 rounded-full" 
                style={{ background: COLORS[i % COLORS.length] }} 
              />
              <span className="text-xs text-zinc-400">{modeLabels[item.mode] || item.mode}</span>
              <span className="text-xs text-zinc-600 ml-auto">{item.count}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
});
ModeDistributionChart.displayName = 'ModeDistributionChart';

export function RealAnalyticsCards({ analytics, loading }: RealAnalyticsCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-zinc-900/40 border border-white/[0.04] animate-pulse" />
        ))}
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="p-8 text-center rounded-2xl bg-zinc-900/40 border border-white/[0.06]">
        <AlertCircle className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
        <p className="text-sm text-zinc-500">No analytics data available</p>
      </div>
    );
  }

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  return (
    <div className="space-y-3">
      {/* Primary Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <AnalyticsCard 
          icon={FolderOpen}
          label="Total Projects"
          value={analytics.totalProjects}
          subValue={`${analytics.completedProjects} completed`}
          color="violet"
          delay={0}
        />
        <AnalyticsCard 
          icon={Film}
          label="Total Clips"
          value={analytics.totalClips}
          subValue={formatDuration(analytics.totalVideoDuration)}
          color="blue"
          delay={0.05}
        />
        <AnalyticsCard 
          icon={Zap}
          label="Credits Used"
          value={analytics.creditsUsed}
          subValue={`${analytics.creditsThisMonth} this month`}
          color="amber"
          delay={0.1}
        />
        <AnalyticsCard 
          icon={Sparkles}
          label="Balance"
          value={analytics.creditsRemaining}
          subValue="credits available"
          color="emerald"
          delay={0.15}
        />
      </div>

      {/* Secondary Stats + Charts */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <AnalyticsCard 
          icon={CheckCircle2}
          label="Success Rate"
          value={analytics.totalProjects > 0 
            ? `${Math.round((analytics.completedProjects / analytics.totalProjects) * 100)}%` 
            : '—'}
          subValue={`${analytics.failedProjects} failed`}
          color={analytics.failedProjects === 0 ? 'emerald' : 'amber'}
          delay={0.2}
        />
        <AnalyticsCard 
          icon={Heart}
          label="Total Likes"
          value={analytics.totalLikes}
          subValue={`${analytics.publicVideos} public videos`}
          color="rose"
          delay={0.25}
        />
        <ActivityChart data={analytics.weeklyActivity} />
      </div>

      {/* Mode Distribution */}
      {analytics.modeDistribution.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <ModeDistributionChart data={analytics.modeDistribution} />
          <AnalyticsCard 
            icon={Activity}
            label="Processing"
            value={analytics.processingProjects}
            subValue="projects active"
            color="blue"
            delay={0.4}
            className="col-span-1"
          />
        </div>
      )}
    </div>
  );
}
