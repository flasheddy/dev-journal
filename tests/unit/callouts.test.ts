import { describe, expect, test } from 'bun:test';
import { markdownToHtml } from 'satteri';
import {
  calloutPlugin,
  readCalloutMarker,
  stripCalloutMarker,
  tableWrapperPlugin,
} from '../../src/lib/callouts';

async function render(markdown: string): Promise<string> {
  const result = await markdownToHtml(markdown, {
    hastPlugins: [calloutPlugin, tableWrapperPlugin],
  });
  return result.html;
}

const VARIANTS = [
  { marker: 'NOTE', kind: 'note', label: 'Note' },
  { marker: 'TIP', kind: 'tip', label: 'Tip' },
  { marker: 'WARNING', kind: 'warning', label: 'Warning' },
  { marker: 'DANGER', kind: 'danger', label: 'Danger' },
] as const;

describe('callout marker parsing', () => {
  test('reads the four supported markers and their inline content', () => {
    for (const variant of VARIANTS) {
      expect(readCalloutMarker(`[!${variant.marker}] Body text.`)).toEqual({
        kind: variant.kind,
        rest: 'Body text.',
      });
    }
  });

  test('consumes the line break that follows a marker-only line', () => {
    expect(readCalloutMarker('[!TIP]\nKeep the cable.')).toEqual({
      kind: 'tip',
      rest: 'Keep the cable.',
    });
  });

  test('rejects lowercase, unsupported, and mid-line markers', () => {
    expect(readCalloutMarker('[!note] Lowercase.')).toBeUndefined();
    expect(readCalloutMarker('[!IMPORTANT] Other.')).toBeUndefined();
    expect(readCalloutMarker('Context [!NOTE]')).toBeUndefined();
    expect(readCalloutMarker('[!NOTE]suffix')).toBeUndefined();
  });

  test('strips supported markers without touching ordinary prose', () => {
    expect(stripCalloutMarker('[!WARNING] Be careful.')).toBe('Be careful.');
    expect(stripCalloutMarker('A normal quotation.')).toBe('A normal quotation.');
  });
});

describe('callout rendering', () => {
  test('renders each supported callout with a semantic badge and icon', async () => {
    for (const variant of VARIANTS) {
      const html = await render(`> [!${variant.marker}]\n> Body text.`);

      expect(html).toContain(`class="callout callout--${variant.kind}"`);
      expect(html).toContain('role="note"');
      expect(html).toContain(`aria-labelledby="callout-${variant.kind}-1"`);
      expect(html).toContain(`id="callout-${variant.kind}-1"`);
      expect(html).toContain(`<span class="callout__label">${variant.label}</span>`);
      expect(html).toContain('<svg class="callout__icon"');
      expect(html).not.toContain(`[!${variant.marker}]`);
      expect(html).toContain('<p>Body text.</p>');
    }
  });

  test('keeps ordinary blockquotes as blockquotes', async () => {
    const html = await render('> A normal quotation.');

    expect(html).toContain('<blockquote>');
    expect(html).not.toContain('callout');
  });

  test('does not transform unsupported or lowercase markers', async () => {
    for (const quote of ['> [!IMPORTANT]\n> Other.', '> [!note]\n> Lowercase.']) {
      const html = await render(quote);

      expect(html).toContain('<blockquote>');
      expect(html).toContain('[!');
      expect(html).not.toContain('callout');
    }
  });

  test('requires the marker to be the first blockquote paragraph', async () => {
    const html = await render('> Context.\n>\n> [!NOTE]\n> Detail.');

    expect(html).toContain('<blockquote>');
    expect(html).toContain('[!NOTE]');
    expect(html).not.toContain('callout');
  });

  test('handles a marker-only paragraph before the body', async () => {
    const html = await render('> [!WARNING]\n>\n> Body text.');

    expect(html).toContain('class="callout callout--warning"');
    expect(html).not.toContain('[!WARNING]');
    expect(html).toContain('<p>Body text.</p>');
    expect(html).not.toMatch(/callout__body[^>]*>\s*<p>\s*<\/p>/);
  });

  test('keeps content that shares the marker line', async () => {
    const html = await render('> [!TIP] Keep a spare cable.');

    expect(html).toContain('class="callout callout--tip"');
    expect(html).not.toContain('[!TIP]');
    expect(html).toContain('Keep a spare cable.');
  });

  test('numbers repeated callouts of the same kind without collisions', async () => {
    const html = await render('> [!NOTE]\n> One.\n\n> [!NOTE]\n> Two.');

    expect(html).toContain('id="callout-note-1"');
    expect(html).toContain('id="callout-note-2"');
    expect(html).toContain('aria-labelledby="callout-note-2"');
  });
});

describe('table wrappers', () => {
  test('wraps Markdown tables in a focusable horizontal scroll region', async () => {
    const html = await render('| Name | Value |\n| --- | --- |\n| Alpha | 1 |');

    expect(html).toContain(
      '<div class="table-wrapper" tabindex="0" role="region" aria-label="Scrollable table">',
    );
    expect(html).toContain('<table>');
    expect(html).toContain('<th>Name</th>');
    expect(html).toContain('<td>Alpha</td>');
  });
});
