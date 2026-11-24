import {
  cleanupAskJournal,
  closeAskJournal,
  initAskJournal,
  openAskJournal,
} from './features/ask-journal';
import {
  cleanupCommandPalette,
  closeCommandPalette,
  initCommandPalette,
  isCommandPaletteOpen,
  openCommandPalette,
} from './features/command-palette';
import { initContentEnhancements } from './features/content-enhancements';
import { initFilters } from './features/filters';
import { cleanupGlobalKeyboard, initGlobalKeyboard } from './features/global-keyboard';
import { cleanupReadingProgress, initReadingProgress } from './features/reading-progress';
import { applyThemeFromStorage, initTheme, readStoredTheme, toggleTheme } from './features/theme';
import { cleanupTocScrollSpy, initTocScrollSpy } from './features/toc';

function setup(): void {
  initGlobalKeyboard();
  initTheme();
  initContentEnhancements();
  initFilters();
  initCommandPalette({
    onAsk: openAskJournal,
    onBeforeOpen: () => closeAskJournal(false),
  });
  initAskJournal({
    isPaletteOpen: isCommandPaletteOpen,
    closePalette: () => closeCommandPalette(false),
  });
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
    openCommandPalette();
    return;
  }
  if (event.target.closest('[data-ask-trigger]')) {
    openAskJournal();
  }
});

// ClientRouter replaces the body without re-running this bundled module. Clean up
// page-scoped observers/listeners and apply theme before the DOM swap, then rebuild controls.
document.addEventListener('astro:before-swap', (event) => {
  cleanupGlobalKeyboard();
  cleanupCommandPalette();
  cleanupAskJournal();
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
