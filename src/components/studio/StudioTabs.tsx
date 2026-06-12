/**
 * StudioTabs — glass-pill tabs with a framer-motion sliding indicator.
 *
 * Visual + behaviour are lifted verbatim from the Create page so every
 * consumer-facing hub feels like a sibling of /create. Pass items + the
 * currently active key; emits onChange.
 */
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface StudioTab<K extends string = string> {
  key: K;
  label: string;
  sub?: string;
  icon?: React.ElementType;
}

interface Props<K extends string> {
  items: StudioTab<K>[];
  value: K;
  onChange: (next: K) => void;
  /** Optional `layoutId` namespace so multiple tab strips don't share their indicator. */
  layoutId?: string;
}

export function StudioTabs<K extends string>({
  items, value, onChange, layoutId = "studio-tab-active",
}: Props<K>) {
  return (
    <div
      role="tablist"
      className="relative inline-flex items-center gap-1 rounded-full p-1"
      style={{
        background: "hsla(0,0%,100%,0.025)",
        backdropFilter: "blur(48px) saturate(180%)",
        WebkitBackdropFilter: "blur(48px) saturate(180%)",
        boxShadow:
          "0 8px 40px -12px rgba(0,0,0,0.6), inset 0 1px 0 hsla(0,0%,100%,0.04)",
      }}
    >
      {items.map((tab) => {
        const Icon = tab.icon;
        const active = value === tab.key;
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.key)}
            className={cn(
              "relative z-10 flex items-center gap-2.5 px-4 sm:px-5 py-2.5 rounded-full text-[13px] font-light tracking-[-0.005em] transition-colors duration-500",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground/85",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
                className="absolute inset-0 -z-10 rounded-full"
                style={{
                  background:
                    "linear-gradient(180deg, hsla(215,100%,60%,0.22) 0%, hsla(215,100%,55%,0.10) 100%)",
                  boxShadow:
                    "0 0 24px hsla(215,100%,60%,0.35), 0 0 48px hsla(215,100%,60%,0.18), inset 0 1px 0 hsla(0,0%,100%,0.10)",
                }}
              />
            )}
            {Icon && (
              <Icon
                className={cn(
                  "w-4 h-4 transition-all duration-500",
                  active
                    ? "text-[hsl(215,100%,75%)] drop-shadow-[0_0_8px_hsla(215,100%,60%,0.6)]"
                    : "opacity-60",
                )}
                strokeWidth={1.5}
              />
            )}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
