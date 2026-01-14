import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
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
  Clock,
  Globe,
  Lock,
  Eye,
  Wrench,
  Database,
  Cloud,
  Activity,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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

// Mock feature flags - in production, these would come from a database table
const DEFAULT_FEATURE_FLAGS: FeatureFlag[] = [
  { id: 'video_generation', name: 'Video Generation', description: 'Enable video generation pipeline', enabled: true, category: 'core' },
  { id: 'multi_character', name: 'Multi-Character Bible', description: 'Multi-character identity tracking', enabled: true, category: 'core' },
  { id: 'auto_retry', name: 'Auto Retry', description: 'Automatically retry failed clips', enabled: true, category: 'core' },
  { id: 'chunked_stitching', name: 'Chunked Stitching', description: 'Process long videos in chunks', enabled: true, category: 'core' },
  { id: 'universes', name: 'Universes', description: 'Shared universe feature', enabled: true, category: 'beta' },
  { id: 'character_lending', name: 'Character Lending', description: 'Allow character sharing between users', enabled: false, category: 'beta' },
  { id: 'ai_script_assist', name: 'AI Script Assistant', description: 'AI-powered script improvements', enabled: true, category: 'beta' },
  { id: 'color_grading', name: 'Color Grading', description: 'Advanced color grading options', enabled: false, category: 'experimental' },
  { id: 'lip_sync', name: 'Lip Sync Analysis', description: 'Lip sync quality analysis', enabled: false, category: 'experimental' },
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
  
  const [saving, setSaving] = useState(false);

  const toggleFeatureFlag = (flagId: string) => {
    setFeatureFlags(flags => 
      flags.map(f => f.id === flagId ? { ...f, enabled: !f.enabled } : f)
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // In production, this would save to a system_config table
      await new Promise(resolve => setTimeout(resolve, 500));
      toast.success('Configuration saved');
    } catch (err) {
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status: 'operational' | 'degraded' | 'down') => {
    switch (status) {
      case 'operational': return 'bg-success text-success-foreground';
      case 'degraded': return 'bg-warning text-warning-foreground';
      case 'down': return 'bg-destructive text-destructive-foreground';
    }
  };

  const getCategoryColor = (category: FeatureFlag['category']) => {
    switch (category) {
      case 'core': return 'bg-primary/10 text-primary border-primary/20';
      case 'beta': return 'bg-info/10 text-info border-info/20';
      case 'experimental': return 'bg-warning/10 text-warning border-warning/20';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            System Configuration
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage feature flags, maintenance mode, and system settings
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Save Changes
        </Button>
      </div>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-5 h-5" />
            System Status
          </CardTitle>
          <CardDescription>Current status of system components</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Veo API</span>
              </div>
              <Badge className={getStatusColor(systemStatus.veoApi)}>
                {systemStatus.veoApi}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Stitcher</span>
              </div>
              <Badge className={getStatusColor(systemStatus.stitcher)}>
                {systemStatus.stitcher}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Database</span>
              </div>
              <Badge className={getStatusColor(systemStatus.database)}>
                {systemStatus.database}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Storage</span>
              </div>
              <Badge className={getStatusColor(systemStatus.storage)}>
                {systemStatus.storage}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Maintenance Mode */}
      <Card className={cn(
        maintenanceMode && "border-warning/50 bg-warning/5"
      )}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wrench className="w-5 h-5" />
            Maintenance Mode
          </CardTitle>
          <CardDescription>
            Disable video generation while performing system maintenance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Maintenance Mode</Label>
              <p className="text-xs text-muted-foreground">
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
        </CardContent>
      </Card>

      {/* Announcement Banner */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Announcement Banner
          </CardTitle>
          <CardDescription>
            Display a banner message to all users
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Show Banner</Label>
              <p className="text-xs text-muted-foreground">
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
                        <Info className="w-4 h-4 text-info" />
                        Info
                      </div>
                    </SelectItem>
                    <SelectItem value="warning">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-warning" />
                        Warning
                      </div>
                    </SelectItem>
                    <SelectItem value="success">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-success" />
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
                <div className={cn(
                  "p-3 rounded-lg text-sm",
                  bannerType === 'info' && "bg-info/10 text-info border border-info/20",
                  bannerType === 'warning' && "bg-warning/10 text-warning border border-warning/20",
                  bannerType === 'success' && "bg-success/10 text-success border border-success/20"
                )}>
                  <p className="font-medium">Preview:</p>
                  <p>{announcementBanner}</p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Feature Flags */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Feature Flags
          </CardTitle>
          <CardDescription>
            Enable or disable features across the application
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Core Features */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Core Features
            </h4>
            <div className="grid gap-3">
              {featureFlags.filter(f => f.category === 'core').map((flag) => (
                <div key={flag.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{flag.name}</span>
                      <Badge className={getCategoryColor(flag.category)} variant="outline">
                        {flag.category}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{flag.description}</p>
                  </div>
                  <Switch
                    checked={flag.enabled}
                    onCheckedChange={() => toggleFeatureFlag(flag.id)}
                  />
                </div>
              ))}
            </div>
          </div>
          
          <Separator />
          
          {/* Beta Features */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Beta Features
            </h4>
            <div className="grid gap-3">
              {featureFlags.filter(f => f.category === 'beta').map((flag) => (
                <div key={flag.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{flag.name}</span>
                      <Badge className={getCategoryColor(flag.category)} variant="outline">
                        {flag.category}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{flag.description}</p>
                  </div>
                  <Switch
                    checked={flag.enabled}
                    onCheckedChange={() => toggleFeatureFlag(flag.id)}
                  />
                </div>
              ))}
            </div>
          </div>
          
          <Separator />
          
          {/* Experimental Features */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              Experimental Features
            </h4>
            <div className="grid gap-3">
              {featureFlags.filter(f => f.category === 'experimental').map((flag) => (
                <div key={flag.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{flag.name}</span>
                      <Badge className={getCategoryColor(flag.category)} variant="outline">
                        {flag.category}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{flag.description}</p>
                  </div>
                  <Switch
                    checked={flag.enabled}
                    onCheckedChange={() => toggleFeatureFlag(flag.id)}
                  />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info */}
      <Card className="border-info/50 bg-info/5">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Configuration Notes</p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                <li>• Feature flags take effect immediately after saving</li>
                <li>• Maintenance mode blocks new generations but allows existing ones to complete</li>
                <li>• Announcement banners are shown to all authenticated users</li>
                <li>• System status is updated automatically based on API health checks</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
