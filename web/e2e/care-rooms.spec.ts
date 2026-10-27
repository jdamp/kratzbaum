import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

const plants = new Set<string>();
const rooms = new Set<string>();
test.afterEach(async ({ request }) => {
  for (const id of plants) await request.delete(`/api/plants/${id}`);
  for (const id of rooms) await request.delete(`/api/rooms/${id}`);
  plants.clear(); rooms.clear();
});
const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: new RegExp(name) });
const section = (page: Page, name: string) => page.getByRole('region', { name, exact: true });
const row = (page: Page, region: string, id: string, type: string) => section(page, region).locator(`[data-plant-id="${id}"][data-care-type="${type}"]`);

async function seedRoom(request: APIRequestContext, name: string) {
  const response = await request.post('/api/rooms', { data: { name } });
  expect(response.ok()).toBe(true);
  const room = await response.json(); rooms.add(room.id);
  return room as { id: string; name: string };
}

async function seedPlant(request: APIRequestContext, name: string, roomID?: string) {
  const response = await request.post('/api/plants', { data: { name, watering_interval_days: 7, summer_fertilizing_interval_days: 14, winter_fertilizing_interval_days: 14, room_id: roomID ?? null } });
  expect(response.ok()).toBe(true);
  const plant = await response.json(); plants.add(plant.id);
  return plant as { id: string; name: string };
}

