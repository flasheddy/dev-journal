let stopTocScrollSpy: (() => void) | null = null;

export function cleanupTocScrollSpy(): void {
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

export function initTocScrollSpy(): void {
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
    const scrollPaddingTop = parseCssPx(
      window.getComputedStyle(document.documentElement).scrollPaddingTop,
    );
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
