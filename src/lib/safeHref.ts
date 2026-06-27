/**
 * safeHref — allowlist user/config-supplied URLs before they reach an <a href>
 * or window.open, to block stored-XSS via `javascript:` / `data:` / `vbscript:`
 * schemes (audit S223–S234). `rel="noopener"` does NOT prevent a javascript:
 * href from executing on click, so the scheme must be validated.
 *
 * Returns a safe URL string, or `undefined` if the input can't be made safe
 * (so `<a href={safeHref(v)}>` renders an inert, non-navigating anchor and
 * `window.open(safeHref(v) ?? '')` is a no-op for the empty string).
 *
 * Accepts: http(s) and mailto absolute URLs, same-origin relative paths
 * (`/foo`, not protocol-relative `//foo`), and bare domains like
 * `twitter.com/me` (commonly entered by users) which are upgraded to https.
 */
export function safeHref(url: unknown): string | undefined {
  if (typeof url !== "string") return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;

  // Absolute http(s) / mailto — safe schemes only.
  if (/^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed)) return trimmed;

  // Same-origin relative path (reject protocol-relative `//evil.com`).
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;

  // Bare domain a user typed without a scheme → upgrade to https.
  // Must look like `domain.tld[/...]` and contain no scheme separator.
  if (!trimmed.includes(":") && /^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(trimmed)) {
    return "https://" + trimmed;
  }

  // Anything else (javascript:, data:, vbscript:, file:, etc.) → reject.
  return undefined;
}
