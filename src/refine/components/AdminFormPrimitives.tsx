/** Shared primitives for admin create/edit dialogs — keeps each page terse. */
import { ReactNode } from "react";
import { motion } from "framer-motion";
import { PrimaryCTA } from "@/components/ui/PrimaryCTA";
import { ACCENT_HSL, accent } from "@/admin/ui/primitives";

const PANEL_BG =
  "linear-gradient(165deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02) 60%, rgba(255,255,255,0.015))";

export function AdminDialog({
  title,
  icon: Icon,
  onClose,
  onSubmit,
  busy,
  submitLabel = "Save",
  children,
}: {
  title: string;
  icon?: React.ElementType;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
  busy?: boolean;
  submitLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-lg space-y-4 overflow-hidden overflow-y-auto rounded-2xl p-6 backdrop-blur-xl"
        style={{
          background: PANEL_BG,
          maxHeight: "90vh",
          boxShadow: "0 40px 120px -50px rgba(0,0,0,0.95)",
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)" }}
        />
        <div className="flex items-center gap-3">
          {Icon && (
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{ background: `linear-gradient(135deg, ${accent(0.22)}, ${accent(0.08)})`, color: ACCENT_HSL }}
            >
              <Icon className="h-4 w-4" strokeWidth={1.8} />
            </span>
          )}
          <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-white">{title}</h2>
        </div>
        <div className="space-y-3">{children}</div>
        <div className="flex justify-end gap-2.5 pt-2">
          <button
            onClick={onClose}
            className="rounded-full bg-white/[0.06] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.22em] text-white/55 transition-colors hover:bg-white/[0.12] hover:text-white focus-visible:outline-none"
          >
            Cancel
          </button>
          <PrimaryCTA loading={busy} onClick={() => void onSubmit()}>
            {submitLabel}
          </PrimaryCTA>
        </div>
      </motion.div>
    </div>
  );
}

export function AdminField({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[10px] font-light text-white/35">{hint}</span>}
    </label>
  );
}

/**
 * Re-exported design-system input class. Kept as a string for backwards
 * compatibility with the 50+ admin pages that pass `inputClass` directly to
 * `<input>` / `<select>` / `<textarea>` JSX. Resolves to the global `.ds-input`
 * class defined in `src/index.css`.
 */
export const inputClass = "ds-input mt-1";

export const textareaClass = `${inputClass} resize-none`;
