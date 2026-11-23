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

function enhanceHeadingAnchors(): void {
  const status = document.querySelector<HTMLElement>('[data-copy-status]');

  document
    .querySelectorAll<HTMLHeadingElement>(
      '.prose h2[id]:not([data-anchor-enhanced]), .prose h3[id]:not([data-anchor-enhanced])',
    )
    .forEach((heading) => {
      heading.dataset.anchorEnhanced = 'true';
      const title = heading.textContent?.trim() ?? '';

      const anchor = document.createElement('a');
      anchor.className = 'heading-anchor';
      anchor.href = `#${heading.id}`;
      anchor.textContent = '#';
      anchor.setAttribute(
        'aria-label',
        title ? `Copy link to section: ${title}` : 'Copy section link',
      );

      let resetTimer: number | undefined;

      anchor.addEventListener('click', async () => {
        try {
          const shareUrl = new URL(`#${heading.id}`, window.location.href).href;
          await copyText(shareUrl);
          anchor.dataset.copied = 'true';
          if (status) status.textContent = 'Section link copied to clipboard';
          if (resetTimer !== undefined) window.clearTimeout(resetTimer);
          resetTimer = window.setTimeout(() => {
            delete anchor.dataset.copied;
          }, 1600);
        } catch {
          // Hash navigation still succeeds if clipboard access is unavailable.
        }
      });

      heading.append(anchor);
    });
}

let stopReadingProgress: (() => void) | null = null;

function cleanupReadingProgress(): void {
  if (stopReadingProgress) {
    stopReadingProgress();
    stopReadingProgress = null;
  }
}

function initReadingProgress(): void {
  cleanupReadingProgress();

  const bar = document.querySelector<HTMLElement>('[data-reading-progress-bar]');
  const article = document.querySelector<HTMLElement>('[data-article-body]');
  if (!bar || !article) return;

  let frameId = 0;

  const update = (): void => {
    frameId = 0;
    const rect = article.getBoundingClientRect();
    const scrollable = Math.max(1, article.offsetHeight - window.innerHeight);
    const scrolled = Math.min(scrollable, Math.max(0, -rect.top));
    const ratio = Math.min(1, Math.max(0, scrolled / scrollable));
    bar.style.transform = `scaleX(${ratio.toFixed(4)})`;
  };

  const scheduleUpdate = (): void => {
    if (frameId !== 0) return;
    frameId = window.requestAnimationFrame(update);
  };

  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate, { passive: true });
  update();

  stopReadingProgress = () => {
    window.removeEventListener('scroll', scheduleUpdate);
    window.removeEventListener('resize', scheduleUpdate);
    if (frameId !== 0) {
      window.cancelAnimationFrame(frameId);
      frameId = 0;
    }
  };
}

let stopTocScrollSpy: (() => void) | null = null;

function cleanupTocScrollSpy(): void {
  if (stopTocScrollSpy) {
    stopTocScrollSpy();
    stopTocScrollSpy = null;
  }
}

interface TocEntry {
  id: string;
  link: HTMLAnchorElement;
  heading: HTMLElement;
}

