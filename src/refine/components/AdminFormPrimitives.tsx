/** Shared primitives for admin create/edit dialogs — keeps each page terse. */
import { ReactNode } from "react";
import { PrimaryCTA } from "@/components/ui/PrimaryCTA";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[#0A0A0C] p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-[#6FB6FF]" />}
          <h2 className="text-white text-lg font-display font-light">{title}</h2>
        </div>
        <div className="space-y-3">{children}</div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="text-[11px] uppercase tracking-[0.22em] text-white/45 hover:text-white px-4 py-2 rounded-lg border border-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 transition-colors"
          >
            Cancel
          </button>
          <PrimaryCTA loading={busy} onClick={() => void onSubmit()}>
            {submitLabel}
          </PrimaryCTA>
        </div>
      </div>
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
      <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/40">
        {label}
      </span>
      {children}
      {hint && <span className="block mt-1 text-[10px] text-white/30">{hint}</span>}
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
