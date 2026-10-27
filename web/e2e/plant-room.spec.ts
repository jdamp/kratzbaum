import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const roomIDs = new Set<string>(), plantIDs = new Set<string>();
test.afterEach(async ({ request }) => {
  for (const id of plantIDs) await request.delete(`/api/plants/${id}`);
  for (const id of roomIDs) await request.delete(`/api/rooms/${id}`);
  plantIDs.clear(); roomIDs.clear();
});
const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name, exact: true });
function gate() {
  let release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  return { wait, release };
}
async function room(request: APIRequestContext, suffix: string) {
  const response = await request.post('/api/rooms', { data: { name: `Assignment ${Date.now()} ${suffix}` } });
  expect(response.status()).toBe(201);
  const saved = await response.json(); roomIDs.add(saved.id); return saved as { id: string; name: string };
}
async function plant(request: APIRequestContext, suffix = 'fern') {
  const response = await request.post('/api/plants', { data: {
    name: `Assignment ${Date.now()} ${suffix}`, scientific_name: 'Nephrolepis exaltata', common_name: 'Boston fern', family: 'Nephrolepidaceae',
    notes: 'Keep moist', care_start_date: '', watering_interval_days: 7,
    summer_fertilizing_interval_days: 14, winter_fertilizing_interval_days: 28,
    summer_fertilizing_paused: true, winter_fertilizing_paused: false,
  } });
  expect(response.status()).toBe(201);
  const saved = await response.json(); plantIDs.add(saved.id); return saved as { id: string; name: string };
}
const detail = async (request: APIRequestContext, id: string) => (await request.get(`/api/plants/${id}`)).json();

// This flow intentionally retains the real service worker and CacheStorage behavior.
test('idle room buttons have no loading cursor and service-worker saves allow another room', async ({ page }) => {
  await page.goto('/rooms');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  const add = page.getByRole('button', { name: 'Add room', exact: true });
  await expect(add).toBeDisabled();
  await add.hover();
  await expect(add).toHaveCSS('cursor', 'not-allowed');
  const names = [`Cursor office ${Date.now()}`, `Cursor living ${Date.now()}`];
  for (const name of names) {
    await page.getByLabel('New room name').fill(name);
    await expect(add).toBeEnabled();
    const saved = page.waitForResponse(r => r.url().endsWith('/api/rooms') && r.request().method() === 'POST');
    await add.click();
    roomIDs.add((await (await saved).json()).id);
    await expect(page.locator('.room-success')).toHaveText(`Room “${name}” saved.`);
    await expect(page.getByLabel('New room name')).toHaveValue('');
    await expect(add).toBeDisabled();
    await add.hover();
    await expect(add).toHaveCSS('cursor', 'not-allowed');
    await expect(page.getByText('Saving room changes…')).toHaveCount(0);
  }
  await page.getByRole('button', { name: `Rename ${names[0]}`, exact: true }).click();
  const renamed = names[0] + ' renamed';
  await page.getByLabel('Rename room', { exact: true }).fill(renamed);
  await page.getByRole('button', { name: 'Save room name', exact: true }).click();
  await expect(page.locator('.room-success')).toHaveText(`Room “${renamed}” saved.`);
  await page.getByLabel('New room name').fill(names[1]);
  await add.click();
  await expect(page.getByRole('alert')).toContainText('already exists');
  await expect(add).toBeEnabled();
});

