let stopReadingProgress: (() => void) | null = null;

export function cleanupReadingProgress(): void {
  if (stopReadingProgress) {
    stopReadingProgress();
    stopReadingProgress = null;
  }
}

export function initReadingProgress(): void {
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
