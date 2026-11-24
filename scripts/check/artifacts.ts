import type { Reporter } from './content';
import { isRecord } from './util';

export type ExpectedSearchItem = {
  kind: 'article' | 'project';
  title: string;
  url: string;
};

const SEARCH_LABEL = 'dist/search-index.json';
const CORPUS_LABEL = 'dist/ai-corpus.json';

function isKind(value: unknown): value is ExpectedSearchItem['kind'] {
  return value === 'article' || value === 'project';
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isSafeUrl(value: string): boolean {
  if (value.startsWith('/')) return !value.startsWith('//');
  return /^https?:\/\//i.test(value);
}

export function validateSearchIndex(
  value: unknown,
  expected: readonly ExpectedSearchItem[],
  fail: Reporter,
): void {
  if (!Array.isArray(value)) {
    fail(`${SEARCH_LABEL}: payload is not an array`);
    return;
  }
  if (value.length !== expected.length) {
    fail(`${SEARCH_LABEL}: expected ${expected.length} items, found ${value.length}`);
  }

  for (const [index, item] of value.entries()) {
    const position = index + 1;
    if (!isRecord(item)) {
      fail(`${SEARCH_LABEL}: item ${position} is not an object`);
      continue;
    }

    if (!isKind(item.kind)) fail(`${SEARCH_LABEL}: item ${position} has an invalid kind`);
    if (!isNonEmptyString(item.title)) {
      fail(`${SEARCH_LABEL}: item ${position} has an empty title`);
    }
    if (!isNonEmptyString(item.summary)) {
      fail(`${SEARCH_LABEL}: item ${position} has an empty summary`);
    }
    if (!isNonEmptyString(item.url)) {
      fail(`${SEARCH_LABEL}: item ${position} has an empty url`);
    }
    if (!isStringArray(item.tags)) {
      fail(`${SEARCH_LABEL}: item ${position} has invalid tags`);
    }
    if (item.date !== undefined && typeof item.date !== 'string') {
      fail(`${SEARCH_LABEL}: item ${position} has a non-string date`);
    }

    const match = expected[index];
    if (!match) continue;

    if (item.kind !== match.kind) {
      fail(
        `${SEARCH_LABEL}: item ${position} kind does not match expected ${match.kind}, found ${String(item.kind)}`,
      );
    }
    if (item.title !== match.title) {
      fail(
        `${SEARCH_LABEL}: item ${position} title does not match expected ${JSON.stringify(match.title)}`,
      );
    }
    if (item.url !== match.url) {
      fail(
        `${SEARCH_LABEL}: item ${position} url does not match expected ${JSON.stringify(match.url)}`,
      );
    }
  }
}

export function validateAiCorpus(value: unknown, fail: Reporter): void {
  if (!Array.isArray(value)) {
    fail(`${CORPUS_LABEL}: payload is not an array`);
    return;
  }
  if (value.length === 0) {
    fail(`${CORPUS_LABEL}: payload is empty`);
    return;
  }

  for (const [index, item] of value.entries()) {
    const position = index + 1;
    if (!isRecord(item)) {
      fail(`${CORPUS_LABEL}: item ${position} is not an object`);
      continue;
    }

    if (!isKind(item.kind)) fail(`${CORPUS_LABEL}: item ${position} has an invalid kind`);
    if (!isNonEmptyString(item.title)) {
      fail(`${CORPUS_LABEL}: item ${position} has an empty title`);
    }
    if (!isNonEmptyString(item.section)) {
      fail(`${CORPUS_LABEL}: item ${position} has an empty section`);
    }
    if (!isNonEmptyString(item.url)) {
      fail(`${CORPUS_LABEL}: item ${position} has an empty url`);
    } else if (!isSafeUrl(item.url)) {
      fail(`${CORPUS_LABEL}: item ${position} has an unsafe URL`);
    }
    if (!isStringArray(item.tags)) {
      fail(`${CORPUS_LABEL}: item ${position} has invalid tags`);
    }
    if (!isNonEmptyString(item.text)) {
      fail(`${CORPUS_LABEL}: item ${position} has an empty text`);
    }
  }
}
