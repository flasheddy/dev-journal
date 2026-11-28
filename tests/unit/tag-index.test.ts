import { describe, expect, test } from 'bun:test';
import { indexTags } from '../../src/lib/tags';

type TestPost = { id: string; tags: string[] };

const post = (id: string, tags: string[]): TestPost => ({ id, tags });
const index = (posts: TestPost[], fail?: (message: string) => void) =>
  indexTags(posts, (entry) => entry.tags, fail);

describe('indexTags', () => {
  test('sorts tags by name and groups posts in input order', () => {
    const posts = [post('first', ['Zig', 'Bun']), post('second', ['Astro', 'Bun'])];

    const tags = index(posts);

    expect(tags.map(({ name }) => name)).toEqual(['Astro', 'Bun', 'Zig']);
    expect(tags.find(({ name }) => name === 'Bun')?.posts.map(({ id }) => id)).toEqual([
      'first',
      'second',
    ]);
  });

  test('reports different names that share a slug', () => {
    const posts = [post('first', ['AI Agents']), post('second', ['AI-Agents'])];

    expect(() => index(posts)).toThrow(/slug collision/i);
  });

  test('reports a tag that normalizes to an empty slug', () => {
    const failures: string[] = [];

    const tags = index([post('first', ['!!!', 'Bun'])], (message) => failures.push(message));

    expect(tags.map(({ name }) => name)).toEqual(['Bun']);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('URL slug');
  });

  test('returns an empty array for no posts', () => {
    expect(index([])).toEqual([]);
  });
});
