let popstateBound = false;

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

export function initFilters(): void {
  if (!popstateBound) {
    popstateBound = true;
    window.addEventListener('popstate', syncTopicFilterFromUrl);
  }
  syncTopicFilterFromUrl();
  initProjectFilter();
}
