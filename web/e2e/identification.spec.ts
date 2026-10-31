import { expect, test, type Page } from './fixtures';
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
  await page.getByRole('button', { name: /(erste )?Pflanze hinzufügen/i }).first().click();
  await page.getByLabel("Pflanzenname").fill(`Identify plant ${Date.now()}`);
  await page.getByLabel("Pflegenotizen").fill('Keep these notes.');
  await page.getByLabel("Pflanzenfoto · optional").setInputFiles('/tmp/plant.jpg');
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
  const identify = dialog.getByRole('button', { name: "Pflanze bestimmen", exact: true });
  await identify.focus(); await page.keyboard.press('Enter');
  await expect(dialog.getByRole('heading', { name: "Vorschläge prüfen" })).toBeVisible();
  await expect(dialog.getByRole('button', { name: "Art bestätigen" })).toBeDisabled();
  await expect(dialog.getByText(/94\s*%/, { exact: true })).toBeVisible();
  const cachedIdentification = await page.evaluate(async () => {
    const requests = (await Promise.all((await caches.keys()).map(async name => (await caches.open(name)).keys()))).flat();
    return requests.some(request => new URL(request.url).pathname.includes('identif'));
  });
  expect(cachedIdentification).toBe(false);
  const radio = dialog.getByRole('radio').first(); await radio.focus(); await page.keyboard.press('Space');
  await dialog.getByRole('button', { name: "Art bestätigen" }).click();
  await expect(page.getByLabel("Wissenschaftlicher Name")).toHaveValue('Monstera deliciosa');
  await expect(page.getByLabel("Pflegenotizen")).toHaveValue('Keep these notes.');
  expect(created.size).toBe(0); expect(uploads).toBe(0);
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.route('**/api/plants', route => route.request().method() === 'POST' ? route.fulfill({ status: 400, json: { error: 'Plant details rejected.' } }) : route.continue());
  await dialog.getByRole('button', { name: "Pflanze hinzufügen", exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Die Anfrage ist fehlgeschlagen');
  await expect(page.getByLabel("Wissenschaftlicher Name")).toHaveValue('Monstera deliciosa');
  expect(uploads).toBe(0); expect(calls).toBe(1);
  await page.unroute('**/api/plants');
  await dialog.getByRole('button', { name: "Pflanze hinzufügen", exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText("Pflanze gespeichert.");
  await expect.poll(() => created.size).toBe(1);
  await expect(dialog.getByRole('button', { name: "Pflanze bestimmen", exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: "Foto erneut hochladen", exact: true }).click();
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
  const identify = dialog.getByRole('button', { name: "Pflanze bestimmen", exact: true });
  await identify.click();
  await dialog.getByRole('radio').first().check();
  await page.getByLabel("Pflanzenfoto · optional").setInputFiles({ name: 'replacement.jpg', mimeType: 'image/jpeg', buffer: readFileSync('/tmp/plant.jpg') });
  await expect(dialog.getByRole('radio')).toHaveCount(0);
  await identify.click();
  await expect(dialog.getByRole('button', { name: "Art bestätigen" })).toBeDisabled();
  await dialog.getByRole('radio').first().check();
  await identify.click();
  await expect(dialog.getByRole('button', { name: "Art bestätigen" })).toBeDisabled();
  await dialog.getByRole('radio').first().check();
  await dialog.getByRole('button', { name: "Bestimmung abbrechen" }).click();
  await expect(page.getByLabel("Wissenschaftlicher Name")).toHaveValue('');
  await expect(page.getByLabel("Pflegenotizen")).toHaveValue('Keep these notes.');
  await identify.click();
  await dialog.getByRole('radio').first().check();
  await dialog.getByRole('button', { name: "Art bestätigen" }).click();
  await page.getByLabel("Wissenschaftlicher Name").fill('Edited species');
  await dialog.getByRole('button', { name: "Entfernen", exact: true }).click();
  await expect(page.getByLabel("Wissenschaftlicher Name")).toHaveValue('Edited species');
  await dialog.getByRole('button', { name: "Pflanze hinzufügen", exact: true }).click();
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
  await dialog.getByRole('button', { name: "Pflanze bestimmen", exact: true }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
  await expect(dialog.getByRole('status')).toHaveText("Pflanze wird bestimmt…");
  await expect(dialog.getByRole('button', { name: "Pflanze hinzufügen", exact: true })).toBeDisabled();
  await expect(page.getByLabel("Pflanzenfoto · optional")).toBeDisabled();
  await dialog.getByRole('button', { name: "Abbrechen", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: /(erste )?Pflanze hinzufügen/i }).first().click();
  release();
  await expect(dialog.getByRole('radio')).toHaveCount(0);
  await expect(page.getByLabel("Wissenschaftlicher Name")).toHaveValue('');
  expect(calls).toBe(1); expect(created.size).toBe(0);
});

test('uses saved gallery photos without attaching another photo and retries only species saving', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  const plant = await savedPlant(page);
  const before = await (await page.request.get(`/api/plants/${plant.id}`)).json();
  const photos = await (await page.request.get(`/api/plants/${plant.id}/photos`)).json();
  let calls = 0, saves = 0;
  await page.route(`**/api/plants/${plant.id}/photos/${photos.photos[0].id}/identify`, route => { calls++; expect(route.request().postData()).toBeNull(); return route.fulfill({ json: success }); });
  await expect(page.getByRole('button', { name: "Foto zur Bestimmung auswählen" })).toHaveCount(0);
  await expect(page.getByRole('button', { name: "Pflanze bestimmen", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Foto zur Pflanzenbestimmung")).toHaveCount(0);
  expect(calls).toBe(0);
  const identify = page.getByRole('button', { name: "Pflanze auf diesem Foto bestimmen" });
  await identify.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: "Pflanzenbestimmung" })).toBeFocused();
  await expect.poll(() => calls).toBe(1);
  await page.getByRole('radio').first().check();
  // Simulate another editor changing unrelated fields while suggestions are open.
  await page.request.put(`/api/plants/${plant.id}`, { data: { ...before.plant, notes: 'Latest notes', watering_interval_days: 12 } });
  await page.route(`**/api/plants/${plant.id}`, async route => {
    if (route.request().method() === 'PUT' && ++saves === 1) await route.fulfill({ status: 500, json: { error: 'Species save was not confirmed.' } });
    else await route.continue();
  });
  await page.getByRole('button', { name: "Art bestätigen" }).click();
  await expect(page.getByRole('alert')).toContainText('Die Anfrage ist fehlgeschlagen');
  await page.getByRole('button', { name: "Art bestätigen" }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
  await expect(page.getByRole('link', { name: "Monstera deliciosa auf Wikipedia (öffnet einen neuen Tab)" })).toBeVisible();
  const after = await (await page.request.get(`/api/plants/${plant.id}`)).json();
  expect(after.plant.notes).toBe('Latest notes'); expect(after.plant.watering_interval_days).toBe(12);
  expect(after.plant.family).toBe('Araceae'); expect(after.plant.cover_photo_id).toBe(before.plant.cover_photo_id);
  expect(after.activities).toEqual(before.activities);
  expect(calls).toBe(1); expect(saves).toBe(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('gallery actions prevent duplicates and ignore pending suggestions after navigation', async ({ page }) => {
  const first = await savedPlant(page);
  let calls = 0, release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/plants/*/photos/*/identify', async route => { calls++; await gate; await route.fulfill({ json: success }); });
  const identify = page.getByRole('button', { name: "Pflanze auf diesem Foto bestimmen" });
  await identify.evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
  await expect(page.getByRole('status')).toHaveText("Pflanze wird bestimmt…");
  await expect(identify).toBeDisabled();
  await expect(page.getByRole('button', { name: "Foto löschen" })).toBeDisabled();
  await expect(page.locator('.gallery .section-title input')).toBeDisabled();
  await expect.poll(() => calls).toBe(1);
  await page.getByRole('button', { name: "Alle Pflanzen" }).click();
  await page.getByRole('button', { name: new RegExp(first.name) }).click();
  release();
  await expect(page.getByRole('heading', { name: "Vorschläge prüfen" })).toHaveCount(0);
  const result = await (await page.request.get('/api/plants/' + first.id)).json();
  expect(result.plant.scientific_name).toBe('Original species');
  expect(calls).toBe(1);
});

test('retries the same gallery photo explicitly and clears selection when changing photos', async ({ page }) => {
  const plant = await savedPlant(page);
  let calls = 0;
  const sources: string[] = [], keys: string[] = [];
  await page.route('**/api/plants/*/photos/*/identify', async route => {
    calls++; sources.push(new URL(route.request().url()).pathname); keys.push(route.request().headers()['idempotency-key']);
    await route.fulfill({ json: calls === 1 ? { status: 'failed', error_code: 'plantnet_request_rejected', error: 'PlantNet rejected the identification request' } : success });
  });
  const addPhoto = page.locator('.gallery .section-title input');
  await addPhoto.setInputFiles('/tmp/plant.jpg');
  await expect(page.getByRole('button', { name: "Pflanze auf diesem Foto bestimmen" })).toHaveCount(2);
  expect(calls).toBe(0);
  const first = page.getByRole('article', { name: "Galeriefoto 1", exact: true }).getByRole('button', { name: "Pflanze auf diesem Foto bestimmen" });
  await first.click();
  await expect(page.getByRole('alert')).toHaveText("PlantNet hat die Bestimmungsanfrage abgelehnt.");
  expect(calls).toBe(1);
  await first.click();
  await page.getByRole('radio').first().check();
  await page.getByRole('button', { name: "Bestimmung abbrechen" }).click();
  await expect(first).toBeFocused();
  await expect(page.getByRole('region', { name: "Pflanzenbestimmung" })).toHaveCount(0);
  await first.click();
  await expect(page.getByRole('button', { name: "Art bestätigen" })).toBeDisabled();
  await page.getByRole('radio').first().check();
  await page.getByRole('article', { name: "Galeriefoto 2", exact: true }).getByRole('button', { name: "Pflanze auf diesem Foto bestimmen" }).click();
  await expect(page.getByText("Bestimmung anhand von Galeriefoto 2")).toBeVisible();
  await expect(page.getByRole('button', { name: "Art bestätigen" })).toBeDisabled();
  expect(calls).toBe(4);
  expect(sources[0]).toBe(sources[1]); expect(sources[1]).toBe(sources[2]); expect(sources[3]).not.toBe(sources[2]);
  expect(new Set(keys).size).toBe(4);
  const result = await (await page.request.get('/api/plants/' + plant.id)).json();
  expect(result.plant.scientific_name).toBe('Original species');
  expect(result.activities.filter((a: { type: string }) => a.type === 'photo')).toHaveLength(2);
});

test('gallery identification explains offline and missing configuration even without photos', async ({ page, context }) => {
  await savedPlant(page, false);
  await expect(page.getByRole('button', { name: "Pflanze auf diesem Foto bestimmen" })).toHaveCount(0);
  await expect(page.getByRole('button', { name: "Pflanze bestimmen", exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: "Foto zur Bestimmung auswählen" })).toHaveCount(0);
  await expect(page.locator('.gallery .section-title input')).toBeEnabled();
  await page.locator('.gallery .section-title input').setInputFiles('/tmp/plant.jpg');
  await expect(page.getByRole('button', { name: "Pflanze auf diesem Foto bestimmen" })).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByText(/Pflanzenbestimmung ist offline nicht verfügbar/)).toBeVisible();
  await expect(page.getByRole('button', { name: "Pflanze auf diesem Foto bestimmen" })).toBeDisabled();
  await context.setOffline(false);
  await page.unroute('**/api/bootstrap');
  await page.route('**/api/bootstrap', async route => { const response = await route.fetch(); await route.fulfill({ response, json: { ...await response.json(), plantnet_available: false } }); });
  await page.reload();
  await expect(page.getByText(/Pflanzenbestimmung ist nicht eingerichtet/)).toBeVisible();
  await expect(page.getByRole('button', { name: "Pflanze auf diesem Foto bestimmen" })).toBeDisabled();
  await expect(page.locator('.gallery .section-title input')).toBeEnabled();
  await savedPlant(page, false);
  await expect(page.getByText(/Pflanzenbestimmung ist nicht eingerichtet/)).toBeVisible();
  await expect(page.getByRole('button', { name: "Pflanze auf diesem Foto bestimmen" })).toHaveCount(0);
});

for (const failure of [
  { status: 'no_match', error_code: 'plantnet_no_match', error: 'PlantNet hat keine passende Art gefunden.' },
  { status: 'failed', error_code: 'plantnet_quota', error: 'Das PlantNet-Kontingent ist aufgebraucht.' },
  { status: 'failed', error_code: 'plantnet_timeout', error: 'PlantNet hat nicht rechtzeitig geantwortet.' },
]) {
  test(`retains the draft after ${failure.error_code} and retries only explicitly`, async ({ page }) => {
    const dialog = await draft(page); let calls = 0;
    await page.route('**/api/identifications', route => { calls++; return route.fulfill({ json: { ...failure, candidates: [] } }); });
    await dialog.getByRole('button', { name: "Pflanze bestimmen", exact: true }).click();
    await expect(dialog.getByRole('alert')).toHaveText(failure.error);
    await expect(page.getByLabel("Pflegenotizen")).toHaveValue('Keep these notes.');
    await expect(dialog.getByText('plant.jpg', { exact: true })).toBeVisible();
    expect(calls).toBe(1);
    await dialog.getByRole('button', { name: "Pflanze bestimmen", exact: true }).click();
    await expect.poll(() => calls).toBe(2);
    await dialog.getByRole('button', { name: "Pflanze hinzufügen", exact: true }).click();
    await expect(dialog).toHaveCount(0); expect(calls).toBe(2);
  });
}

test('no-key and offline states disable identification, and HEIC fallback remains eligible online', async ({ page, context }) => {
  await page.unroute('**/api/bootstrap');
  await page.route('**/api/bootstrap', async route => { const response = await route.fetch(); await route.fulfill({ response, json: { ...await response.json(), plantnet_available: false } }); });
  const dialog = await draft(page);
  await expect(dialog.getByText(/Pflanzenbestimmung ist nicht eingerichtet/)).toBeVisible();
  await expect(dialog.getByRole('button', { name: "Pflanze bestimmen", exact: true })).toBeDisabled();
  await page.getByLabel("Wissenschaftlicher Name").fill('Manual species');
  await dialog.getByRole('button', { name: "Abbrechen", exact: true }).click();
  await page.unroute('**/api/bootstrap');
  await page.route('**/api/bootstrap', async route => { const response = await route.fetch(); await route.fulfill({ response, json: { ...await response.json(), plantnet_available: true } }); });
  await draft(page);
  await page.getByLabel("Pflanzenfoto · optional").setInputFiles({ name: 'plant.heic', mimeType: 'image/heic', buffer: Buffer.from('HEIC preview unavailable') });
  await expect(dialog.getByText("Keine Vorschau verfügbar. Dein Foto kann trotzdem hochgeladen werden.")).toBeVisible();
  await expect(dialog.getByRole('button', { name: "Pflanze bestimmen", exact: true })).toBeEnabled();
  await context.setOffline(true);
  await expect(dialog.getByRole('button', { name: "Pflanze bestimmen", exact: true })).toBeDisabled();
  await expect(dialog.getByText(/Pflanzenbestimmung ist offline nicht verfügbar/)).toBeVisible();
  await context.setOffline(false);
  await expect(dialog.getByRole('button', { name: "Pflanze bestimmen", exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: "Abbrechen", exact: true }).click();
});
