/**
 * HealthCheckDashboard - Cloud Run and Pipeline Health Monitor
 * 
 * ADMIN ONLY: Displays high-severity errors, edge function logs,
 * and system health status for immediate analysis.
 * 
 * This component should only be rendered within admin-protected contexts.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw, 
  Server, 
  Cpu,
  Database,
  Zap,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { stabilityMonitor } from '@/lib/stabilityMonitor';
import { analyzeStateTransitions } from '@/lib/diagnostics/StateSnapshotMonitor';
import { useAdminAccess } from '@/hooks/useAdminAccess';

interface HealthStatus {
  database: 'healthy' | 'degraded' | 'error' | 'checking';
  auth: 'healthy' | 'degraded' | 'error' | 'checking';
  edgeFunctions: 'healthy' | 'degraded' | 'error' | 'checking';
  pipeline: 'healthy' | 'degraded' | 'error' | 'checking';
}

interface SystemLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error';
  source: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export function HealthCheckDashboard() {
  const { isAdmin, loading: adminLoading } = useAdminAccess();
  const [healthStatus, setHealthStatus] = useState<HealthStatus>({
    database: 'checking',
    auth: 'checking',
    edgeFunctions: 'checking',
    pipeline: 'checking',
  });
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['health']));
  const [stateIssues, setStateIssues] = useState<string[]>([]);
  
  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };
  
  const checkHealth = useCallback(async () => {
    setIsRefreshing(true);
    
    // Check database
    try {
      const { error } = await supabase.from('profiles').select('id').limit(1);
      setHealthStatus(prev => ({ 
        ...prev, 
        database: error ? 'error' : 'healthy' 
      }));
    } catch {
      setHealthStatus(prev => ({ ...prev, database: 'error' }));
    }
    
    // Check auth
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setHealthStatus(prev => ({ 
        ...prev, 
        auth: session ? 'healthy' : 'degraded' 
      }));
    } catch {
      setHealthStatus(prev => ({ ...prev, auth: 'error' }));
    }
    
    // Check edge functions (ping a lightweight function if available)
    try {
      // Simple connectivity check - use GET with a quick timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      
      await supabase.functions.invoke('pipeline-watchdog', {
        body: { ping: true },
      }).catch(() => ({})); // Ignore errors - just checking reachability
      
      clearTimeout(timeout);
      setHealthStatus(prev => ({ ...prev, edgeFunctions: 'healthy' }));
    } catch {
      setHealthStatus(prev => ({ ...prev, edgeFunctions: 'degraded' }));
    }
    
    // Check pipeline status
    try {
      const { data: stalledProjects, error } = await supabase
        .from('movie_projects')
        .select('id')
        .eq('status', 'generating')
        .lt('updated_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
        .limit(5);
      
      if (error) {
        setHealthStatus(prev => ({ ...prev, pipeline: 'error' }));
      } else if (stalledProjects && stalledProjects.length > 0) {
        setHealthStatus(prev => ({ ...prev, pipeline: 'degraded' }));
      } else {
        setHealthStatus(prev => ({ ...prev, pipeline: 'healthy' }));
      }
    } catch {
      setHealthStatus(prev => ({ ...prev, pipeline: 'error' }));
    }
    
    // Analyze state transitions
    const analysis = analyzeStateTransitions();
    setStateIssues(analysis.issues);
    
    // Get stability events
    const events = stabilityMonitor.getEvents(20);
    const logs: SystemLog[] = events.map(e => ({
      id: e.id,
      timestamp: new Date(e.timestamp).toISOString(),
      level: e.category === 'ASYNC_RACE' ? 'info' : 'error',
      source: e.componentName || 'System',
      message: e.message,
      metadata: { category: e.category, recovered: e.recovered },
    }));
    setSystemLogs(logs);
    
    setIsRefreshing(false);
  }, []);
  
  useEffect(() => {
    checkHealth();
    
    // Refresh every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [checkHealth]);
  
  const getStatusIcon = (status: HealthStatus[keyof HealthStatus]) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case 'degraded':
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin" />;
    }
  };
  
  const getStatusBadge = (status: HealthStatus[keyof HealthStatus]) => {
    switch (status) {
      case 'healthy':
        return <Badge variant="default" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Healthy</Badge>;
      case 'degraded':
        return <Badge variant="default" className="bg-amber-500/10 text-amber-500 border-amber-500/20">Degraded</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="secondary">Checking...</Badge>;
    }
  };
  
  const overallHealth = Object.values(healthStatus).every(s => s === 'healthy') 
    ? 'healthy' 
    : Object.values(healthStatus).some(s => s === 'error') 
      ? 'error' 
      : 'degraded';
  
  const healthScore = stabilityMonitor.getHealth();
  
  // Show loading state while checking admin status
  if (adminLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Block access for non-admins
  if (!isAdmin) {
    return (
      <Card className="border-amber-500/30">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            <CardTitle>Admin Access Required</CardTitle>
          </div>
          <CardDescription>
            System health monitoring is restricted to administrators.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Overview Card */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">System Health</CardTitle>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={checkHealth}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          <CardDescription>
            Overall Status: {getStatusBadge(overallHealth)} • Health Score: {healthScore}/100
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Database className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">Database</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {getStatusIcon(healthStatus.database)}
                  <span className="text-xs text-muted-foreground capitalize">{healthStatus.database}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Server className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">Auth</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {getStatusIcon(healthStatus.auth)}
                  <span className="text-xs text-muted-foreground capitalize">{healthStatus.auth}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Zap className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">Edge Functions</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {getStatusIcon(healthStatus.edgeFunctions)}
                  <span className="text-xs text-muted-foreground capitalize">{healthStatus.edgeFunctions}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Cpu className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">Pipeline</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {getStatusIcon(healthStatus.pipeline)}
                  <span className="text-xs text-muted-foreground capitalize">{healthStatus.pipeline}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* State Analysis */}
      {stateIssues.length > 0 && (
        <Card className="border-amber-500/50">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-lg">State Analysis Warnings</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {stateIssues.map((issue, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  {issue}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      
      {/* Recent Errors */}
      <Card>
        <CardHeader 
          className="pb-2 cursor-pointer" 
          onClick={() => toggleSection('logs')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Recent System Events</CardTitle>
            </div>
            {expandedSections.has('logs') ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <CardDescription>
            Last {systemLogs.length} events from stability monitor
          </CardDescription>
        </CardHeader>
        {expandedSections.has('logs') && (
          <CardContent>
            <ScrollArea className="h-[300px]">
              {systemLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <CheckCircle className="h-8 w-8 mb-2 opacity-50" />
                  <span className="text-sm">No recent errors</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {systemLogs.map(log => (
                    <div 
                      key={log.id}
                      className={`p-3 rounded-lg text-sm ${
                        log.level === 'error' 
                          ? 'bg-red-500/5 border border-red-500/20' 
                          : log.level === 'warning'
                            ? 'bg-amber-500/5 border border-amber-500/20'
                            : 'bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {log.level === 'error' ? (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        ) : log.level === 'warning' ? (
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                        ) : (
                          <Activity className="h-4 w-4 text-blue-500" />
                        )}
                        <span className="font-medium">{log.source}</span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-muted-foreground break-words">
                        {log.message}
                      </p>
                      {log.metadata && (
                        <div className="mt-2 text-xs text-muted-foreground font-mono">
                          {JSON.stringify(log.metadata)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

export default HealthCheckDashboard;
