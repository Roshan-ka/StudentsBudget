// A saved sign-in (storageState) is as good as a password while it lasts: it must never reach a commit. From
// playwright-tester's templates/saved-state.ts, as the 2FA proof of 2026-11-12 used it.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** Where saved sign-ins go: the repo's git-ignored `/playwright/.auth/`, one file per role, project and worker. */
export const AUTH_DIR = fileURLToPath(new URL('../playwright/.auth/', import.meta.url));

/**
 * Refuses unless git ignores the saved sign-in at `file` and doesn't track it. Call it before any credential is typed.
 * Outside a git checkout it refuses too: nothing can show the file stays out of a commit.
 */
export function assertNeverCommitted(file: string, cwd: string = process.cwd()): void {
  const git = (...args: string[]): boolean => {
    try {
      execFileSync('git', args, { cwd, stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  };
  if (!git('rev-parse', '--is-inside-work-tree')) throw new Error(`not inside a git checkout, so nothing shows ${file} stays out of a commit`);
  if (git('ls-files', '--error-unmatch', file)) throw new Error(`${file} is tracked by git; untrack it before saving a sign-in there`);
  if (!git('check-ignore', '-q', file)) throw new Error(`${file} is not git-ignored; add playwright/.auth/ to .gitignore first`);
}
