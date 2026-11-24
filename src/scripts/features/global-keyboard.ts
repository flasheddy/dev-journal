import { closeAskJournal, handleAskJournalKeydown, isAskJournalOpen } from './ask-journal';
import {
  closeCommandPalette,
  handleCommandPaletteKeydown,
  isCommandPaletteOpen,
  openCommandPalette,
} from './command-palette';

let stopGlobalKeyboard: (() => void) | null = null;

export function cleanupGlobalKeyboard(): void {
  if (stopGlobalKeyboard) {
    stopGlobalKeyboard();
    stopGlobalKeyboard = null;
  }
}

export function initGlobalKeyboard(): void {
  cleanupGlobalKeyboard();

  const handleKeydown = (event: KeyboardEvent): void => {
    if (
      (event.metaKey || event.ctrlKey) &&
      !event.altKey &&
      !event.shiftKey &&
      event.key.toLowerCase() === 'k'
    ) {
      event.preventDefault();
      if (isCommandPaletteOpen()) {
        closeCommandPalette(true);
      } else {
        openCommandPalette();
      }
      return;
    }

    if (event.key === 'Escape' || event.code === 'Escape') {
      if (isAskJournalOpen()) {
        event.preventDefault();
        closeAskJournal(true);
        return;
      }
      if (isCommandPaletteOpen()) {
        event.preventDefault();
        closeCommandPalette(true);
        return;
      }
    }

    if (isAskJournalOpen()) {
      handleAskJournalKeydown(event);
      return;
    }

    if (isCommandPaletteOpen()) {
      handleCommandPaletteKeydown(event);
    }
  };

  document.addEventListener('keydown', handleKeydown, true);
  stopGlobalKeyboard = () => {
    document.removeEventListener('keydown', handleKeydown, true);
  };
}
