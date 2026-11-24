import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkBuilt } from './check/built';
import { report } from './check/report';
import { checkSource } from './check/source';

const root = process.env.DEV_JOURNAL_ROOT
  ? resolve(process.env.DEV_JOURNAL_ROOT)
  : fileURLToPath(new URL('..', import.meta.url));
const args = new Set(process.argv.slice(2));
const builtMode = args.has('--built');

const errors: string[] = [];
const fail = (message: string) => errors.push(message);

function run(): void {
  if (builtMode) {
    const { pages } = checkBuilt(root, fail);
    report(errors);
    console.log(`check: built contract ok (${pages} HTML pages)`);
    return;
  }

  const { posts, tags } = checkSource(root, fail);
  report(errors);
  console.log(`check: source contract ok (${posts} posts, ${tags} tags)`);
}

run();