test('starts individual care, previews photos, and manages rooms without losing plant input at 320px', async ({ page, request }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  const prefix = `Care ${Date.now()}`;
  const name = `${prefix} fern`;
  await page.goto('/plants');
  await page.getByRole('button', { name: /add (your first )?plant/i }).first().click();
  const dialog = page.getByRole('dialog');
  await page.getByLabel('Plant name').fill(name);
  await page.getByLabel('Care notes').fill('Retain my draft.');
  await expect(page.getByLabel('Care started', { exact: true })).toHaveValue('');
  await dialog.getByRole('button', { name: 'Manage rooms', exact: true }).click();
  for (const suffix of ['Arbeitszimmer', 'Wohnzimmer']) {
    await dialog.getByLabel('New room name').fill(`${prefix} ${suffix}`);
    const saved = page.waitForResponse(r => new URL(r.url()).pathname === '/api/rooms' && r.request().method() === 'POST');
    await dialog.getByRole('button', { name: 'Add room', exact: true }).click();
    rooms.add((await (await saved).json()).id);
    await expect(dialog.locator('.room-list')).toContainText(`${prefix} ${suffix}`);
  }
  const list = await (await request.get('/api/rooms')).json();
  const office = list.rooms.find((r: { name: string }) => r.name === `${prefix} Arbeitszimmer`);
  const living = list.rooms.find((r: { name: string }) => r.name === `${prefix} Wohnzimmer`);
  await dialog.getByRole('button', { name: 'Back to plant' }).click();
  await expect(page.getByLabel('Plant name')).toHaveValue(name);
  await expect(page.getByLabel('Care notes')).toHaveValue('Retain my draft.');
  await page.getByLabel('Room · optional').selectOption(office.id);
  await page.getByLabel('Summer fertilizer interval (days)').fill('14');
  await page.getByLabel('Winter fertilizer interval (days)').fill('14');
  await page.getByLabel('Plant photo · optional').setInputFiles('/tmp/plant.jpg');
  const saved = page.waitForResponse(r => new URL(r.url()).pathname === '/api/plants' && r.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Add plant', exact: true }).click();
  const plant = await (await saved).json(); plants.add(plant.id);
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: new RegExp(name) }).locator('img')).toBeVisible();
  await nav(page, 'Today').click();
  await page.getByLabel('Filter by room').selectOption(office.id);
  await expect(section(page, 'Not started yet').locator('.care-row')).toHaveCount(2);
  await expect(row(page, 'Not started yet', plant.id, 'watering').locator('img')).toBeVisible();
  await expect(section(page, 'Care due').locator('.care-row')).toHaveCount(0);
  await expect(section(page, 'Upcoming').locator('.care-row')).toHaveCount(0);
  expect(await page.locator('body').evaluate(el => el.scrollWidth)).toBeLessThanOrEqual(320);
  await page.screenshot({ path: '/tmp/kratzbaum-care-rooms-320.png', fullPage: true });
  await row(page, 'Not started yet', plant.id, 'watering').getByRole('button', { name: 'Watered', exact: true }).click();
  const care = page.getByRole('dialog');
  expect((await care.getByRole('button', { name: 'Close care entry' }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  const occurred = new Date(); occurred.setDate(occurred.getDate() - 2);
  const localDate = new Date(occurred.getTime() - occurred.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  await care.getByLabel('Watering date and time').fill(localDate);
  await page.route(`**/api/plants/${plant.id}/activities`, route => route.abort());
  await care.getByRole('button', { name: 'Save care' }).click();
  await expect(care.getByRole('alert')).toContainText('not confirmed');
  await expect(care.getByLabel('Watering date and time')).toHaveValue(localDate);
  await page.unroute(`**/api/plants/${plant.id}/activities`);
  let posts = 0;
  page.on('request', r => { if (r.method() === 'POST' && r.url().endsWith(`/plants/${plant.id}/activities`)) posts++; });
  await care.getByRole('button', { name: 'Save care' }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
  await expect(care).toHaveCount(0);
  expect(posts).toBe(1);
  await expect(row(page, 'Upcoming', plant.id, 'watering').locator('img')).toBeVisible();
  await expect(row(page, 'Not started yet', plant.id, 'watering')).toHaveCount(0);
  await expect(row(page, 'Not started yet', plant.id, 'fertilizing')).toBeVisible();
  await nav(page, 'Plants').click();
  await expect(page.getByLabel('Filter by room')).toHaveValue(office.id);
  await page.getByLabel('Search plants').fill('no plant matches this');
  await expect(page.getByText('No plants match this selection')).toBeVisible();
  await nav(page, 'Today').click();
  await expect(row(page, 'Not started yet', plant.id, 'fertilizing').getByRole('button', { name: 'Fertilized' })).toBeEnabled();
  // Move the plant without affecting its independently recorded care.
  await nav(page, 'Plants').click();
  await page.getByLabel('Search plants').fill('');
  await page.getByRole('button', { name: new RegExp(name) }).click();
  await page.getByRole('button', { name: 'Edit plant and care schedule' }).click();
  await page.getByLabel('Room · optional').selectOption(living.id);
  await page.getByLabel('Care started', { exact: true }).fill('2026-01-01');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit plant and care schedule' }).click();
  await expect(page.getByLabel('Care started', { exact: true })).toHaveValue('2026-01-01');
  await page.getByLabel('Care started', { exact: true }).fill('');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog).toHaveCount(0);
  const detail = await (await request.get(`/api/plants/${plant.id}`)).json();
  expect(detail.plant.room_id).toBe(living.id);
  expect(detail.plant.care_start_date).toBe('');
  expect(detail.activities.filter((a: { type: string }) => a.type === 'watering')).toHaveLength(1);
  await nav(page, 'Rooms').click();
  await page.getByRole('button', { name: `Rename ${prefix} Wohnzimmer`, exact: true }).click();
  await page.getByLabel('Rename room', { exact: true }).fill(`${prefix} Büro`);
  await page.getByRole('button', { name: 'Save room name' }).click();
  await expect(page.locator('.room-list')).toContainText(`${prefix} Büro`);
  await nav(page, 'Today').click();
  await page.getByLabel('Filter by room').selectOption(living.id);
  await expect(row(page, 'Upcoming', plant.id, 'watering')).toBeVisible();
  await nav(page, 'Rooms').click();
  page.once('dialog', async dialog => { expect(dialog.message()).toContain('unassigned'); await dialog.accept(); });
  await page.getByRole('button', { name: `Delete ${prefix} Büro`, exact: true }).click();
  await expect(page.getByRole('button', { name: `Delete ${prefix} Büro`, exact: true })).toHaveCount(0);
  await nav(page, 'Today').click();
  await expect(page.getByLabel('Filter by room')).toHaveValue('all');
  await page.getByLabel('Filter by room').selectOption('unassigned');
  await expect(row(page, 'Upcoming', plant.id, 'watering')).toBeVisible();
  const unassigned = await (await request.get(`/api/plants/${plant.id}`)).json();
  expect(unassigned.plant.room_id).toBeNull();
  expect(unassigned.activities).toHaveLength(2);
});

test('filters cached room snapshots offline and distinguishes missing room data', async ({ page, request, context }) => {
  const room = await seedRoom(request, `Offline office ${Date.now()}`);
  const assigned = await seedPlant(request, `Offline assigned ${Date.now()}`, room.id);
  const unassigned = await seedPlant(request, `Offline unassigned ${Date.now()}`);
  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect(row(page, 'Not started yet', assigned.id, 'watering')).toBeVisible();
  await page.getByLabel('Filter by room').selectOption(room.id);
  await expect(section(page, 'Not started yet').locator('.care-row')).toHaveCount(2);
  await context.setOffline(true);
  await expect(page.locator('.offline-banner')).toContainText('Last refreshed:');
  await expect(row(page, 'Not started yet', assigned.id, 'watering').getByRole('button')).toBeDisabled();
  await nav(page, 'Plants').click();
  await expect(page.getByRole('button', { name: new RegExp(assigned.name) })).toBeVisible();
  await expect(page.getByRole('button', { name: new RegExp(unassigned.name) })).toHaveCount(0);
  await nav(page, 'Rooms').click();
  await expect(page.getByLabel('New room name')).toBeDisabled();
  await expect(page.getByRole('button', { name: `Delete ${room.name}` })).toBeDisabled();
  const deletedRoomReads = await page.evaluate(async () => {
    let deleted = 0;
    for (const name of await caches.keys()) {
      if (!name.startsWith('kratzbaum-data-')) continue;
      const cache = await caches.open(name);
      for (const key of await cache.keys()) if (new URL(key.url).pathname === '/api/rooms' && await cache.delete(key, { ignoreVary: true })) deleted++;
    }
    return deleted;
  });
  expect(deletedRoomReads).toBeGreaterThan(0);
  // Explicitly fail this uncached read; Chromium can still network service-worker
  // requests during emulated offline mode. Existing calendar tests do the same.
  await page.addInitScript(() => {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init) => String(input).endsWith('/api/rooms') && !navigator.onLine
      ? Promise.reject(new TypeError('Failed to fetch')) : nativeFetch(input, init);
  });
  await page.goto('/plants');
  await expect(page.getByText('Room information is unavailable. Connect and retry to refresh rooms.')).toBeVisible();
  await expect(page.getByRole('button', { name: new RegExp(assigned.name) })).toBeVisible();
  await page.getByLabel('Filter by room').selectOption('unassigned');
  await expect(page.getByRole('button', { name: new RegExp(assigned.name) })).toHaveCount(0);
  await expect(page.getByRole('button', { name: new RegExp(unassigned.name) })).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByLabel('Filter by room').locator('option', { hasText: room.name })).toHaveCount(1);
});

