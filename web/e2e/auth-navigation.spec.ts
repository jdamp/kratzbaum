import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { createServer } from 'node:http';
import type { Server } from 'node:http';

interface AuthFixture {
  origin: string;
  providerOrigin: string;
  requests: URL[];
  worker: string;
  correctedWorker: string;
  previousWorker: string;
}

async function listen(server: Server): Promise<string> {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No fixture address');
  return `http://127.0.0.1:${address.port}`;
}

async function close(server: Server) {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

// Real HTTP listeners are deliberate: browser route mocks can mask worker interception.
const test = base.extend<{ auth: AuthFixture }>({
  auth: async ({ baseURL }, use) => {
    const source = baseURL!;
    const workerResponse = await fetch(new URL('/sw.js', source));
    expect(workerResponse.ok).toBeTruthy();
    const correctedWorker = await workerResponse.text();
    // Reproduce the previous production worker by removing only the auth denylist entry.
    const previousWorker = correctedWorker.replace(String.raw`,/^\/auth\//`, '');
    const provider = createServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
      response.end('<h1>Test identity provider</h1>');
    });
    const providerOrigin = await listen(provider);
    const auth: AuthFixture = { origin: '', providerOrigin, requests: [], worker: correctedWorker, correctedWorker, previousWorker };
    const server = createServer(async (request, response) => {
      try {
        const url = new URL(request.url!, auth.origin);
        response.setHeader('Cache-Control', 'no-store');
        if (url.pathname === '/sw.js') {
          response.setHeader('Content-Type', 'application/javascript');
          response.end(auth.worker);
        } else if (url.pathname === '/api/bootstrap') {
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify({ name: 'kratzbaum', auth_mode: 'oidc', authenticated: false, identity: '', display_name: '', csrf_token: '', login_url: '/auth/login', timezone: 'UTC', offline: false, plantnet_available: false }));
        } else if (url.pathname.startsWith('/auth/')) {
          auth.requests.push(url);
          if (url.pathname === '/auth/login') {
            response.writeHead(302, { Location: `${providerOrigin}/authorize`, 'Set-Cookie': 'kratzbaum_oidc_state=fixture-state; Path=/auth/callback; HttpOnly; SameSite=Lax' });
            response.end();
          } else {
            response.setHeader('Content-Type', 'text/html');
            response.end('<h1>Authentication server response</h1>');
          }
        } else {
          const asset = await fetch(new URL(url.pathname + url.search, source));
          response.writeHead(asset.status, { 'Content-Type': asset.headers.get('content-type') || 'application/octet-stream' });
          response.end(Buffer.from(await asset.arrayBuffer()));
        }
      } catch (error) {
        response.writeHead(500);
        response.end(String(error));
      }
    });
    auth.origin = await listen(server);
    try {
      await use(auth);
    } finally {
      await close(server);
      await close(provider);
    }
  },
});

async function controlledPage(page: Page, origin: string) {
  await page.goto(origin);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await expect(page.getByRole('link', { name: 'Continue with your identity provider' })).toBeVisible();
}

async function noAuthCacheEntries(page: Page) {
  const paths = await page.evaluate(async () => {
    const requests = (await Promise.all((await caches.keys()).map(async name => (await caches.open(name)).keys()))).flat();
    return requests.map(request => new URL(request.url).pathname);
  });
  expect(paths.some(path => path.startsWith('/auth/'))).toBe(false);
}

