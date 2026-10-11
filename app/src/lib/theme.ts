// Light / dark choice, remembered on this device only (each phone can differ).
// 'auto' follows the device setting. The same logic runs inline in index.html
// before first paint, so the page never flashes the wrong colours.
export type ThemeChoice = 'auto' | 'light' | 'dark';
const KEY = 'sb-theme';

export function readTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
  const dark = choice === 'dark' || (choice === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    m.setAttribute('content', dark ? '#111814' : '#F6F8F5');
    m.removeAttribute('media');
  });
}

export function saveTheme(choice: ThemeChoice): void {
  try {
    if (choice === 'auto') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch { /* private mode: still applies for this visit */ }
  applyTheme(choice);
}
