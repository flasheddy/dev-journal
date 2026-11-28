import { describe, expect, test } from 'bun:test';
import { slugifyTag, tagPath } from '../../src/lib/tags';

describe('slugifyTag', () => {
  for (const [input, expected] of [
    ['AI Agents', 'ai-agents'],
    ['Café & Rust', 'cafe-rust'],
    ['C++ / C#', 'c-c'],
    ['!!!', ''],
  ] as const) {
    test(`slugifies ${JSON.stringify(input)}`, () => {
      expect(slugifyTag(input)).toBe(expected);
    });
  }
});

describe('tagPath', () => {
  test('builds the tag route from the slug', () => {
    expect(tagPath('AI Agents')).toBe('/tags/ai-agents/');
  });

  test('throws when the tag normalizes to an empty slug', () => {
    expect(() => tagPath('!!!')).toThrow('cannot be converted to a URL slug');
  });
});
