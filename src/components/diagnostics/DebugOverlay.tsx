/**
 * DebugOverlay - Development-only diagnostic overlay
 * 
 * Displays real-time console errors, state snapshots,
 * and critical failures before the preview reloads.
 * 
 * Toggle with Ctrl+Shift+D (Cmd+Shift+D on Mac)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, AlertTriangle, AlertCircle, Info, Bug, Trash2, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { 
  DiagnosticEntry, 
  subscribeToDiagnostics, 
  clearDiagnostics,
  getDiagnosticEntries,
} from '@/lib/diagnostics/DiagnosticsLogger';

interface DebugOverlayProps {
  position?: 'top-right' | 'bottom-right' | 'bottom-left' | 'top-left';
}

export function DebugOverlay({ position = 'bottom-right' }: DebugOverlayProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [entries, setEntries] = useState<DiagnosticEntry[]>([]);
  const [filter, setFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all');
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Keyboard shortcut to toggle
  useEffect(() => {
    if (!isDevelopment) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setIsVisible(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDevelopment]);
  
  // Subscribe to diagnostics
  useEffect(() => {
    if (!isDevelopment) return;
    
    const unsubscribe = subscribeToDiagnostics(setEntries);
    return unsubscribe;
  }, [isDevelopment]);
  
  // Auto-scroll to bottom on new entries
  useEffect(() => {
    if (scrollRef.current && isVisible && !isMinimized) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries, isVisible, isMinimized]);
  
  // Auto-scroll to bottom on new entries
  useEffect(() => {
    if (scrollRef.current && isVisible && !isMinimized) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries, isVisible, isMinimized]);
  const filteredEntries = entries.filter(entry => {
    if (filter === 'all') return true;
    return entry.severity === filter;
  });
  
  const errorCount = entries.filter(e => e.severity === 'error').length;
  const warningCount = entries.filter(e => e.severity === 'warning').length;
  
  // Move all hooks before conditional return
  const handleExport = useCallback(() => {
    const data = JSON.stringify(getDiagnosticEntries(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagnostics-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);
  
  // Return null for production (after all hooks)
  if (!isDevelopment) {
    return null;
  }
  
  const getSeverityIcon = (severity: DiagnosticEntry['severity']) => {
    switch (severity) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };
  
  const getSeverityClass = (severity: DiagnosticEntry['severity']) => {
    switch (severity) {
      case 'error':
        return 'border-l-red-500 bg-red-500/5';
      case 'warning':
        return 'border-l-amber-500 bg-amber-500/5';
      default:
        return 'border-l-blue-500 bg-blue-500/5';
    }
  };
  
  const positionClasses = {
    'top-right': 'top-4 right-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-left': 'top-4 left-4',
  };
  
  // Floating indicator button when hidden
  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className={`fixed ${positionClasses[position]} z-[9999] flex items-center gap-2 rounded-full bg-zinc-900 px-3 py-2 text-xs text-zinc-300 shadow-lg border border-zinc-700 hover:bg-zinc-800 transition-colors`}
      >
        <Bug className="h-4 w-4" />
        <span>Debug</span>
        {errorCount > 0 && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold">
            {errorCount}
          </span>
        )}
        {warningCount > 0 && errorCount === 0 && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-white text-xs font-bold">
            {warningCount}
          </span>
        )}
      </button>
    );
  }
  
  return (
    <div
      className={`fixed ${positionClasses[position]} z-[9999] flex flex-col bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl overflow-hidden transition-all duration-200`}
      style={{ 
        width: isMinimized ? '240px' : '480px', 
        maxHeight: isMinimized ? '48px' : '400px' 
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between bg-zinc-800 px-3 py-2 border-b border-zinc-700">
        <div className="flex items-center gap-2">
          <Bug className="h-4 w-4 text-emerald-500" />
          <span className="text-sm font-medium text-zinc-200">Diagnostics</span>
          {errorCount > 0 && (
            <span className="flex h-5 px-1.5 items-center justify-center rounded bg-red-500/20 text-red-400 text-xs font-medium">
              {errorCount} errors
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(prev => !prev)}
            className="p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-zinc-200"
          >
            {isMinimized ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <button
            onClick={handleExport}
            className="p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-zinc-200"
            title="Export logs"
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            onClick={clearDiagnostics}
            className="p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-zinc-200"
            title="Clear logs"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setIsVisible(false)}
            className="p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      
      {!isMinimized && (
        <>
          {/* Filters */}
          <div className="flex gap-1 p-2 bg-zinc-850 border-b border-zinc-700">
            {(['all', 'error', 'warning', 'info'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  filter === f 
                    ? 'bg-zinc-700 text-zinc-100' 
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          
          {/* Entries */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-2 space-y-1"
            style={{ maxHeight: '300px' }}
          >
            {filteredEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-zinc-500">
                <Bug className="h-8 w-8 mb-2 opacity-50" />
                <span className="text-sm">No diagnostics yet</span>
                <span className="text-xs mt-1 opacity-75">Errors will appear here</span>
              </div>
            ) : (
              filteredEntries.map(entry => (
                <DiagnosticEntryRow key={entry.id} entry={entry} />
              ))
            )}
          </div>
          
          {/* Footer */}
          <div className="px-3 py-1.5 bg-zinc-800 border-t border-zinc-700 text-xs text-zinc-500">
            Press <kbd className="px-1 py-0.5 bg-zinc-700 rounded text-zinc-300">Ctrl+Shift+D</kbd> to toggle
          </div>
        </>
      )}
    </div>
  );
}

