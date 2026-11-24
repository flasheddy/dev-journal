import { describe, expect, test } from 'bun:test';
import {
  validateAiCorpus,
  validateSearchIndex,
  type ExpectedSearchItem,
} from '../../scripts/check/artifacts';
import type { Reporter } from '../../scripts/check/content';

function collectFailures(run: (fail: Reporter) => void): string[] {
  const failures: string[] = [];
  run((message) => failures.push(message));
  return failures;
}

const expected: ExpectedSearchItem[] = [
  { kind: 'article', title: 'Hello', url: '/blog/hello/' },
  { kind: 'project', title: 'Project', url: 'https://example.com/project' },
];

function searchItem(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kind: 'article',
    title: 'Hello',
    summary: 'A summary',
    url: '/blog/hello/',
    tags: ['Bun'],
    date: '2026-09-26',
    ...overrides,
  };
}

function corpusItem(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kind: 'article',
    title: 'Hello',
    section: 'Overview',
    url: '/blog/hello/',
    tags: ['Bun'],
    text: 'Corpus text',
    date: '2026-09-26',
    ...overrides,
  };
}

describe('validateSearchIndex', () => {
  test('a valid search index passes', () => {
    const failures = collectFailures((fail) => {
      validateSearchIndex(
        [
          searchItem(),
          searchItem({
            kind: 'project',
            title: 'Project',
            url: 'https://example.com/project',
            date: undefined,
          }),
        ],
        expected,
        fail,
      );
    });

    expect(failures).toEqual([]);
  });

  test('a non-array search index fails', () => {
    const failures = collectFailures((fail) => {
      validateSearchIndex({}, expected, fail);
    });

    expect(failures).toEqual(['dist/search-index.json: payload is not an array']);
  });

  test('a wrong item count fails', () => {
    const failures = collectFailures((fail) => {
      validateSearchIndex([searchItem()], expected, fail);
    });

    expect(failures).toContain('dist/search-index.json: expected 2 items, found 1');
  });

  test('a mismatched kind, title, or URL fails', () => {
    const failures = collectFailures((fail) => {
      validateSearchIndex(
        [searchItem({ kind: 'project', title: 'Other', url: '/blog/other/' })],
        [expected[0]!],
        fail,
      );
    });

    expect(failures).toContain(
      'dist/search-index.json: item 1 kind does not match expected article, found project',
    );
    expect(failures).toContain(
      'dist/search-index.json: item 1 title does not match expected "Hello"',
    );
    expect(failures).toContain(
      'dist/search-index.json: item 1 url does not match expected "/blog/hello/"',
    );
  });

  test('a non-string tag fails', () => {
    const failures = collectFailures((fail) => {
      validateSearchIndex([searchItem({ tags: ['Bun', 7] })], [expected[0]!], fail);
    });

    expect(failures).toContain('dist/search-index.json: item 1 has invalid tags');
  });
});

describe('validateAiCorpus', () => {
  test('a valid AI corpus passes', () => {
    const failures = collectFailures((fail) => {
      validateAiCorpus(
        [corpusItem(), corpusItem({ kind: 'project', url: 'https://example.com/project' })],
        fail,
      );
    });

    expect(failures).toEqual([]);
  });

  test('an empty AI corpus fails', () => {
    const failures = collectFailures((fail) => {
      validateAiCorpus([], fail);
    });

    expect(failures).toEqual(['dist/ai-corpus.json: payload is empty']);
  });

  test('a protocol-relative URL fails', () => {
    const failures = collectFailures((fail) => {
      validateAiCorpus([corpusItem(), corpusItem({ url: '//evil.example/path' })], fail);
    });

    expect(failures).toEqual(['dist/ai-corpus.json: item 2 has an unsafe URL']);
  });

  test('empty text fails', () => {
    const failures = collectFailures((fail) => {
      validateAiCorpus([corpusItem({ text: '   ' })], fail);
    });

    expect(failures).toContain('dist/ai-corpus.json: item 1 has an empty text');
  });
});
