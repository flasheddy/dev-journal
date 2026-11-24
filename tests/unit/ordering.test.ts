import { describe, expect, test } from 'bun:test';
import { sortPostsByDate, sortProjectsByOrder } from '../../src/lib/ordering';

type TestPost = { id: string; data: { date: Date } };
type TestProject = { id: string; data: { order: number } };

const post = (id: string, date: string): TestPost => ({ id, data: { date: new Date(date) } });
const project = (id: string, order: number): TestProject => ({ id, data: { order } });

describe('sortPostsByDate', () => {
  test('sorts posts newest first', () => {
    const posts = [
      post('older', '2026-01-01T00:00:00Z'),
      post('newest', '2026-03-01T00:00:00Z'),
      post('middle', '2026-02-01T00:00:00Z'),
    ];

    expect(sortPostsByDate(posts).map(({ id }) => id)).toEqual(['newest', 'middle', 'older']);
  });

  test('tie-breaks equal dates by id', () => {
    const date = '2026-09-26T12:00:00Z';
    const posts = [post('b', date), post('a', date), post('c', date)];

    expect(sortPostsByDate(posts).map(({ id }) => id)).toEqual(['a', 'b', 'c']);
  });

  test('does not mutate the input array', () => {
    const posts = [post('older', '2026-01-01T00:00:00Z'), post('newer', '2026-02-01T00:00:00Z')];
    const before = [...posts];

    const sorted = sortPostsByDate(posts);

    expect(posts).toEqual(before);
    expect(sorted).not.toBe(posts);
  });
});

describe('sortProjectsByOrder', () => {
  test('sorts projects by ascending order', () => {
    const projects = [project('last', 30), project('first', 10), project('middle', 20)];

    expect(sortProjectsByOrder(projects).map(({ id }) => id)).toEqual(['first', 'middle', 'last']);
  });

  test('tie-breaks equal order by id', () => {
    const projects = [project('b', 1), project('a', 1), project('c', 1)];

    expect(sortProjectsByOrder(projects).map(({ id }) => id)).toEqual(['a', 'b', 'c']);
  });

  test('does not mutate the input array', () => {
    const projects = [project('last', 20), project('first', 10)];
    const before = [...projects];

    const sorted = sortProjectsByOrder(projects);

    expect(projects).toEqual(before);
    expect(sorted).not.toBe(projects);
  });
});
