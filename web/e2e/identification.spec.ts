import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const candidates = [
  { scientific_name: 'Monstera deliciosa', common_names: ['Swiss cheese plant'], score: 0.94 },
  { scientific_name: 'Monstera adansonii', common_names: null, score: 0.05 },
];
const success = { status: 'succeeded', candidates };
const created = new Set<string>();
const creates: Promise<void>[] = [];

test.beforeEach(async ({ page }) => {
  await page.route('**/api/bootstrap', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, json: { ...await response.json(), plantnet_available: true } });
  });
  page.on('response', response => {
    if (response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/plants' && response.status() === 201) {
      creates.push(response.json().then(plant => { created.add(plant.id); }));
    }
  });
});
test.afterEach(async ({ request }) => {
  await Promise.all(creates.splice(0));
  for (const id of created) await request.delete(`/api/plants/${id}`);
  created.clear();
});

async function draft(page: Page) {
  await page.goto('/plants');
  await page.getByRole('button', { name: /add (your first )?plant/i }).first().click();
  await page.getByLabel('Plant name').fill(`Identify plant ${Date.now()}`);
  await page.getByLabel('Care notes').fill('Keep these notes.');
  await page.getByLabel('Plant photo · optional').setInputFiles('/tmp/plant.jpg');
  return page.getByRole('dialog');
}

async function savedPlant(page: Page, withPhoto = true) {
  const response = await page.request.post('/api/plants', { data: {
    name: `Saved plant ${Date.now()}`, scientific_name: 'Original species', common_name: 'Original common name', family: 'Araceae', notes: 'Existing notes', care_start_date: '2026-01-01', watering_interval_days: 9,
  } });
  const plant = await response.json(); created.add(plant.id);
  if (withPhoto) await page.request.post(`/api/plants/${plant.id}/photos`, { multipart: { image: { name: 'plant.jpg', mimeType: 'image/jpeg', buffer: readFileSync('/tmp/plant.jpg') } } });
  await page.goto(`/plants/${plant.id}`);
  await expect(page.getByRole('heading', { name: plant.name })).toBeVisible();
  return plant;
}

