import type { AiCorpusChunk } from '../../lib/contracts';
import { isSafeChunkUrl, rankCorpusChunks, summarizeExcerpt } from '../../lib/search';

const askEndpoint = import.meta.env.PUBLIC_ASK_ENDPOINT;

let aiCorpusCache: AiCorpusChunk[] | null = null;
let aiCorpusPromise: Promise<AiCorpusChunk[]> | null = null;
let askJournalController: {
  open: (initialQuestion?: string) => void;
  close: (restoreFocus?: boolean) => void;
  isOpen: () => boolean;
  handleKeydown: (event: KeyboardEvent) => void;
  destroy: () => void;
} | null = null;

export type AskJournalOptions = {
  isPaletteOpen: () => boolean;
  closePalette: () => void;
};

function loadAiCorpus(): Promise<AiCorpusChunk[]> {
  if (aiCorpusCache) return Promise.resolve(aiCorpusCache);
  if (aiCorpusPromise) return aiCorpusPromise;

  aiCorpusPromise = fetch('/ai-corpus.json')
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`AI corpus request failed (${response.status})`);
      }
      const data = (await response.json()) as unknown;
      if (!Array.isArray(data)) {
        throw new Error('AI corpus payload is not an array');
      }
      const normalized: AiCorpusChunk[] = data
        .filter((entry): entry is AiCorpusChunk => {
          if (typeof entry !== 'object' || entry === null) return false;
          const item = entry as Partial<AiCorpusChunk>;
          return (
            (item.kind === 'article' || item.kind === 'project') &&
            typeof item.title === 'string' &&
            typeof item.section === 'string' &&
            typeof item.url === 'string' &&
            isSafeChunkUrl(item.url) &&
            typeof item.text === 'string' &&
            Array.isArray(item.tags)
          );
        })
        .map((item) => ({
          kind: item.kind,
          title: item.title,
          section: item.section,
          url: item.url,
          tags: item.tags.filter((tag): tag is string => typeof tag === 'string'),
          text: item.text,
          ...(typeof item.date === 'string' ? { date: item.date } : {}),
        }));
      aiCorpusCache = normalized;
      return normalized;
    })
    .catch((error) => {
      aiCorpusPromise = null;
      throw error;
    });

  return aiCorpusPromise;
}

async function requestAskSynthesis(
  question: string,
  chunks: AiCorpusChunk[],
  signal: AbortSignal,
): Promise<string | null> {
  if (!askEndpoint) return null;

  try {
    const response = await fetch(askEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/plain',
      },
      body: JSON.stringify({ question, chunks }),
      signal,
    });
    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const payload = (await response.json()) as { answer?: unknown; text?: unknown };
      if (typeof payload.answer === 'string' && payload.answer.trim()) {
        return payload.answer.trim();
      }
      if (typeof payload.text === 'string' && payload.text.trim()) {
        return payload.text.trim();
      }
      return null;
    }

    const text = (await response.text()).trim();
    if (!text || /^<!doctype html/i.test(text) || /^<html/i.test(text)) {
      return null;
    }
    return text;
  } catch {
    return null;
  }
}

export function cleanupAskJournal(): void {
  if (askJournalController) {
    askJournalController.destroy();
    askJournalController = null;
  }
  document.documentElement.classList.remove('has-ask-modal');
}

