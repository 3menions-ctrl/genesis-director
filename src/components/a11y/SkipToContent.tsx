/**
 * Skip-to-content link.
 *
 * Renders an invisible-until-focused anchor that, when activated by a
 * keyboard user (Tab as the first interaction), jumps focus past the
 * navigation chrome and into the page's main content. Standard
 * WCAG 2.1 SC 2.4.1 requirement; absence flagged by the a11y audit.
 *
 * The target id is `#main` — every `<main>` element (currently owned by
 * AppShell) should carry id="main" for this to work. AppShell's <main>
 * gets the id set in its component, not here.
 */
export function SkipToContent() {
  return (
    <a
      href="#main"
      className={[
        // Hidden visually until focused — covers up the top-left corner
        // with a high-contrast pill so a sighted keyboard user sees it.
        "sr-only focus:not-sr-only",
        "fixed left-4 top-4 z-[100]",
        "rounded-full px-4 py-2 text-sm font-semibold",
        "bg-primary text-primary-foreground",
        "shadow-lg shadow-black/40",
        "outline-none ring-2 ring-foreground/40",
      ].join(" ")}
    >
      Skip to content
    </a>
  );
}
