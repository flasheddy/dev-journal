import { describe, expect, test } from 'bun:test';
import { indexTags } from '../../src/lib/tags';

type TestPost = { id: string; data: { tags: string[] } };

const post = (id: string, tags: string[]): TestPost => ({ id, data: { tags } });

describe('indexTags', () => {
  test('sorts tags by name', () => {
    const index = indexTags([post('one', ['Zig', 'Astro', 'Bun'])]);

    expect(index.map(({ name }) => name)).toEqual(['Astro', 'Bun', 'Zig']);
  });

  test('preserves input order for posts within a tag', () => {
    const posts = [post('first', ['Bun']), post('second', ['Bun'])];

    const [tag] = indexTags(posts);

    expect(tag?.posts.map(({ id }) => id)).toEqual(['first', 'second']);
  });

  test('lists a tag with multiple posts once', () => {
    const index = indexTags([post('first', ['Bun']), post('second', ['Bun'])]);

    expect(index).toHaveLength(1);
    expect(index[0]?.posts).toHaveLength(2);
  });

  test('throws when different names share a slug', () => {
    const posts = [post('first', ['AI Agents']), post('second', ['AI-Agents'])];

    expect(() => indexTags(posts)).toThrow(
      'Tag slug collision: "AI Agents" and "AI-Agents" both map to /tags/ai-agents/',
    );
  });

  test('throws when a tag normalizes to an empty slug', () => {
    expect(() => indexTags([post('first', ['!!!'])])).toThrow(
      'Tag cannot be converted to a URL slug: "!!!"',
    );
  });

  test('returns an empty array for no posts', () => {
    expect(indexTags([])).toEqual([]);
  });
});
