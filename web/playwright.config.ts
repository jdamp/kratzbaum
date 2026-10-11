import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.KRATZBAUM_BASE_URL || 'http://127.0.0.1:8080',
    ...devices['Pixel 7'],
    serviceWorkers: 'allow',
  },
});
