const storageKey = 'dev-journal-theme';
const root = document.documentElement;

const copyIconMarkup =
  '<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
const checkIconMarkup =
  '<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';

function currentTheme(): 'mocha' | 'latte' {
  return root.dataset.theme === 'latte' ? 'latte' : 'mocha';
}

function readStoredTheme(): 'mocha' | 'latte' {
  try {
    return localStorage.getItem(storageKey) === 'latte' ? 'latte' : 'mocha';
  } catch {
    return 'mocha';
  }
}

function applyThemeFromStorage(): void {
  root.dataset.theme = readStoredTheme();
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
      button.innerHTML = copyIconMarkup;
      wrapper.append(button);

      let resetTimer: number | undefined;

      button.addEventListener('click', async () => {
        try {
          await copyText(pre.innerText);
          button.dataset.copied = 'true';
          button.innerHTML = checkIconMarkup;
          button.setAttribute('aria-label', 'Code copied');
          if (status) status.textContent = 'Code copied to clipboard';
          if (resetTimer !== undefined) window.clearTimeout(resetTimer);
          resetTimer = window.setTimeout(() => {
            delete button.dataset.copied;
            button.innerHTML = copyIconMarkup;
            button.setAttribute('aria-label', 'Copy code');
          }, 1800);
        } catch {
          if (status) status.textContent = 'Unable to copy code';
          button.setAttribute('aria-label', 'Unable to copy code');
        }
      });
    });
}

function syncTopicFilterFromUrl(): void {
  const filterBar = document.querySelector<HTMLElement>('[data-topic-filter]');
  if (!filterBar) return;

  const buttons = Array.from(filterBar.querySelectorAll<HTMLButtonElement>('[data-filter-tag]'));
  const overflowButtons = buttons.filter((button) => button.hasAttribute('data-filter-overflow'));
  const toggleButton = filterBar.querySelector<HTMLButtonElement>('[data-filter-toggle]');
  const list = document.querySelector<HTMLElement>('[data-filter-list]');
  if (!list || buttons.length === 0) return;

  const items = Array.from(list.querySelectorAll<HTMLElement>('.post-item[data-tags]'));
  const countEl = document.querySelector<HTMLElement>('[data-archive-count]');
  const emptyEl = list.querySelector<HTMLElement>('[data-filter-empty]');
  const validSlugs = new Set(buttons.map((button) => button.dataset.filterTag ?? 'all'));

  const setExpanded = (expanded: boolean): void => {
    filterBar.dataset.filterExpanded = String(expanded);
    for (const button of overflowButtons) {
      button.hidden = !expanded;
    }
    if (toggleButton) {
      toggleButton.setAttribute('aria-expanded', String(expanded));
      toggleButton.textContent = expanded
        ? 'Show less'
        : (toggleButton.dataset.moreLabel ?? 'Show more');
    }
  };

  const applyFilter = (rawSlug: string, updateHistory: boolean): void => {
    const active = validSlugs.has(rawSlug) ? rawSlug : 'all';

    let activeInOverflow = false;
    for (const button of buttons) {
      const isSelected = (button.dataset.filterTag ?? 'all') === active;
      button.classList.toggle('is-active', isSelected);
      button.setAttribute('aria-pressed', String(isSelected));
      if (isSelected && button.hasAttribute('data-filter-overflow')) {
        activeInOverflow = true;
      }
    }

    if (activeInOverflow) {
      setExpanded(true);
    }

    let visibleCount = 0;
    for (const item of items) {
      const tags = (item.dataset.tags ?? '').split(',').filter(Boolean);
      const visible = active === 'all' || tags.includes(active);
      item.hidden = !visible;
      if (visible) visibleCount += 1;
    }

    if (countEl) {
      countEl.textContent = `${visibleCount} ${visibleCount === 1 ? 'post' : 'posts'}`;
    }

    if (emptyEl) {
      emptyEl.hidden = visibleCount > 0;
    }

    if (updateHistory) {
      const url = new URL(window.location.href);
      if (active === 'all') {
        url.searchParams.delete('tag');
      } else {
        url.searchParams.set('tag', active);
      }
      window.history.replaceState(
        window.history.state,
        '',
        `${url.pathname}${url.search}${url.hash}`,
      );
    }
  };

  if (filterBar.dataset.filterBound !== 'true') {
    filterBar.dataset.filterBound = 'true';
    filterBar.addEventListener('click', (event) => {
      if (!(event.target instanceof Element)) return;

      const toggle = event.target.closest<HTMLButtonElement>('[data-filter-toggle]');
      if (toggle) {
        setExpanded(filterBar.dataset.filterExpanded !== 'true');
        return;
      }

      const button = event.target.closest<HTMLButtonElement>('[data-filter-tag]');
      if (!button) return;
      applyFilter(button.dataset.filterTag ?? 'all', true);
    });
  }

  const initialTag = new URLSearchParams(window.location.search).get('tag') ?? 'all';
  applyFilter(initialTag, false);
}

function setup(): void {
  renderThemeControl();
  enhanceCodeBlocks();
  syncTopicFilterFromUrl();
}

document.addEventListener('click', (event) => {
  if (event.target instanceof Element && event.target.closest('[data-theme-toggle]')) {
    toggleTheme();
  }
});

window.addEventListener('popstate', syncTopicFilterFromUrl);

// ClientRouter replaces the body without re-running this bundled module. Apply
// theme before the DOM swap to avoid light/dark flashes, then rebuild per-page controls.
document.addEventListener('astro:before-swap', (event) => {
  const swapEvent = event as Event & { newDocument?: Document };
  if (swapEvent.newDocument) {
    swapEvent.newDocument.documentElement.dataset.theme = readStoredTheme();
  }
});
document.addEventListener('astro:after-swap', applyThemeFromStorage);
document.addEventListener('astro:page-load', setup);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setup, { once: true });
} else {
  setup();
}
