/**
 * StateSnapshotMonitor - Auth and Navigation State Tracker
 * 
 * Tracks exactly which state variables are active at the moment
 * of a crash, helping to isolate 'kick-back to login' loops.
 */

import { StateSnapshot } from './DiagnosticsLogger';

// Singleton state store
let currentAuthState: StateSnapshot['auth'] | null = null;
let currentNavigationState: StateSnapshot['navigation'] | null = null;
let stateHistory: Array<{
  snapshot: StateSnapshot;
  timestamp: number;
  trigger: string;
}> = [];

const MAX_HISTORY = 50;

/**
 * Update auth state snapshot
 */
export function updateAuthState(state: StateSnapshot['auth'], trigger: string = 'update'): void {
  currentAuthState = state;
  recordSnapshot(trigger);
}

/**
 * Update navigation state snapshot
 */
export function updateNavigationState(state: StateSnapshot['navigation'], trigger: string = 'update'): void {
  currentNavigationState = state;
  recordSnapshot(trigger);
}

/**
 * Record current state to history
 */
function recordSnapshot(trigger: string): void {
  const snapshot: StateSnapshot = {
    auth: currentAuthState || undefined,
    navigation: currentNavigationState || undefined,
    timestamp: Date.now(),
  };
  
  stateHistory.push({
    snapshot,
    timestamp: Date.now(),
    trigger,
  });
  
  // Cap history
  while (stateHistory.length > MAX_HISTORY) {
    stateHistory.shift();
  }
}

/**
 * Get current state snapshot
 */
export function getCurrentSnapshot(): StateSnapshot {
  return {
    auth: currentAuthState || undefined,
    navigation: currentNavigationState || undefined,
    timestamp: Date.now(),
  };
}

/**
 * Get state history (for debugging)
 */
export function getStateHistory(): typeof stateHistory {
  return [...stateHistory];
}

/**
 * Analyze state transitions for potential issues
 */
export function analyzeStateTransitions(): {
  rapidAuthChanges: boolean;
  navigationLoops: boolean;
  loginKickbacks: number;
  issues: string[];
} {
  const issues: string[] = [];
  const recentHistory = stateHistory.slice(-20);
  
  // Check for rapid auth state changes (potential loop)
  const authChanges = recentHistory.filter(h => 
    h.trigger.includes('auth') || h.trigger.includes('session')
  );
  const rapidAuthChanges = authChanges.length > 5;
  if (rapidAuthChanges) {
    issues.push(`Rapid auth state changes detected (${authChanges.length} in recent history)`);
  }
  
  // Check for navigation loops
  const navChanges = recentHistory.filter(h => 
    h.trigger.includes('navigation') || h.trigger.includes('route')
  );
  const uniqueRoutes = new Set(navChanges.map(n => n.snapshot.navigation?.currentRoute));
  const navigationLoops = navChanges.length > 5 && uniqueRoutes.size <= 2;
  if (navigationLoops) {
    issues.push(`Navigation loop detected between routes: ${Array.from(uniqueRoutes).join(', ')}`);
  }
  
  // Check for login kickbacks (user -> no user patterns)
  let loginKickbacks = 0;
  for (let i = 1; i < recentHistory.length; i++) {
    const prev = recentHistory[i - 1].snapshot.auth;
    const curr = recentHistory[i].snapshot.auth;
    
    if (prev?.user && !curr?.user) {
      loginKickbacks++;
    }
  }
  if (loginKickbacks > 0) {
    issues.push(`Login kickback events detected: ${loginKickbacks}`);
  }
  
  return {
    rapidAuthChanges,
    navigationLoops,
    loginKickbacks,
    issues,
  };
}

/**
 * Clear state history
 */
export function clearStateHistory(): void {
  stateHistory = [];
}

/**
 * Format state history for export
 */
export function formatStateHistory(): string {
  return stateHistory
    .map(h => {
      const time = new Date(h.timestamp).toLocaleTimeString();
      return `${time} [${h.trigger}]\n  ${JSON.stringify(h.snapshot, null, 2)}`;
    })
    .join('\n\n');
}

export const stateSnapshotMonitor = {
  updateAuth: updateAuthState,
  updateNavigation: updateNavigationState,
  getCurrent: getCurrentSnapshot,
  getHistory: getStateHistory,
  analyze: analyzeStateTransitions,
  clear: clearStateHistory,
  format: formatStateHistory,
};
