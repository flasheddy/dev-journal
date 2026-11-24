import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Reporter } from './content';

export function rel(root: string, path: string): string {
  return relative(root, path).split('\\').join('/');
}

export function readText(root: string, file: string): string {
  return readFileSync(join(root, file), 'utf8');
}

export function assertFile(root: string, file: string, fail: Reporter): void {
  if (!existsSync(join(root, file))) fail(`missing required file: ${file}`);
}

export function assertContains(root: string, file: string, text: string, fail: Reporter): void {
  if (!existsSync(join(root, file))) return;
  if (!readText(root, file).includes(text)) fail(`${file} does not contain: ${text}`);
}

export function walk(root: string, directory: string, keep: (file: string) => boolean): string[] {
  const absolute = join(root, directory);
  if (!existsSync(absolute)) return [];

  const files: string[] = [];
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    const child = join(absolute, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(root, rel(root, child), keep));
    } else if (entry.isFile() && keep(child)) {
      files.push(child);
    }
  }
  return files;
}
