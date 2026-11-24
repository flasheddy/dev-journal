import { describe, expect, test } from 'bun:test';
import { slugifyTag, tagPath } from '../../src/lib/tags';

describe('slugifyTag', () => {
  test('lowercases a single word', () => {
    expect(slugifyTag('Playwright')).toBe('playwright');
  });

  test('separates words with one dash', () => {
    expect(slugifyTag('AI Agents')).toBe('ai-agents');
  });

  test('strips diacritics and punctuation', () => {
    expect(slugifyTag('Café & Rust')).toBe('cafe-rust');
  });

  test('collapses repeated spaces and punctuation into one dash', () => {
    expect(slugifyTag('Bun   ---   Astro!!!')).toBe('bun-astro');
  });

  test('trims leading and trailing separators', () => {
    expect(slugifyTag('-- Bun / Astro --')).toBe('bun-astro');
  });

  test('keeps letters around symbols from separate words', () => {
    expect(slugifyTag('C++ / C#')).toBe('c-c');
  });

  test('returns an empty string when nothing remains', () => {
    expect(slugifyTag('!!!')).toBe('');
  });
});

describe('tagPath', () => {
  test('builds the tag route from the slug', () => {
    expect(tagPath('AI Agents')).toBe('/tags/ai-agents/');
  });

  test('throws when the tag normalizes to an empty slug', () => {
    expect(() => tagPath('!!!')).toThrow('Tag cannot be converted to a URL slug: "!!!"');
  });
});