test('identifies before saving, confirms only draft fields, then retains the species through photo recovery', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  const dialog = await draft(page);
  let calls = 0, uploads = 0;
  await page.route('**/api/identifications', async route => { calls++; await route.fulfill({ json: success }); });
  await page.route('**/api/plants/*/photos', async route => {
    uploads++;
    if (uploads === 1) await route.fulfill({ status: 422, json: { error: 'Photo rejected.' } });
    else await route.continue();
  });
  expect(calls).toBe(0);
  const identify = dialog.getByRole('button', { name: 'Identify species', exact: true });
  await identify.focus(); await page.keyboard.press('Enter');
  await expect(dialog.getByRole('heading', { name: 'Review suggestions' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Confirm species' })).toBeDisabled();
  await expect(dialog.getByText('94%', { exact: true })).toBeVisible();
  const cachedIdentification = await page.evaluate(async () => {
    const requests = (await Promise.all((await caches.keys()).map(async name => (await caches.open(name)).keys()))).flat();
    return requests.some(request => new URL(request.url).pathname.includes('identif'));
  });
  expect(cachedIdentification).toBe(false);
  const radio = dialog.getByRole('radio').first(); await radio.focus(); await page.keyboard.press('Space');
  await dialog.getByRole('button', { name: 'Confirm species' }).click();
  await expect(page.getByLabel('Scientific name')).toHaveValue('Monstera deliciosa');
  await expect(page.getByLabel('Care notes')).toHaveValue('Keep these notes.');
  expect(created.size).toBe(0); expect(uploads).toBe(0);
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.route('**/api/plants', route => route.request().method() === 'POST' ? route.fulfill({ status: 400, json: { error: 'Plant details rejected.' } }) : route.continue());
  await dialog.getByRole('button', { name: 'Add plant', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Plant details rejected.');
  await expect(page.getByLabel('Scientific name')).toHaveValue('Monstera deliciosa');
  expect(uploads).toBe(0); expect(calls).toBe(1);
  await page.unroute('**/api/plants');
  await dialog.getByRole('button', { name: 'Add plant', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Plant saved.');
  await expect.poll(() => created.size).toBe(1);
  await expect(dialog.getByRole('button', { name: 'Identify species', exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Retry photo', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const id = [...created][0];
  const result = await (await page.request.get(`/api/plants/${id}`)).json();
  expect(result.plant.scientific_name).toBe('Monstera deliciosa');
  expect(result.plant.common_name).toBe('Swiss cheese plant');
  expect(result.activities.filter((a: { type: string }) => a.type === 'photo')).toHaveLength(1);
  expect(calls).toBe(1); expect(uploads).toBe(2); expect(created.size).toBe(1);
});

test('clears stale selections on source changes and new attempts, and keeps confirmed species editable', async ({ page }) => {
  const dialog = await draft(page);
  let calls = 0;
  await page.route('**/api/identifications', route => { calls++; return route.fulfill({ json: success }); });
  const identify = dialog.getByRole('button', { name: 'Identify species', exact: true });
  await identify.click();
  await dialog.getByRole('radio').first().check();
  await page.getByLabel('Plant photo · optional').setInputFiles({ name: 'replacement.jpg', mimeType: 'image/jpeg', buffer: readFileSync('/tmp/plant.jpg') });
  await expect(dialog.getByRole('radio')).toHaveCount(0);
  await identify.click();
  await expect(dialog.getByRole('button', { name: 'Confirm species' })).toBeDisabled();
  await dialog.getByRole('radio').first().check();
  await identify.click();
  await expect(dialog.getByRole('button', { name: 'Confirm species' })).toBeDisabled();
  await dialog.getByRole('radio').first().check();
  await dialog.getByRole('button', { name: 'Cancel identification' }).click();
  await expect(page.getByLabel('Scientific name')).toHaveValue('');
  await expect(page.getByLabel('Care notes')).toHaveValue('Keep these notes.');
  await identify.click();
  await dialog.getByRole('radio').first().check();
  await dialog.getByRole('button', { name: 'Confirm species' }).click();
  await page.getByLabel('Scientific name').fill('Edited species');
  await dialog.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.getByLabel('Scientific name')).toHaveValue('Edited species');
  await dialog.getByRole('button', { name: 'Add plant', exact: true }).click();
  await expect(dialog).toHaveCount(0); await expect.poll(() => created.size).toBe(1);
  const result = await (await page.request.get(`/api/plants/${[...created][0]}`)).json();
  expect(result.plant.scientific_name).toBe('Edited species'); expect(result.plant.common_name).toBe('');
  expect(calls).toBe(4);
});

test('guards duplicate identification and ignores a late response after cancelling creation', async ({ page }) => {
  const dialog = await draft(page);
  let calls = 0, release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/identifications', async route => { calls++; await gate; await route.fulfill({ json: success }); });
  await dialog.getByRole('button', { name: 'Identify species', exact: true }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
  await expect(dialog.getByRole('status')).toHaveText('Identifying species…');
  await expect(dialog.getByRole('button', { name: 'Add plant', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Plant photo · optional')).toBeDisabled();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: /add (your first )?plant/i }).first().click();
  release();
  await expect(dialog.getByRole('radio')).toHaveCount(0);
  await expect(page.getByLabel('Scientific name')).toHaveValue('');
  expect(calls).toBe(1); expect(created.size).toBe(0);
});

test('uses saved gallery photos without attaching another photo and retries only species saving', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  const plant = await savedPlant(page);
  const before = await (await page.request.get(`/api/plants/${plant.id}`)).json();
  const photos = await (await page.request.get(`/api/plants/${plant.id}/photos`)).json();
  let calls = 0, saves = 0;
  await page.route(`**/api/plants/${plant.id}/photos/${photos.photos[0].id}/identify`, route => { calls++; expect(route.request().postData()).toBeNull(); return route.fulfill({ json: success }); });
  await page.getByRole('button', { name: 'Identify this photo' }).click();
  expect(calls).toBe(0);
  await page.getByRole('button', { name: 'Identify species', exact: true }).click();
  await page.getByRole('radio').first().check();
  // Simulate another editor changing unrelated fields while suggestions are open.
  await page.request.put(`/api/plants/${plant.id}`, { data: { ...before.plant, notes: 'Latest notes', watering_interval_days: 12 } });
  await page.route(`**/api/plants/${plant.id}`, async route => {
    if (route.request().method() === 'PUT' && ++saves === 1) await route.fulfill({ status: 500, json: { error: 'Species save was not confirmed.' } });
    else await route.continue();
  });
  await page.getByRole('button', { name: 'Confirm species' }).click();
  await expect(page.getByRole('alert')).toContainText('Species save was not confirmed');
  await page.getByRole('button', { name: 'Confirm species' }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
  await expect(page.getByRole('link', { name: 'Monstera deliciosa on Wikipedia (opens in a new tab)' })).toBeVisible();
  const after = await (await page.request.get(`/api/plants/${plant.id}`)).json();
  expect(after.plant.notes).toBe('Latest notes'); expect(after.plant.watering_interval_days).toBe(12);
  expect(after.plant.family).toBe('Araceae'); expect(after.plant.cover_photo_id).toBe(before.plant.cover_photo_id);
  expect(after.activities).toEqual(before.activities);
  expect(calls).toBe(1); expect(saves).toBe(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('existing-file selection stays local and switching plants ignores pending suggestions', async ({ page }) => {
  const first = await savedPlant(page, false);
  let calls = 0, release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**/api/plants/${first.id}/photos/identify`, async route => { calls++; await gate; await route.fulfill({ json: success }); });
  await page.getByLabel('Photo for species identification').setInputFiles('/tmp/plant.jpg');
  expect(calls).toBe(0);
  await page.getByRole('button', { name: 'Identify species', exact: true }).click();
  await expect(page.getByText('Identifying species…')).toBeVisible();
  await page.getByRole('button', { name: 'All plants' }).click();
  await page.getByRole('button', { name: new RegExp(first.name) }).click();
  release();
  await expect(page.getByRole('heading', { name: 'Review suggestions' })).toHaveCount(0);
  const result = await (await page.request.get(`/api/plants/${first.id}`)).json();
  expect(result.plant.scientific_name).toBe('Original species');
  const photos = await (await page.request.get(`/api/plants/${first.id}/photos`)).json();
  expect(photos.photos).toHaveLength(0);
});

for (const failure of [
  { status: 'no_match', error_code: 'plantnet_no_match', error: 'No likely species found.' },
  { status: 'failed', error_code: 'plantnet_quota', error: 'PlantNet quota is exhausted.' },
  { status: 'failed', error_code: 'plantnet_timeout', error: 'PlantNet did not respond in time.' },
]) {
  test(`retains the draft after ${failure.error_code} and retries only explicitly`, async ({ page }) => {
    const dialog = await draft(page); let calls = 0;
    await page.route('**/api/identifications', route => { calls++; return route.fulfill({ json: { ...failure, candidates: [] } }); });
    await dialog.getByRole('button', { name: 'Identify species', exact: true }).click();
    await expect(dialog.getByRole('alert')).toHaveText(failure.error);
    await expect(page.getByLabel('Care notes')).toHaveValue('Keep these notes.');
    await expect(dialog.getByText('plant.jpg', { exact: true })).toBeVisible();
    expect(calls).toBe(1);
    await dialog.getByRole('button', { name: 'Identify species', exact: true }).click();
    await expect.poll(() => calls).toBe(2);
    await dialog.getByRole('button', { name: 'Add plant', exact: true }).click();
    await expect(dialog).toHaveCount(0); expect(calls).toBe(2);
  });
}

test('no-key and offline states disable identification, and HEIC fallback remains eligible online', async ({ page, context }) => {
  await page.unroute('**/api/bootstrap');
  await page.route('**/api/bootstrap', async route => { const response = await route.fetch(); await route.fulfill({ response, json: { ...await response.json(), plantnet_available: false } }); });
  const dialog = await draft(page);
  await expect(dialog.getByText(/identification is not configured/)).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Identify species', exact: true })).toBeDisabled();
  await page.getByLabel('Scientific name').fill('Manual species');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.unroute('**/api/bootstrap');
  await page.route('**/api/bootstrap', async route => { const response = await route.fetch(); await route.fulfill({ response, json: { ...await response.json(), plantnet_available: true } }); });
  await draft(page);
  await page.getByLabel('Plant photo · optional').setInputFiles({ name: 'plant.heic', mimeType: 'image/heic', buffer: Buffer.from('HEIC preview unavailable') });
  await expect(dialog.getByText('Preview unavailable. Your photo can still be uploaded.')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Identify species', exact: true })).toBeEnabled();
  await context.setOffline(true);
  await expect(dialog.getByRole('button', { name: 'Identify species', exact: true })).toBeDisabled();
  await expect(dialog.getByText(/identification is unavailable offline/)).toBeVisible();
  await context.setOffline(false);
  await expect(dialog.getByRole('button', { name: 'Identify species', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
});
