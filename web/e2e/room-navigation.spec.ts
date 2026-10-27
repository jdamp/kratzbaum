import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

test.use({ serviceWorkers: 'block' });
const roomIDs = new Set<string>();
const plantIDs = new Set<string>();
test.afterEach(async ({ request }) => {
  for (const id of plantIDs) await request.delete(`/api/plants/${id}`);
  for (const id of roomIDs) await request.delete(`/api/rooms/${id}`);
  plantIDs.clear(); roomIDs.clear();
});
const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name, exact: true });

async function plant(request: APIRequestContext, name: string) {
  const response = await request.post('/api/plants', { data: { name, watering_interval_days: 7 } });
  expect(response.status()).toBe(201);
  const result = await response.json(); plantIDs.add(result.id);
  return result as { id: string; name: string };
}

test('room saves settle and accept another room while an older collection read is stalled', async ({ page, request }) => {
  await page.goto('/rooms');
  await expect(page.getByLabel('New room name')).toBeEnabled();
  const oldRooms = await (await request.get('/api/rooms')).json();
  const oldToday = await (await request.get('/api/today')).json();
  let release!: () => void, started!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const readStarted = new Promise<void>(resolve => { started = resolve; });
  await page.route('**/api/today', async route => { started(); await gate; await route.fulfill({ json: oldToday }); });
  await page.route('**/api/rooms', route => route.request().method() === 'GET' ? route.fulfill({ json: oldRooms }) : route.continue());
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await readStarted;
  const prefix = `Room completion ${Date.now()}`;
  let writes = 0;
  page.on('request', req => { if (req.method() === 'POST' && new URL(req.url()).pathname === '/api/rooms') writes++; });
  for (const name of [prefix + ' office', prefix + ' living']) {
    await page.getByLabel('New room name').fill(name);
    await expect(page.getByRole('button', { name: 'Add room', exact: true })).toBeEnabled();
    const saved = page.waitForResponse(response => new URL(response.url()).pathname === '/api/rooms' && response.request().method() === 'POST' && response.status() === 201);
    await page.getByRole('button', { name: 'Add room', exact: true }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
    roomIDs.add((await (await saved).json()).id);
    await expect(page.locator('.room-list').getByText(name, { exact: true })).toBeVisible();
    await expect(page.getByText('Saving room changes…', { exact: true })).toHaveCount(0);
    await expect(page.getByLabel('New room name')).toBeEnabled();
    await expect(page.getByLabel('New room name')).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Add room', exact: true })).toBeDisabled();
  }
  expect(writes).toBe(2);
  // A rejected write keeps its input and releases the same lock.
  await page.getByLabel('New room name').fill(prefix + ' office');
  await page.getByRole('button', { name: 'Add room', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('already exists');
  await expect(page.getByLabel('New room name')).toHaveValue(prefix + ' office');
  await expect(page.getByRole('button', { name: 'Add room', exact: true })).toBeEnabled();
  const finishedRead = page.waitForResponse(response => new URL(response.url()).pathname === '/api/today');
  release();
  await finishedRead;
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  // Releasing the older snapshot must not undo confirmed room changes or show a spinner.
  await expect(page.locator('.room-list').getByText(prefix + ' office', { exact: true })).toBeVisible();
  await expect(page.locator('.room-list').getByText(prefix + ' living', { exact: true })).toBeVisible();
  await expect(page.getByText('Loading your collection…', { exact: true })).toHaveCount(0);
  expect(writes).toBe(3);
});

test('Rooms has its own route after Calendar and all four destinations fit phones', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto('/rooms');
  await expect(page.getByRole('heading', { name: 'Rooms', exact: true })).toBeVisible();
  await expect(nav(page, 'Rooms')).toHaveAttribute('aria-current', 'page');
  const buttons = page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button');
  await expect(buttons).toHaveText([/Today/, /Plants/, /Calendar/, /Rooms/]);
  expect(await buttons.evaluateAll(nodes => nodes.every(node => { const box = node.getBoundingClientRect(); return box.width >= 44 && box.height >= 44; }))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload();
  await expect(page.getByLabel('New room name')).toBeEnabled();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Collection settings' })).toBeVisible();
  await expect(page.locator('.room-manager')).toHaveCount(0);
  await nav(page, 'Rooms').click();
  await page.screenshot({ path: '/tmp/kratzbaum-rooms-phone.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  const calendarBox = (await nav(page, 'Calendar').boundingBox())!;
  const roomsBox = (await nav(page, 'Rooms').boundingBox())!;
  expect(roomsBox.y).toBeGreaterThan(calendarBox.y);
  await page.screenshot({ path: '/tmp/kratzbaum-rooms-desktop.png', fullPage: true });
});

test('upcoming photos and fallbacks open the correct plant without recording care', async ({ page, request, context }) => {
  const pictured = await plant(request, `Preview photo ${Date.now()}`);
  const fallback = await plant(request, `Preview fallback ${Date.now()}`);
  for (const saved of [pictured, fallback]) {
    expect((await request.post(`/api/plants/${saved.id}/activities`, { data: { type: 'watering' } })).status()).toBe(201);
  }
  expect((await request.post(`/api/plants/${pictured.id}/photos`, { multipart: { image: { name: 'plant.jpg', mimeType: 'image/jpeg', buffer: readFileSync('/tmp/plant.jpg') } } })).status()).toBe(201);
  await page.goto('/');
  const upcoming = page.getByRole('region', { name: 'Upcoming', exact: true });
  const photo = upcoming.getByRole('link', { name: `Open ${pictured.name}`, exact: true });
  await expect(photo).toHaveAttribute('href', `/plants/${pictured.id}`);
  await expect(photo.locator('img')).toBeVisible();
  const opened = context.waitForEvent('page');
  await photo.click({ modifiers: ['Control'] });
  const otherTab = await opened;
  await expect(otherTab).toHaveURL(new RegExp(`/plants/${pictured.id}$`));
  await expect(otherTab.getByRole('heading', { name: pictured.name, exact: true })).toBeVisible();
  await otherTab.close();
  await photo.click();
  await expect(page).toHaveURL(new RegExp(`/plants/${pictured.id}$`));
  await expect(page.getByRole('heading', { name: pictured.name, exact: true })).toBeVisible();
  await nav(page, 'Today').click();
  const fallbackLink = upcoming.getByRole('link', { name: `Open ${fallback.name}`, exact: true });
  await expect(fallbackLink.locator('img')).toHaveCount(0);
  await fallbackLink.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/plants/${fallback.id}$`));
  await expect(page.getByRole('heading', { name: fallback.name, exact: true })).toBeVisible();
  for (const saved of [pictured, fallback]) {
    const detail = await (await request.get(`/api/plants/${saved.id}`)).json();
    expect(detail.activities.filter((activity: { type: string }) => activity.type === 'watering')).toHaveLength(1);
  }
});

test('new notes use current server time and retain text on failure without a date field', async ({ page, request }) => {
  const saved = await plant(request, `Note time ${Date.now()}`);
  // The client clock is deliberately old and advances after opening the form.
  // New notes must rely on the server's submission time throughout.
  await page.clock.setFixedTime('2000-01-01T12:00:00Z');
  await page.goto(`/plants/${saved.id}`);
  await expect(page.getByRole('heading', { name: saved.name, exact: true })).toBeVisible();
  await expect(page.getByLabel('Care note date and time')).toHaveCount(0);
  await expect(page.getByText('Written at', { exact: true })).toHaveCount(0);
  await expect(page.locator('.note-form input')).toHaveCount(0);
  await page.clock.setFixedTime('2000-01-02T12:00:00Z');
  const note = 'Checked the leaves today.';
  await page.getByLabel('Care note', { exact: true }).fill(note);
  let submissions = 0;
  await page.route(`**/api/plants/${saved.id}/activities`, async route => {
    if (route.request().method() !== 'POST') { await route.continue(); return; }
    submissions++;
    expect(route.request().postDataJSON()).not.toHaveProperty('occurred_at');
    if (submissions === 1) await route.fulfill({ status: 500, json: { error: 'Note save temporarily unavailable' } });
    else await route.continue();
  });
  await page.getByRole('button', { name: 'Add note', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('temporarily unavailable');
  await expect(page.getByLabel('Care note', { exact: true })).toHaveValue(note);
  const before = Date.now();
  await page.getByRole('button', { name: 'Add note', exact: true }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
  await expect(page.getByLabel('Care note', { exact: true })).toHaveValue('');
  const after = Date.now();
  const detail = await (await request.get(`/api/plants/${saved.id}`)).json();
  const notes = detail.activities.filter((activity: { type: string }) => activity.type === 'note');
  expect(notes).toHaveLength(1);
  expect(Date.parse(notes[0].occurred_at)).toBeGreaterThanOrEqual(before - 1000);
  expect(Date.parse(notes[0].occurred_at)).toBeLessThanOrEqual(after + 1000);
  expect(submissions).toBe(2);
  const activity = page.locator('.timeline-item').filter({ hasText: note });
  await activity.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(activity.getByLabel('Date and time', { exact: true })).toBeVisible();
  await activity.getByLabel('Date and time', { exact: true }).fill('2026-10-01T09:00');
  await activity.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(activity.locator('.activity-edit')).toHaveCount(0);
  const corrected = await (await request.get(`/api/plants/${saved.id}`)).json();
  expect(corrected.activities.find((activity: { id: string }) => activity.id === notes[0].id).occurred_at).toContain('2026-10-01');
});
