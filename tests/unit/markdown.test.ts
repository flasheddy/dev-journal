import { describe, expect, test } from 'bun:test';
import {
  normalizeInlineSpace,
  splitIntoChunks,
  splitMarkdownByHeadings,
  stripMarkdownToPlainText,
  truncateAtWordBoundary,
} from '../../src/lib/markdown';

describe('stripMarkdownToPlainText', () => {
  test('removes heading, list, blockquote, and horizontal-rule markers', () => {
    const markdown = [
      '# Heading one',
      '## Heading two',
      '###### Heading six',
      '',
      '> Quote line',
      '> > Nested quote',
      '',
      '- first item',
      '* second item',
      '+ third item',
      '1. fourth item',
      '2) fifth item',
      '',
      '---',
    ].join('\n');

    expect(stripMarkdownToPlainText(markdown)).toBe(
      'Heading one\nHeading two\nHeading six\n\nQuote line\nNested quote\n\nfirst item\nsecond item\nthird item\nfourth item\nfifth item',
    );
  });

  test('keeps link and image labels while removing URLs', () => {
    const markdown =
      'See [the docs](https://example.com/docs), ![diagram alt](/img/diagram.png), and [reference][guide].';

    expect(stripMarkdownToPlainText(markdown)).toBe('See the docs, diagram alt, and reference.');
  });

  test('removes HTML comments and tags', () => {
    expect(stripMarkdownToPlainText('Alpha<!-- hidden -->Beta\nGamma<span>Delta</span>')).toBe(
      'Alpha Beta\nGamma Delta',
    );
  });

  test('removes inline formatting markers while preserving text', () => {
    const markdown =
      'Use `bun test` with **bold**, _italic_, ~~struck~~, and \\*escaped\\* markers.';

    expect(stripMarkdownToPlainText(markdown)).toBe(
      'Use bun test with bold, italic, struck, and *escaped* markers.',
    );
  });

  test('drops table separator rows and joins cells into readable text', () => {
    const markdown = ['| Name | Value |', '| :--- | ---: |', '| Alpha | 1 |', '| Beta | 2 |'].join(
      '\n',
    );

    expect(stripMarkdownToPlainText(markdown)).toBe('Name — Value\nAlpha — 1\nBeta — 2');
  });

  test('keeps fenced code content while dropping the fence lines', () => {
    const markdown = [
      'Before',
      '',
      '```ts',
      'const total = 1 + 1;',
      '## still code',
      '```',
      '',
      'After',
    ].join('\n');

    expect(stripMarkdownToPlainText(markdown)).toBe(
      'Before\n\nconst total = 1 + 1;\n## still code\n\nAfter',
    );
  });

  test('strips supported callout markers from quoted prose', () => {
    const markdown = [
      '> [!NOTE]',
      '> Note body.',
      '',
      '> [!TIP] Tip body.',
      '',
      '> [!WARNING]',
      '> Warning body.',
      '',
      '> [!DANGER] Danger body.',
    ].join('\n');

    expect(stripMarkdownToPlainText(markdown)).toBe(
      'Note body.\n\nTip body.\n\nWarning body.\n\nDanger body.',
    );
  });

  test('keeps regular blockquotes and unsupported markers in quoted prose', () => {
    const markdown = [
      '> A normal quote.',
      '',
      '> [!IMPORTANT]',
      '> Important body.',
      '',
      '> [!note] Lowercase body.',
    ].join('\n');

    expect(stripMarkdownToPlainText(markdown)).toBe(
      'A normal quote.\n\n[!IMPORTANT]\nImportant body.\n\n[!note] Lowercase body.',
    );
  });
});

describe('normalizeInlineSpace', () => {
  test('collapses whitespace and trims the result', () => {
    expect(normalizeInlineSpace('  First\n\tsecond   third  ')).toBe('First second third');
  });
});

describe('truncateAtWordBoundary', () => {
  test('returns text that already fits unchanged', () => {
    expect(truncateAtWordBoundary('short text', 20)).toBe('short text');
  });

  test('truncates oversized text at a word boundary with an ellipsis', () => {
    expect(truncateAtWordBoundary('word '.repeat(10).trim(), 20)).toBe('word word word…');
  });
});

describe('splitIntoChunks', () => {
  test('returns no chunks for empty or whitespace-only text', () => {
    expect(splitIntoChunks('')).toEqual([]);
    expect(splitIntoChunks('  \n\n ')).toEqual([]);
  });

  test('keeps a short paragraph in one chunk and merges adjacent paragraphs', () => {
    expect(splitIntoChunks('First paragraph.\n\nSecond\nparagraph.')).toEqual([
      'First paragraph. Second paragraph.',
    ]);
  });

  test('splits long paragraphs at sentence boundaries within maxChars', () => {
    const paragraph = 'Alpha is short. Beta is also short. Gamma is longer than the rest.';
    const chunks = splitIntoChunks(paragraph, 40);

    expect(chunks).toEqual([
      'Alpha is short. Beta is also short.',
      'Gamma is longer than the rest.',
    ]);
    expect(chunks.every((chunk) => chunk.length <= 40)).toBe(true);
  });

  test('truncates an oversized sentence with an ellipsis', () => {
    expect(splitIntoChunks('word '.repeat(10).trim(), 20)).toEqual(['word word word…']);
  });
});

describe('splitMarkdownByHeadings', () => {
  test('builds Overview, H2, and H3 sections with slugs and fallback heading text', () => {
    const body = [
      'Intro text.',
      '',
      '## Getting started',
      '',
      'Install it.',
      '',
      '### Details',
      '',
      'Deep dive.',
      '',
      '## **Final** notes',
      '',
      'Wrap up.',
    ].join('\n');
    const headings = [
      { depth: 1, slug: 'ignored-title', text: 'Ignored title' },
      { depth: 2, slug: 'getting-started', text: 'Getting started' },
    ];

    expect(splitMarkdownByHeadings(body, headings)).toEqual([
      { section: 'Overview', slug: undefined, markdown: 'Intro text.' },
      { section: 'Getting started', slug: 'getting-started', markdown: 'Install it.' },
      { section: 'Details', slug: undefined, markdown: 'Deep dive.' },
      { section: 'Final notes', slug: undefined, markdown: 'Wrap up.' },
    ]);
  });

  test('does not split at H1 or H4 headings', () => {
    const body = ['# Page title', '', 'Intro.', '', '#### Detail', '', 'More.'].join('\n');

    expect(splitMarkdownByHeadings(body, [])).toEqual([
      {
        section: 'Overview',
        slug: undefined,
        markdown: '# Page title\n\nIntro.\n\n#### Detail\n\nMore.',
      },
    ]);
  });

  test('does not split on heading-looking lines inside code fences', () => {
    const body = ['## Real heading', '', '```md', '## Not a heading', '```', '', 'Tail text.'].join(
      '\n',
    );
    const headings = [{ depth: 2, slug: 'real-heading', text: 'Real heading' }];

    expect(splitMarkdownByHeadings(body, headings)).toEqual([
      { section: 'Overview', slug: undefined, markdown: '' },
      {
        section: 'Real heading',
        slug: 'real-heading',
        markdown: '```md\n## Not a heading\n```\n\nTail text.',
      },
    ]);
  });
});
