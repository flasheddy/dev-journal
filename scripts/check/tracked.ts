import { execFileSync } from 'node:child_process';
import type { Reporter } from './content';

export function trackedFiles(root: string): string[] | undefined {
  try {
    const output = execFileSync('git', ['ls-files', '-z'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return output.split('\0').filter(Boolean);
  } catch {
    return undefined;
  }
}

export function checkTrackedArtifacts(root: string, fail: Reporter): void {
  const tracked = trackedFiles(root);
  if (!tracked) return;

  for (const file of tracked) {
    if (/(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/.test(file)) {
      fail(`non-Bun lockfile is tracked: ${file}`);
    }
    if (/(^|\/)(dist|\.astro|\.visual|test-results|playwright-report)\//.test(file)) {
      fail(`generated artifact is tracked: ${file}`);
    }
  }
}
