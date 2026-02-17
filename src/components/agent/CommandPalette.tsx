/**
 * Phase 2: Command Palette (Cmd+K)
 * 
 * Futuristic command palette with typeahead search,
 * keyboard navigation, and holographic styling.
 */

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { 
  Search, Video, CreditCard, User, Settings, 
  MessageCircle, Compass, Plus, Sparkles, Command, 
  ArrowRight, Film, Palette
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSafeNavigation } from '@/lib/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface CommandItem {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  action: () => void;
  category: string;
  keywords: string[];
}

export const CommandPalette = memo(function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { navigate } = useSafeNavigation();
  const { user } = useAuth();

  const commands: CommandItem[] = [
    { id: 'create', label: 'Create a video', description: 'Start a new production', icon: <Plus className="w-4 h-4" />, action: () => navigate('/create'), category: 'Create', keywords: ['new', 'video', 'generate', 'make'] },
    { id: 'projects', label: 'My Projects', description: 'View all your films', icon: <Film className="w-4 h-4" />, action: () => navigate('/projects'), category: 'Navigate', keywords: ['projects', 'films', 'my'] },
    { id: 'explore', label: 'Explore AI Films', description: 'Discover community creations', icon: <Compass className="w-4 h-4" />, action: () => navigate('/creators'), category: 'Navigate', keywords: ['explore', 'discover', 'gallery', 'community'] },
    { id: 'templates', label: 'Templates', description: 'Start with a template', icon: <Palette className="w-4 h-4" />, action: () => navigate('/templates'), category: 'Create', keywords: ['template', 'preset', 'starter'] },
    { id: 'avatars', label: 'AI Avatars', description: 'Create avatar videos', icon: <User className="w-4 h-4" />, action: () => navigate('/avatars'), category: 'Create', keywords: ['avatar', 'talking', 'head'] },
    { id: 'credits', label: 'Credits & Billing', description: 'Check balance & buy credits', icon: <CreditCard className="w-4 h-4" />, action: () => navigate('/pricing'), category: 'Account', keywords: ['credits', 'balance', 'buy', 'pricing', 'billing'] },
    { id: 'settings', label: 'Settings', description: 'Account preferences', icon: <Settings className="w-4 h-4" />, action: () => navigate('/settings'), category: 'Account', keywords: ['settings', 'preferences', 'account'] },
    { id: 'profile', label: 'My Profile', description: 'View your creator profile', icon: <User className="w-4 h-4" />, action: () => navigate('/profile'), category: 'Account', keywords: ['profile', 'me'] },
    { id: 'chat', label: 'World Chat', description: 'Chat with the community', icon: <MessageCircle className="w-4 h-4" />, action: () => navigate('/world-chat'), category: 'Social', keywords: ['chat', 'talk', 'community', 'world'] },
    { id: 'hoppy', label: 'Ask Hoppy', description: 'Open AI assistant', icon: <Sparkles className="w-4 h-4" />, action: () => { /* Trigger Hoppy - handled by parent */ }, category: 'AI', keywords: ['hoppy', 'ai', 'help', 'assistant'] },
  ];

  const filtered = query.trim()
    ? commands.filter(cmd => {
        const q = query.toLowerCase();
        return cmd.label.toLowerCase().includes(q) ||
               cmd.description.toLowerCase().includes(q) ||
               cmd.keywords.some(k => k.includes(q));
      })
    : commands;

  // Group by category
  const grouped = filtered.reduce<Record<string, CommandItem[]>>((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {});

  const flatFiltered = Object.values(grouped).flat();

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    if (!user) return; // Only for authenticated users
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [user]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, flatFiltered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flatFiltered[activeIndex]) {
        flatFiltered[activeIndex].action();
        setIsOpen(false);
      }
    }
  }, [flatFiltered, activeIndex]);

  if (!user) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]"
          onClick={() => setIsOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={e => e.stopPropagation()}
            className="relative w-full max-w-lg mx-4 rounded-2xl overflow-hidden border border-white/[0.1] shadow-[0_25px_100px_-20px_hsl(263_70%_58%/0.25)]"
            style={{ background: 'hsl(250 15% 6% / 0.95)', backdropFilter: 'blur(24px)' }}
          >
            {/* Holographic top border */}
            <div className="absolute top-0 left-0 right-0 h-px holo-border-gradient" />

            {/* Search input */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
              <Search className="w-5 h-5 text-white/25 flex-shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => { setQuery(e.target.value); setActiveIndex(0); }}
                onKeyDown={handleKeyDown}
                placeholder="Type a command or search..."
                className="flex-1 bg-transparent text-white text-sm placeholder:text-white/25 outline-none font-display"
              />
              <kbd className="hidden sm:flex items-center gap-0.5 px-2 py-1 rounded-md bg-white/[0.06] border border-white/[0.08] text-[10px] text-white/30 font-mono">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div className="max-h-[50vh] overflow-y-auto py-2 scrollbar-hide">
              {Object.entries(grouped).map(([category, items]) => (
                <div key={category}>
                  <div className="px-5 py-2">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/20">{category}</span>
                  </div>
                  {items.map(cmd => {
                    const flatIdx = flatFiltered.indexOf(cmd);
                    return (
                      <button
                        key={cmd.id}
                        onClick={() => { cmd.action(); setIsOpen(false); }}
                        onMouseEnter={() => setActiveIndex(flatIdx)}
                        className={cn(
                          "w-full flex items-center gap-3 px-5 py-3 text-left transition-colors duration-100",
                          flatIdx === activeIndex
                            ? "bg-primary/10 text-white"
                            : "text-white/60 hover:bg-white/[0.04]"
                        )}
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors",
                          flatIdx === activeIndex
                            ? "bg-primary/20 text-primary"
                            : "bg-white/[0.04] text-white/30"
                        )}>
                          {cmd.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{cmd.label}</div>
                          <div className="text-xs text-white/30 truncate">{cmd.description}</div>
                        </div>
                        {flatIdx === activeIndex && (
                          <ArrowRight className="w-3.5 h-3.5 text-primary/60 flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}

              {flatFiltered.length === 0 && (
                <div className="py-12 text-center">
                  <Search className="w-8 h-8 text-white/10 mx-auto mb-3" />
                  <p className="text-sm text-white/30">No commands found</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.06]">
              <div className="flex items-center gap-3 text-[10px] text-white/20">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] font-mono">↑↓</kbd> Navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] font-mono">↵</kbd> Select
                </span>
              </div>
              <span className="text-[10px] text-white/15 flex items-center gap-1">
                <Command className="w-3 h-3" />K to toggle
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
