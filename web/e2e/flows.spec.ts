import { test, expect } from './fixtures';

const created: string[] = [];
test.afterAll(async ({ request }) => {
  for (const id of created) await request.delete(`/api/plants/${id}`).catch(() => undefined);
});

async function addPlant(page: import('@playwright/test').Page, name: string) {
  if (!(await page.getByRole('button', { name: /(erste )?Pflanze hinzufügen/i }).count())) {
    await page.getByRole('navigation', { name: "Hauptnavigation" }).getByRole('button', { name: /Pflanzen/ }).click();
  }
  await page.getByRole('button', { name: /(erste )?Pflanze hinzufügen/i }).first().click();
  await page.getByLabel("Pflanzenname").fill(name);
  await page.getByLabel("Pflegebeginn").fill(new Date().toISOString().slice(0, 10));
  await page.getByLabel(/Gießabstand/).fill('0');
  await page.getByLabel("Pflanzenname").press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel(/Gießabstand/)).toHaveValue('0');
  await page.getByLabel(/Gießabstand/).fill('7');
  await page.getByLabel("Düngeabstand im Sommer (Tage)").fill('14');
  await page.getByLabel("Düngeabstand im Winter (Tage)").fill('42');
  await page.getByRole('button', { name: "Pflanze hinzufügen" }).last().click();
  await expect(page.getByRole('heading', { name: "Deine Pflanzen" })).toBeVisible();
  const response = await page.request.get('/api/plants');
  const payload = await response.json();
  const plant = payload.plants.find((item: { name: string }) => item.name === name);
  if (plant) created.push(plant.id);
  return plant as { id: string };
}

async function wateringDue(page: import('@playwright/test').Page, plantID: string) {
  const today = await (await page.request.get('/api/today')).json();
  return [...today.due, ...today.next]
    .filter((item: { plant_id: string; type: string }) => item.plant_id === plantID && item.type === 'watering')
    .map((item: { due_date: string }) => item.due_date)
    .sort();
}

test('creates a plant, records care and a note, and keeps the form usable on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const name = `PW fern ${Date.now()}`;
  const plant = await addPlant(page, name);
  await page.getByRole('button', { name: new RegExp(name) }).click();
  await expect(page.getByText("Alle 14 Tage")).toBeVisible();
  await expect(page.getByText("Alle 42 Tage")).toBeVisible();
  await page.getByRole('button', { name: /Gießen eintragen/ }).press('Enter');
  await expect(page.getByRole('heading', { name: /Verlauf/ })).toBeVisible();
  await expect(page.getByText("Gießen").last()).toBeVisible();
  const nextWatering = await wateringDue(page, plant.id);
  await page.getByRole('textbox', { name: "Pflegenotiz", exact: true }).fill('Rotate toward the light weekly.');
  await page.getByRole('button', { name: "Notiz hinzufügen" }).click();
  await expect(page.getByText('Rotate toward the light weekly.')).toBeVisible();
  await expect(await wateringDue(page, plant.id)).toEqual(nextWatering);
  const fertilizerDate = page.getByLabel("Datum und Uhrzeit des Düngens");
  await fertilizerDate.fill('2024-04-01T12:00');
  await page.route(`**/api/plants/${plant.id}/activities`, route => route.abort());
  await page.getByRole('button', { name: /Düngen eintragen/ }).click();
  await expect(page.getByRole('alert')).toContainText(/offline/i);
  await expect(fertilizerDate).toHaveValue('2024-04-01T12:00');
  await page.unroute(`**/api/plants/${plant.id}/activities`);
  let carePosts = 0;
  let releaseResponse!: () => void, requestSaved!: () => void;
  const responseHeld = new Promise<void>(resolve => { releaseResponse = resolve; });
  const requestCompleted = new Promise<void>(resolve => { requestSaved = resolve; });
  await page.route(`**/api/plants/${plant.id}/activities`, async route => {
    if (route.request().method() !== 'POST') return route.continue();
    carePosts++;
    const response = await route.fetch();
    requestSaved();
    await responseHeld;
    await route.fulfill({ response });
  });
  const fertilizerButton = page.getByRole('button', { name: /Düngen eintragen/ });
  const fertilizerControl = page.locator('.quick-entry').filter({ has: page.getByLabel('Datum und Uhrzeit des Düngens') }).getByRole('button');
  try {
    await fertilizerButton.evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
    await requestCompleted;
    await expect.poll(() => carePosts).toBe(1);
    await expect(fertilizerControl).toHaveText('Wird gespeichert…');
    const wateringFilter = page.locator('.activity-filters').getByRole('button', { name: 'Gießen', exact: true });
    await wateringFilter.click();
    await expect(wateringFilter).toHaveAttribute('aria-pressed', 'true');
    releaseResponse();
    await expect(fertilizerControl).toHaveText(/Düngen eintragen/);
    await expect(wateringFilter).toHaveAttribute('aria-pressed', 'true');
  } finally { releaseResponse(); }
  await page.unroute(`**/api/plants/${plant.id}/activities`);
  for (const [kind, label] of [['Gießen', 'Gießen'], ['Düngen', 'Düngen'], ['Pflegenotiz', 'Pflegenotiz']] as const) {
    await page.getByRole('button', { name: kind, exact: true }).click();
    await expect(page.locator('.timeline-item').first()).toContainText(label);
    await expect(page.locator('.timeline-item')).toHaveCount(1);
  }
  await page.getByRole('button', { name: "Alle", exact: true }).click();
  const timeline = page.locator('.timeline-item');
  const activityCount = await timeline.count();
  const fertilizerItem = timeline.filter({ hasText: 'Düngen' }).first();
  await fertilizerItem.getByRole('button', { name: "Bearbeiten", exact: true }).click();
  await page.getByLabel("Pflegenotiz bearbeiten").fill('Adjusted care record.');
  await page.getByRole('button', { name: "Speichern", exact: true }).click();
  await expect(page.getByText('Adjusted care record.')).toBeVisible();
  await timeline.filter({ hasText: 'Düngen' }).first().getByRole('button', { name: "Eintrag löschen" }).click();
  await expect(timeline).toHaveCount(activityCount - 1);
  await page.getByRole('button', { name: "← Alle Pflanzen" }).click();
  await page.getByRole('button', { name: /Kalender/ }).click();
  await expect(page.getByRole('heading', { name: /2026|2025|2027/ })).toBeVisible();
  await expect(page.getByText('Rotate toward the light weekly.')).toBeVisible();
  await expect(page.getByText(/Gießen/).last()).toBeVisible();
  expect(await page.locator('body').evaluate(el => el.scrollWidth)).toBeLessThanOrEqual(390);
  expect(plant.id).toMatch(/^[a-f0-9-]{36}$/);
});

