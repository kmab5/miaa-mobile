import { defineConfig } from '@playwright/test';
const roles = ['admin', 'mother', 'cyclist', 'client'];
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30000,
  expect: { timeout: 10000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    viewport: { width: 360, height: 800 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
      ...(process.env.MIAA_CHROMIUM_PATH ? { executablePath: process.env.MIAA_CHROMIUM_PATH } : {}),
    },
  },
  webServer: roles.map((role, index) => ({
    command: `node scripts/serve-export.mjs ${role} ${3100 + index}`,
    url: `http://127.0.0.1:${3100 + index}`,
    reuseExistingServer: false,
    timeout: 15000,
  })),
});
