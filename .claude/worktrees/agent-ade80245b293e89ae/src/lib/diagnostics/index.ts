/**
 * Diagnostics Module - Centralized exports
 */

export type {
  DiagnosticEntry,
  DiagnosticSeverity,
  StateSnapshot,
} from './DiagnosticsLogger';

export {
  addDiagnosticEntry,
  logDiagnosticError,
  getDiagnosticEntries,
  getEntriesBySeverity,
  getEntriesBySource,
  clearDiagnostics,
  subscribeToDiagnostics,
  setStateSnapshotProvider,
  initializeDiagnostics,
  formatDiagnosticEntry,
  diagnosticsLogger,
} from './DiagnosticsLogger';

export {
  updateAuthState,
  updateNavigationState,
  getCurrentSnapshot,
  getStateHistory,
  analyzeStateTransitions,
  clearStateHistory,
  formatStateHistory,
  stateSnapshotMonitor,
} from './StateSnapshotMonitor';
