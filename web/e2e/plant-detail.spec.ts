import { test, expect, type APIRequestContext, type Page } from './fixtures';

test.use({ serviceWorkers: 'block' });
const ids = new Set<string>();
test.afterEach(async ({ request }) => { for (const id of ids) await request.delete(`/api/plants/${id}`); ids.clear(); });
async function create(request: APIRequestContext, extra: Record<string, unknown> = {}) {
  const response = await request.post('/api/plants', { data: { name: `Detail review ${Date.now()}`, scientific_name: 'Nephrolepis exaltata', watering_interval_days: 7, summer_fertilizing_interval_days: 14, winter_fertilizing_paused: true, ...extra } });
  expect(response.status()).toBe(201);
  const plant = await response.json(); ids.add(plant.id); return plant;
}
const read = async (request: APIRequestContext, id: string) => (await (await request.get(`/api/plants/${id}`)).json()).plant;
async function editor(page: Page) {
  await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pflanze bearbeiten' });
  await expect(dialog).toBeVisible(); return dialog;
}

test('detail sections fit phones and desktop and support keyboard navigation', async ({ page, request }) => {
  const plant = await create(request);
  await page.goto(`/plants/${plant.id}`);
  await expect(page.getByRole('tab', { name: 'Übersicht' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: plant.name })).toBeVisible();
  await expect(page.getByText('Noch nicht begonnen', { exact: true })).toBeVisible();
  await expect(page.getByText('Im Winter pausiert')).toBeVisible();
  await page.getByRole('tab', { name: 'Übersicht' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Fotos' })).toBeFocused();
  await expect(page.getByText(/Füge ein Foto hinzu/)).toBeVisible();
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: 'Verlauf' })).toBeFocused();
  await expect(page.getByText('Keine Einträge für diese Auswahl')).toBeVisible();
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const name of ['Übersicht', 'Fotos', 'Verlauf']) {
      await page.getByRole('tab', { name }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Übersicht' })).toHaveAttribute('aria-selected', 'true');
});

test('automatic prefill stays automatic, manual override survives reload and unrelated edits', async ({ page, request }) => {
  const plant = await create(request);
  await page.goto(`/plants/${plant.id}`);
  let form = await editor(page);
  await expect(form.getByLabel('Wikipedia-Link · optional')).toHaveValue('https://de.wikipedia.org/wiki/Nephrolepis_exaltata');
  await form.getByLabel('Pflanzenname').fill(`${plant.name} renamed`);
  await form.getByRole('button', { name: 'Änderungen speichern' }).click();
  await expect(form).toHaveCount(0);
  expect((await read(request, plant.id)).wikipedia_url).toBe('');
  form = await editor(page);
  await form.getByLabel('Wikipedia-Link · optional').fill('https://en.m.wikipedia.org/wiki/Fern#Ecology');
  await form.getByRole('button', { name: 'Änderungen speichern' }).click();
  await expect(form).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.identity-species a')).toHaveAttribute('href', 'https://en.wikipedia.org/wiki/Fern#Ecology');
  await expect(page.locator('.identity-species a')).toHaveAttribute('aria-label', /auf Englisch/);
  form = await editor(page);
  await form.getByLabel('Wissenschaftlicher Name').fill('Another species');
  await form.getByRole('button', { name: 'Änderungen speichern' }).click();
  await expect(form).toHaveCount(0);
  expect((await read(request, plant.id)).wikipedia_url).toBe('https://en.wikipedia.org/wiki/Fern#Ecology');
});

test('automatic reset is saved only by confirmation, invalid URLs retain the draft', async ({ page, request }) => {
  const url = 'https://de.wikipedia.org/wiki/Schwertfarne';
  const plant = await create(request, { wikipedia_url: url });
  await page.goto(`/plants/${plant.id}`);
  let form = await editor(page);
  await form.getByRole('button', { name: 'Automatisch ermitteln' }).click();
  await form.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  expect((await read(request, plant.id)).wikipedia_url).toBe(url);
  form = await editor(page);
  await form.getByLabel('Wikipedia-Link · optional').fill('https://evil.test/wiki/Fern');
  await form.getByRole('button', { name: 'Änderungen speichern' }).click();
  await expect(form.getByRole('alert')).toContainText('HTTPS-Artikellink');
  expect((await read(request, plant.id)).wikipedia_url).toBe(url);
  await form.getByRole('button', { name: 'Automatisch ermitteln' }).click();
  await form.getByRole('button', { name: 'Änderungen speichern' }).click();
  await expect(form).toHaveCount(0);
  expect((await read(request, plant.id)).wikipedia_url).toBe('');
});

