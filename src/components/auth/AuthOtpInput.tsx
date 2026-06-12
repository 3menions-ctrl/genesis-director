/**
 * AuthOtpInput — six-cell OTP entry with auto-advance, paste-friendly
 * handling, backspace navigation, and a clean focus state.
 *
 * Pure presentational — the parent owns the value + onComplete.
 */
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (next: string) => void;
  onComplete?: (full: string) => void;
  disabled?: boolean;
  length?: number;
}

export function AuthOtpInput({
  value,
  onChange,
  onComplete,
  disabled,
  length = 6,
}: Props) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  // Focus the first empty cell on mount.
  useEffect(() => {
    const target = value.length < length ? value.length : length - 1;
    inputsRef.current[target]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the value reaches `length`, fire onComplete.
  useEffect(() => {
    if (value.length === length) onComplete?.(value);
  }, [value, length, onComplete]);

  const setCell = (idx: number, digit: string) => {
    const sanitized = digit.replace(/\D/g, "").slice(0, 1);
    const next =
      (value.substring(0, idx) + sanitized + value.substring(idx + 1)).slice(0, length);
    onChange(next);
    if (sanitized && idx < length - 1) {
      inputsRef.current[idx + 1]?.focus();
    }
  };

  const handleKey = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (value[idx]) {
        setCell(idx, "");
      } else if (idx > 0) {
        inputsRef.current[idx - 1]?.focus();
        const next = value.substring(0, idx - 1) + value.substring(idx);
        onChange(next);
      }
    } else if (e.key === "ArrowLeft" && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    } else if (e.key === "ArrowRight" && idx < length - 1) {
      inputsRef.current[idx + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    onChange(pasted);
    inputsRef.current[Math.min(pasted.length, length - 1)]?.focus();
  };

  return (
    <div className="flex items-center justify-center gap-2" role="group" aria-label="One-time code">
      {Array.from({ length }).map((_, i) => {
        const filled = !!value[i];
        return (
          <input
            key={i}
            ref={(el) => { inputsRef.current[i] = el; }}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={1}
            value={value[i] ?? ""}
            disabled={disabled}
            onChange={(e) => setCell(i, e.target.value)}
            onKeyDown={(e) => handleKey(i, e)}
            onPaste={handlePaste}
            aria-label={`Digit ${i + 1}`}
            className={cn(
              "w-12 h-14 text-center text-xl font-mono tabular-nums rounded-2xl",
              "bg-white/[0.025] border text-white outline-none transition-all duration-200",
              "border-white/[0.08]",
              "focus-visible:border-primary/60 focus-visible:bg-primary/[0.06] focus-visible:shadow-[0_0_0_4px_hsla(215,100%,55%,0.12)]",
              filled && "border-primary/40 bg-primary/[0.05] shadow-[0_0_20px_-8px_hsla(215,100%,60%,0.55)]",
              disabled && "opacity-50 cursor-not-allowed",
            )}
          />
        );
      })}
    </div>
  );
}
