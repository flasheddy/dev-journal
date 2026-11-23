const storageKey = 'dev-journal-theme';
const root = document.documentElement;

function currentTheme(): 'mocha' | 'latte' {
  return root.dataset.theme === 'latte' ? 'latte' : 'mocha';
}

function applyThemeFromStorage(): void {
  try {
    const saved = localStorage.getItem(storageKey);
    root.dataset.theme = saved === 'latte' ? 'latte' : 'mocha';
  } catch {
    root.dataset.theme = 'mocha';
  }
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

function toggleTheme(): void {
  const nextTheme = currentTheme() === 'mocha' ? 'latte' : 'mocha';
  root.dataset.theme = nextTheme;

  try {
    localStorage.setItem(storageKey, nextTheme);
  } catch {
    // Theme switching still works when storage is unavailable.
  }

  renderThemeControl();
}

async function copyText(text: string): Promise<void> {
  // The Clipboard API is available on localhost and HTTPS.
  await navigator.clipboard.writeText(text);
}

function enhanceCodeBlocks(): void {
  const status = document.querySelector<HTMLElement>('[data-copy-status]');

  document
    .querySelectorAll<HTMLPreElement>('.prose pre:not([data-copy-enhanced])')
    .forEach((pre) => {
      pre.dataset.copyEnhanced = 'true';

      const wrapper = document.createElement('div');
      wrapper.className = 'code-block';
      pre.before(wrapper);
      wrapper.append(pre);

      const button = document.createElement('button');
      button.className = 'copy-button';
      button.type = 'button';
      button.setAttribute('aria-label', 'Copy code');
      button.innerHTML =
        '<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
      wrapper.append(button);

      button.addEventListener('click', async () => {
        try {
          await copyText(pre.innerText);
          button.dataset.copied = 'true';
          button.setAttribute('aria-label', 'Code copied');
          if (status) status.textContent = 'Code copied to clipboard';
          window.setTimeout(() => {
            delete button.dataset.copied;
            button.setAttribute('aria-label', 'Copy code');
          }, 1800);
        } catch {
          if (status) status.textContent = 'Unable to copy code';
          button.setAttribute('aria-label', 'Unable to copy code');
        }
      });
    });
}

function setup(): void {
  renderThemeControl();
  enhanceCodeBlocks();
}

document.addEventListener('click', (event) => {
  if (event.target instanceof Element && event.target.closest('[data-theme-toggle]')) {
    toggleTheme();
  }
});

// ClientRouter replaces the body without re-running this bundled module. Restore
// theme state early in the swap, then rebuild the per-page controls.
document.addEventListener('astro:after-swap', applyThemeFromStorage);
document.addEventListener('astro:page-load', setup);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setup, { once: true });
} else {
  setup();
}
