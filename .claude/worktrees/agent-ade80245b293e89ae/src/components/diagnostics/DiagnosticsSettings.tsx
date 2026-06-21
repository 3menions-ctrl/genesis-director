/**
 * DiagnosticsSettings - Developer diagnostics panel for Settings page
 * 
 * ADMIN ONLY: This component displays sensitive system health and debug information.
 * Access is restricted to users with the 'admin' role in user_roles table.
 */

import React, { useState } from 'react';
import { Bug, Activity, Download, Trash2, ShieldAlert, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HealthCheckDashboard } from './HealthCheckDashboard';
import { getDiagnosticEntries, clearDiagnostics } from '@/lib/diagnostics/DiagnosticsLogger';
import { formatStateHistory, clearStateHistory } from '@/lib/diagnostics/StateSnapshotMonitor';
import { stabilityMonitor } from '@/lib/stabilityMonitor';
import { useAdminAccess } from '@/hooks/useAdminAccess';

export function DiagnosticsSettings() {
  const { isAdmin, loading: adminLoading } = useAdminAccess();
  const [showDashboard, setShowDashboard] = useState(false);
  
  const handleExportAll = () => {
    const data = {
      diagnosticEntries: getDiagnosticEntries(),
      stateHistory: formatStateHistory(),
      stabilityEvents: stabilityMonitor.getEvents(50),
      healthScore: stabilityMonitor.getHealth(),
      exportedAt: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system-diagnostics-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  const handleClearAll = () => {
    clearDiagnostics();
    clearStateHistory();
  };

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
            System diagnostics and health monitoring data are restricted to administrators only.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
  
  const healthScore = stabilityMonitor.getHealth();
  const diagnosticCount = getDiagnosticEntries().length;
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bug className="h-5 w-5 text-primary" />
              <CardTitle>System Diagnostics</CardTitle>
              <Badge variant="outline" className="ml-2 text-xs">Admin Only</Badge>
            </div>
            <Badge variant={healthScore >= 80 ? 'default' : healthScore >= 50 ? 'secondary' : 'destructive'}>
              Health: {healthScore}/100
            </Badge>
          </div>
          <CardDescription>
            Development tools for debugging and monitoring system health
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowDashboard(prev => !prev)}
            >
              <Activity className="h-4 w-4 mr-2" />
              {showDashboard ? 'Hide Dashboard' : 'Show Dashboard'}
            </Button>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleExportAll}
            >
              <Download className="h-4 w-4 mr-2" />
              Export All ({diagnosticCount} events)
            </Button>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleClearAll}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear History
            </Button>
          </div>
          
          <div className="text-sm text-muted-foreground">
            <p>
              <strong>Keyboard shortcut:</strong> Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-foreground">Ctrl+Shift+D</kbd> to toggle the Debug Overlay anywhere in the app.
            </p>
          </div>
        </CardContent>
      </Card>
      
      {showDashboard && <HealthCheckDashboard />}
    </div>
  );
}

export default DiagnosticsSettings;
