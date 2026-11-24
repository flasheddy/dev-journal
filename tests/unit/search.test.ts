import { describe, expect, test } from 'bun:test';
import type { SearchIndexItem } from '../../src/lib/contracts';
import { rankSearchItems } from '../../src/lib/search';

function entry(overrides: Partial<SearchIndexItem> = {}): SearchIndexItem {
  return {
    kind: 'article',
    title: 'Untitled',
    summary: '',
    url: '/blog/untitled/',
    tags: [],
    ...overrides,
  };
}

describe('rankSearchItems', () => {
  test('preserves input order for an empty query', () => {
    const items = [
      entry({ title: 'Third', url: '/blog/third/' }),
      entry({ title: 'First', url: '/blog/first/' }),
      entry({ title: 'Second', url: '/blog/second/' }),
    ];

    expect(rankSearchItems(items, '   ').map(({ title }) => title)).toEqual([
      'Third',
      'First',
      'Second',
    ]);
  });

  test('ranks title matches above tag-only and summary-only matches', () => {
    const items = [
      entry({ title: 'Field Notes', summary: 'Astro deployment notes' }),
      entry({ title: 'Journal Update', tags: ['Astro'] }),
      entry({ title: 'Astro Deployment' }),
    ];

    expect(rankSearchItems(items, 'astro').map(({ title }) => title)).toEqual([
      'Astro Deployment',
      'Journal Update',
      'Field Notes',
    ]);
  });

  test('matches case-insensitively', () => {
    const items = [entry({ title: 'Astro Deployment', url: '/blog/astro-deployment/' })];

    expect(rankSearchItems(items, 'aStRo').map(({ title }) => title)).toEqual(['Astro Deployment']);
  });

  test('excludes items that match only one token of a multi-token query', () => {
    const items = [
      entry({ title: 'Astro only', url: '/blog/astro-only/' }),
      entry({ title: 'Astro deploy guide', url: '/blog/astro-deploy-guide/' }),
    ];

    expect(rankSearchItems(items, 'astro deploy').map(({ title }) => title)).toEqual([
      'Astro deploy guide',
    ]);
  });

  test('preserves input order for equal scores', () => {
    const items = [
      entry({ title: 'Zeta', tags: ['Astro'], url: '/blog/zeta/' }),
      entry({ title: 'Alpha', tags: ['Astro'], url: '/blog/alpha/' }),
    ];

    expect(rankSearchItems(items, 'astro').map(({ title }) => title)).toEqual(['Zeta', 'Alpha']);
  });
});
