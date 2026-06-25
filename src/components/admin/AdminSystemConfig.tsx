import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Settings,
  AlertTriangle,
  Bell,
  Shield,
  Zap,
  Server,
  RefreshCw,
  Save,
  Eye,
  Wrench,
  Database,
  Cloud,
  Activity,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { FloatSection, DeckButton, StatusPill } from '@/admin/ui/primitives';

interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category: 'core' | 'experimental' | 'beta';
}

interface SystemStatus {
  veoApi: 'operational' | 'degraded' | 'down';
  stitcher: 'operational' | 'degraded' | 'down';
  storage: 'operational' | 'degraded' | 'down';
  database: 'operational' | 'degraded' | 'down';
}

// Feature flags — default values, overridden by DB
const DEFAULT_FEATURE_FLAGS: FeatureFlag[] = [
  { id: 'video_generation', name: 'Video Generation', description: 'Enable video generation pipeline', enabled: true, category: 'core' },
  { id: 'multi_character', name: 'Multi-Character Bible', description: 'Multi-character identity tracking', enabled: true, category: 'core' },
  { id: 'auto_retry', name: 'Auto Retry', description: 'Automatically retry failed clips', enabled: true, category: 'core' },
  { id: 'chunked_stitching', name: 'Chunked Stitching', description: 'Process long videos in chunks', enabled: true, category: 'core' },
  { id: 'character_lending', name: 'Character Lending', description: 'Allow character sharing between users', enabled: false, category: 'beta' },
  { id: 'ai_script_assist', name: 'AI Script Assistant', description: 'AI-powered script improvements', enabled: true, category: 'beta' },
  { id: 'color_grading', name: 'Color Grading', description: 'Advanced color grading options', enabled: false, category: 'experimental' },
  { id: 'audio_quality', name: 'Audio Quality Analysis', description: 'Audio quality metrics for generated clips', enabled: false, category: 'experimental' },
  { id: 'motion_vectors', name: 'Motion Vectors', description: 'Motion vector analysis for transitions', enabled: false, category: 'experimental' },
];