export function initAskJournal(options: AskJournalOptions): void {
  cleanupAskJournal();

  const modal = document.querySelector<HTMLElement>('[data-ask-modal]');
  const backdrop = modal?.querySelector<HTMLElement>('[data-ask-backdrop]');
  const closeButton = modal?.querySelector<HTMLButtonElement>('[data-ask-close]');
  const form = modal?.querySelector<HTMLFormElement>('[data-ask-form]');
  const input = modal?.querySelector<HTMLInputElement>('[data-ask-input]');
  const submitButton = modal?.querySelector<HTMLButtonElement>('[data-ask-submit]');
  const promptsEl = modal?.querySelector<HTMLElement>('[data-ask-prompts]');
  const statusEl = modal?.querySelector<HTMLElement>('[data-ask-status]');
  const answerEl = modal?.querySelector<HTMLElement>('[data-ask-answer]');
  const modeEl = modal?.querySelector<HTMLElement>('[data-ask-mode]');
  const answerTextEl = modal?.querySelector<HTMLElement>('[data-ask-answer-text]');
  const citationsEl = modal?.querySelector<HTMLElement>('[data-ask-citations]');
  const citationListEl = modal?.querySelector<HTMLOListElement>('[data-ask-citation-list]');
  const trigger = document.querySelector<HTMLButtonElement>('[data-ask-trigger]');

  if (
    !modal ||
    !form ||
    !input ||
    !submitButton ||
    !statusEl ||
    !answerEl ||
    !modeEl ||
    !answerTextEl ||
    !citationsEl ||
    !citationListEl
  ) {
    return;
  }

  let openState = false;
  let previouslyFocused: HTMLElement | null = null;
  let activeRequest: AbortController | null = null;
  let queryGeneration = 0;

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

  const resetResults = (): void => {
    setStatus(null);
    answerEl.hidden = true;
    modeEl.textContent = '';
    answerTextEl.textContent = '';
    citationsEl.hidden = true;
    citationListEl.replaceChildren();
    if (promptsEl) promptsEl.hidden = false;
  };

  const renderCitations = (chunks: AiCorpusChunk[]): void => {
    citationListEl.replaceChildren();
    if (chunks.length === 0) {
      citationsEl.hidden = true;
      return;
    }

    const fragment = document.createDocumentFragment();
    chunks.forEach((chunk, index) => {
      const li = document.createElement('li');
      li.className = 'ask-modal__citation-item';

      const isExternal = /^https?:\/\//i.test(chunk.url);
      const link = document.createElement('a');
      link.className = isExternal ? 'ask-modal__citation external-link' : 'ask-modal__citation';
      link.href = chunk.url;
      if (isExternal) {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      }

      const header = document.createElement('div');
      header.className = 'ask-modal__citation-head';

      const indexBadge = document.createElement('span');
      indexBadge.className = 'ask-modal__citation-index';
      indexBadge.textContent = String(index + 1);

      const label = document.createElement('span');
      label.className = 'ask-modal__citation-label';
      label.textContent = `${chunk.title} · ${chunk.section}`;

      const kind = document.createElement('span');
      kind.className = `command-palette__kind command-palette__kind--${chunk.kind}`;
      kind.textContent = chunk.kind === 'project' ? 'Project' : 'Article';

      header.append(indexBadge, label, kind);

      if (isExternal) {
        const arrow = document.createElement('span');
        arrow.className = 'ask-modal__citation-arrow';
        arrow.setAttribute('aria-hidden', 'true');
        arrow.textContent = '↗';
        header.append(arrow);
      }

      const excerpt = document.createElement('p');
      excerpt.className = 'ask-modal__citation-excerpt';
      excerpt.textContent = summarizeExcerpt(chunk.text);

      link.append(header, excerpt);
      li.append(link);
      fragment.append(li);
    });

    citationListEl.append(fragment);
    citationsEl.hidden = false;
  };

  const runQuestion = async (rawQuestion: string): Promise<void> => {
    const question = rawQuestion.trim();
    if (!question) {
      resetResults();
      input.focus();
      return;
    }

    if (activeRequest) {
      activeRequest.abort();
      activeRequest = null;
    }

    const generation = ++queryGeneration;
    const controller = new AbortController();
    activeRequest = controller;

    if (promptsEl) promptsEl.hidden = true;
    answerEl.hidden = true;
    citationsEl.hidden = true;
    citationListEl.replaceChildren();
    submitButton.disabled = true;
    setStatus(aiCorpusCache ? 'Finding relevant journal passages…' : 'Loading journal corpus…');

    try {
      const corpus = await loadAiCorpus();
      if (!openState || generation !== queryGeneration) return;

      const topChunks = rankCorpusChunks(corpus, question, 3);
      if (topChunks.length === 0) {
        setStatus(
          `No closely matching passages found for “${question}”. Try another topic or tag.`,
        );
        return;
      }

      renderCitations(topChunks);
      if (askEndpoint) setStatus('Checking live synthesis endpoint…');

      const synthesis = await requestAskSynthesis(question, topChunks, controller.signal);
      if (!openState || generation !== queryGeneration) return;

      setStatus(null);
      if (synthesis) {
        modeEl.textContent = 'Synthesized answer';
        modeEl.dataset.mode = 'live';
        answerTextEl.textContent = synthesis;
      } else {
        modeEl.textContent = 'Static mode · Top matched passages';
        modeEl.dataset.mode = 'static';
        answerTextEl.textContent =
          'Live AI synthesis is not active on this static build. Here are the top ranked passages from the journal for your question — follow any citation below to jump directly to the section.';
      }
      answerEl.hidden = false;
    } catch {
      if (!openState || generation !== queryGeneration) return;
      setStatus('Unable to load the journal corpus.');
    } finally {
      if (generation === queryGeneration) {
        submitButton.disabled = false;
        if (activeRequest === controller) {
          activeRequest = null;
        }
      }
    }
  };

  const close = (restoreFocus = true): void => {
    if (!openState) return;
    openState = false;
    queryGeneration += 1;
    if (activeRequest) {
      activeRequest.abort();
      activeRequest = null;
    }
    submitButton.disabled = false;
    modal.hidden = true;
    document.documentElement.classList.remove('has-ask-modal');
    setTriggerExpanded(false);

    if (restoreFocus) {
      const target =
        previouslyFocused &&
        previouslyFocused !== document.body &&
        previouslyFocused.isConnected &&
        !previouslyFocused.closest('[hidden]')
          ? previouslyFocused
          : trigger;
      target?.focus();
    }
    previouslyFocused = null;
  };

  const open = (initialQuestion = ''): void => {
    if (options.isPaletteOpen()) {
      options.closePalette();
    }

    if (!openState) {
      previouslyFocused =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      openState = true;
      modal.hidden = false;
      document.documentElement.classList.add('has-ask-modal');
      setTriggerExpanded(true);
      // Warm up the static corpus lazily on first open.
      void loadAiCorpus().catch(() => {
        // Error state is handled cleanly if the user submits a question.
      });
    }

    const trimmed = initialQuestion.trim();
    if (trimmed) {
      input.value = trimmed;
      input.focus();
      void runQuestion(trimmed);
    } else {
      if (!input.value.trim()) {
        resetResults();
      }
      input.focus();
      input.select();
    }
  };

  const handleFormSubmit = (event: SubmitEvent): void => {
    event.preventDefault();
    void runQuestion(input.value);
  };

  const handleBackdropClick = (): void => {
    close(true);
  };

  const handleCloseClick = (): void => {
    close(true);
  };

  const handlePromptsClick = (event: MouseEvent): void => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest<HTMLButtonElement>('[data-ask-suggestion]');
    if (!button) return;
    const suggestion = button.dataset.askSuggestion ?? '';
    if (!suggestion) return;
    input.value = suggestion;
    void runQuestion(suggestion);
  };

  const handleCitationsClick = (event: MouseEvent): void => {
    if (!(event.target instanceof Element)) return;
    const link = event.target.closest<HTMLAnchorElement>('a.ask-modal__citation');
    if (!link) return;
    const isExternal = link.target === '_blank';
    close(isExternal);
  };

  const getFocusableElements = (): HTMLElement[] => {
    const candidates = Array.from(
      modal.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    return candidates.filter((el) => !el.closest('[hidden]') && el.offsetParent !== null);
  };

  const handleKeydown = (event: KeyboardEvent): void => {
    if (!openState) return;

    if (event.key === 'Tab') {
      const focusables = getFocusableElements();
      if (focusables.length === 0) {
        event.preventDefault();
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

  form.addEventListener('submit', handleFormSubmit);
  backdrop?.addEventListener('click', handleBackdropClick);
  closeButton?.addEventListener('click', handleCloseClick);
  promptsEl?.addEventListener('click', handlePromptsClick);
  citationListEl.addEventListener('click', handleCitationsClick);

  askJournalController = {
    open,
    close,
    isOpen: () => openState,
    handleKeydown,
    destroy: () => {
      close(false);
      form.removeEventListener('submit', handleFormSubmit);
      backdrop?.removeEventListener('click', handleBackdropClick);
      closeButton?.removeEventListener('click', handleCloseClick);
      promptsEl?.removeEventListener('click', handlePromptsClick);
      citationListEl.removeEventListener('click', handleCitationsClick);
    },
  };
}

export function openAskJournal(initialQuestion?: string): void {
  askJournalController?.open(initialQuestion);
}

export function closeAskJournal(restoreFocus = true): void {
  askJournalController?.close(restoreFocus);
}

export function isAskJournalOpen(): boolean {
  return askJournalController?.isOpen() ?? false;
}

export function handleAskJournalKeydown(event: KeyboardEvent): void {
  askJournalController?.handleKeydown(event);
}
