import { describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Reporter } from '../../scripts/check/content';
import { checkSecrets } from '../../scripts/check/secrets';

function tempDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

function collectFailures(run: (fail: Reporter) => void): string[] {
  const failures: string[] = [];
  run((message) => failures.push(message));
  return failures;
}

const credential = ['password', '=', '"correcthorsebattery"'].join(' ');
const privateKeyMaterial = ['-----BEGIN', 'RSA', 'PRIVATE', 'KEY-----'].join(' ');

describe('checkSecrets', () => {
  test('accepts a clean markdown file', () => {
    const dir = tempDir('check-secrets-clean-');

    try {
      writeFileSync(join(dir, 'post.md'), '# Hello\n\nNothing sensitive here.\n');

      const failures = collectFailures((fail) => checkSecrets(dir, fail));

      expect(failures).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('reports a credential-shaped string', () => {
    const dir = tempDir('check-secrets-credential-');

    try {
      writeFileSync(join(dir, 'post.md'), `${credential}\n`);

      const failures = collectFailures((fail) => checkSecrets(dir, fail));

      expect(failures).toEqual(['credential-shaped string found in post.md']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('reports a private-key filename', () => {
    const dir = tempDir('check-secrets-filename-');

    try {
      writeFileSync(join(dir, 'server.pem'), 'placeholder\n');

      const failures = collectFailures((fail) => checkSecrets(dir, fail));

      expect(failures).toEqual(['private-key filename is tracked: server.pem']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('reports private-key material in a TypeScript file', () => {
    const dir = tempDir('check-secrets-material-');

    try {
      writeFileSync(join(dir, 'secret.ts'), `const key = "${privateKeyMaterial}";\n`);

      const failures = collectFailures((fail) => checkSecrets(dir, fail));

      expect(failures).toEqual(['private-key material found in secret.ts']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('skips .env files in the filesystem fallback', () => {
    const dir = tempDir('check-secrets-env-');

    try {
      writeFileSync(join(dir, '.env'), `${credential}\n`);

      const failures = collectFailures((fail) => checkSecrets(dir, fail));

      expect(failures).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
