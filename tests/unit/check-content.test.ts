import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { loadPosts, loadProjects } from '../../scripts/check/content';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function writeFiles(files: Record<string, string>): string[] {
  const dir = mkdtempSync(join(tmpdir(), 'check-content-'));
  tempDirs.push(dir);

  return Object.entries(files).map(([name, text]) => {
    const path = join(dir, name);
    writeFileSync(path, text);
    return path;
  });
}

const blogRel = (path: string) => `src/content/blog/${basename(path)}`;
const projectRel = (path: string) => `src/content/projects/${basename(path)}`;
const post = (frontMatter: string) => `+++\n${frontMatter}\n+++\nBody text\n`;
const project = (frontMatter: string) => `+++\n${frontMatter}\n+++\n`;

function expectDiagnostics(failures: string[], diagnostics: string[]): void {
  const output = failures.join('\n');
  for (const diagnostic of diagnostics) expect(output).toContain(diagnostic);
}

describe('loadPosts', () => {
  test('parses a valid post and normalizes TOML dates', () => {
    const [file] = writeFiles({
      'hello.md': post(`title = "Hello"
date = 2026-09-26
description = "A summary"
[taxonomies]
tags = ["Bun", "Astro"]`),
    });
    const reported: string[] = [];

    const posts = loadPosts([file!], (message) => reported.push(message), blogRel);

    expect(reported).toEqual([]);
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({
      title: 'Hello',
      description: 'A summary',
      tags: ['Bun', 'Astro'],
    });
    expect(posts[0]!.date.toISOString()).toBe('2026-09-26T00:00:00.000Z');
  });

  const invalidPosts = [
    {
      name: 'reports a missing title',
      file: 'missing-title.md',
      frontMatter: 'date = 2026-09-26\ndescription = "A summary"',
      diagnostics: ['title must be a string'],
      loaded: 0,
    },
    {
      name: 'reports a missing description',
      file: 'missing-description.md',
      frontMatter: 'title = "Missing description"\ndate = 2026-09-26',
      diagnostics: ['description must be a string'],
      loaded: 0,
    },
    {
      name: 'reports a missing date and skips the post',
      file: 'missing-date.md',
      frontMatter: 'title = "Missing date"\ndescription = "A summary"',
      diagnostics: ['date must be an ISO date', 'no blog entries found'],
      loaded: 0,
    },
    {
      name: 'reports an invalid date',
      file: 'invalid-date.md',
      frontMatter: 'title = "Invalid date"\ndate = "not-a-date"\ndescription = "A summary"',
      diagnostics: ['date must be an ISO date'],
      loaded: 0,
    },
    {
      name: 'reports duplicate tags',
      file: 'duplicate-tags.md',
      frontMatter: `title = "Duplicate tags"
date = 2026-09-26
description = "A summary"
[taxonomies]
tags = ["Bun", "Bun"]`,
      diagnostics: ['tags must be unique'],
      loaded: 1,
    },
  ];

  for (const scenario of invalidPosts) {
    test(scenario.name, () => {
      const [file] = writeFiles({ [scenario.file]: post(scenario.frontMatter) });
      const reported: string[] = [];

      const posts = loadPosts([file!], (message) => reported.push(message), blogRel);

      expect(posts).toHaveLength(scenario.loaded);
      expectDiagnostics(reported, scenario.diagnostics);
    });
  }

  test('keeps valid posts when another post has a missing date', () => {
    const [missing, valid] = writeFiles({
      'missing-date.md': post('title = "Missing date"\ndescription = "A summary"'),
      'valid.md': post('title = "Valid"\ndate = 2026-09-26\ndescription = "A summary"'),
    });
    const reported: string[] = [];

    const posts = loadPosts([missing!, valid!], (message) => reported.push(message), blogRel);

    expect(posts.map(({ slug }) => slug)).toEqual(['valid']);
    expect(posts[0]!.date.toISOString()).toBe('2026-09-26T00:00:00.000Z');
    expectDiagnostics(reported, ['date must be an ISO date']);
  });

  test('reports duplicate blog slugs', () => {
    const [file] = writeFiles({
      'duplicate.md': post('title = "Duplicate"\ndate = 2026-09-26\ndescription = "A summary"'),
    });
    const reported: string[] = [];

    loadPosts([file!, file!], (message) => reported.push(message), blogRel);

    expectDiagnostics(reported, ['duplicate blog slug: duplicate']);
  });
});

describe('loadProjects', () => {
  test('parses valid projects and sorts them by order', () => {
    const [second, first] = writeFiles({
      'second.md': project(`title = "Second"
description = "Second project"
tech = ["Astro"]
url = "https://example.com/second"
order = 2`),
      'first.md': project(`title = "First"
description = "First project"
tech = ["Bun", "Astro"]
url = "https://example.com/first"
order = 1`),
    });
    const reported: string[] = [];

    const projects = loadProjects(
      [second!, first!],
      (message) => reported.push(message),
      projectRel,
    );

    expect(reported).toEqual([]);
    expect(projects.map(({ slug }) => slug)).toEqual(['first', 'second']);
    expect(projects[0]).toMatchObject({
      tech: ['Bun', 'Astro'],
      url: 'https://example.com/first',
      draft: false,
    });
  });

  const invalidProjects = [
    {
      name: 'reports a project missing order',
      file: 'no-order.md',
      frontMatter: `title = "No order"
description = "Missing order"
tech = ["Bun"]
url = "https://example.com/no-order"`,
      diagnostics: ['order must be an integer'],
    },
    {
      name: 'reports a project using an HTTP url',
      file: 'http-url.md',
      frontMatter: `title = "HTTP url"
description = "Insecure url"
tech = ["Bun"]
url = "http://example.com/http-url"
order = 1`,
      diagnostics: ['url must be an https URL'],
    },
  ];

  for (const scenario of invalidProjects) {
    test(scenario.name, () => {
      const [file] = writeFiles({ [scenario.file]: project(scenario.frontMatter) });
      const reported: string[] = [];

      loadProjects([file!], (message) => reported.push(message), projectRel);

      expectDiagnostics(reported, scenario.diagnostics);
    });
  }
});
