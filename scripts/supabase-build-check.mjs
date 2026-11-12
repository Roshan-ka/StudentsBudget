// The build's Supabase settings, checked before Next builds anything (next.config.ts). Pure, so the unit test can run
// it with made-up settings.
//
// Neither setting is a choice: the app is local-only (CI's checks job, a local build). One without the other is a
// mistake that the app can't tell from that choice: on 12-11-2026 the live site went out with the URL and no key, and
// quietly lost Your account, sign-in and sync. A secret key in the browser's setting would be written into the
// bundle. Both stop the build instead.

const URL_NAME = 'NEXT_PUBLIC_SUPABASE_URL';
const KEY_NAME = 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY';

/**
 * What is wrong with the build's Supabase settings, or null when there is nothing wrong. The message names the
 * setting, never its value.
 * @param {Record<string, string | undefined>} env The build's environment (`process.env`).
 * @returns {string | null}
 */
export function supabaseBuildProblem(env) {
  const url = env[URL_NAME]?.trim() ?? '';
  const key = env[KEY_NAME]?.trim() ?? '';
  const after = 'Set both or neither (Vercel: Settings → Environment Variables; locally: .env.local), then build again.';

  if (key.startsWith('sb_secret_')) {
    return `${KEY_NAME} holds a secret key (sb_secret_…), which would be written into the app for every browser. Use the project's publishable key (sb_publishable_…).`;
  }
  if (url !== '' && key === '') {
    return `${URL_NAME} is set but ${KEY_NAME} is not, so the app would go out without accounts, sign-in or sync. ${after}`;
  }
  if (key !== '' && url === '') {
    return `${KEY_NAME} is set but ${URL_NAME} is not, so the app would go out without accounts, sign-in or sync. ${after}`;
  }
  return null;
}
