import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  Suspense,
  Component,
  type ReactNode,
} from 'react';

/**
 * Landing-page diagnostics panel.
 *
 * Logs which loader GATE is still pending and which Suspense SECTION is
 * either still suspending or threw during render. Visible only when:
 *   - `?diag=1` is in the URL, or
 *   - `localStorage.landingDiag === '1'`, or
 *   - `import.meta.env.DEV` is true.
 *
 * Lightweight — no DOM cost when hidden.
 */

type Status = 'pending' | 'ready' | 'error';

interface Entry {
  name: string;
  status: Status;
  detail?: string;
  since: number;
}

interface DiagCtx {
  setGate: (name: string, status: Status, detail?: string) => void;
  setSection: (name: string, status: Status, detail?: string) => void;
}

const Ctx = createContext<DiagCtx | null>(null);

function shouldShow(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (new URLSearchParams(window.location.search).get('diag') === '1') return true;
    if (window.localStorage?.getItem('landingDiag') === '1') return true;
  } catch {}
  // @ts-expect-error vite env
  return Boolean(import.meta?.env?.DEV);
}

export function LandingDiagnosticsProvider({ children }: { children: ReactNode }) {
  const [gates, setGates] = useState<Record<string, Entry>>({});
  const [sections, setSections] = useState<Record<string, Entry>>({});
  const [enabled] = useState(shouldShow);
  const [collapsed, setCollapsed] = useState(false);

  const ctx = useMemo<DiagCtx>(
    () => ({
      setGate: (name, status, detail) =>
        setGates((prev) => {
          const existing = prev[name];
          if (existing && existing.status === status && existing.detail === detail) return prev;
          if (enabled) {
             
            console.info(`[LandingDiag] gate "${name}" → ${status}${detail ? ` (${detail})` : ''}`);
          }
          return { ...prev, [name]: { name, status, detail, since: performance.now() } };
        }),
      setSection: (name, status, detail) =>
        setSections((prev) => {
          const existing = prev[name];
          if (existing && existing.status === status && existing.detail === detail) return prev;
          if (enabled) {
             
            console.info(`[LandingDiag] section "${name}" → ${status}${detail ? ` (${detail})` : ''}`);
          }
          return { ...prev, [name]: { name, status, detail, since: performance.now() } };
        }),
    }),
    [enabled],
  );

  return (
    <Ctx.Provider value={ctx}>
      {children}
      {enabled && (
        <DiagnosticsPanel
          gates={gates}
          sections={sections}
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
        />
      )}
    </Ctx.Provider>
  );
}

function useDiag() {
  return useContext(Ctx);
}

/** Report a loader-gate state (auth, hero image, fonts, paint, ceiling, etc). */
export function useGate(name: string, ready: boolean, detail?: string) {
  const diag = useDiag();
  useEffect(() => {
    diag?.setGate(name, ready ? 'ready' : 'pending', detail);
  }, [diag, name, ready, detail]);
}

/** Wraps a lazy/Suspense section with name-tagged status reporting + error boundary. */
export function TrackedSection({
  name,
  fallback,
  children,
}: {
  name: string;
  fallback: ReactNode;
  children: ReactNode;
}) {
  return (
    <SectionErrorBoundary name={name}>
      <Suspense fallback={<SectionPendingProbe name={name}>{fallback}</SectionPendingProbe>}>
        <SectionReadyProbe name={name}>{children}</SectionReadyProbe>
      </Suspense>
    </SectionErrorBoundary>
  );
}

function SectionPendingProbe({ name, children }: { name: string; children: ReactNode }) {
  const diag = useDiag();
  const mountedRef = useRef(false);
  useEffect(() => {
    diag?.setSection(name, 'pending');
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, [diag, name]);
  return <>{children}</>;
}

function SectionReadyProbe({ name, children }: { name: string; children: ReactNode }) {
  const diag = useDiag();
  useEffect(() => {
    diag?.setSection(name, 'ready');
  }, [diag, name]);
  return <>{children}</>;
}

class SectionErrorBoundary extends Component<
  { name: string; children: ReactNode },
  { error: Error | null }
> {
  static contextType = Ctx;
  declare context: React.ContextType<typeof Ctx>;
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    try {
      this.context?.setSection(this.props.name, 'error', error.message);
    } catch {}
     
    console.error(`[LandingDiag] section "${this.props.name}" threw:`, error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="py-16 px-6 text-center text-xs text-white/40">
          Section <span className="font-mono text-white/70">{this.props.name}</span> failed to load.
        </div>
      );
    }
    return this.props.children;
  }
}

