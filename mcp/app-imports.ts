import { existsSync, statSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

// The app's own files import through the `@/` alias (tsconfig `paths`) and without file extensions, as bundlers
// allow. Node resolves neither, so the server teaches it both, for files in src/ only, before it loads any of them.

const SRC = fileURLToPath(new URL('../src/', import.meta.url));

/** The file a specifier names: `@/lib/budget` or `./tables`, tried as written, then with `.ts`, then as a folder. */
function appFile(specifier: string, parentURL: string | undefined): string | null {
  let base: string;
  if (specifier.startsWith('@/')) base = SRC + specifier.slice(2);
  else if ((specifier.startsWith('./') || specifier.startsWith('../')) && parentURL?.startsWith('file:')) {
    const parent = fileURLToPath(parentURL);
    if (!parent.startsWith(SRC)) return null;
    base = fileURLToPath(new URL(specifier, parentURL));
  } else return null;
  for (const candidate of [base, `${base}.ts`, `${base}/index.ts`]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

let registered = false;

/** Lets Node load the app's `src/` modules as Vitest and Next do. Call it before importing any of them. */
export function registerAppImports(): void {
  if (registered) return;
  registered = true;
  registerHooks({
    resolve(specifier, context, nextResolve) {
      const file = appFile(specifier, context.parentURL);
      return nextResolve(file === null ? specifier : pathToFileURL(file).href, context);
    },
  });
}
