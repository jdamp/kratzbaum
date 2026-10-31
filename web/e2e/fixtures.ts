import { test as base, expect } from '@playwright/test';

export type { APIRequestContext, Page } from '@playwright/test';
export { expect };

// Browser tests must not depend on Wikimedia availability or send plant names to it.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route(/^https:\/\/(de|en)\.wikipedia\.org\/w\/api\.php/, async route => {
      const url = new URL(route.request().url());
      const title = url.searchParams.get('titles') || '';
      await route.fulfill({ json: { query: { pages: [{ ns: 0, title }] } }, headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' } });
    });
    await page.route(/^https:\/\/www\.wikidata\.org\/w\/api\.php/, async route => {
      await route.fulfill({ json: { search: [] }, headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' } });
    });
    await use(page);
  },
});
