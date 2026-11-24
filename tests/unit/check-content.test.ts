import { describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import {
  buildTagIndex,
  loadPosts,
  loadProjects,
  type BlogRecord,
  type Reporter,
} from '../../scripts/check/content';

const blogRel = (path: string) => `src/content/blog/${basename(path)}`;
const projectRel = (path: string) => `src/content/projects/${basename(path)}`;

function tempDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

function collectFailures(run: (fail: Reporter) => void): string[] {
  const failures: string[] = [];
  run((message) => failures.push(message));
  return failures;
}

function blogRecord(overrides: Partial<BlogRecord> = {}): BlogRecord {
  return {
    file: 'src/content/blog/post.md',
    slug: 'post',
    title: 'Post',
    date: new Date('2026-09-26T00:00:00.000Z'),
    draft: false,
    description: 'A summary',
    tags: [],
    body: '',
    ...overrides,
  };
}

describe('loadPosts', () => {
  test('parses a valid post and normalizes TOML dates', () => {
    const dir = tempDir('check-content-post-');

    try {
      const file = join(dir, 'hello.md');
      writeFileSync(
        file,
        `+++
title = "Hello"
date = 2026-09-26
description = "A summary"
[taxonomies]
tags = ["Bun", "Astro"]
+++
Body text
`,
      );

      const failures = collectFailures((fail) => {
        const posts = loadPosts([file], fail, blogRel);

        expect(posts).toHaveLength(1);
        const post = posts[0]!;
        expect(post.file).toBe('src/content/blog/hello.md');
        expect(post.slug).toBe('hello');
        expect(post.title).toBe('Hello');
        expect(post.description).toBe('A summary');
        expect(post.tags).toEqual(['Bun', 'Astro']);
        expect(post.date.toISOString()).toBe('2026-09-26T00:00:00.000Z');
      });

      expect(failures).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('reports a missing title', () => {
    const dir = tempDir('check-content-title-');

    try {
      const file = join(dir, 'missing-title.md');
      writeFileSync(
        file,
        `+++
date = 2026-09-26
description = "A summary"
+++
Body text
`,
      );

      const failures = collectFailures((fail) => {
        loadPosts([file], fail, blogRel);
      });

      expect(failures).toContain('src/content/blog/missing-title.md: title must be a string');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('reports a missing description', () => {
    const dir = tempDir('check-content-description-');

    try {
      const file = join(dir, 'missing-description.md');
      writeFileSync(
        file,
        `+++
title = "Missing description"
date = 2026-09-26
+++
Body text
`,
      );

      const failures = collectFailures((fail) => {
        loadPosts([file], fail, blogRel);
      });

      expect(failures).toContain(
        'src/content/blog/missing-description.md: description must be a string',
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('reports a missing date by skipping the post', () => {
    const dir = tempDir('check-content-date-');

    try {
      const file = join(dir, 'missing-date.md');
      writeFileSync(
        file,
        `+++
title = "Missing date"
description = "A summary"
+++
Body text
`,
      );

      const failures = collectFailures((fail) => {
        const posts = loadPosts([file], fail, blogRel);

        expect(posts).toEqual([]);
      });

      expect(failures).toContain(
        'src/content/blog/missing-date.md: date must be an ISO date (YYYY-MM-DD)',
      );
      expect(failures).toContain('no blog entries found in src/content/blog');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('reports a missing date without dropping valid posts', () => {
    const dir = tempDir('check-content-mixed-date-');

    try {
      const valid = join(dir, 'valid.md');
      const missing = join(dir, 'missing-date.md');
      writeFileSync(
        valid,
        `+++
title = "Valid"
date = 2026-09-26
description = "A summary"
+++
Body text
`,
      );
      writeFileSync(
        missing,
        `+++
title = "Missing date"
description = "A summary"
+++
Body text
`,
      );

      const failures = collectFailures((fail) => {
        const posts = loadPosts([missing, valid], fail, blogRel);

        expect(posts.map((post) => post.slug)).toEqual(['valid']);
        expect(posts[0]!.date.toISOString()).toBe('2026-09-26T00:00:00.000Z');
      });

      expect(failures).toEqual([
        'src/content/blog/missing-date.md: date must be an ISO date (YYYY-MM-DD)',
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('reports an invalid date', () => {
    const dir = tempDir('check-content-invalid-date-');

    try {
      const file = join(dir, 'invalid-date.md');
      writeFileSync(
        file,
        `+++
title = "Invalid date"
date = "not-a-date"
description = "A summary"
+++
Body text
`,
      );

      const failures = collectFailures((fail) => {
        loadPosts([file], fail, blogRel);
      });

      expect(failures).toContain(
        'src/content/blog/invalid-date.md: date must be an ISO date (YYYY-MM-DD)',
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('reports duplicate tags', () => {
    const dir = tempDir('check-content-tags-');

    try {
      const file = join(dir, 'duplicate-tags.md');
      writeFileSync(
        file,
        `+++
title = "Duplicate tags"
date = 2026-09-26
description = "A summary"
[taxonomies]
tags = ["Bun", "Bun"]
+++
Body text
`,
      );

      const failures = collectFailures((fail) => {
        loadPosts([file], fail, blogRel);
      });

      expect(failures).toContain('src/content/blog/duplicate-tags.md: tags must be unique');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('reports duplicate slugs', () => {
    const dir = tempDir('check-content-slugs-');

    try {
      const file = join(dir, 'duplicate.md');
      writeFileSync(
        file,
        `+++
title = "Duplicate"
date = 2026-09-26
description = "A summary"
+++
Body text
`,
      );

      const failures = collectFailures((fail) => {
        loadPosts([file, file], fail, blogRel);
      });

      expect(failures).toContain('duplicate blog slug: duplicate');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('buildTagIndex', () => {
  test('groups tags by slug', () => {
    const failures = collectFailures((fail) => {
      const index = buildTagIndex(
        [
          blogRecord({ tags: ['Astro', 'Bun'] }),
          blogRecord({ file: 'src/content/blog/other.md', slug: 'other', tags: ['Bun'] }),
        ],
        fail,
      );

      expect([...index.entries()]).toEqual([
        ['astro', 'Astro'],
        ['bun', 'Bun'],
      ]);
    });

    expect(failures).toEqual([]);
  });

  test('reports different names with the same slug', () => {
    const failures = collectFailures((fail) => {
      buildTagIndex(
        [blogRecord({ tags: ['AI Agents'] }), blogRecord({ tags: ['AI-Agents'] })],
        fail,
      );
    });

    expect(failures).toEqual([
      'tag slug collision: "AI Agents" and "AI-Agents" both map to /tags/ai-agents/',
    ]);
  });

  test('reports a tag that normalizes to an empty slug', () => {
    const failures = collectFailures((fail) => {
      buildTagIndex([blogRecord({ tags: ['!!!'] })], fail);
    });

    expect(failures).toEqual([
      'src/content/blog/post.md: tag cannot be converted to a URL slug: "!!!"',
    ]);
  });
});

// The content schema now requires the same project order and HTTPS URL rules.
describe('loadProjects', () => {
  test('parses valid projects and sorts them by order', () => {
    const dir = tempDir('check-content-projects-');

    try {
      const second = join(dir, 'second.md');
      const first = join(dir, 'first.md');
      writeFileSync(
        second,
        `+++
title = "Second"
description = "Second project"
tech = ["Astro"]
url = "https://example.com/second"
order = 2
+++
`,
      );
      writeFileSync(
        first,
        `+++
title = "First"
description = "First project"
tech = ["Bun", "Astro"]
url = "https://example.com/first"
order = 1
+++
`,
      );

      const failures = collectFailures((fail) => {
        const projects = loadProjects([second, first], fail, projectRel);

        expect(projects.map((project) => project.slug)).toEqual(['first', 'second']);
        expect(projects[0]!.tech).toEqual(['Bun', 'Astro']);
        expect(projects[0]!.url).toBe('https://example.com/first');
        expect(projects[0]!.draft).toBe(false);
      });

      expect(failures).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('reports a project missing order', () => {
    const dir = tempDir('check-content-project-order-');

    try {
      const file = join(dir, 'no-order.md');
      writeFileSync(
        file,
        `+++
title = "No order"
description = "Missing order"
tech = ["Bun"]
url = "https://example.com/no-order"
+++
`,
      );

      const failures = collectFailures((fail) => {
        loadProjects([file], fail, projectRel);
      });

      expect(failures).toContain('src/content/projects/no-order.md: order must be an integer');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('reports a project using an HTTP url', () => {
    const dir = tempDir('check-content-project-url-');

    try {
      const file = join(dir, 'http-url.md');
      writeFileSync(
        file,
        `+++
title = "HTTP url"
description = "Insecure url"
tech = ["Bun"]
url = "http://example.com/http-url"
order = 1
+++
`,
      );

      const failures = collectFailures((fail) => {
        loadProjects([file], fail, projectRel);
      });

      expect(failures).toContain('src/content/projects/http-url.md: url must be an https URL');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