function DiagnosticEntryRow({ entry }: { entry: DiagnosticEntry }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const time = new Date(entry.timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  
  const getSeverityIcon = (severity: DiagnosticEntry['severity']) => {
    switch (severity) {
      case 'error':
        return <AlertCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />;
      case 'warning':
        return <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />;
      default:
        return <Info className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />;
    }
  };
  
  const getSeverityClass = (severity: DiagnosticEntry['severity']) => {
    switch (severity) {
      case 'error':
        return 'border-l-red-500';
      case 'warning':
        return 'border-l-amber-500';
      default:
        return 'border-l-blue-500';
    }
  };
  
  return (
    <div 
      className={`border-l-2 ${getSeverityClass(entry.severity)} bg-zinc-800/50 rounded-r text-xs overflow-hidden`}
    >
      <button
        onClick={() => setIsExpanded(prev => !prev)}
        className="w-full flex items-start gap-2 p-2 text-left hover:bg-zinc-800/80 transition-colors"
      >
        {getSeverityIcon(entry.severity)}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-zinc-500 font-mono">{time}</span>
            <span className="px-1.5 py-0.5 bg-zinc-700 rounded text-zinc-400">
              {entry.source}
            </span>
          </div>
          <p className="text-zinc-200 mt-1 break-words line-clamp-2">
            {entry.message}
          </p>
        </div>
        <ChevronDown 
          className={`h-4 w-4 text-zinc-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>
      
      {isExpanded && (
        <div className="px-2 pb-2 pt-0 space-y-2">
          {entry.stateSnapshot && (
            <div className="bg-zinc-900 rounded p-2">
              <span className="text-zinc-500 font-medium">State Snapshot:</span>
              <pre className="text-zinc-400 mt-1 text-[10px] overflow-x-auto">
                {JSON.stringify(entry.stateSnapshot, null, 2)}
              </pre>
            </div>
          )}
          
          {entry.stack && (
            <div className="bg-zinc-900 rounded p-2">
              <span className="text-zinc-500 font-medium">Stack Trace:</span>
              <pre className="text-zinc-400 mt-1 text-[10px] overflow-x-auto whitespace-pre-wrap break-all">
                {entry.stack.split('\n').slice(0, 5).join('\n')}
              </pre>
            </div>
          )}
          
          {entry.metadata && (
            <div className="bg-zinc-900 rounded p-2">
              <span className="text-zinc-500 font-medium">Metadata:</span>
              <pre className="text-zinc-400 mt-1 text-[10px] overflow-x-auto">
                {JSON.stringify(entry.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DebugOverlay;
