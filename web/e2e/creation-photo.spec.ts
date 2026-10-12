import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const created = new Set<string>();
const responses: Promise<void>[] = [];
test.beforeEach(async ({ page }) => {
  page.on('response', response => {
    if (new URL(response.url()).pathname === '/api/plants' && response.request().method() === 'POST' && response.status() === 201) {
      responses.push(response.json().then(plant => { created.add(plant.id); }));
    }
  });
});
test.afterEach(async ({ request }) => {
  await Promise.all(responses.splice(0));
  for (const id of created) await request.delete(`/api/plants/${id}`);
  created.clear();
});

async function openForm(page: Page) {
  await page.goto('/plants');
  await page.getByRole('button', { name: /add (your first )?plant/i }).first().click();
  await page.getByLabel('Plant name').fill(`Photo plant ${Date.now()}`);
  await page.getByLabel('Care notes').fill('Keep these details.');
  return page.getByRole('dialog');
}
const picker = (page: Page) => page.getByLabel('Plant photo · optional');
const add = (page: Page) => page.getByRole('dialog').getByRole('button', { name: 'Add plant', exact: true });
async function choose(page: Page) { await picker(page).setInputFiles('/tmp/plant.jpg'); }
async function uploadFailure(page: Page) {
  await page.route('**/api/plants/*/photos', route => route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ error: 'Photo rejected for this test.' }) }));
}