test('keeps reminders usable when a cover cannot load and clears room state on access loss', async ({ page, request }) => {
  const room = await seedRoom(request, `Private room ${Date.now()}`);
  const plant = await seedPlant(request, `Private fern ${Date.now()}`, room.id);
  await page.route('**/api/bootstrap', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, json: { ...await response.json(), auth_mode: 'oidc', identity: 'room-test-user' } });
  });
  await page.route('**/api/today', async route => {
    const response = await route.fetch(); const data = await response.json();
    data.not_started = data.not_started.map((item: { plant_id: string }) => item.plant_id === plant.id ? { ...item, photo_url: '/media/00000000-0000-0000-0000-000000000000/thumb.jpg' } : item);
    await route.fulfill({ response, json: data });
  });
  await page.goto('/');
  await page.getByLabel('Filter by room').selectOption(room.id);
  await expect(row(page, 'Not started yet', plant.id, 'watering').getByRole('button', { name: 'Watered' })).toBeEnabled();
  await expect(row(page, 'Not started yet', plant.id, 'watering').locator('img')).toHaveCount(0);
  await expect(row(page, 'Not started yet', plant.id, 'watering')).toContainText('not started');
  await page.evaluate(() => {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      if (String(input).endsWith('/api/rooms')) {
        await new Promise(resolve => setTimeout(resolve, 100));
        return new Response('{"error":"Sign-in required"}', { status: 401, headers: { 'Content-Type': 'application/json' } });
      }
      return nativeFetch(input, init);
    };
    window.dispatchEvent(new Event('online'));
  });
  await expect(page.getByRole('heading', { name: 'Sign in to your collection' })).toBeVisible();
  await expect(page.getByLabel('Filter by room')).toHaveCount(0);
  await expect(page.getByText(room.name, { exact: true })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const saved = await page.evaluate(async () => (await caches.keys()).filter(name => name.startsWith('kratzbaum-data-') || name.startsWith('kratzbaum-media-')));
  expect(saved).toHaveLength(0);
});
