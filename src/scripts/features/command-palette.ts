import type { SearchIndexItem } from '../../lib/contracts';
import { rankSearchItems } from '../../lib/search';

let searchIndexCache: SearchIndexItem[] | null = null;
let searchIndexPromise: Promise<SearchIndexItem[]> | null = null;
let commandPaletteController: {
  open: () => void;
  close: (restoreFocus?: boolean) => void;
  isOpen: () => boolean;
  handleKeydown: (event: KeyboardEvent) => void;
  destroy: () => void;
} | null = null;

export type CommandPaletteOptions = {
  onAsk: (query: string) => void;
  onBeforeOpen?: () => void;
};

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

export function cleanupCommandPalette(): void {
  if (commandPaletteController) {
    commandPaletteController.destroy();
    commandPaletteController = null;
  }
  document.documentElement.classList.remove('has-command-palette');
}

export function initCommandPalette(options: CommandPaletteOptions): void {
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
    resultsList.replaceChildren();

    const trimmedQuery = query.trim();
    const fragment = document.createDocumentFragment();
    let optionIndex = 0;

    const appendAskAction = (): void => {
      const li = document.createElement('li');
      li.id = `command-option-${optionIndex}`;
      li.className = 'command-palette__option';
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', 'false');
      li.dataset.commandOption = String(optionIndex);
      optionIndex += 1;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'command-palette__item command-palette__item--action';
      button.tabIndex = -1;
      button.dataset.commandAsk = trimmedQuery;

      const topRow = document.createElement('div');
      topRow.className = 'command-palette__item-top';

      const kindBadge = document.createElement('span');
      kindBadge.className = 'command-palette__kind command-palette__kind--action';
      kindBadge.textContent = 'Ask';
      topRow.append(kindBadge);

      const titleEl = document.createElement('span');
      titleEl.className = 'command-palette__title';
      titleEl.textContent = trimmedQuery ? `Ask Journal about “${trimmedQuery}”` : 'Ask Journal';
      topRow.append(titleEl);

      const metaEl = document.createElement('span');
      metaEl.className = 'command-palette__meta';
      metaEl.textContent = 'Cited passages';
      topRow.append(metaEl);

      const summaryEl = document.createElement('p');
      summaryEl.className = 'command-palette__summary';
      summaryEl.textContent = trimmedQuery
        ? 'Search matching sections across articles and projects with citations.'
        : 'Ask a question and jump straight to the highest-ranked sections.';

      button.append(topRow, summaryEl);
      li.append(button);
      fragment.append(li);
    };

    if (items.length === 0) {
      if (trimmedQuery) {
        setStatus(null);
        appendAskAction();
        resultsList.append(fragment);
        setSelectedIndex(0, false);
        return;
      }

      activeIndex = -1;
      input.removeAttribute('aria-activedescendant');
      setStatus('No searchable items available.');
      return;
    }

    setStatus(null);

    if (!trimmedQuery) {
      appendAskAction();
    }

    items.forEach((item) => {
      const li = document.createElement('li');
      li.id = `command-option-${optionIndex}`;
      li.className = 'command-palette__option';
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', 'false');
      li.dataset.commandOption = String(optionIndex);
      optionIndex += 1;

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

    if (trimmedQuery) {
      appendAskAction();
    }

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
    document.documentElement.classList.remove('has-command-palette');
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
    options.onBeforeOpen?.();
    if (openState) {
      input.focus();
      input.select();
      return;
    }

    previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    openState = true;
    palette.hidden = false;
    document.documentElement.classList.add('has-command-palette');
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
    const askButton = event.target.closest<HTMLButtonElement>('[data-command-ask]');
    if (askButton) {
      const prefill = askButton.dataset.commandAsk ?? '';
      close(false);
      options.onAsk(prefill);
      return;
    }
    const link = event.target.closest<HTMLAnchorElement>('a.command-palette__item');
    if (!link) return;
    const isExternal = link.target === '_blank';
    close(isExternal);
  };

  const handleKeydown = (event: KeyboardEvent): void => {
    if (!openState) return;

    const optionCount = resultsList.querySelectorAll('[data-command-option]').length;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (optionCount > 0) {
        setSelectedIndex(activeIndex + 1, true);
      }
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (optionCount > 0) {
        setSelectedIndex(activeIndex <= 0 ? optionCount - 1 : activeIndex - 1, true);
      }
      return;
    }

    if (event.key === 'Enter') {
      const activeOption = resultsList.querySelector<HTMLLIElement>(
        `[data-command-option="${activeIndex}"]`,
      );
      const askButton = activeOption?.querySelector<HTMLButtonElement>('[data-command-ask]');
      if (askButton) {
        event.preventDefault();
        const prefill = askButton.dataset.commandAsk ?? '';
        close(false);
        options.onAsk(prefill);
        return;
      }
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

export function openCommandPalette(): void {
  commandPaletteController?.open();
}

export function closeCommandPalette(restoreFocus = true): void {
  commandPaletteController?.close(restoreFocus);
}

export function isCommandPaletteOpen(): boolean {
  return commandPaletteController?.isOpen() ?? false;
}

export function handleCommandPaletteKeydown(event: KeyboardEvent): void {
  commandPaletteController?.handleKeydown(event);
}
