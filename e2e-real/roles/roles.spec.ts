import type { APIRequestContext, Page } from '@playwright/test';
import { openApp } from '../../e2e/helpers/app';
import { postHack, reportHack, type TestUser } from '../adapter';
import { codeStep, expect, giveCode, signedInAs, signIn, test, UI_SIGN_IN_TIMEOUT } from '../fixtures';

// The role matrix's UI cells (e2e-real/roles/matrix.json): the moderation page and its Settings link, for someone
// signed out, a student, the moderator without the authenticator code and the moderator with it. The server cells are
// proven by pgTAP and security.spec.ts. Every absence is checked only once the app has had its answer, and the queue a
// student must not see holds a reported post, so "nothing shown" can't pass on an empty page.

const SIGNED_OUT = 'Sign in with the moderator account to moderate.';
const NOT_MODERATOR = "This page is for the app's moderator.";
const NEEDS_CODE = /^Moderating needs a session that gave the authenticator code\./;

function moderationLink(page: Page) {
  return page.getByRole('link', { name: /^Moderation/ });
}

function reportedPost(page: Page, body: string) {
  return page.getByRole('list', { name: 'Reported posts', exact: true }).getByRole('listitem').filter({ hasText: body });
}

/** Opens Settings and waits until the app has asked whether this account moderates, and drawn the answer. */
async function settingsAnswered(page: Page) {
  const answered = page.waitForResponse((response) => response.url().includes('/rest/v1/rpc/am_i_moderator'));
  await openApp(page, '/settings');
  await expect(page.getByRole('link', { name: /^Your account/ })).toBeVisible();
  await answered;
  // Two frames: React has drawn what the answer changed.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

/** A post by one throwaway student, reported by `reporter`: in the moderator's queue. Its body is unique to the test. */
async function reportedPostBy(request: APIRequestContext, author: TestUser, reporter: TestUser, title: string) {
  const body = `Cheap textbooks at the library, ${title} ${Date.now().toString(36)}`;
  await reportHack(request, reporter, await postHack(request, author, body));
  return body;
}

test('signed out: the moderation page asks to sign in, and Settings has no Moderation link', async ({ page }) => {
  await openApp(page, '/settings/moderation');
  await expect(page.getByText(SIGNED_OUT, { exact: true })).toBeVisible(); // proof: outsider-page
  await openApp(page, '/settings');
  await expect(page.getByRole('link', { name: /^Your account/ })).toBeVisible();
  await expect(moderationLink(page)).toHaveCount(0); // proof: outsider-link
});

test('a student: no Moderation link, and the page refuses, with a reported post waiting', async ({ page, request, makeUser }) => {
  const author = await makeUser({ secondFactor: 'none', username: true });
  const student = await makeUser({ secondFactor: 'none' });
  const body = await reportedPostBy(request, author, student, 'student');
  await openApp(page, '/settings/account');
  await signIn(page, student);
  await expect(signedInAs(page, student.email)).toBeVisible();

  await settingsAnswered(page);
  await expect(moderationLink(page)).toHaveCount(0); // proof: student-link
  await openApp(page, '/settings/moderation');
  await expect(page.getByText(NOT_MODERATOR, { exact: true })).toBeVisible(); // proof: student-page
  await expect(reportedPost(page, body)).toHaveCount(0);
});

test('the moderator without the authenticator code: the page asks for the code', async ({ page, moderator }) => {
  await openApp(page, '/settings/account');
  await signIn(page, moderator);
  await expect(codeStep(page, moderator.email)).toBeVisible();

  await openApp(page, '/settings/moderation');
  await expect(page.getByText(NEEDS_CODE)).toBeVisible(); // proof: moderator-aal1-page
});

test('the moderator with the code: the link, the reported post, and hiding it', async ({ page, request, makeUser, moderator }) => {
  test.setTimeout(UI_SIGN_IN_TIMEOUT);
  const author = await makeUser({ secondFactor: 'none', username: true });
  const reporter = await makeUser({ secondFactor: 'none' });
  const body = await reportedPostBy(request, author, reporter, 'moderator');
  await openApp(page, '/settings/account');
  await signIn(page, moderator);
  await expect(codeStep(page, moderator.email)).toBeVisible();
  await giveCode(page, moderator);
  await expect(signedInAs(page, moderator.email)).toBeVisible();

  await settingsAnswered(page);
  await expect(moderationLink(page)).toBeVisible(); // proof: moderator-link
  await openApp(page, '/settings/moderation');
  await expect(reportedPost(page, body)).toBeVisible(); // proof: moderator-page
  await reportedPost(page, body).getByRole('button', { name: 'Hide', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Hidden from every feed.');
  // What the server holds, not what the page said: the queue read again shows the post hidden by hand.
  await openApp(page, '/settings/moderation');
  await expect(reportedPost(page, body)).toContainText('Hidden by you'); // proof: moderator-hide
});
