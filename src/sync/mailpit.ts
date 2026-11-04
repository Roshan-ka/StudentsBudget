// The local Supabase stack's Mailpit, where the stack's emails land instead of going out, so the contract tests can
// read the code a sign-up or "Forgot password" email holds (P2.4). Its API: `/api/v1/search` lists the messages to an
// address, newest first, and `/api/v1/message/{ID}` gives one. SUPABASE_TEST_MAIL_URL comes from `node
// scripts/supabase-test-env.mjs`. Tests only: nothing in the app imports it.

const MAIL_URL = process.env.SUPABASE_TEST_MAIL_URL;

/** How long an email may take to reach Mailpit, and how often to look. */
const WAIT_MS = 10_000;
const POLL_MS = 100;

export type Mail = { subject: string; html: string; text: string };

async function mailpit(path: string): Promise<unknown> {
  if (!MAIL_URL) throw new Error('SUPABASE_TEST_MAIL_URL is not set: `node scripts/supabase-test-env.mjs` prints it.');
  const response = await fetch(`${MAIL_URL}${path}`);
  if (!response.ok) throw new Error(`Mailpit answered ${response.status} for ${path}`);
  return response.json();
}

/** The ids of every email to `to` so far, newest first. */
export async function mailIds(to: string): Promise<string[]> {
  const found = (await mailpit(`/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`)) as {
    messages: { ID: string }[];
  };
  return found.messages.map((message) => message.ID);
}

/** The newest email to `to` that isn't one of `seen`, waiting for it to arrive. */
export async function nextMail(to: string, seen: readonly string[] = []): Promise<Mail> {
  const deadline = Date.now() + WAIT_MS;
  for (;;) {
    const id = (await mailIds(to)).find((candidate) => !seen.includes(candidate));
    if (id !== undefined) {
      const message = (await mailpit(`/api/v1/message/${id}`)) as { Subject: string; HTML: string; Text: string };
      return { subject: message.Subject, html: message.HTML, text: message.Text };
    }
    if (Date.now() > deadline) throw new Error(`No new email to ${to} within ${WAIT_MS / 1000} s`);
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

/** The 6-digit code in an email's body. The templates send HTML only, so the tags are taken off first. */
export function codeIn(mail: Mail): string {
  const body = mail.text || mail.html.replace(/<[^>]*>/g, ' ');
  const code = /\b\d{6}\b/.exec(body)?.[0];
  if (code === undefined) throw new Error(`No 6-digit code in the email "${mail.subject}"`);
  return code;
}
