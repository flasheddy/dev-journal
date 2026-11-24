import { describe, expect, test } from 'bun:test';
import type { AiCorpusChunk } from '../../src/lib/contracts';
import {
  isSafeChunkUrl,
  rankCorpusChunks,
  summarizeExcerpt,
  tokenizeQuestion,
} from '../../src/lib/search';

function chunk(overrides: Partial<AiCorpusChunk> = {}): AiCorpusChunk {
  return {
    kind: 'article',
    title: 'Untitled',
    section: 'Overview',
    url: '/blog/untitled/',
    tags: [],
    text: '',
    ...overrides,
  };
}

describe('tokenizeQuestion', () => {
  test('removes stop words', () => {
    expect(tokenizeQuestion('How do I deploy Astro?')).toEqual(['deploy', 'astro']);
  });

  test('falls back to raw tokens when every token is a stop word', () => {
    expect(tokenizeQuestion('What is it?')).toEqual(['what', 'is', 'it']);
  });
});

describe('rankCorpusChunks', () => {
  test('returns an empty array for an empty query', () => {
    const chunks = [chunk({ title: 'Astro guide', text: 'Astro deployment notes' })];

    expect(rankCorpusChunks(chunks, '')).toEqual([]);
    expect(rankCorpusChunks(chunks, '   ')).toEqual([]);
  });

  test('ranks section and title matches above text-only matches', () => {
    const chunks = [
      chunk({
        title: 'Field Guide',
        section: 'Overview',
        url: '/blog/text-only/',
        text: 'Astro deployment notes',
      }),
      chunk({
        title: 'Astro Deployment',
        section: 'Overview',
        url: '/blog/title-match/',
        text: 'Plain notes',
      }),
      chunk({
        title: 'Field Guide',
        section: 'Astro Deployment',
        url: '/blog/section-match/',
        text: 'Plain notes',
      }),
    ];

    expect(rankCorpusChunks(chunks, 'astro deployment').map(({ url }) => url)).toEqual([
      '/blog/section-match/',
      '/blog/title-match/',
      '/blog/text-only/',
    ]);
  });

  test('respects the result limit', () => {
    const chunks = Array.from({ length: 4 }, (_, index) =>
      chunk({ title: `Astro note ${index}`, url: `/blog/note-${index}/` }),
    );

    expect(rankCorpusChunks(chunks, 'astro', 2)).toHaveLength(2);
  });

  test('prefers distinct URLs when available', () => {
    const chunks = [
      chunk({ title: 'Astro one', url: '/blog/shared/' }),
      chunk({ title: 'Astro two', url: '/blog/shared/' }),
      chunk({ title: 'Astro three', url: '/blog/other/' }),
    ];

    expect(rankCorpusChunks(chunks, 'astro', 2).map(({ url }) => url)).toEqual([
      '/blog/shared/',
      '/blog/other/',
    ]);
  });
});

describe('summarizeExcerpt', () => {
  test('collapses whitespace', () => {
    expect(summarizeExcerpt('  Astro\n\tis   great  ')).toBe('Astro is great');
  });

  test('leaves short text unchanged', () => {
    expect(summarizeExcerpt('Short text', 40)).toBe('Short text');
  });

  test('truncates at a word boundary with an ellipsis', () => {
    expect(summarizeExcerpt('The quick brown fox jumps over the lazy dog', 20)).toBe(
      'The quick brown…',
    );
  });
});

describe('isSafeChunkUrl', () => {
  test('accepts internal paths and http(s) URLs', () => {
    expect(isSafeChunkUrl('/blog/x/')).toBe(true);
    expect(isSafeChunkUrl('https://example.com')).toBe(true);
    expect(isSafeChunkUrl('http://example.com')).toBe(true);
  });

  test('rejects protocol-relative, non-http, and relative URLs', () => {
    expect(isSafeChunkUrl('//evil.example/path')).toBe(false);
    expect(isSafeChunkUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeChunkUrl('blog/x/')).toBe(false);
  });
});
