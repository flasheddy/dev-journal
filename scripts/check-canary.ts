import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const blog = join(root, 'src/content/blog');
const projects = join(root, 'src/content/projects');

function fail(message: string): never {
  console.error(`FAIL: check canary: ${message}`);
  process.exit(1);
}

if (!existsSync(dist)) fail('dist/ is missing; run "bun run build" first');

const temporary = mkdtempSync(join(tmpdir(), 'dev-journal-canary-'));

function runChecker() {
  const result = spawnSync('bun', ['scripts/check.ts', '--built'], {
    cwd: root,
    env: { ...process.env, DEV_JOURNAL_ROOT: temporary },
    encoding: 'utf8',
  });
  if (result.error) fail(`could not start the checker: ${result.error.message}`);
  return result;
}

try {
  mkdirSync(join(temporary, 'src/content'), { recursive: true });
  cpSync(dist, join(temporary, 'dist'), { recursive: true });
  cpSync(blog, join(temporary, 'src/content/blog'), { recursive: true });
  cpSync(projects, join(temporary, 'src/content/projects'), { recursive: true });

  const valid = runChecker();
  if (valid.status !== 0) {
    fail(`valid built copy should pass but exited ${valid.status}\n${valid.stderr}`);
  }
  if (!valid.stdout.includes('check: built contract ok')) {
    fail(`valid built copy did not print the success marker\n${valid.stdout}`);
  }
  console.log('canary: valid built copy passes');

  rmSync(join(temporary, 'dist/search-index.json'));

  const missingSearchIndex = runChecker();
  if (missingSearchIndex.status === 0 || missingSearchIndex.status === null) {
    fail(
      `missing dist/search-index.json should fail but the checker exited ${missingSearchIndex.status}`,
    );
  }
  const missingSearchIndexDiagnostic = 'built artifact is missing: dist/search-index.json';
  if (!missingSearchIndex.stderr.includes(missingSearchIndexDiagnostic)) {
    fail(
      `missing dist/search-index.json did not report "${missingSearchIndexDiagnostic}"\n${missingSearchIndex.stderr}`,
    );
  }
  console.log('canary: missing dist/search-index.json fails as expected');

  copyFileSync(join(dist, 'search-index.json'), join(temporary, 'dist/search-index.json'));

  rmSync(join(temporary, 'dist/404.html'));

  const broken = runChecker();
  if (broken.status === 0 || broken.status === null) {
    fail(`missing dist/404.html should fail but the checker exited ${broken.status}`);
  }
  const expected = 'FAIL: built page is missing: dist/404.html';
  if (!broken.stderr.includes(expected)) {
    fail(`missing dist/404.html did not report "${expected}"\n${broken.stderr}`);
  }
  console.log('canary: missing dist/404.html fails as expected');
} finally {
  rmSync(temporary, { recursive: true, force: true });
}

console.log('check: built gate canary ok');