test.describe('direct plant assignment', () => {
  test.use({ serviceWorkers: 'block' });

  test('room creation shows a waiting cursor only until the server confirms', async ({ page }) => {
    await page.goto('/rooms');
    await expect(page.getByLabel('New room name')).toBeEnabled();
    const blocked = gate(), started = gate();
    await page.route('**/api/rooms', async route => {
      if (route.request().method() !== 'POST') { await route.continue(); return; }
      const response = await route.fetch(); roomIDs.add((await response.json()).id);
      started.release(); await blocked.wait; await route.fulfill({ response });
    });
    await page.getByLabel('New room name').fill('Pending room ' + Date.now());
    await page.getByRole('button', { name: 'Add room', exact: true }).click();
    await started.wait;
    await expect(page.getByRole('button', { name: 'Saving…', exact: true })).toHaveCSS('cursor', 'wait');
    await expect(page.getByText('Saving room changes…', { exact: true })).toBeVisible();
    blocked.release();
    await expect(page.getByRole('button', { name: 'Add room', exact: true })).toHaveCSS('cursor', 'not-allowed');
    await expect(page.getByText('Saving room changes…', { exact: true })).toHaveCount(0);
  });

  test('assigns, moves, and unassigns with confirmed filters while preserving plant data', async ({ page, request }) => {
    const office = await room(request, 'office'), living = await room(request, 'living');
    const saved = await plant(request);
    expect((await request.post(`/api/plants/${saved.id}/photos`, { multipart: { image: { name: 'plant.jpg', mimeType: 'image/jpeg', buffer: readFileSync('/tmp/plant.jpg') } } })).status()).toBe(201);
    expect((await request.post(`/api/plants/${saved.id}/activities`, { data: { type: 'watering' } })).status()).toBe(201);
    await page.route('**/api/bootstrap', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, json: { ...await response.json(), plantnet_available: true } });
    });
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(`/plants/${saved.id}`);
    const form = page.getByRole('form', { name: 'Plant room', exact: true });
    const select = form.getByRole('combobox', { name: 'Room', exact: true });
    const save = form.getByRole('button', { name: 'Save room', exact: true });
    await expect(select).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Choose identification photo', exact: true })).toBeEnabled();
    await expect(save).toBeDisabled();
    // An unrelated edit after opening detail must be preserved by the room-only intent.
    const latest = await detail(request, saved.id);
    expect((await request.put(`/api/plants/${saved.id}`, { data: { ...latest.plant, notes: 'Updated from another tab' } })).ok()).toBe(true);
    const before = await detail(request, saved.id);
    const oldToday = await (await request.get('/api/today')).json();
    const readGate = gate(), readStarted = gate(), writeGate = gate(), writeStarted = gate();
    await page.route('**/api/today', async route => { readStarted.release(); await readGate.wait; await route.fulfill({ json: oldToday }); });
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await readStarted.wait;
    let puts = 0;
    await page.route(`**/api/plants/${saved.id}`, async route => {
      if (route.request().method() !== 'PUT') { await route.continue(); return; }
      puts++; writeStarted.release(); await writeGate.wait; await route.continue();
    });
    await select.selectOption(office.id);
    await save.evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
    await writeStarted.wait;
    await expect(form).toHaveAttribute('aria-busy', 'true');
    await expect(form.getByRole('button', { name: 'Saving room…', exact: true })).toHaveCSS('cursor', 'wait');
    await expect(select).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Choose identification photo', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Edit plant and care schedule' })).toBeDisabled();
    writeGate.release();
    await expect(form.getByRole('status')).toHaveText('Room assignment saved.');
    await expect(save).toBeDisabled();
    expect(puts).toBe(1);
    await expect(page.getByRole('button', { name: 'Choose identification photo', exact: true })).toBeEnabled();
    await expect(page.getByText(`Room: ${office.name}`, { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const control of [select, save]) {
      const box = (await control.boundingBox())!; expect(box.height).toBeGreaterThanOrEqual(44); expect(box.width).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({ path: '/tmp/kratzbaum-plant-room-phone.png', fullPage: true });
    await nav(page, 'Today').click();
    await page.getByLabel('Filter by room').selectOption(office.id);
    await expect(page.locator(`.care-row[data-plant-id="${saved.id}"]`)).not.toHaveCount(0);
    const readFinished = page.waitForResponse(r => r.url().endsWith('/api/today'));
    readGate.release(); await readFinished;
    await page.unroute('**/api/today');
    await nav(page, 'Plants').click();
    await expect(page.getByLabel('Filter by room')).toHaveValue(office.id);
    await expect(page.locator('.plant-card').filter({ hasText: saved.name })).toBeVisible();
    await page.locator('.plant-card').filter({ hasText: saved.name }).click();
    await select.selectOption(living.id);
    await save.focus(); await page.keyboard.press('Enter');
    await expect(page.getByText(`Room: ${living.name}`, { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({ path: '/tmp/kratzbaum-plant-room-desktop.png', fullPage: true });
    await select.selectOption(''); await save.click();
    await expect(page.getByText('Room: Unassigned', { exact: true })).toBeVisible();
    const after = await detail(request, saved.id);
    const { room_id: ignoredBefore, updated_at: ignoredBeforeTime, ...prior } = before.plant;
    const { room_id: ignoredAfter, updated_at: ignoredAfterTime, ...next } = after.plant;
    expect(next).toEqual(prior);
    expect(after.plant.room_id).toBeNull();
    expect(after.activities).toEqual(before.activities);
    await nav(page, 'Today').click();
    await page.getByLabel('Filter by room').selectOption(living.id);
    await expect(page.locator(`.care-row[data-plant-id="${saved.id}"]`)).toHaveCount(0);
    await page.getByLabel('Filter by room').selectOption('unassigned');
    await expect(page.locator(`.care-row[data-plant-id="${saved.id}"]`)).not.toHaveCount(0);
  });

  test('retains selection on read/write failures, rejects deleted rooms, and disables offline', async ({ page, request, context }) => {
    const office = await room(request, 'failure'), saved = await plant(request);
    await page.goto(`/plants/${saved.id}`);
    const form = page.getByRole('form', { name: 'Plant room', exact: true });
    const select = form.getByRole('combobox', { name: 'Room', exact: true }), save = form.getByRole('button', { name: 'Save room', exact: true });
    await expect(select).toBeEnabled();
    await select.selectOption(office.id);
    let puts = 0, reads = 0;
    await page.route(`**/api/plants/${saved.id}`, async route => {
      if (route.request().method() === 'GET') {
        if (++reads === 1) await route.fulfill({ status: 500, json: { error: 'Plant read failed' } });
        else await route.continue();
      } else {
        if (++puts === 1) await route.fulfill({ status: 500, json: { error: 'Room save failed' } });
        else await route.continue();
      }
    });
    await save.click();
    await expect(form.getByRole('alert')).toHaveText('Plant read failed'); expect(puts).toBe(0);
    await expect(select).toHaveValue(office.id); await expect(save).toBeEnabled();
    await save.click();
    await expect(form.getByRole('alert')).toHaveText('Room save failed');
    await expect(select).toHaveValue(office.id); await expect(page.getByText('Room: Unassigned', { exact: true })).toBeVisible();
    await save.click();
    await expect(form.getByRole('status')).toHaveText('Room assignment saved.');
    const deleted = await room(request, 'deleted');
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(select.locator(`option[value="${deleted.id}"]`)).toHaveCount(1);
    await request.delete(`/api/rooms/${deleted.id}`); roomIDs.delete(deleted.id);
    await select.selectOption(deleted.id); await save.click();
    await expect(form.getByRole('alert')).toContainText('no longer exists');
    await expect(select).toHaveValue(deleted.id);
    await expect(page.getByText(`Room: ${office.name}`, { exact: true })).toBeVisible();
    await context.setOffline(true);
    await expect(select).toBeDisabled(); await expect(save).toBeDisabled(); await expect(save).toHaveCSS('cursor', 'not-allowed');
    await context.setOffline(false);
  });

  test('room information unavailable leaves the current assignment readable', async ({ page, request }) => {
    const office = await room(request, 'unavailable'), saved = await plant(request);
    const initial = await detail(request, saved.id);
    await request.put(`/api/plants/${saved.id}`, { data: { ...initial.plant, room_id: office.id } });
    await page.route('**/api/rooms', route => route.fulfill({ status: 500, json: { error: 'Rooms unavailable' } }));
    await page.goto(`/plants/${saved.id}`);
    const form = page.getByRole('form', { name: 'Plant room', exact: true });
    await expect(form.getByRole('combobox', { name: 'Room', exact: true })).toHaveValue(office.id);
    await expect(form.getByRole('combobox', { name: 'Room', exact: true })).toBeDisabled();
    await expect(form.getByRole('button', { name: 'Save room', exact: true })).toBeDisabled();
    await expect(page.getByText('Room: Room information unavailable', { exact: true })).toBeVisible();
  });

  test('leaving during the latest-plant read cancels the assignment write', async ({ page, request }) => {
    const office = await room(request, 'cancel'), saved = await plant(request);
    await page.goto(`/plants/${saved.id}`);
    const form = page.getByRole('form', { name: 'Plant room', exact: true });
    await expect(form.getByRole('combobox', { name: 'Room', exact: true })).toBeEnabled();
    const blocked = gate(), started = gate(); let puts = 0;
    await page.route(`**/api/plants/${saved.id}`, async route => {
      if (route.request().method() === 'PUT') { puts++; await route.continue(); return; }
      started.release(); await blocked.wait; await route.continue();
    });
    await form.getByRole('combobox', { name: 'Room', exact: true }).selectOption(office.id);
    await form.getByRole('button', { name: 'Save room', exact: true }).click();
    await started.wait;
    await nav(page, 'Rooms').click();
    const response = page.waitForResponse(r => r.url().endsWith(`/api/plants/${saved.id}`));
    blocked.release(); await response;
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    expect(puts).toBe(0);
    await expect(page).toHaveURL(/\/rooms$/);
    expect((await detail(request, saved.id)).plant.room_id).toBeNull();
  });

  test('a delayed assignment response does not replace another detail or restore lost access', async ({ page, request }) => {
    const office = await room(request, 'delayed'), saved = await plant(request), other = await plant(request, 'other');
    await page.goto(`/plants/${saved.id}`);
    const form = page.getByRole('form', { name: 'Plant room', exact: true });
    const blocked = gate(), started = gate();
    await page.route(`**/api/plants/${saved.id}`, async route => {
      if (route.request().method() !== 'PUT') { await route.continue(); return; }
      const response = await route.fetch(); started.release(); await blocked.wait; await route.fulfill({ response });
    });
    await form.getByRole('combobox', { name: 'Room', exact: true }).selectOption(office.id);
    await form.getByRole('button', { name: 'Save room', exact: true }).click();
    await started.wait;
    await nav(page, 'Plants').click();
    await page.locator('.plant-card').filter({ hasText: other.name }).click();
    blocked.release();
    await expect(page.getByRole('heading', { name: other.name, exact: true })).toBeVisible();
    await expect(page.getByRole('form', { name: 'Plant room', exact: true }).getByRole('combobox', { name: 'Room', exact: true })).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Edit plant and care schedule' })).toBeEnabled();
    // A second delayed save loses collection access before its response is delivered.
    await nav(page, 'Plants').click(); await page.locator('.plant-card').filter({ hasText: saved.name }).click();
    const lost = gate(), committed = gate();
    await page.unroute(`**/api/plants/${saved.id}`);
    await page.route(`**/api/plants/${saved.id}`, async route => {
      if (route.request().method() !== 'PUT') { await route.continue(); return; }
      const response = await route.fetch(); committed.release(); await lost.wait; await route.fulfill({ response });
    });
    await form.getByRole('combobox', { name: 'Room', exact: true }).selectOption('');
    await form.getByRole('button', { name: 'Save room', exact: true }).click();
    await committed.wait;
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('kratzbaum:access-denied')));
    lost.release();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('form', { name: 'Plant room', exact: true })).toHaveCount(0);
    await expect(page.getByText(saved.name, { exact: true })).toHaveCount(0);
  });
});
