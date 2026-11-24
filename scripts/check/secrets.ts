import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, extname, join, relative } from 'node:path';
import type { Reporter } from './content';
import { trackedFiles } from './tracked';

function sourceFilesForSecrets(root: string): string[] {
  const tracked = trackedFiles(root);
  if (tracked && tracked.length > 0) return tracked.map((file) => join(root, file));

  const skippedDirectories = new Set([
    '.git',
    '.astro',
    '.cache',
    '.netlify',
    '.turbo',
    '.vercel',
    '.visual',
    '.wrangler',
    'dist',
    'node_modules',
    'playwright-report',
    'test-results',
  ]);

  const files: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const child = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!skippedDirectories.has(entry.name)) visit(child);
      } else if (entry.isFile()) {
        if (entry.name.startsWith('.env') && entry.name !== '.env.example') continue;
        if (entry.name === '.dev.vars') continue;
        files.push(child);
      }
    }
  };
  visit(root);
  return files;
}

export function checkSecrets(root: string, fail: Reporter): void {
  const privateKey = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/;
  const credential =
    /(password|passwd|secret|api[-_]?key|access[-_]?key|client[-_]?secret|auth[-_]?token)\s*[:=]\s*\S{8,}/i;
  const forbiddenName = /(^|\/)(id_(rsa|ed25519|ecdsa|dsa)|[^/]+\.(pem|key|ppk|p12|pfx))$/i;
  const textExtensions = new Set([
    '.astro',
    '.cjs',
    '.css',
    '.fish',
    '.html',
    '.js',
    '.json',
    '.md',
    '.mjs',
    '.toml',
    '.ts',
    '.txt',
    '.yaml',
    '.yml',
  ]);
  const textNames = new Set(['.gitignore', 'justfile']);

  const files = sourceFilesForSecrets(root);
  for (const file of files) {
    if (!existsSync(file)) continue;

    const relativeFile = relative(root, file).split('\\').join('/');
    if (forbiddenName.test(relativeFile)) {
      fail(`private-key filename is tracked: ${relativeFile}`);
      continue;
    }

    if (
      (!textExtensions.has(extname(file)) && !textNames.has(basename(file))) ||
      statSync(file).size > 1_000_000
    ) {
      continue;
    }
    const text = readFileSync(file, 'utf8');

    if (privateKey.test(text)) fail(`private-key material found in ${relativeFile}`);
    if (credential.test(text)) fail(`credential-shaped string found in ${relativeFile}`);
  }
}
