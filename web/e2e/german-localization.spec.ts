import { test, expect } from './fixtures';

test.use({ locale: 'en-US', timezoneId: 'America/Los_Angeles', viewport: { width: 320, height: 740 } });

async function addPlant(request: import('@playwright/test').APIRequestContext, name: string) {
  const response = await request.post('/api/plants', { data: { name, scientific_name: 'Monstera deliciosa', watering_interval_days: 7 } });
  expect(response.ok()).toBe(true);
  return response.json() as Promise<{ id: string }>;
}

test('uses German UI and a verified German article under a different title', async ({ page, request }) => {
  const plant = await addPlant(request, `German reference ${Date.now()}`);
  try {
    await page.route(/^https:\/\/de\.wikipedia\.org\/w\/api\.php/, async route => {
      const title = new URL(route.request().url()).searchParams.get('titles');
      await route.fulfill({ json: { query: { pages: [title === 'Köstliches Fensterblatt' ? { ns: 0, title } : { ns: 0, missing: true }] } }, headers: { 'Access-Control-Allow-Origin': '*' } });
    });
    await page.route(/^https:\/\/en\.wikipedia\.org\/w\/api\.php/, route => route.fulfill({ json: { query: { pages: [{ ns: 0, title: 'Monstera deliciosa', langlinks: [{ lang: 'de', title: 'Köstliches Fensterblatt' }] }] } }, headers: { 'Access-Control-Allow-Origin': '*' } }));
    await page.goto(`/plants/${plant.id}`);
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await expect(page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('button', { name: 'Pflanzen' })).toBeVisible();
    const reference = page.getByRole('link', { name: 'Monstera deliciosa auf Wikipedia (öffnet einen neuen Tab)' });
    await expect(reference).toHaveAttribute('href', 'https://de.wikipedia.org/wiki/K%C3%B6stliches_Fensterblatt');
    await expect(reference).toHaveAttribute('rel', 'noopener noreferrer');
    await reference.focus(); await expect(reference).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole('combobox', { name: /Sprache/i })).toHaveCount(0);
  } finally { await request.delete(`/api/plants/${plant.id}`); }
});

test('uses an English article only when German is missing and explains an unavailable lookup', async ({ page, request, context }) => {
  const plant = await addPlant(request, `English reference ${Date.now()}`);
  try {
    await page.route(/^https:\/\/de\.wikipedia\.org\/w\/api\.php/, route => route.fulfill({ json: { query: { pages: [{ ns: 0, missing: true }] } }, headers: { 'Access-Control-Allow-Origin': '*' } }));
    await page.goto(`/plants/${plant.id}`);
    const reference = page.getByRole('link', { name: 'Monstera deliciosa auf Wikipedia (auf Englisch) (öffnet einen neuen Tab)' });
    await expect(reference).toHaveAttribute('href', 'https://en.wikipedia.org/wiki/Monstera_deliciosa');
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await context.setOffline(true);
    await expect(page.getByText(/Wikipedia konnte nicht geprüft werden/)).toBeVisible();
    await expect(reference).toHaveCount(0);
    const cachedExternal = await page.evaluate(async () => (await Promise.all((await caches.keys()).map(async name => (await caches.open(name)).keys()))).flat().some(request => /wikipedia|wikidata/.test(request.url)));
    expect(cachedExternal).toBe(false);
    await context.setOffline(false);
    await expect(reference).toBeVisible();
  } finally { await request.delete(`/api/plants/${plant.id}`); }
});

test('retries a failed lookup and never applies a stale result to another plant', async ({ page, request }) => {
  const first = await addPlant(request, `First reference ${Date.now()}`);
  const otherResponse = await request.post('/api/plants', { data: { name: `Second reference ${Date.now()}`, scientific_name: 'Epipremnum aureum', watering_interval_days: 7 } });
  const second = await otherResponse.json() as { id: string; name: string };
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  let firstRequested!: () => void;
  const firstLookup = new Promise<void>(resolve => { firstRequested = resolve; });
  let failSecond = true;
  try {
    await page.route(/^https:\/\/de\.wikipedia\.org\/w\/api\.php/, async route => {
      const title = new URL(route.request().url()).searchParams.get('titles');
      if (title === 'Monstera deliciosa') {
        firstRequested();
        await pending;
        await route.fulfill({ json: { query: { pages: [{ ns: 0, title: 'Köstliches Fensterblatt' }] } }, headers: { 'Access-Control-Allow-Origin': '*' } }).catch(() => {});
      } else if (failSecond) {
        await route.abort();
      } else {
        await route.fulfill({ json: { query: { pages: [{ ns: 0, title: 'Goldene Efeutute' }] } }, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
    });
    await page.goto(`/plants/${first.id}`);
    await firstLookup;
    await page.getByRole('button', { name: '← Alle Pflanzen' }).click();
    await page.getByRole('button', { name: new RegExp(second.name) }).click();
    await expect(page.getByText(/Wikipedia konnte nicht geprüft werden/)).toBeVisible();
    failSecond = false;
    await page.getByRole('button', { name: 'Erneut versuchen' }).click();
    const reference = page.getByRole('link', { name: 'Epipremnum aureum auf Wikipedia (öffnet einen neuen Tab)' });
    await expect(reference).toHaveAttribute('href', 'https://de.wikipedia.org/wiki/Goldene_Efeutute');
    release();
    await expect(reference).toBeVisible();
    await expect(page.getByRole('link', { name: /Monstera deliciosa auf Wikipedia/ })).toHaveCount(0);
  } finally { release(); await request.delete(`/api/plants/${first.id}`); await request.delete(`/api/plants/${second.id}`); }
});

test('calendar starts on Monday and groups activity by the deployment timezone', async ({ page }) => {
  await page.route('**/api/bootstrap', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, json: { ...await response.json(), timezone: 'Europe/Berlin' } });
  });
  await page.route('**/api/calendar?month=*', route => route.fulfill({ json: { activities: [{ id: 'a', plant_id: 'p', plant_name: 'Zeitzonenpflanze', type: 'watering', occurred_at: '2026-03-28T23:30:00Z' }], due: [] } }));
  await page.goto('/calendar?month=2026-03');
  await expect(page.locator('.calendar-grid > b')).toHaveText(['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']);
  await expect(page.getByRole('heading', { name: 'März 2026' })).toBeVisible();
  await page.locator('.calendar-grid button:not(.outside)').filter({ hasText: /^29$/ }).click();
  await expect(page.getByText('Zeitzonenpflanze · Gießen')).toBeVisible();
  await expect(page.getByText('00:30', { exact: true })).toBeVisible();
});
