const storageKey = 'dev-journal-theme';

function currentTheme(): 'mocha' | 'latte' {
  return document.documentElement.dataset.theme === 'latte' ? 'latte' : 'mocha';
}

export function readStoredTheme(): 'mocha' | 'latte' {
  try {
    return localStorage.getItem(storageKey) === 'latte' ? 'latte' : 'mocha';
  } catch {
    return 'mocha';
  }
}

export function applyThemeFromStorage(): void {
  document.documentElement.dataset.theme = readStoredTheme();
}

function renderThemeControl(): void {
  const toggle = document.querySelector<HTMLButtonElement>('[data-theme-toggle]');
  if (!toggle) return;

  const isLatte = currentTheme() === 'latte';
  toggle.setAttribute('aria-label', isLatte ? 'Switch to dark theme' : 'Switch to light theme');
  toggle.setAttribute('aria-pressed', String(isLatte));
  document
    .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    ?.setAttribute('content', isLatte ? '#eff1f5' : '#1e1e2e');
}

export function initTheme(): void {
  renderThemeControl();
}

export function toggleTheme(): void {
  const nextTheme = currentTheme() === 'mocha' ? 'latte' : 'mocha';
  document.documentElement.dataset.theme = nextTheme;

  try {
    localStorage.setItem(storageKey, nextTheme);
  } catch {
    // Theme switching still works when storage is unavailable.
  }

  renderThemeControl();
}