test('selects, replaces and removes local photos, falls back for HEIC, and cancels cleanly at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  const dialog = await openForm(page);
  let writes = 0;
  page.on('request', r => { if (r.method() === 'POST') writes++; });
  await page.evaluate(() => {
    const created: string[] = [], revoked: string[] = [];
    const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = blob => { const url = create(blob); if (blob instanceof File) created.push(url); return url; };
    URL.revokeObjectURL = url => { revoked.push(url); revoke(url); };
    Object.assign(window, { previewURLs: { created, revoked } });
  });
  expect(await picker(page).getAttribute('accept')).toContain('image/webp');
  expect(await picker(page).getAttribute('accept')).toContain('.heic');
  await dialog.getByRole('button', { name: 'Choose photo' }).focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Choose photo' })).toBeFocused();
  expect(await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle)).not.toBe('none');
  await choose(page);
  await expect(dialog.getByRole('img', { name: 'Selected plant photo preview' })).toBeVisible();
  await expect(dialog.getByText('plant.jpg', { exact: true })).toBeVisible();
  for (const mime of ['image/png', 'image/webp']) {
    await picker(page).setInputFiles({ name: `replacement.${mime.split('/')[1]}`, mimeType: mime, buffer: readFileSync('/tmp/plant.jpg') });
    await expect(dialog.getByText(`replacement.${mime.split('/')[1]}`, { exact: true })).toBeVisible();
    await expect(page.getByLabel('Care notes')).toHaveValue('Keep these details.');
  }
  await picker(page).setInputFiles({ name: 'window-plant.heic', mimeType: 'image/heic', buffer: Buffer.from('unsupported browser preview') });
  await expect(dialog.getByText('Preview unavailable. Your photo can still be uploaded.')).toBeVisible();
  await expect(dialog.getByRole('img')).toHaveCount(0);
  await expect(add(page)).toBeEnabled();
  for (const name of ['Replace', 'Remove']) {
    expect((await dialog.getByRole('button', { name, exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await dialog.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Choose photo' })).toBeVisible();
  await choose(page);
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(writes).toBe(0);
  const urls = await page.evaluate(() => (window as unknown as { previewURLs: { created: string[]; revoked: string[] } }).previewURLs);
  expect(urls.created.length).toBeGreaterThanOrEqual(4);
  expect(urls.created.every(url => urls.revoked.includes(url))).toBe(true);
  await page.getByRole('button', { name: /add (your first )?plant/i }).first().click();
  await expect(picker(page)).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Choose photo' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('creates with a cover and one photo activity, without identification, and keeps editing unchanged', async ({ page }) => {
  const dialog = await openForm(page);
  const name = await page.getByLabel('Plant name').inputValue();
  let identification = 0;
  page.on('request', r => { if (r.url().includes('/photos/identify')) identification++; });
  await choose(page);
  const saved = page.waitForResponse(r => new URL(r.url()).pathname === '/api/plants' && r.request().method() === 'POST');
  await add(page).click();
  const plant = await (await saved).json();
  await expect(dialog).toHaveCount(0);
  const card = page.getByRole('button', { name: new RegExp(name) });
  await expect(card.locator('img')).toBeVisible();
  await card.click();
  await expect(page.locator('.photo-grid img')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Cover photo' })).toBeVisible();
  const detail = await (await page.request.get(`/api/plants/${plant.id}`)).json();
  expect(detail.plant.cover_photo_id).toBeTruthy();
  expect(detail.activities.filter((a: { type: string }) => a.type === 'photo')).toHaveLength(1);
  expect(identification).toBe(0);
  await page.getByRole('button', { name: 'Edit plant and care schedule' }).click();
  await expect(picker(page)).toHaveCount(0);
  await page.getByLabel('Care notes').fill('Edited notes.');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog).toHaveCount(0);
  const edited = await (await page.request.get(`/api/plants/${plant.id}`)).json();
  expect(edited.plant.notes).toBe('Edited notes.');
});

test('removing the photo saves normally without an upload', async ({ page }) => {
  const dialog = await openForm(page);
  let uploads = 0;
  page.on('request', r => { if (r.method() === 'POST' && r.url().includes('/photos')) uploads++; });
  await choose(page);
  await dialog.getByRole('button', { name: 'Remove', exact: true }).click();
  await add(page).click();
  await expect(dialog).toHaveCount(0);
  expect(uploads).toBe(0);
  expect(created.size).toBe(1);
});

test('retains details and selection after create rejection and never starts the upload', async ({ page }) => {
  const dialog = await openForm(page);
  await choose(page);
  let uploads = 0;
  page.on('request', r => { if (r.method() === 'POST' && r.url().includes('/photos')) uploads++; });
  await page.route('**/api/plants', route => route.request().method() === 'POST' ? route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Please check the plant details.' }) }) : route.continue());
  await add(page).click();
  await expect(dialog.getByRole('alert')).toContainText('Please check the plant details.');
  await expect(page.getByLabel('Care notes')).toHaveValue('Keep these details.');
  await expect(dialog.getByText('plant.jpg', { exact: true })).toBeVisible();
  expect(uploads).toBe(0);
  await page.unroute('**/api/plants');
  await add(page).click();
  await expect(dialog).toHaveCount(0);
});

test('locks saving and uploading phases, then retries a replacement against the same saved plant', async ({ page }) => {
  const dialog = await openForm(page);
  await choose(page);
  let creates = 0, uploads = 0;
  let releaseCreate!: () => void, releaseUpload!: () => void;
  const createGate = new Promise<void>(resolve => { releaseCreate = resolve; });
  const uploadGate = new Promise<void>(resolve => { releaseUpload = resolve; });
  await page.route('**/api/plants', async route => {
    if (route.request().method() === 'POST') { creates++; await createGate; }
    await route.continue();
  });
  const uploadIDs: string[] = [];
  await page.route('**/api/plants/*/photos', async route => {
    uploads++;
    uploadIDs.push(new URL(route.request().url()).pathname.split('/')[3]);
    if (uploads === 1) { await uploadGate; await route.fulfill({ status: 422, contentType: 'application/json', body: '{"error":"Photo rejected for this test."}' }); }
    else await route.continue();
  });
  await add(page).evaluate(b => { (b as HTMLButtonElement).click(); (b as HTMLButtonElement).click(); });
  await expect(dialog.getByRole('status')).toHaveText('Saving plant…');
  await expect(page.getByLabel('Plant name')).toBeDisabled();
  await expect(picker(page)).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  expect(creates).toBe(1);
  releaseCreate();
  await expect(dialog.getByRole('status')).toHaveText('Plant saved. Uploading photo…');
  await expect(dialog.getByRole('button', { name: 'Continue without photo' })).toBeDisabled();
  expect(uploads).toBe(1);
  releaseUpload();
  await expect(dialog.getByRole('alert')).toContainText('Plant saved. Photo needs attention.');
  await expect(page.getByLabel('Plant name')).toBeHidden();
  await picker(page).setInputFiles({ name: 'replacement.jpg', mimeType: 'image/jpeg', buffer: readFileSync('/tmp/plant.jpg') });
  await dialog.getByRole('button', { name: 'Retry photo', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(creates).toBe(1);
  expect(uploads).toBe(2);
  expect(new Set(uploadIDs).size).toBe(1);
  const detail = await (await page.request.get(`/api/plants/${uploadIDs[0]}`)).json();
  expect(detail.activities.filter((a: { type: string }) => a.type === 'photo')).toHaveLength(1);
});

for (const dismiss of ['Continue without photo', 'Close']) {
  test(`preserves the plant after photo rejection when choosing ${dismiss}`, async ({ page }) => {
    const dialog = await openForm(page);
    const name = await page.getByLabel('Plant name').inputValue();
    await choose(page);
    await uploadFailure(page);
    await add(page).click();
    await expect(dialog.getByRole('alert')).toContainText('Plant saved.');
    await dialog.getByRole('button', { name: dismiss, exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible();
    expect(created.size).toBe(1);
    await page.getByRole('button', { name: /add (your first )?plant/i }).first().click();
    await expect(page.getByRole('button', { name: 'Choose photo' })).toBeVisible();
    await expect(page.getByLabel('Plant name')).toHaveValue('');
  });
}

test('keeps the saved context after connection loss and requires explicit retry after reconnecting', async ({ page, context }) => {
  const dialog = await openForm(page);
  await choose(page);
  let uploads = 0, creates = 0;
  page.on('request', r => { if (r.method() === 'POST' && new URL(r.url()).pathname === '/api/plants') creates++; });
  await page.route('**/api/plants/*/photos', async route => { uploads++; await context.setOffline(true); await route.abort(); });
  await add(page).click();
  await expect(dialog.getByRole('alert')).toContainText('could not be confirmed');
  await expect(dialog.getByText('plant.jpg', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Retry photo', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Plant saved.');
  expect(uploads).toBe(1);
  await page.unroute('**/api/plants/*/photos');
  await context.setOffline(false);
  await expect(dialog.getByRole('button', { name: 'Retry photo', exact: true })).toBeEnabled();
  expect(uploads).toBe(1);
  await dialog.getByRole('button', { name: 'Retry photo', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(creates).toBe(1);
});

test('a collection refresh failure after a successful upload never offers another upload', async ({ page }) => {
  const dialog = await openForm(page);
  await choose(page);
  let uploads = 0, creates = 0;
  page.on('request', r => {
    if (r.method() === 'POST' && new URL(r.url()).pathname === '/api/plants') creates++;
    if (r.method() === 'POST' && r.url().endsWith('/photos')) uploads++;
  });
  await page.route('**/api/bootstrap', route => route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"Refresh unavailable."}' }));
  await add(page).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('alert')).toContainText('Refresh unavailable.');
  await expect(page.getByRole('button', { name: 'Retry photo', exact: true })).toHaveCount(0);
  expect(creates).toBe(1);
  expect(uploads).toBe(1);
});
