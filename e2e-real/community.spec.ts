import type { Page } from '@playwright/test';
import { openApp } from '../e2e/helpers/app';
import { acceptPrivacyNotes } from '../e2e/helpers/privacy';
import { postHack, type TestUser } from './adapter';
import { expect, signedInAs, signIn, test } from './fixtures';

// Journeys 4 and 5, the community side against the real database: posting a hack, commenting and voting on another
// student's, and adding a discount. Each test's proof is what the page shows after a reload, which only the server can
// give: a change the page claims but the database doesn't hold fails there. The "About your data" notes are taken as
// seen (their own specs test them), and every student has a username, which posting and commenting need.

const unique = (what: string) => `${what}, ${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

function hacksPanel(page: Page) {
  return page.getByRole('tabpanel', { name: 'Hacks', exact: true });
}

function postItem(page: Page, body: string) {
  return hacksPanel(page).getByRole('list', { name: 'Posts', exact: true }).getByRole('listitem').filter({ hasText: body });
}

/** Opens a tab of the tips page: Hacks or Discounts. */
async function openTab(page: Page, name: 'Hacks' | 'Discounts') {
  await openApp(page, '/tips');
  const tab = page.getByRole('tablist', { name: 'Tips, discounts, hacks or checklist', exact: true }).getByRole('tab', { name, exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}

/** Signs `user` in on the account page, with the notes taken as seen. */
async function signedInAs_(page: Page, user: TestUser) {
  await acceptPrivacyNotes(page);
  await openApp(page, '/settings/account');
  await signIn(page, user);
  await expect(signedInAs(page, user.email)).toBeVisible();
}

test('posting: a student posts a hack, and it is in the feed after a reload', async ({ page, makeUser }) => {
  const student = await makeUser({ secondFactor: 'none', username: true });
  const body = unique('The night bus to the campus is free with the semester ticket');
  await signedInAs_(page, student);
  await openTab(page, 'Hacks');
  await hacksPanel(page).getByRole('button', { name: 'Post a hack', exact: true }).click();
  const form = hacksPanel(page).getByRole('region', { name: 'Post a hack', exact: true });
  await form.getByRole('textbox', { name: 'Your hack', exact: true }).fill(body);
  await form.getByRole('combobox', { name: 'Category', exact: true }).selectOption({ label: 'Transport' });
  await form.getByRole('combobox', { name: 'Where', exact: true }).selectOption({ label: 'Anywhere' });
  await form.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(hacksPanel(page).getByRole('status')).toHaveText('Posted.');

  await openTab(page, 'Hacks');
  await expect(postItem(page, body)).toContainText('Your post'); // proof: posted
});

test("commenting: a student comments on another student's post, and the comment stays", async ({ page, request, makeUser }) => {
  const author = await makeUser({ secondFactor: 'none', username: true });
  const student = await makeUser({ secondFactor: 'none', username: true });
  const body = unique('Bread is half price at the bakery after 6 pm');
  await postHack(request, author, body);
  await signedInAs_(page, student);
  await openTab(page, 'Hacks');
  await postItem(page, body).getByRole('button', { name: 'Comments (0)', exact: true }).click();
  await postItem(page, body).getByRole('textbox', { name: 'Your comment', exact: true }).fill('Thanks, it worked for me.');
  await postItem(page, body).getByRole('button', { name: 'Post comment', exact: true }).click();
  await expect(postItem(page, body).getByRole('status')).toHaveText('Comment posted.');

  await openTab(page, 'Hacks');
  await expect(postItem(page, body).getByRole('button', { name: 'Comments (1)', exact: true })).toBeVisible(); // proof: commented
});

test("voting: a student upvotes another student's post, and the vote stays", async ({ page, request, makeUser }) => {
  const author = await makeUser({ secondFactor: 'none', username: true });
  const student = await makeUser({ secondFactor: 'none', username: true });
  const body = unique('The library lends laptops for a week');
  await postHack(request, author, body);
  await signedInAs_(page, student);
  await openTab(page, 'Hacks');
  const votes = postItem(page, body).getByRole('group', { name: 'Your vote on this post', exact: true });
  await votes.getByRole('button', { name: 'Upvote', exact: true }).click();
  await expect(votes.getByRole('button', { name: 'Upvote', exact: true })).toHaveAttribute('aria-pressed', 'true');

  await openTab(page, 'Hacks');
  await expect(postItem(page, body)).toContainText('Upvotes: 1'); // proof: voted
});

test('discounts: a student adds a discount, and it is in the list after a reload', async ({ page, makeUser }) => {
  const student = await makeUser({ secondFactor: 'none', username: true });
  const place = unique('Schneiderei Nadel');
  await signedInAs_(page, student);
  await openTab(page, 'Discounts');
  await page.getByRole('button', { name: 'Add a discount', exact: true }).click();
  const form = page.getByRole('region', { name: 'Add a discount', exact: true });
  await form.getByRole('textbox', { name: 'Place', exact: true }).fill(place);
  await form.getByRole('textbox', { name: 'Offer', exact: true }).fill('15 % off hems with a student card');
  await form.getByRole('textbox', { name: 'Source link', exact: true }).fill('https://www.example.de/nadel');
  await form.getByRole('combobox', { name: 'Category', exact: true }).selectOption({ label: 'Shopping' });
  await form.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText('Discount added.', { exact: true })).toBeAttached();

  await openTab(page, 'Discounts');
  const added = page.getByRole('list', { name: 'Discounts', exact: true }).getByRole('heading', { level: 3, name: place, exact: true });
  await expect(added).toBeVisible(); // proof: discount-added
});