function parseCssPx(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function decodeHashId(rawHash: string | undefined): string {
  if (!rawHash) return '';
  try {
    return decodeURIComponent(rawHash);
  } catch {
    return rawHash;
  }
}

function initTocScrollSpy(): void {
  cleanupTocScrollSpy();

  const tocContainer = document.querySelector<HTMLElement>('.article-toc');
  const tocRail = tocContainer?.querySelector<HTMLElement>('.toc-rail');
  if (!tocContainer || !tocRail) return;

  const entries: TocEntry[] = [];
  const entryById = new Map<string, TocEntry>();

  for (const link of tocRail.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')) {
    const id = decodeHashId(link.getAttribute('href')?.slice(1));
    if (!id) continue;
    const heading = document.getElementById(id);
    if (!heading) continue;
    const entry: TocEntry = { id, link, heading };
    entries.push(entry);
    entryById.set(id, entry);
  }
  if (entries.length === 0) return;

  let activeLink: HTMLAnchorElement | null = null;

  const setActive = (target: TocEntry): void => {
    if (target.link === activeLink) return;
    activeLink = target.link;
    for (const entry of entries) {
      const active = entry.link === target.link;
      entry.link.classList.toggle('is-active', active);
      if (active) {
        entry.link.setAttribute('aria-current', 'location');
      } else {
        entry.link.removeAttribute('aria-current');
      }
    }
  };

  const getActivationThreshold = (heading: HTMLElement): number => {
    const scrollPaddingTop = parseCssPx(window.getComputedStyle(root).scrollPaddingTop);
    const scrollMarginTop = parseCssPx(window.getComputedStyle(heading).scrollMarginTop);
    const scrollOffset = scrollPaddingTop + scrollMarginTop;
    return (scrollOffset > 0 ? scrollOffset : 88) + 32;
  };

  let scrollLocked = false;
  let unlockTimer: number | undefined;
  let frameId = 0;

  const computeActive = (): void => {
    frameId = 0;
    if (scrollLocked) return;

    const atBottom =
      window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
    if (atBottom) {
      setActive(entries[entries.length - 1]);
      return;
    }

    let current = entries[0];
    for (const entry of entries) {
      const threshold = getActivationThreshold(entry.heading);
      if (entry.heading.getBoundingClientRect().top <= threshold) {
        current = entry;
      }
    }
    setActive(current);
  };

  const handleScrollEnd = (): void => {
    clearScrollLock();
    computeActive();
  };

  const clearScrollLock = (): void => {
    scrollLocked = false;
    if (unlockTimer !== undefined) {
      window.clearTimeout(unlockTimer);
      unlockTimer = undefined;
    }
    window.removeEventListener('scrollend', handleScrollEnd);
  };

  const lockForClick = (target: TocEntry): void => {
    setActive(target);
    clearScrollLock();
    scrollLocked = true;
    window.addEventListener('scrollend', handleScrollEnd, { once: true });
    unlockTimer = window.setTimeout(handleScrollEnd, 650);
  };

  const scheduleCompute = (): void => {
    if (scrollLocked) {
      if (unlockTimer !== undefined) window.clearTimeout(unlockTimer);
      unlockTimer = window.setTimeout(handleScrollEnd, 220);
      return;
    }
    if (frameId !== 0) return;
    frameId = window.requestAnimationFrame(computeActive);
  };

  const handleTocClick = (event: MouseEvent): void => {
    if (!(event.target instanceof Element)) return;
    const anchor = event.target.closest<HTMLAnchorElement>('a[href^="#"]');
    if (!anchor) return;
    const id = decodeHashId(anchor.getAttribute('href')?.slice(1));
    const entry = entryById.get(id);
    if (entry) {
      lockForClick(entry);
    }
  };

  tocContainer.addEventListener('click', handleTocClick);
  window.addEventListener('scroll', scheduleCompute, { passive: true });
  window.addEventListener('resize', scheduleCompute, { passive: true });

  const initialEntry = entryById.get(decodeHashId(window.location.hash.slice(1)));
  if (initialEntry) {
    setActive(initialEntry);
  } else {
    computeActive();
  }

  stopTocScrollSpy = () => {
    clearScrollLock();
    tocContainer.removeEventListener('click', handleTocClick);
    window.removeEventListener('scroll', scheduleCompute);
    window.removeEventListener('resize', scheduleCompute);
    if (frameId !== 0) {
      window.cancelAnimationFrame(frameId);
      frameId = 0;
    }
  };
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

function initProjectFilter(): void {
  const filterBar = document.querySelector<HTMLElement>('[data-project-filter]');
  const list = document.querySelector<HTMLElement>('[data-project-list]');
  if (!filterBar || !list) return;

  const buttons = Array.from(filterBar.querySelectorAll<HTMLButtonElement>('[data-filter-tag]'));
  const items = Array.from(list.querySelectorAll<HTMLElement>('.project-card[data-tags]'));
  const emptyEl = list.querySelector<HTMLElement>('[data-project-empty]');
  if (buttons.length === 0) return;

  const validSlugs = new Set(buttons.map((button) => button.dataset.filterTag ?? 'all'));

  const applyFilter = (rawSlug: string): void => {
    const active = validSlugs.has(rawSlug) ? rawSlug : 'all';

    for (const button of buttons) {
      const isSelected = (button.dataset.filterTag ?? 'all') === active;
      button.classList.toggle('is-active', isSelected);
      button.setAttribute('aria-pressed', String(isSelected));
    }

    let visibleCount = 0;
    for (const item of items) {
      const tags = (item.dataset.tags ?? '').split(',').filter(Boolean);
      const visible = active === 'all' || tags.includes(active);
      item.hidden = !visible;
      if (visible) visibleCount += 1;
    }

    if (emptyEl) {
      emptyEl.hidden = visibleCount > 0;
    }
  };

  if (filterBar.dataset.filterBound !== 'true') {
    filterBar.dataset.filterBound = 'true';
    filterBar.addEventListener('click', (event) => {
      if (!(event.target instanceof Element)) return;
      const button = event.target.closest<HTMLButtonElement>('[data-filter-tag]');
      if (!button) return;
      applyFilter(button.dataset.filterTag ?? 'all');
    });
  }

  const activeButton = buttons.find((button) => button.classList.contains('is-active'));
  applyFilter(activeButton?.dataset.filterTag ?? 'all');
}

interface SearchIndexItem {
  kind: 'article' | 'project';
  title: string;
  summary: string;
  url: string;
  tags: string[];
  date?: string;
}

let searchIndexCache: SearchIndexItem[] | null = null;
let searchIndexPromise: Promise<SearchIndexItem[]> | null = null;
let commandPaletteController: {
  open: () => void;
  close: (restoreFocus?: boolean) => void;
  isOpen: () => boolean;
  handleKeydown: (event: KeyboardEvent) => void;
  destroy: () => void;
} | null = null;

function isApplePlatform(): boolean {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = nav.userAgentData?.platform ?? navigator.platform ?? navigator.userAgent;
  return /Mac|iPhone|iPad|iPod/i.test(platform);
}

function formatSearchDate(iso: string): string {
  const parsed = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf())) return iso;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}