function DiagnosticsPanel({
  gates,
  sections,
  collapsed,
  onToggle,
}: {
  gates: Record<string, Entry>;
  sections: Record<string, Entry>;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const gateList = Object.values(gates).sort((a, b) => a.name.localeCompare(b.name));
  const sectionList = Object.values(sections).sort((a, b) => a.name.localeCompare(b.name));

  const stuckGates = gateList.filter((g) => g.status !== 'ready');
  const erroredSections = sectionList.filter((s) => s.status === 'error');
  const pendingSections = sectionList.filter((s) => s.status === 'pending');

  const headline = erroredSections.length
    ? `${erroredSections.length} section error${erroredSections.length === 1 ? '' : 's'}`
    : stuckGates.length
    ? `${stuckGates.length} gate${stuckGates.length === 1 ? '' : 's'} pending`
    : pendingSections.length
    ? `${pendingSections.length} section${pendingSections.length === 1 ? '' : 's'} loading`
    : 'All clear';

  const tone = erroredSections.length
    ? '#ff4d4d'
    : stuckGates.length || pendingSections.length
    ? '#FFB020'
    : '#34D399';

  return (
    <div
      style={{
        position: 'fixed',
        right: 12,
        bottom: 12,
        zIndex: 2147483646,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 11,
        color: '#E5E7EB',
        background: 'rgba(8,10,14,0.92)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 10,
        backdropFilter: 'blur(14px)',
        boxShadow: '0 20px 60px -20px rgba(0,0,0,0.7)',
        maxWidth: collapsed ? 220 : 340,
        overflow: 'hidden',
      }}
    >
      <button
        onClick={onToggle}
        style={{
          all: 'unset',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          width: '100%',
          boxSizing: 'border-box',
          background: 'rgba(255,255,255,0.02)',
        }}
        aria-label="Toggle landing diagnostics"
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: tone,
            boxShadow: `0 0 10px ${tone}`,
            flexShrink: 0,
          }}
        />
        <span style={{ fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: 10 }}>
          Landing Diag
        </span>
        <span style={{ marginLeft: 'auto', color: '#9CA3AF' }}>{headline}</span>
      </button>
      {!collapsed && (
        <div style={{ padding: '8px 12px 12px', maxHeight: '60vh', overflow: 'auto' }}>
          <Group title="Gates" items={gateList} />
          <Group title="Sections" items={sectionList} />
          <div style={{ marginTop: 8, color: '#6B7280', fontSize: 10 }}>
            Hide with <code>?diag=0</code> or <code>localStorage.removeItem('landingDiag')</code>.
          </div>
        </div>
      )}
    </div>
  );
}

function Group({ title, items }: { title: string; items: Entry[] }) {
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ color: '#9CA3AF', fontSize: 10, marginBottom: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {title}
      </div>
      {items.length === 0 ? (
        <div style={{ color: '#4B5563', fontSize: 11 }}>—</div>
      ) : (
        items.map((it) => <Row key={it.name} entry={it} />)
      )}
    </div>
  );
}

function Row({ entry }: { entry: Entry }) {
  const color =
    entry.status === 'ready' ? '#34D399' : entry.status === 'error' ? '#ff4d4d' : '#FFB020';
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '3px 0' }}>
      <span
        style={{
          marginTop: 5,
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: color,
          flexShrink: 0,
          boxShadow: `0 0 6px ${color}`,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#E5E7EB' }}>{entry.name}</div>
        {entry.detail && (
          <div style={{ color: '#9CA3AF', fontSize: 10, wordBreak: 'break-word' }}>{entry.detail}</div>
        )}
      </div>
      <span style={{ color, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {entry.status}
      </span>
    </div>
  );
}