test('controlled login and callback reach the server without caching authentication', async ({ page, context, auth }) => {
  await controlledPage(page, auth.origin);
  await page.getByRole('link', { name: 'Continue with your identity provider' }).click();
  await expect.poll(() => auth.requests.filter(url => url.pathname === '/auth/login').length).toBe(1);
  await expect(page).toHaveURL(`${auth.providerOrigin}/authorize`);
  await expect(page.getByRole('heading', { name: 'Test identity provider' })).toBeVisible();
  expect((await context.cookies(`${auth.origin}/auth/callback`)).find(cookie => cookie.name === 'kratzbaum_oidc_state')?.value).toBe('fixture-state');

  await controlledPage(page, auth.origin);
  await page.goto(`${auth.origin}/auth/callback?code=test-code&state=fixture-state`);
  await expect(page.getByRole('heading', { name: 'Authentication server response' })).toBeVisible();
  const callback = auth.requests.find(url => url.pathname === '/auth/callback');
  expect(callback?.searchParams.get('code')).toBe('test-code');
  expect(callback?.searchParams.get('state')).toBe('fixture-state');
  await noAuthCacheEntries(page);

  await controlledPage(page, auth.origin);
  await page.goto(`${auth.origin}/auth/future-route?test=1`);
  await expect(page.getByRole('heading', { name: 'Authentication server response' })).toBeVisible();
  expect(auth.requests.some(url => url.pathname === '/auth/future-route')).toBe(true);
  await noAuthCacheEntries(page);
});

test('controlled worker retains offline app navigation but never serves the shell for auth', async ({ page, context, auth }) => {
  await controlledPage(page, auth.origin);
  await context.setOffline(true);
  await page.goto(`${auth.origin}/plants`);
  await expect(page.getByRole('heading', { name: 'Your plants' })).toBeVisible();
  expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await expect(page.goto(`${auth.origin}/auth/login`)).rejects.toThrow(/net::ERR_/);
  expect(auth.requests).toHaveLength(0);
  await context.setOffline(false);
});

for (const accept of [false, true]) {
  test(`existing client ${accept ? 'accepts' : 'declines'} the corrected worker update`, async ({ page, auth }) => {
    expect(auth.previousWorker).not.toBe(auth.correctedWorker);
    auth.worker = auth.previousWorker;
    await controlledPage(page, auth.origin);
    // Confirm the old controller has the actual regression before testing its replacement.
    await page.goto(`${auth.origin}/auth/login`);
    await expect(page.getByRole('link', { name: 'Continue with your identity provider' })).toBeVisible();
    expect(auth.requests).toHaveLength(0);
    await page.goto(auth.origin);
    await page.evaluate(() => {
      const input = document.createElement('textarea');
      input.setAttribute('aria-label', 'Unsaved note');
      input.value = 'Keep this draft';
      document.body.append(input);
      const oldController = navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (navigator.serviceWorker.controller !== oldController) localStorage.setItem('test-controller-changed', 'yes');
      });
    });
    const dialogHandled = new Promise<void>(resolve => page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('update is ready');
      if (accept) await dialog.accept(); else await dialog.dismiss();
      resolve();
    }));
    auth.worker = auth.correctedWorker;
    const reloaded = accept ? page.waitForEvent('load') : undefined;
    await page.evaluate(async () => { await (await navigator.serviceWorker.ready).update(); });
    await dialogHandled;
    if (accept) {
      await reloaded;
      await expect.poll(() => page.evaluate(() => localStorage.getItem('test-controller-changed'))).toBe('yes');
      await expect(page.getByRole('link', { name: 'Continue with your identity provider' })).toBeVisible();
      expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
      await page.getByRole('link', { name: 'Continue with your identity provider' }).click();
      await expect.poll(() => auth.requests.filter(url => url.pathname === '/auth/login').length).toBe(1);
      await expect(page).toHaveURL(`${auth.providerOrigin}/authorize`);
    } else {
      await expect.poll(() => page.evaluate(async () => Boolean((await navigator.serviceWorker.ready).waiting))).toBe(true);
      expect(await page.evaluate(() => localStorage.getItem('test-controller-changed'))).toBeNull();
      await expect(page.getByRole('textbox', { name: 'Unsaved note' })).toHaveValue('Keep this draft');
      await expect(page).toHaveURL(auth.origin + '/');
    }
  });
}