function loadSearchIndex(): Promise<SearchIndexItem[]> {
  if (searchIndexCache) return Promise.resolve(searchIndexCache);
  if (searchIndexPromise) return searchIndexPromise;

  searchIndexPromise = fetch('/search-index.json')
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Search index request failed (${response.status})`);
      }
      const data = (await response.json()) as unknown;
      if (!Array.isArray(data)) {
        throw new Error('Search index payload is not an array');
      }
      const normalized: SearchIndexItem[] = data
        .filter((entry): entry is SearchIndexItem => {
          if (typeof entry !== 'object' || entry === null) return false;
          const item = entry as Partial<SearchIndexItem>;
          return (
            (item.kind === 'article' || item.kind === 'project') &&
            typeof item.title === 'string' &&
            typeof item.summary === 'string' &&
            typeof item.url === 'string' &&
            Array.isArray(item.tags)
          );
        })
        .map((item) => ({
          kind: item.kind,
          title: item.title,
          summary: item.summary,
          url: item.url,
          tags: item.tags.filter((tag): tag is string => typeof tag === 'string'),
          ...(typeof item.date === 'string' ? { date: item.date } : {}),
        }));
      searchIndexCache = normalized;
      return normalized;
    })
    .catch((error) => {
      searchIndexPromise = null;
      throw error;
    });

  return searchIndexPromise;
}

function rankSearchItems(items: SearchIndexItem[], query: string): SearchIndexItem[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return items;

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  const scored: Array<{ item: SearchIndexItem; score: number; index: number }> = [];

  items.forEach((item, index) => {
    const titleLower = item.title.toLowerCase();
    const summaryLower = item.summary.toLowerCase();
    const tagsLower = item.tags.map((tag) => tag.toLowerCase());
    const kindLower = item.kind;

    let score = 0;
    for (const token of tokens) {
      let tokenScore = 0;
      if (titleLower.startsWith(token)) {
        tokenScore += 34;
      } else if (titleLower.includes(` ${token}`) || titleLower.includes(`-${token}`)) {
        tokenScore += 28;
      } else if (titleLower.includes(token)) {
        tokenScore += 20;
      }

      if (tagsLower.some((tag) => tag === token)) {
        tokenScore += 24;
      } else if (tagsLower.some((tag) => tag.startsWith(token))) {
        tokenScore += 18;
      } else if (tagsLower.some((tag) => tag.includes(token))) {
        tokenScore += 12;
      }

      if (summaryLower.includes(token)) {
        tokenScore += 6;
      }

      if (kindLower.startsWith(token)) {
        tokenScore += 5;
      }

      if (tokenScore === 0) return;
      score += tokenScore;
    }

    if (titleLower.startsWith(normalizedQuery)) {
      score += 120;
    } else if (titleLower.includes(normalizedQuery)) {
      score += 80;
    }

    if (tagsLower.some((tag) => tag === normalizedQuery)) {
      score += 70;
    }

    scored.push({ item, score, index });
  });

  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return scored.map((entry) => entry.item);
}

function cleanupCommandPalette(): void {
  if (commandPaletteController) {
    commandPaletteController.destroy();
    commandPaletteController = null;
  }
  root.classList.remove('has-command-palette');
}

function initCommandPalette(): void {
  cleanupCommandPalette();

  const kbd = document.querySelector<HTMLElement>('[data-search-kbd]');
  if (kbd) {
    kbd.textContent = isApplePlatform() ? '⌘K' : 'Ctrl K';
  }

  const palette = document.querySelector<HTMLElement>('[data-command-palette]');
  const input = palette?.querySelector<HTMLInputElement>('[data-command-input]');
  const resultsList = palette?.querySelector<HTMLUListElement>('[data-command-results]');
  const statusEl = palette?.querySelector<HTMLElement>('[data-command-status]');
  const closeButton = palette?.querySelector<HTMLButtonElement>('[data-command-close]');
  const backdrop = palette?.querySelector<HTMLElement>('[data-command-backdrop]');
  const trigger = document.querySelector<HTMLButtonElement>('[data-search-trigger]');

  if (!palette || !input || !resultsList || !statusEl) return;

  let openState = false;
  let activeIndex = -1;
  let renderedItems: SearchIndexItem[] = [];
  let previouslyFocused: HTMLElement | null = null;
  let renderGeneration = 0;

  const setTriggerExpanded = (expanded: boolean): void => {
    trigger?.setAttribute('aria-expanded', String(expanded));
  };

  const setStatus = (message: string | null): void => {
    if (message) {
      statusEl.textContent = message;
      statusEl.hidden = false;
    } else {
      statusEl.textContent = '';
      statusEl.hidden = true;
    }
  };

  const setSelectedIndex = (nextIndex: number, scrollIntoView: boolean): void => {
    const options = Array.from(
      resultsList.querySelectorAll<HTMLLIElement>('[data-command-option]'),
    );
    if (options.length === 0) {
      activeIndex = -1;
      input.removeAttribute('aria-activedescendant');
      return;
    }

    const bounded = ((nextIndex % options.length) + options.length) % options.length;
    activeIndex = bounded;

    options.forEach((option, index) => {
      const selected = index === bounded;
      option.classList.toggle('is-selected', selected);
      option.setAttribute('aria-selected', String(selected));
      if (selected) {
        input.setAttribute('aria-activedescendant', option.id);
        if (scrollIntoView) {
          option.scrollIntoView({ block: 'nearest' });
        }
      }
    });
  };

  const renderResults = (items: SearchIndexItem[], query: string): void => {
    renderedItems = items;
    resultsList.replaceChildren();

    if (items.length === 0) {
      activeIndex = -1;
      input.removeAttribute('aria-activedescendant');
      setStatus(
        query.trim()
          ? `No matching articles or projects for “${query.trim()}”.`
          : 'No searchable items available.',
      );
      return;
    }

    setStatus(null);
    const fragment = document.createDocumentFragment();

    items.forEach((item, index) => {
      const li = document.createElement('li');
      li.id = `command-option-${index}`;
      li.className = 'command-palette__option';
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', 'false');
      li.dataset.commandOption = String(index);

      const isExternal = /^https?:\/\//i.test(item.url);
      const link = document.createElement('a');
      link.className = isExternal ? 'command-palette__item external-link' : 'command-palette__item';
      link.href = item.url;
      link.tabIndex = -1;
      if (isExternal) {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      }

      const topRow = document.createElement('div');
      topRow.className = 'command-palette__item-top';

      const kindBadge = document.createElement('span');
      kindBadge.className = `command-palette__kind command-palette__kind--${item.kind}`;
      kindBadge.textContent = item.kind === 'project' ? 'Project' : 'Article';
      topRow.append(kindBadge);

      const titleEl = document.createElement('span');
      titleEl.className = 'command-palette__title';
      titleEl.textContent = item.title;
      topRow.append(titleEl);

      if (item.date) {
        const metaEl = document.createElement('span');
        metaEl.className = 'command-palette__meta';
        metaEl.textContent = formatSearchDate(item.date);
        topRow.append(metaEl);
      } else if (isExternal) {
        const arrowEl = document.createElement('span');
        arrowEl.className = 'command-palette__meta';
        arrowEl.setAttribute('aria-hidden', 'true');
        arrowEl.textContent = '↗';
        topRow.append(arrowEl);
      }

      const summaryEl = document.createElement('p');
      summaryEl.className = 'command-palette__summary';
      summaryEl.textContent = item.summary;

      link.append(topRow, summaryEl);

      if (item.tags.length > 0) {
        const tagsRow = document.createElement('div');
        tagsRow.className = 'command-palette__tags';
        item.tags.slice(0, 4).forEach((tag) => {
          const tagEl = document.createElement('span');
          tagEl.className = 'command-palette__tag';
          tagEl.textContent = tag;
          tagsRow.append(tagEl);
        });
        link.append(tagsRow);
      }

      li.append(link);
      fragment.append(li);
    });

    resultsList.append(fragment);
    setSelectedIndex(0, false);
  };

  const updateQuery = async (query: string): Promise<void> => {
    const generation = ++renderGeneration;
    if (!searchIndexCache) {
      resultsList.replaceChildren();
      setStatus('Loading search index…');
    }

    try {
      const indexItems = await loadSearchIndex();
      if (!openState || generation !== renderGeneration) return;
      const matches = rankSearchItems(indexItems, query);
      renderResults(matches, query);
    } catch {
      if (!openState || generation !== renderGeneration) return;
      resultsList.replaceChildren();
      activeIndex = -1;
      input.removeAttribute('aria-activedescendant');
      setStatus('Unable to load search index.');
    }
  };

  const close = (restoreFocus = true): void => {
    if (!openState) return;
    openState = false;
    renderGeneration += 1;
    palette.hidden = true;
    root.classList.remove('has-command-palette');
    setTriggerExpanded(false);
    input.value = '';
    input.removeAttribute('aria-activedescendant');
    activeIndex = -1;

    if (restoreFocus) {
      const target =
        previouslyFocused && previouslyFocused.isConnected ? previouslyFocused : trigger;
      target?.focus();
    }
    previouslyFocused = null;
  };

  const open = (): void => {
    if (openState) {
      input.focus();
      input.select();
      return;
    }

    previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    openState = true;
    palette.hidden = false;
    root.classList.add('has-command-palette');
    setTriggerExpanded(true);
    input.value = '';
    input.focus();
    void updateQuery('');
  };

  const handleInput = (): void => {
    void updateQuery(input.value);
  };

  const handleBackdropClick = (): void => {
    close(true);
  };

  const handleCloseClick = (): void => {
    close(true);
  };

  const handleResultsMouseMove = (event: MouseEvent): void => {
    if (!(event.target instanceof Element)) return;
    const option = event.target.closest<HTMLLIElement>('[data-command-option]');
    if (!option) return;
    const index = Number.parseInt(option.dataset.commandOption ?? '', 10);
    if (Number.isInteger(index) && index !== activeIndex) {
      setSelectedIndex(index, false);
    }
  };

  const handleResultsClick = (event: MouseEvent): void => {
    if (!(event.target instanceof Element)) return;
    const link = event.target.closest<HTMLAnchorElement>('a.command-palette__item');
    if (!link) return;
    const isExternal = link.target === '_blank';
    close(isExternal);
  };

  const handleKeydown = (event: KeyboardEvent): void => {
    if (!openState) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (renderedItems.length > 0) {
        setSelectedIndex(activeIndex + 1, true);
      }
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (renderedItems.length > 0) {
        setSelectedIndex(activeIndex <= 0 ? renderedItems.length - 1 : activeIndex - 1, true);
      }
      return;
    }

    if (event.key === 'Enter') {
      const activeOption = resultsList.querySelector<HTMLLIElement>(
        `[data-command-option="${activeIndex}"]`,
      );
      const link = activeOption?.querySelector<HTMLAnchorElement>('a.command-palette__item');
      if (link) {
        event.preventDefault();
        const isExternal = link.target === '_blank';
        link.click();
        close(isExternal);
      }
      return;
    }

    if (event.key === 'Tab') {
      const focusables = [input, closeButton].filter(
        (el): el is HTMLInputElement | HTMLButtonElement => Boolean(el),
      );
      if (focusables.length < 2) {
        event.preventDefault();
        input.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  input.addEventListener('input', handleInput);
  backdrop?.addEventListener('click', handleBackdropClick);
  closeButton?.addEventListener('click', handleCloseClick);
  resultsList.addEventListener('mousemove', handleResultsMouseMove);
  resultsList.addEventListener('click', handleResultsClick);

  commandPaletteController = {
    open,
    close,
    isOpen: () => openState,
    handleKeydown,
    destroy: () => {
      close(false);
      input.removeEventListener('input', handleInput);
      backdrop?.removeEventListener('click', handleBackdropClick);
      closeButton?.removeEventListener('click', handleCloseClick);
      resultsList.removeEventListener('mousemove', handleResultsMouseMove);
      resultsList.removeEventListener('click', handleResultsClick);
    },
  };
}

function setup(): void {
  renderThemeControl();
  enhanceCodeBlocks();
  enhanceHeadingAnchors();
  syncTopicFilterFromUrl();
  initProjectFilter();
  initCommandPalette();
  initReadingProgress();
  initTocScrollSpy();
}

document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  if (event.target.closest('[data-theme-toggle]')) {
    toggleTheme();
    return;
  }
  if (event.target.closest('[data-search-trigger]')) {
    commandPaletteController?.open();
  }
});

document.addEventListener('keydown', (event) => {
  if (
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    !event.shiftKey &&
    event.key.toLowerCase() === 'k'
  ) {
    event.preventDefault();
    if (commandPaletteController?.isOpen()) {
      commandPaletteController.close(true);
    } else {
      commandPaletteController?.open();
    }
    return;
  }

  if (commandPaletteController?.isOpen()) {
    commandPaletteController.handleKeydown(event);
  }
});

window.addEventListener('popstate', syncTopicFilterFromUrl);

// ClientRouter replaces the body without re-running this bundled module. Clean up
// page-scoped observers/listeners and apply theme before the DOM swap, then rebuild controls.
document.addEventListener('astro:before-swap', (event) => {
  cleanupCommandPalette();
  cleanupReadingProgress();
  cleanupTocScrollSpy();
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
