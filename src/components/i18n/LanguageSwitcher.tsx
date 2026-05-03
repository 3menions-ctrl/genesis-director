import { useTranslation } from "react-i18next";
import { Globe, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { LANGUAGES, getLanguage } from "@/i18n/languages";
import { cn } from "@/lib/utils";

interface Props {
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "sm" | "icon";
  showLabel?: boolean;
  className?: string;
}

export function LanguageSwitcher({
  variant = "ghost",
  size = "sm",
  showLabel = true,
  className,
}: Props) {
  const { i18n } = useTranslation();
  const current = getLanguage(i18n.language?.split("-")[0] ?? "en") ?? LANGUAGES[0];

  const handleSelect = (code: string) => {
    void i18n.changeLanguage(code);
    try { localStorage.setItem("apex.lang", code); } catch { /* noop */ }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={cn("gap-2 font-medium", className)}
          aria-label="Change language"
        >
          <Globe className="h-4 w-4" />
          {showLabel && (
            <span className="hidden sm:inline">
              {current.flag} {current.name}
            </span>
          )}
          {showLabel && (
            <span className="sm:hidden">{current.flag}</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-h-[60vh] w-56 overflow-y-auto bg-popover/95 backdrop-blur-xl"
      >
        <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
          Language
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {LANGUAGES.map((lang) => {
          const active = lang.code === current.code;
          return (
            <DropdownMenuItem
              key={lang.code}
              onSelect={() => handleSelect(lang.code)}
              className={cn(
                "flex cursor-pointer items-center justify-between gap-3",
                active && "bg-accent/40",
              )}
            >
              <span className="flex items-center gap-2">
                <span aria-hidden className="text-base leading-none">
                  {lang.flag}
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="text-sm">{lang.name}</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {lang.english}
                  </span>
                </span>
              </span>
              {active && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default LanguageSwitcher;