test('shows reachable navigation, settings, and touch targets at phone and desktop widths', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: "Hauptnavigation" });
  await expect(nav.getByRole('button', { name: "Heute" })).toBeVisible();
  await expect(nav.getByRole('button', { name: "Pflanzen" })).toBeVisible();
  await expect(nav.getByRole('button', { name: "Kalender" })).toBeVisible();
  const touchTargets = await nav.locator('button').evaluateAll(buttons => buttons.map(button => button.getBoundingClientRect().height));
  expect(touchTargets.every(height => height >= 44)).toBeTruthy();
  await page.getByRole('button', { name: "Einstellungen" }).click();
  await expect(page.getByRole('heading', { name: "Einstellungen der Sammlung" })).toBeVisible();
  await expect(page.getByText("Freier Zugang")).toBeVisible();
  expect(await page.locator('body').evaluate(el => el.scrollWidth)).toBeLessThanOrEqual(320);
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(nav.getByRole('button', { name: "Kalender" })).toBeVisible();
  await page.keyboard.press('Tab');
  const focusedOutline = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle);
  expect(focusedOutline).not.toBe('none');
  const textContrast = await page.evaluate(() => {
    const rgb = (color: string) => color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    const luminance = (color: string) => { const [red, green, blue] = rgb(color); return 0.2126 * red + 0.7152 * green + 0.0722 * blue; };
    const ratio = (foreground: string, background: string) => { const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a); return (values[0] + 0.05) / (values[1] + 0.05); };
    const muted = getComputedStyle(document.querySelector('.settings-card dt')!).color;
    const paper = getComputedStyle(document.querySelector('.settings-card')!).backgroundColor;
    return ratio(muted, paper);
  });
  expect(textContrast).toBeGreaterThanOrEqual(4.5);
});

test('identification is one-shot and species changes only after confirmation', async ({ page }) => {
  await page.route('**/api/bootstrap', async route => { const response = await route.fetch(); await route.fulfill({ response, json: { ...await response.json(), plantnet_available: true } }); });
  await page.goto('/');
  const name = `PW identify ${Date.now()}`;
  const plant = await addPlant(page, name);
  await page.getByRole('button', { name: new RegExp(name) }).click();
  const photoInput = page.locator('.gallery .section-title input');
  expect(await photoInput.getAttribute('accept')).toContain('.heic');
  await photoInput.setInputFiles('/tmp/plant.jpg');
  await expect(page.getByRole('button', { name: "Pflanze auf diesem Foto bestimmen" })).toBeVisible();
  await page.route(`**/api/plants/${plant.id}/photos/*/identify`, route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ status: 'succeeded', candidates: [{ scientific_name: 'Monstera deliciosa', common_names: ['Swiss cheese plant'], score: 0.94 }] }),
  }));
  await page.getByRole('button', { name: "Pflanze auf diesem Foto bestimmen" }).click();
  await expect(page.getByRole('heading', { name: "Vorschläge prüfen" })).toBeVisible();
  await expect(page.getByRole('button', { name: "Art bestätigen" })).toBeDisabled();
  await page.getByRole('radio').check();
  await page.getByRole('button', { name: "Bestimmung abbrechen", exact: true }).click();
  await expect(page.getByRole('heading', { name: "Art nicht angegeben" })).toBeVisible();
  await expect(page.getByRole('link', { name: /auf Wikipedia/ })).toHaveCount(0);
  await page.getByRole('button', { name: "Pflanze auf diesem Foto bestimmen" }).click();
  await page.getByRole('radio').check();
  await page.getByRole('button', { name: "Art bestätigen" }).click();
  await expect(page.getByRole('heading', { name: 'Monstera deliciosa' })).toBeVisible();
  const reference = page.getByRole('link', { name: "Monstera deliciosa auf Wikipedia (öffnet einen neuen Tab)" });
  await expect(reference).toHaveAttribute('href', 'https://de.wikipedia.org/wiki/Monstera_deliciosa');
  await expect(reference).toHaveAttribute('target', '_blank');
  await expect(reference).toHaveAttribute('rel', 'noopener noreferrer');
  await reference.focus();
  await expect(reference).toBeFocused();
  await page.unroute(`**/api/plants/${plant.id}/photos/*/identify`);
});