test('late automatic lookup cannot replace typing and lookup failures do not block unrelated saves', async ({ page, request }) => {
  const plant = await create(request);
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('https://de.wikipedia.org/w/api.php*', async route => {
    const name = new URL(route.request().url()).searchParams.get('titles');
    if (name === 'Delayed species') await pending;
    if (name === 'Unavailable species') { await route.abort(); return; }
    await route.fulfill({ json: { query: { pages: [{ ns: 0, title: name }] } }, headers: { 'Access-Control-Allow-Origin': '*' } }).catch(() => {});
  });
  try {
    await page.goto(`/plants/${plant.id}`);
    let form = await editor(page);
    await form.getByLabel('Wissenschaftlicher Name').fill('Delayed species');
    await expect(form.getByText('Wikipedia wird geprüft…')).toBeVisible();
    const field = form.getByLabel('Wikipedia-Link · optional');
    await field.fill('https://en.wikipedia.org/wiki/Fern'); release();
    await expect(field).toHaveValue('https://en.wikipedia.org/wiki/Fern');
    await form.getByRole('button', { name: 'Abbrechen', exact: true }).click();
    form = await editor(page);
    await form.getByLabel('Wissenschaftlicher Name').fill('Unavailable species');
    await expect(form.getByText(/Du kannst einen Link selbst eingeben/)).toBeVisible();
    await form.getByRole('button', { name: 'Änderungen speichern' }).click();
    await expect(form).toHaveCount(0);
    expect((await read(request, plant.id)).scientific_name).toBe('Unavailable species');
  } finally { release(); }
});

test('room-only edit preserves newer fields and saved override', async ({ page, request }) => {
  const roomResponse = await request.post('/api/rooms', { data: { name: `Detail room ${Date.now()}` } });
  const room = await roomResponse.json();
  const plant = await create(request, { wikipedia_url: 'https://de.wikipedia.org/wiki/Schwertfarne', common_name: 'Schwertfarn', family: 'Nephrolepidaceae' });
  try {
    await page.goto(`/plants/${plant.id}`);
    const form = await editor(page);
    await request.put(`/api/plants/${plant.id}`, { data: { ...await read(request, plant.id), notes: 'Saved by another client' } });
    await form.getByLabel('Raum · optional').selectOption(room.id);
    await form.getByRole('button', { name: 'Änderungen speichern' }).click();
    await expect(form).toHaveCount(0);
    const saved = await read(request, plant.id);
    expect(saved).toMatchObject({ room_id: room.id, notes: 'Saved by another client', family: 'Nephrolepidaceae', common_name: 'Schwertfarn', wikipedia_url: plant.wikipedia_url });
    await expect(page.locator('.identity-room')).toContainText(room.name);
  } finally { await request.delete(`/api/rooms/${room.id}`); }
});

test('small-screen editor groups focus, seasonal controls, cancellation and keyboard actions', async ({ page, request }) => {
  const plant = await create(request);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto(`/plants/${plant.id}`);
  const planLauncher = page.locator('.care-plan').getByRole('button', { name: 'Ändern', exact: true });
  await planLauncher.click();
  const form = page.getByRole('dialog', { name: 'Pflanze bearbeiten' });
  await expect(form.getByLabel('Gießabstand (Tage)')).toBeFocused();
  await form.getByRole('checkbox', { name: 'Im Sommer pausieren', exact: true }).check();
  await form.getByRole('checkbox', { name: 'Im Winter pausieren', exact: true }).uncheck();
  await form.getByLabel('Düngeabstand im Winter (Tage)', { exact: true }).fill('28');
  const save = form.getByRole('button', { name: 'Änderungen speichern' });
  await save.focus(); await page.keyboard.press('Tab');
  const close = form.getByRole('button', { name: 'Schließen', exact: true });
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab'); await expect(save).toBeFocused();
  expect(await form.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  for (const button of [close, save]) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await save.click(); await expect(form).toHaveCount(0);
  await expect(planLauncher).toBeFocused();
  expect(await read(request, plant.id)).toMatchObject({ summer_fertilizing_paused: true, winter_fertilizing_paused: false, winter_fertilizing_interval_days: 28 });
  const notes = page.getByRole('button', { name: 'Notizen hinzufügen', exact: true });
  await notes.click();
  await expect(form.getByRole('textbox', { name: 'Pflanzennotizen', exact: true })).toBeFocused();
  await form.getByRole('textbox', { name: 'Pflanzennotizen', exact: true }).fill('Unsaved note');
  await form.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  await expect(notes).toBeFocused();
  expect((await read(request, plant.id)).notes).toBe('');
});

for (const [timezone, expectedTimestamp] of [
  ['UTC', '2026-10-30T10:30:00Z'],
  ['Europe/Berlin', '2026-10-30T09:30:00Z'],
] as const) test(`care sheet retains failed input and records exactly one backdated event with a note (${timezone})`, async ({ page, request }) => {
  await page.route('**/api/bootstrap', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, json: { ...await response.json(), timezone } });
  });
  const plant = await create(request);
  await page.goto(`/plants/${plant.id}`);
  const launcher = page.getByRole('button', { name: 'Gießen eintragen', exact: true });
  await launcher.click();
  const form = page.getByRole('dialog', { name: 'Gießen eintragen' });
  const date = form.getByLabel('Datum und Uhrzeit des Gießens');
  await date.fill('2026-10-30T10:30');
  await form.getByLabel('Notiz · optional').fill('Erde war trocken.');
  let calls = 0, fail = true;
  await page.route(`**/api/plants/${plant.id}/activities`, async route => {
    if (route.request().method() !== 'POST') { await route.continue(); return; }
    calls++;
    if (fail) { await route.fulfill({ status: 503, json: { error: 'failure' } }); return; }
    await route.continue();
  });
  await form.getByRole('button', { name: 'Pflege speichern' }).click();
  await expect(form.getByRole('alert')).toContainText('nicht bestätigt');
  await expect(date).toHaveValue('2026-10-30T10:30');
  await expect(form.getByLabel('Notiz · optional')).toHaveValue('Erde war trocken.');
  fail = false;
  await form.getByRole('button', { name: 'Pflege speichern' }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
  await expect(form).toHaveCount(0);
  expect(calls).toBe(2);
  await expect(launcher).toBeFocused();
  const data = await (await request.get(`/api/plants/${plant.id}`)).json();
  expect(data.activities).toHaveLength(1);
  expect(data.activities[0]).toMatchObject({ type: 'watering', note: 'Erde war trocken.', occurred_at: expectedTimestamp });
  await page.getByRole('tab', { name: 'Verlauf' }).click();
  await expect(page.locator('.timeline')).toContainText('Erde war trocken.');
});

