/**
 * Theme — simple "Dailies" (default cinematic dark) vs "Production Day"
 * (warmer low-blue) palette switcher.
 *
 * Stored in localStorage, applied via `data-theme` attribute on <html>.
 * CSS variables in index.css respond to `[data-theme="production-day"]`.
 */

export type Theme = 'dailies' | 'production-day';

const KEY = 'smallbridges.theme';

export function getTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'production-day' ? 'production-day' : 'dailies';
  } catch {
    return 'dailies';
  }
}

export function setTheme(theme: Theme): void {
  try {
    localStorage.setItem(KEY, theme);
  } catch {}
  applyTheme(theme);
}

export function applyTheme(theme: Theme): void {
  if (theme === 'production-day') {
    document.documentElement.setAttribute('data-theme', 'production-day');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

/** Apply theme from storage on app boot. Call once in main.tsx / App.tsx. */
export function bootTheme(): void {
  applyTheme(getTheme());
}