export function AdminSystemConfig() {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [announcementBanner, setAnnouncementBanner] = useState('');
  const [bannerType, setBannerType] = useState<'info' | 'warning' | 'success'>('info');
  const [bannerEnabled, setBannerEnabled] = useState(false);

  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>(DEFAULT_FEATURE_FLAGS);

  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    veoApi: 'operational',
    stitcher: 'operational',
    storage: 'operational',
    database: 'operational',
  });
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusUpdatedAt, setStatusUpdatedAt] = useState<Date | null>(null);

  const [saving, setSaving] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // Load persisted config from DB on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const { data, error } = await supabase
          .from('system_config')
          .select('key, value');

        if (error) throw error;

        (data || []).forEach((row: { key: string; value: any }) => {
          if (row.key === 'maintenance_mode') {
            setMaintenanceMode(row.value?.enabled ?? false);
            setMaintenanceMessage(row.value?.message ?? '');
          } else if (row.key === 'announcement_banner') {
            setBannerEnabled(row.value?.enabled ?? false);
            setAnnouncementBanner(row.value?.message ?? '');
            setBannerType(row.value?.type ?? 'info');
          } else if (row.key === 'feature_flags') {
            // Merge persisted overrides with defaults
            const overrides = row.value || {};
            setFeatureFlags(prev => prev.map(f => ({
              ...f,
              enabled: overrides[f.id] !== undefined ? overrides[f.id] : f.enabled,
            })));
          }
        });
      } catch (err) {
        console.error('Failed to load system config:', err);
      } finally {
        setLoadingConfig(false);
      }
    };
    loadConfig();
  }, []);

  // Compute REAL service health from api_cost_logs (last 60 minutes).
  // Mirrors AdminPipelineMonitor logic so admin sees true uptime, not hardcoded values.
  useEffect(() => {
    let cancelled = false;
    const computeStatus = async () => {
      setStatusLoading(true);
      const sinceIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      // Database health = whether this query itself succeeds
      let databaseStatus: SystemStatus['database'] = 'operational';
      let veoApi: SystemStatus['veoApi'] = 'operational';
      let stitcher: SystemStatus['stitcher'] = 'operational';
      let storage: SystemStatus['storage'] = 'operational';

      const classify = (total: number, failed: number): 'operational' | 'degraded' | 'down' => {
        if (total === 0) return 'operational'; // no traffic = treat as healthy
        const successRate = ((total - failed) / total) * 100;
        if (successRate < 50) return 'down';
        if (successRate < 95) return 'degraded';
        return 'operational';
      };

      try {
        const { data, error } = await supabase
          .from('api_cost_logs')
          .select('service, status')
          .gte('created_at', sinceIso);

        if (error) {
          databaseStatus = 'degraded';
        } else {
          const buckets: Record<string, { total: number; failed: number }> = {
            video: { total: 0, failed: 0 },
            stitch: { total: 0, failed: 0 },
            storage: { total: 0, failed: 0 },
          };
          (data || []).forEach((row: any) => {
            const svc = String(row.service || '').toLowerCase();
            // map service names to our 3 buckets
            let bucket: keyof typeof buckets | null = null;
            if (svc.includes('kling') || svc.includes('veo') || svc.includes('replicate') || svc === 'video') bucket = 'video';
            else if (svc.includes('stitch') || svc.includes('ffmpeg')) bucket = 'stitch';
            else if (svc.includes('storage') || svc.includes('upload')) bucket = 'storage';
            if (!bucket) return;
            buckets[bucket].total += 1;
            if (row.status === 'failed' || row.status === 'error') buckets[bucket].failed += 1;
          });
          veoApi = classify(buckets.video.total, buckets.video.failed);
          storage = classify(buckets.storage.total, buckets.storage.failed);
        }
      } catch {
        databaseStatus = 'down';
      }

      // Stitcher health comes from the stitch_jobs table — stitch work is never
      // written to api_cost_logs (it lives in its own table), so the old
      // api_cost_logs "stitch" bucket was always empty and the tile was
      // permanently green. Classify from the real jobs in the last 60m.
      try {
        const { data: sj } = await supabase
          .from('stitch_jobs')
          .select('status')
          .gte('created_at', sinceIso);
        const total = (sj || []).length;
        const failed = (sj || []).filter((j: any) => j.status === 'failed' || j.status === 'error').length;
        stitcher = classify(total, failed);
      } catch { /* keep operational if the table is unreachable */ }

      if (cancelled) return;
      setSystemStatus({ veoApi, stitcher, storage, database: databaseStatus });
      setStatusUpdatedAt(new Date());
      setStatusLoading(false);
    };

    computeStatus();
    const interval = setInterval(computeStatus, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const toggleFeatureFlag = (flagId: string) => {
    setFeatureFlags(flags =>
      flags.map(f => f.id === flagId ? { ...f, enabled: !f.enabled } : f)
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Persist maintenance mode
      await supabase
        .from('system_config')
        .upsert({
          key: 'maintenance_mode',
          value: { enabled: maintenanceMode, message: maintenanceMessage },
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });

      // Persist announcement banner
      await supabase
        .from('system_config')
        .upsert({
          key: 'announcement_banner',
          value: { enabled: bannerEnabled, message: announcementBanner, type: bannerType },
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });

      // Persist feature flags as override map
      const flagOverrides: Record<string, boolean> = {};
      featureFlags.forEach(f => { flagOverrides[f.id] = f.enabled; });
      await supabase
        .from('system_config')
        .upsert({
          key: 'feature_flags',
          value: flagOverrides,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });

      toast.success('Configuration saved successfully');
    } catch (err) {
      console.error('Failed to save configuration:', err);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const getStatusTone = (status: 'operational' | 'degraded' | 'down') => {
    switch (status) {
      case 'operational': return 'positive' as const;
      case 'degraded': return 'warn' as const;
      case 'down': return 'danger' as const;
    }
  };

  const getCategoryTone = (category: FeatureFlag['category']) => {
    switch (category) {
      case 'core': return 'accent' as const;
      case 'beta': return 'accent' as const;
      case 'experimental': return 'warn' as const;
    }
  };

  const renderFlagRow = (flag: FeatureFlag) => (
    <div key={flag.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03]">
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="font-medium text-[13px] text-white">{flag.name}</span>
          <StatusPill tone={getCategoryTone(flag.category)}>{flag.category}</StatusPill>
        </div>
        <p className="text-xs text-white/45">{flag.description}</p>
      </div>
      <Switch
        checked={flag.enabled}
        onCheckedChange={() => toggleFeatureFlag(flag.id)}
      />
    </div>
  );

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-[17px] font-semibold tracking-tight text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-white/60" />
            System Configuration
          </h2>
          <p className="text-[13px] text-white/55">
            Manage feature flags, maintenance mode, and system settings
          </p>
        </div>
        <DeckButton primary onClick={handleSave} disabled={saving}>
          {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-2" /> : <Save className="w-3.5 h-3.5 mr-2" />}
          Save Changes
        </DeckButton>
      </div>

      {/* System Status */}
      <FloatSection
        title="System Status"
        meta={`live · last 60m${statusUpdatedAt ? ` · updated ${statusUpdatedAt.toLocaleTimeString()}` : ''}`}
        actions={statusLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-white/40" /> : undefined}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03]">
            <div className="flex items-center gap-2">
              <Cloud className="w-4 h-4 text-white/40" />
              <span className="text-[13px] text-white/70">Veo API</span>
            </div>
            <StatusPill tone={getStatusTone(systemStatus.veoApi)}>{systemStatus.veoApi}</StatusPill>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03]">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-white/40" />
              <span className="text-[13px] text-white/70">Stitcher</span>
            </div>
            <StatusPill tone={getStatusTone(systemStatus.stitcher)}>{systemStatus.stitcher}</StatusPill>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03]">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-white/40" />
              <span className="text-[13px] text-white/70">Database</span>
            </div>
            <StatusPill tone={getStatusTone(systemStatus.database)}>{systemStatus.database}</StatusPill>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03]">
            <div className="flex items-center gap-2">
              <Cloud className="w-4 h-4 text-white/40" />
              <span className="text-[13px] text-white/70">Storage</span>
            </div>
            <StatusPill tone={getStatusTone(systemStatus.storage)}>{systemStatus.storage}</StatusPill>
          </div>
        </div>
      </FloatSection>

      {/* Maintenance Mode */}
      <FloatSection title="Maintenance Mode" meta={maintenanceMode ? 'active' : undefined}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Maintenance Mode</Label>
              <p className="text-xs text-white/45">
                When enabled, users cannot start new video generations
              </p>
            </div>
            <Switch
              checked={maintenanceMode}
              onCheckedChange={setMaintenanceMode}
            />
          </div>

          {maintenanceMode && (
            <div className="space-y-2">
              <Label htmlFor="maintenance-message">Maintenance Message</Label>
              <Textarea
                id="maintenance-message"
                value={maintenanceMessage}
                onChange={(e) => setMaintenanceMessage(e.target.value)}
                placeholder="We're performing scheduled maintenance. Video generation will be back shortly."
                rows={3}
              />
            </div>
          )}
        </div>
      </FloatSection>

      {/* Announcement Banner */}
      <FloatSection title="Announcement Banner">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Show Banner</Label>
              <p className="text-xs text-white/45">
                Display announcement banner across the app
              </p>
            </div>
            <Switch
              checked={bannerEnabled}
              onCheckedChange={setBannerEnabled}
            />
          </div>

          {bannerEnabled && (
            <>
              <div className="space-y-2">
                <Label>Banner Type</Label>
                <Select value={bannerType} onValueChange={(v: 'info' | 'warning' | 'success') => setBannerType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">
                      <div className="flex items-center gap-2">
                        <Info className="w-4 h-4" />
                        Info
                      </div>
                    </SelectItem>
                    <SelectItem value="warning">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Warning
                      </div>
                    </SelectItem>
                    <SelectItem value="success">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        Success
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="banner-message">Banner Message</Label>
                <Input
                  id="banner-message"
                  value={announcementBanner}
                  onChange={(e) => setAnnouncementBanner(e.target.value)}
                  placeholder="🎉 New feature: Multi-character support is now live!"
                />
              </div>

              {/* Preview */}
              {announcementBanner && (
                <div className="p-3 rounded-lg text-[13px] bg-white/[0.03]">
                  <p className="font-medium text-white/60 text-xs uppercase tracking-wide">Preview</p>
                  <p className="mt-1 text-white/80">{announcementBanner}</p>
                </div>
              )}
            </>
          )}
        </div>
      </FloatSection>

      {/* Feature Flags */}
      <FloatSection title="Feature Flags" meta="enable / disable">
        <div className="space-y-6">
          {/* Core Features */}
          <div className="space-y-3">
            <h4 className="text-[13px] font-medium text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-white/50" />
              Core Features
            </h4>
            <div className="grid gap-3">
              {featureFlags.filter(f => f.category === 'core').map(renderFlagRow)}
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

          {/* Beta Features */}
          <div className="space-y-3">
            <h4 className="text-[13px] font-medium text-white flex items-center gap-2">
              <Eye className="w-4 h-4 text-white/50" />
              Beta Features
            </h4>
            <div className="grid gap-3">
              {featureFlags.filter(f => f.category === 'beta').map(renderFlagRow)}
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

          {/* Experimental Features */}
          <div className="space-y-3">
            <h4 className="text-[13px] font-medium text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" style={{ color: 'hsl(38 96% 62%)' }} />
              Experimental Features
            </h4>
            <div className="grid gap-3">
              {featureFlags.filter(f => f.category === 'experimental').map(renderFlagRow)}
            </div>
          </div>
        </div>
      </FloatSection>

      {/* Info */}
      <div className="flex items-start gap-3">
        <Info className="w-5 h-5 text-white/50 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-white">Configuration Notes</p>
          <ul className="text-[13px] text-white/55 mt-2 space-y-1">
            <li>• Feature flags take effect immediately after saving</li>
            <li>• Maintenance mode blocks new generations but allows existing ones to complete</li>
            <li>• Announcement banners are shown to all authenticated users</li>
            <li>• System status is updated automatically based on API health checks</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