test('confirmed care is not resubmitted when reminder refresh fails', async ({ page, request }) => {
  const plant = await create(request);
  await page.goto(`/plants/${plant.id}`);
  await page.getByRole('button', { name: 'Gießen eintragen', exact: true }).click();
  let posts = 0;
  await page.route(`**/api/plants/${plant.id}/activities`, async route => { if (route.request().method() === 'POST') posts++; await route.continue(); });
  await page.route('**/api/today', route => route.fulfill({ status: 503, json: {} }));
  await page.getByRole('dialog').getByRole('button', { name: 'Pflege speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Pflegestatus nicht verfügbar')).toBeVisible();
  await expect(page.getByText('Gießen gespeichert.')).toBeVisible();
  expect(posts).toBe(1);
});

test('an override works without a scientific name and never triggers lookup', async ({ page, request }) => {
  const plant = await create(request, { scientific_name: '', wikipedia_url: 'https://de.wikipedia.org/wiki/Schwertfarne' });
  let lookups = 0;
  await page.route(/^https:\/\/(de|en)\.wikipedia\.org\/w\/api\.php/, async route => { lookups++; await route.abort(); });
  await page.goto(`/plants/${plant.id}`);
  await expect(page.locator('.identity-species')).toContainText('Art nicht angegeben');
  await expect(page.locator('.identity-species a')).toHaveAttribute('href', plant.wikipedia_url);
  expect(lookups).toBe(0);
});

test('failed detail reads do not masquerade as an empty history', async ({ page, request }) => {
  const plant = await create(request);
  await page.goto('/plants');
  await page.route(`**/api/plants/${plant.id}`, route => route.fulfill({ status: 503, json: {} }));
  await page.getByRole('button', { name: new RegExp(plant.name) }).click();
  await expect(page.getByRole('heading', { name: plant.name })).toBeVisible();
  await page.getByRole('tab', { name: 'Verlauf' }).click();
  await expect(page.getByRole('tabpanel', { name: 'Verlauf' }).getByRole('alert')).toContainText('Der Verlauf konnte nicht geladen werden.');
  await expect(page.getByText('Keine Einträge für diese Auswahl')).toHaveCount(0);
});

test.describe('cached reference', () => {
  test.use({ serviceWorkers: 'allow' });
  test('keeps a saved override readable offline while all mutations remain disabled', async ({ page, request, context }) => {
    const plant = await create(request, { wikipedia_url: 'https://de.wikipedia.org/wiki/Schwertfarne' });
    await page.goto(`/plants/${plant.id}`);
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload();
    await expect(page.locator('.identity-species a')).toHaveAttribute('href', plant.wikipedia_url);
    await expect(page.getByRole('button', { name: 'Bearbeiten', exact: true })).toBeEnabled();
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('.identity-species a')).toHaveAttribute('href', plant.wikipedia_url);
    await expect(page.getByRole('button', { name: 'Bearbeiten', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Gießen eintragen', exact: true })).toBeDisabled();
    await page.getByRole('tab', { name: 'Fotos' }).click();
    await expect(page.locator('.gallery input[type=file]')).toBeDisabled();
    await page.getByRole('tab', { name: 'Verlauf' }).click();
    await expect(page.getByRole('button', { name: 'Notiz hinzufügen', exact: true })).toBeDisabled();
    await context.setOffline(false);
  });
});
