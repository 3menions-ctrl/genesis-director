/**
 * CastPanel — Studio's view of the current cast roster.
 *
 * Mounts above the Studio's mode tabs. Reads from the shared
 * cast-store via useCast(), so adding/removing avatars from the
 * Avatars page or anywhere else reflects here in real time.
 *
 * Empty state: a quiet glass card with a link to /avatars and the
 * call to action "Cast a character." Once any avatar is in the cast,
 * the card expands into a horizontal row of glass mini-frames — one
 * per cast member — with the lead actor marked with a small "lead"
 * badge. Each mini-frame has a remove affordance on hover.
 *
 * The lead actor (cast[0]) is the avatar wired into the generation
 * pipeline by CreationHub. Supporting members are persisted to
 * localStorage and surfaced via the avatar template selectors so the
 * director can swap leads with one click.
 */
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users as UsersIcon,
  ArrowRight,
  X,
  Sparkles,
  Crown,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { OptimizedAvatarImage } from "@/components/avatars/OptimizedAvatarImage";
import { useCast } from "@/hooks/useCast";
import { EASE_PREMIUM, TYPE_META } from "@/lib/design-system";

export function CastPanel({ className }: { className?: string }) {
  const { cast, remove, clear, reorder } = useCast();

  // Promote a cast member to lead (position 0) — drives which avatar
  // CreationHub pre-selects for the generation request.
  const promote = (id: string) => {
    const others = cast.filter((m) => m.id !== id).map((m) => m.id);
    reorder([id, ...others]);
  };

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl",
        "border border-border/30",
        "bg-gradient-to-br from-[hsl(var(--foreground)/0.025)] via-[hsl(var(--foreground)/0.015)] to-[hsl(var(--foreground)/0.01)]",
        "backdrop-blur-xl",
        "shadow-[0_30px_80px_-40px_hsl(0_0%_0%/0.55),inset_0_1px_0_hsl(0_0%_100%/0.04)]",
        className,
      )}
      aria-label="Studio cast"
    >
      {/* Foundation corner brackets — registration marks */}
      <div aria-hidden className="pointer-events-none absolute left-3 top-3 h-2.5 w-2.5 border-l border-t border-accent/30" />
      <div aria-hidden className="pointer-events-none absolute right-3 top-3 h-2.5 w-2.5 border-r border-t border-accent/30" />
      <div aria-hidden className="pointer-events-none absolute left-3 bottom-3 h-2.5 w-2.5 border-l border-b border-accent/30" />
      <div aria-hidden className="pointer-events-none absolute right-3 bottom-3 h-2.5 w-2.5 border-r border-b border-accent/30" />

      {/* Header row */}
      <header className="flex items-center justify-between gap-4 border-b border-border/20 px-5 py-3.5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-accent/40 bg-[hsl(var(--accent)/0.08)]">
            <UsersIcon className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <span className={cn(TYPE_META, "text-foreground/85")}>
              ◆ Cast
            </span>
            {cast.length > 0 && (
              <span className={cn(TYPE_META, "ml-2 text-muted-foreground/55")}>
                {cast.length} {cast.length === 1 ? "talent" : "talents"} · max 8
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/avatars"
            className={cn(
              "group inline-flex items-center gap-1.5 h-8 px-3 rounded-full",
              "border border-border/40 bg-[hsl(var(--foreground)/0.02)]",
              "text-[12px] text-foreground/85 transition-colors",
              "hover:border-accent/40 hover:text-foreground",
            )}
          >
            <Sparkles className="h-3 w-3 text-accent" strokeWidth={1.5} />
            <span>{cast.length === 0 ? "Cast" : "Add"}</span>
            <ArrowRight
              className="h-3 w-3 text-accent transition-transform group-hover:translate-x-0.5"
              strokeWidth={1.5}
            />
          </Link>
          {cast.length > 0 && (
            <button
              onClick={clear}
              className={cn(TYPE_META, "text-muted-foreground/55 hover:text-foreground transition-colors")}
            >
              Clear
            </button>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="p-5">
        {cast.length === 0 ? (
          <EmptyState />
        ) : (
          <ul
            className="flex items-stretch gap-3 overflow-x-auto scrollbar-hide -mx-1 px-1 py-1"
            aria-label="Cast members"
          >
            <AnimatePresence initial={false}>
              {cast.map((m, i) => (
                <motion.li
                  key={m.id}
                  layout
                  initial={{ opacity: 0, scale: 0.96, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94, y: 4 }}
                  transition={{ duration: 0.32, ease: EASE_PREMIUM }}
                  className="shrink-0"
                >
                  <MiniFrame
                    name={m.name}
                    imageUrl={m.imageUrl}
                    style={m.style}
                    avatarType={m.avatarType}
                    isLead={i === 0}
                    onRemove={() => remove(m.id)}
                    onPromote={i === 0 ? undefined : () => promote(m.id)}
                  />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MiniFrame — glass picture-frame for a single cast member.
// ─────────────────────────────────────────────────────────────────────────────
function MiniFrame({
  name,
  imageUrl,
  style,
  avatarType,
  isLead,
  onRemove,
  onPromote,
}: {
  name: string;
  imageUrl: string;
  style: string | null;
  avatarType: "realistic" | "animated";
  isLead: boolean;
  onRemove: () => void;
  onPromote?: () => void;
}) {
  return (
    <div className="group relative w-[120px] sm:w-[140px]">
      <div
        className={cn(
          "relative overflow-hidden rounded-xl p-[5px]",
          "border border-white/[0.08] bg-gradient-to-br from-white/[0.05] via-white/[0.02] to-transparent",
          "backdrop-blur-xl",
          "shadow-[0_20px_50px_-20px_hsl(0_0%_0%/0.7),inset_0_1px_0_hsl(0_0%_100%/0.06)]",
          "transition-shadow duration-500",
          isLead &&
            "shadow-[0_20px_50px_-20px_hsl(0_0%_0%/0.7),0_0_0_1px_hsl(var(--accent)/0.4),inset_0_1px_0_hsl(0_0%_100%/0.08),0_0_40px_-12px_hsl(var(--accent)/0.5)]",
        )}
      >
        <div className="relative aspect-[3/4] overflow-hidden rounded-md ring-1 ring-inset ring-white/[0.05]">
          <OptimizedAvatarImage
            src={imageUrl}
            alt={name}
            fallbackText={name}
            aspectRatio="portrait"
            className="h-full w-full object-cover"
          />

          {/* Top hairline + diagonal reflection */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-40 mix-blend-overlay"
            style={{
              background:
                "linear-gradient(135deg, hsl(0 0% 100% / 0.14) 0%, transparent 35%, transparent 65%, hsl(0 0% 100% / 0.04) 100%)",
            }}
          />

          {/* Bottom vignette for caption */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[hsl(220_40%_2%/0.92)] via-[hsl(220_40%_2%/0.35)] to-transparent"
          />

          {/* Lead badge — top-left */}
          {isLead && (
            <span
              className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 backdrop-blur-md ring-1 ring-inset ring-accent/40 bg-[hsl(var(--accent)/0.18)] text-accent"
              aria-label="Lead role"
            >
              <Crown className="h-2.5 w-2.5" strokeWidth={1.8} />
              <span className="text-[8.5px] font-mono uppercase tracking-[0.2em]">
                Lead
              </span>
            </span>
          )}

          {/* Realistic / animated badge — top-right */}
          <span
            className={cn(
              "absolute top-1.5 right-1.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-[8px] font-mono uppercase tracking-[0.2em] backdrop-blur-md ring-1 ring-inset",
              avatarType === "realistic"
                ? "bg-[hsl(var(--accent)/0.10)] ring-[hsl(var(--accent)/0.30)] text-accent"
                : "bg-[hsl(280_55%_65%/0.10)] ring-[hsl(280_55%_65%/0.30)] text-[hsl(280_55%_85%)]",
            )}
          >
            {avatarType === "realistic" ? "Real" : "Anim"}
          </span>

          {/* Remove — top-right corner, on hover */}
          <button
            onClick={onRemove}
            aria-label={`Remove ${name}`}
            className={cn(
              "absolute -top-1.5 -right-1.5 z-10 h-5 w-5 rounded-full",
              "bg-[hsl(220_30%_4%)] ring-1 ring-inset ring-white/30 text-foreground",
              "inline-flex items-center justify-center transition-all",
              "opacity-0 group-hover:opacity-100 hover:ring-accent/60 hover:scale-110",
            )}
          >
            <X className="h-3 w-3" strokeWidth={2.2} />
          </button>

          {/* Caption */}
          <div className="absolute inset-x-0 bottom-0 p-2">
            <h4
              className="font-display italic text-[12px] font-light leading-tight tracking-tight text-white truncate"
              style={{
                fontFamily: "'Fraunces', serif",
                textShadow: "0 2px 12px hsl(220 40% 2% / 0.85)",
              }}
            >
              {name}
            </h4>
            {style && (
              <p className="mt-0.5 text-[8.5px] font-mono uppercase tracking-[0.22em] text-white/65 truncate">
                {style}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Promote-to-lead — only on supporting members */}
      {onPromote && (
        <button
          onClick={onPromote}
          aria-label={`Make ${name} the lead`}
          className={cn(
            "mt-2 w-full inline-flex items-center justify-center gap-1 h-6 rounded-full",
            "border border-border/30 bg-[hsl(var(--foreground)/0.02)] text-muted-foreground/70",
            "text-[9.5px] font-mono uppercase tracking-[0.22em]",
            "hover:text-accent hover:border-accent/40 transition-colors",
            "opacity-0 group-hover:opacity-100",
          )}
        >
          <Star className="h-2.5 w-2.5" strokeWidth={1.8} />
          <span>Make Lead</span>
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EmptyState — quiet glass invitation
// ─────────────────────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <Link
      to="/avatars"
      className={cn(
        "group block rounded-xl border border-dashed border-border/40 bg-[hsl(var(--foreground)/0.015)]",
        "px-5 py-6 text-center transition-all",
        "hover:border-accent/40 hover:bg-[hsl(var(--accent)/0.04)]",
      )}
    >
      <UsersIcon
        className="mx-auto h-5 w-5 text-muted-foreground/55 group-hover:text-accent transition-colors"
        strokeWidth={1.4}
      />
      <p className={cn(TYPE_META, "mt-3 text-muted-foreground/65 group-hover:text-foreground/85 transition-colors")}>
        No cast yet — open the talent vault and start casting
      </p>
      <span className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-accent group-hover:underline">
        Cast a character
        <ArrowRight
          className="h-3 w-3 transition-transform group-hover:translate-x-0.5"
          strokeWidth={1.5}
        />
      </span>
    </Link>
  );
}
