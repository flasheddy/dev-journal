(() => {
  'use strict';

  const storageKey = 'dev-journal-theme';
  const root = document.documentElement;
  const toggle = document.querySelector('[data-theme-toggle]');
  const status = document.querySelector('[data-copy-status]');

  function currentTheme() {
    return root.dataset.theme === 'latte' ? 'latte' : 'mocha';
  }

  function renderThemeControl() {
    if (!toggle) return;
    const isLatte = currentTheme() === 'latte';
    toggle.setAttribute('aria-label', isLatte ? 'Switch to dark theme' : 'Switch to light theme');
    toggle.setAttribute('aria-pressed', String(isLatte));
    toggle.querySelector('[data-theme-icon="light"]').hidden = isLatte;
    toggle.querySelector('[data-theme-icon="dark"]').hidden = !isLatte;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isLatte ? '#eff1f5' : '#1e1e2e');
  }

  toggle?.addEventListener('click', () => {
    const nextTheme = currentTheme() === 'mocha' ? 'latte' : 'mocha';
    root.dataset.theme = nextTheme;
    try {
      localStorage.setItem(storageKey, nextTheme);
    } catch (_) {
      // Theme switching still works when storage is unavailable.
    }
    renderThemeControl();
  });

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.append(field);
    field.select();
    const copied = document.execCommand('copy');
    field.remove();
    if (!copied) throw new Error('Copy command was unavailable');
  }

  document.querySelectorAll('.prose pre').forEach((pre) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'code-block';
    pre.before(wrapper);
    wrapper.append(pre);

    const button = document.createElement('button');
    button.className = 'copy-button';
    button.type = 'button';
    button.setAttribute('aria-label', 'Copy code');
    button.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
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
      } catch (_) {
        if (status) status.textContent = 'Unable to copy code';
        button.setAttribute('aria-label', 'Unable to copy code');
      }
    });
  });

  renderThemeControl();
})();