test('reopens cached collection reads offline and serves a cached app shell', async ({ page, context }) => {
  await page.goto('/');
  const name = `PW offline ${Date.now()}`;
  const plant = await addPlant(page, name);
  await page.getByRole('button', { name: new RegExp(name) }).click();
  const nextWatering = await wateringDue(page, plant.id);
  const photoResponse = page.waitForResponse(response => response.url().includes('/photos') && response.request().method() === 'POST');
  await page.locator('.gallery input[type=file]').setInputFiles('/tmp/plant.jpg');
  const uploaded = await photoResponse;
  expect(uploaded.status(), await uploaded.text()).toBe(201);
  await expect(page.locator('.photo-grid img')).toBeVisible();
  await expect(await wateringDue(page, plant.id)).toEqual(nextWatering);
  await page.getByRole('button', { name: "Foto", exact: true }).click();
  await expect(page.locator('.timeline-item').first()).toContainText("Foto");
  await page.getByRole('button', { name: "Alle", exact: true }).click();
  const setCover = page.getByRole('button', { name: "Als Titelbild festlegen" });
  if (await setCover.count()) await setCover.click();
  await expect(page.getByRole('button', { name: "Titelbild" })).toBeVisible();
  await page.getByRole('button', { name: /Kalender/ }).click();
  await expect(page.getByRole('heading', { name: /2026|2025|2027/ })).toBeVisible();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect(page.getByText(name)).toBeVisible();
  const manifest = await page.evaluate(async () => { const response = await fetch('/manifest.webmanifest'); return response.json(); });
  expect(manifest.name).toContain('kratzbaum');
  await context.setOffline(true);
  await page.goto('/plants');
  await expect(page.getByText(name)).toBeVisible();
  await expect(page.getByRole('heading', { name: "Deine Pflanzen" })).toBeVisible();
  await page.goto(`/plants/${plant.id}`);
  await expect(page.getByRole('heading', { name })).toBeVisible();
  await expect(page.locator('.photo-grid img')).toBeVisible();
  await page.addInitScript(() => {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init) => String(input).includes('/api/calendar?month=1900-01')
      ? Promise.reject(new TypeError('Failed to fetch'))
      : nativeFetch(input, init);
  });
  await page.goto('/calendar?month=1900-01');
  expect(await page.evaluate(() => navigator.onLine)).toBe(false);
  await expect(page.locator('.calendar-card')).toContainText(/offline/i);
  const cachedURLs = await page.evaluate(async () => {
    const names = (await caches.keys()).filter(name => name.startsWith('kratzbaum-data-') || name.startsWith('kratzbaum-media-'));
    const requests = (await Promise.all(names.map(async name => (await caches.open(name)).keys()))).flat();
    return requests.map(request => new URL(request.url).pathname);
  });
  expect(cachedURLs.every(path => !path.startsWith('/auth/') && !path.includes('token') && path !== '/api/bootstrap')).toBeTruthy();
  await context.setOffline(false);
  await page.goto(`/plants/${plant.id}`);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: "Foto löschen" }).click();
  await expect(page.locator('.photo-grid img')).toHaveCount(0);
  await expect.poll(() => page.evaluate(async () => (await caches.keys()).filter(name => name.startsWith('kratzbaum-media-')))).toHaveLength(0);
  await page.getByRole('button', { name: "← Alle Pflanzen" }).click();
  const otherTab = await context.newPage();
  await otherTab.goto('/plants');
  await expect(otherTab.getByText(name)).toBeVisible();
  await otherTab.evaluate(async () => {
    const channel = new BroadcastChannel('kratzbaum-session');
    channel.postMessage({ type: 'LOGOUT' });
    await new Promise(resolve => setTimeout(resolve, 50));
    channel.close();
  });
  await expect(otherTab.getByText(name)).toHaveCount(0);
  await expect.poll(() => page.evaluate(async () => (await caches.keys()).filter(name => name.startsWith('kratzbaum-data-') || name.startsWith('kratzbaum-media-')))).toHaveLength(0);
});
