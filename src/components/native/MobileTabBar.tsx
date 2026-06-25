/**
 * MobileTabBar — the bottom navigation for the native mobile app.
 *
 * Rendered ONLY inside the Capacitor native shell (returns null on web, so the
 * existing web navigation is untouched). Five destinations, with a raised
 * center "create" button. Hidden on full-screen / auth flows where a tab bar
 * would be in the way.
 *
 * Height is mirrored by the `--tabbar-h` CSS var (see index.css) so full-bleed
 * screens like the feed reserve space for it.
 */
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Clapperboard, Compass, Plus, SlidersHorizontal, User } from 'lucide-react';
import { IS_MOBILE_SHELL } from '@/lib/native';
import { hapticTap } from '@/lib/native/shell';
import { cn } from '@/lib/utils';

const TABS = [
  { to: '/feed', label: 'Feed', icon: Clapperboard },
  { to: '/search', label: 'Discover', icon: Compass },
  { to: '/presets', label: 'Presets', icon: SlidersHorizontal },
  { to: '/you', label: 'You', icon: User },
] as const;

// Routes where the tab bar should not appear.
const HIDDEN_PREFIXES = ['/auth', '/onboarding', '/business-start', '/welcome'];

export function MobileTabBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Mobile nav prune: the gamified /you screen is the canonical profile in the
  // mobile shell — send the desktop /profile there. (Admin/marketing/full-editor
  // simply aren't reachable from the tab bar.)
  useEffect(() => {
    if (IS_MOBILE_SHELL && pathname === '/profile') {
      navigate('/you', { replace: true });
    }
  }, [pathname, navigate]);

  if (!IS_MOBILE_SHELL) return null;
  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  const go = (to: string) => {
    void hapticTap();
    navigate(to);
  };

  const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`);

  // Render two tabs, the center create button, then two tabs.
  const left = TABS.slice(0, 2);
  const right = TABS.slice(2);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 flex items-start justify-around bg-gradient-to-t from-[#060608] via-[#060608]/92 to-transparent px-2 pt-3.5 backdrop-blur-xl"
      style={{
        height: 'calc(var(--tabbar-h, 64px) + var(--safe-bottom, 0px) + 8px)',
        paddingBottom: 'var(--safe-bottom, 0px)',
      }}
    >
      {left.map((t) => (
        <TabButton key={t.to} {...t} active={isActive(t.to)} onClick={() => go(t.to)} />
      ))}

      {/* Center create */}
      <button
        onClick={() => go('/create')}
        aria-label="Create"
        className="-mt-1.5 grid h-[40px] w-[52px] place-items-center rounded-[15px] bg-gradient-to-br from-[#3f78ff] to-[#7a3bff] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.45),0_10px_26px_-6px_rgba(64,90,255,.85)]"
      >
        <Plus className="h-6 w-6" strokeWidth={2.4} />
      </button>

      {right.map((t) => (
        <TabButton key={t.to} {...t} active={isActive(t.to)} onClick={() => go(t.to)} />
      ))}
    </nav>
  );
}

function TabButton({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: typeof Clapperboard;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-1 font-display text-[10px] font-semibold tracking-wide transition-colors',
        active ? 'text-white' : 'text-white/40',
      )}
    >
      <span className="relative grid place-items-center">
        {active && (
          <span className="pointer-events-none absolute h-7 w-7 rounded-full bg-[#3f78ff]/35 blur-md" />
        )}
        <Icon className="relative h-[24px] w-[24px]" strokeWidth={1.9} />
      </span>
      {label}
      <span className={cn('h-1 w-1 rounded-full', active ? 'bg-[#3f78ff] shadow-[0_0_10px_#3f78ff]' : 'bg-transparent')} />
    </button>
  );
}
