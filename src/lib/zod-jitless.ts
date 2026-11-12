// Zod without its compiled fast path (legal pages, chunk 4). The Content-Security-Policy has no 'unsafe-eval', and
// Zod probes `new Function` when it builds an object schema; the browser reports that as a `securitypolicyviolation`
// even though Zod catches the error. Zod reads its settings from `globalThis.__zod_globalConfig` when it loads, and
// takes `jitless` as each schema is built, so the setting must be there before any module builds one: the layout puts
// this script in <head>, where it runs before the app's bundles, like the language and theme scripts.

/** The inline <head> script: keeps whatever Zod settings are there, and turns `jitless` on. */
export const ZOD_JITLESS_HEAD_SCRIPT =
  'var c=globalThis.__zod_globalConfig||(globalThis.__zod_globalConfig={});c.jitless=true;';
