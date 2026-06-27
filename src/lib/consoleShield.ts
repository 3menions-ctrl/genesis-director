/**
 * Console Shield — Production Console Protection
 *
 * Prevents sensitive app internals from leaking via browser DevTools console.
 * - Wraps all console methods to redact sensitive patterns (tokens, keys, user IDs)
 * - Suppresses internal debug logs from libraries in production
 * - Shows a deterrent warning when DevTools are opened
 * - Clears console periodically to reduce data exposure window
 *
 * This is a defence-in-depth layer. Real secrets live server-side.
 */

// Patterns that indicate sensitive data — these get redacted
const SENSITIVE_PATTERNS = [
  // JWTs and auth tokens (high priority — always redact)
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  // Supabase URLs (prevent endpoint discovery)
  /https?:\/\/[a-z0-9]+\.supabase\.co[^\s"]*/gi,
  // API keys (generic patterns)
  /(?:api[_-]?key|apikey|secret|token|password|authorization)['":\s]*[=:]\s*['"][^'"]{8,}['"]/gi,
  // Bearer tokens in headers
  /Bearer\s+[A-Za-z0-9._~+/=-]{20,}/gi,
  // Email addresses
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  // NOTE: UUIDs intentionally NOT redacted — they are not secrets and
  // redacting them destroys debugging ability for admins and support.
];

// Internal log prefixes to suppress entirely in production
const SUPPRESSED_PREFIXES = [
  '[Boot]',
  '[SAFE MODE]',
  '[BrowserCompat]',
  '[Global]',
  '[MasterClock]',
  '[AtomicToggle]',
  '[AtomicFrameSwitchEngine]',
  '[LookAheadBuffer]',
  '[BrandedVideoPlayer]',
  '[Thumbnails]',
  '[Pipeline]',
  '[Watchdog]',
  '[SecurityGuard]',
  '[StabilityMonitor]',
  '[Diagnostics]',
  '[CrashForensics]',
  '[ChunkRecovery]',
  '[HLS]',
  '[SW]',
  '[Auth]',
  '[Credits]',
  '[Realtime]',
];

function redactSensitiveData(value: unknown): unknown {
  if (typeof value === 'string') {
    let redacted = value;
    for (const pattern of SENSITIVE_PATTERNS) {
      // Reset lastIndex for global regex
      pattern.lastIndex = 0;
      redacted = redacted.replace(pattern, '[REDACTED]');
    }
    return redacted;
  }
  if (value instanceof Error) {
    const redactedError = new Error(redactSensitiveData(value.message) as string);
    redactedError.name = value.name;
    // Don't expose stack traces in production
    redactedError.stack = '';
    return redactedError;
  }
  if (typeof value === 'object' && value !== null) {
    try {
      const str = JSON.stringify(value);
      return JSON.parse(redactSensitiveData(str) as string);
    } catch {
      return '[Object]';
    }
  }
  return value;
}

function shouldSuppressInternalLog(args: unknown[]): boolean {
  const firstArg = args[0];
  if (typeof firstArg !== 'string') return false;
  return SUPPRESSED_PREFIXES.some(prefix => firstArg.includes(prefix));
}

/**
 * Install the console shield. Call once at app boot in production.
 * Returns a cleanup function to restore original console methods.
 */
export function installConsoleShield(): () => void {
  // Only activate in production
  if (
    typeof window === 'undefined' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  ) {
    return () => {};
  }

  const originalLog = console.log.bind(console);
  const originalInfo = console.info.bind(console);
  const originalWarn = console.warn.bind(console);
  const originalError = console.error.bind(console);
  const originalDebug = console.debug.bind(console);
  const originalTrace = console.trace.bind(console);
  const originalTable = console.table.bind(console);
  const originalDir = console.dir.bind(console);
  const originalGroup = console.group.bind(console);
  const originalGroupCollapsed = console.groupCollapsed.bind(console);

  // Create wrapped console methods that redact sensitive data
  const createShieldedMethod = (
    original: (...args: unknown[]) => void,
    level: 'log' | 'info' | 'warn' | 'error' | 'debug'
  ) => {
    return (...args: unknown[]) => {
      // Suppress internal debug logs entirely
      if (level !== 'error' && shouldSuppressInternalLog(args)) {
        return;
      }
      // Redact sensitive data from all output
      const redactedArgs = args.map(redactSensitiveData);
      original(...redactedArgs);
    };
  };

  console.log = createShieldedMethod(originalLog, 'log');
  console.info = createShieldedMethod(originalInfo, 'info');
  console.warn = createShieldedMethod(originalWarn, 'warn');
  console.error = createShieldedMethod(originalError, 'error');
  console.debug = createShieldedMethod(originalDebug, 'debug');

  // Suppress trace entirely — it exposes call stacks
  console.trace = () => {};

  // Suppress table — it can expose data structures
  console.table = (...args: unknown[]) => {
    originalLog('[Data table suppressed in production]');
  };

  // Suppress dir — it exposes object internals
  console.dir = () => {};

  // Groups are fine but redact their labels
  console.group = (...args: unknown[]) => {
    originalGroup(...args.map(redactSensitiveData));
  };
  console.groupCollapsed = (...args: unknown[]) => {
    originalGroupCollapsed(...args.map(redactSensitiveData));
  };

  // Show deterrent warning
  showDeterrentWarning(originalLog);

  // NOTE: Periodic console.clear() REMOVED — it destroys error evidence
  // that users and support staff need for bug reports. The redaction layer
  // already prevents sensitive data exposure without destroying logs.

  // Detect DevTools opening via a window-dimension heuristic. The previous
  // implementation force-triggered an Image getter every tick (`void el.id`),
  // so console.clear() fired on EVERY interval regardless of DevTools state —
  // destroying error evidence support needs. We now only clear on the
  // transition into the "open" state, and re-arm the warning when it closes.
  let devtoolsCheckInterval: ReturnType<typeof setInterval> | null = null;
  let devtoolsOpen = false;
  const DEVTOOLS_SIZE_THRESHOLD = 160;
  const detectDevTools = () => {
    const widthGap = window.outerWidth - window.innerWidth;
    const heightGap = window.outerHeight - window.innerHeight;
    const open = widthGap > DEVTOOLS_SIZE_THRESHOLD || heightGap > DEVTOOLS_SIZE_THRESHOLD;
    if (open && !devtoolsOpen) {
      devtoolsOpen = true;
      // Only clear once, when DevTools are actually detected — not every tick.
      console.clear();
      showDeterrentWarning(originalLog);
    } else if (!open && devtoolsOpen) {
      devtoolsOpen = false;
    }
  };

  devtoolsCheckInterval = setInterval(detectDevTools, 10000);

  return () => {
    console.log = originalLog;
    console.info = originalInfo;
    console.warn = originalWarn;
    console.error = originalError;
    console.debug = originalDebug;
    console.trace = originalTrace;
    console.table = originalTable;
    console.dir = originalDir;
    console.group = originalGroup;
    console.groupCollapsed = originalGroupCollapsed;
    if (devtoolsCheckInterval) clearInterval(devtoolsCheckInterval);
  };
}

function showDeterrentWarning(logFn: (...args: unknown[]) => void) {
  logFn(
    '%c⛔ STOP',
    'color: #dc2626; font-size: 48px; font-weight: 900; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);'
  );
  logFn(
    '%cThis is a browser feature intended for developers.\n\nIf someone told you to copy-paste something here, it is a scam and will give them access to your account.\n\nIf you are a developer, we welcome responsible disclosure at our security contact.',
    'color: #1e293b; font-size: 15px; line-height: 1.8; font-weight: 500;'
  );
  logFn(
    '%c🔒 All console activity is monitored and logged.',
    'color: #6b7280; font-size: 13px; font-style: italic;'
  );
}
