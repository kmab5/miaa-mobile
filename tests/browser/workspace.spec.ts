import { test, expect } from '@playwright/test';
const apps = [
  { role: 'admin', heading: 'Keep lunch moving.', module: 'Daily operations' },
  { role: 'mother', heading: 'Good food starts with you.', module: 'Preparation list' },
  { role: 'cyclist', heading: 'Every lunch, delivered.', module: 'My delivery run' },
  { role: 'client', heading: 'Your next lunch, sorted.', module: 'Today’s lunch' },
];
for (const [index, app] of apps.entries()) {
  test(`${app.role}: navigation, Amharic persistence, narrow layout and safe connection checks`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const origin = `http://127.0.0.1:${3100 + index}`;
    await page.route('**/api/v1/auth/options', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        },
        body: JSON.stringify({ data: { password: true, telegram: true, sessionDays: 7 } }),
      }),
    );
    await page.route('**/api/v1/auth/password', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        },
        body: JSON.stringify({
          data: {
            accessToken: 'miaa_m1_' + 'a'.repeat(43),
            tokenType: 'Bearer',
            expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
            user: {
              id: 1,
              role: app.role,
              phoneNumber: '+251911111111',
              email: null,
              locale: 'en',
            },
          },
        }),
      }),
    );
    await page.route('**/api/v1/client/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Allow-Methods': 'GET,OPTIONS',
        },
        body: JSON.stringify({ data: [] }),
      }),
    );
    await page.goto(origin);
    await page.getByLabel('Phone number or email', { exact: true }).fill('0911111111');
    await page.getByLabel('Password', { exact: true }).fill('test-password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('heading', { name: app.heading })).toBeVisible();
    const tabLabel = page.getByText('Home', { exact: true });
    expect(
      await tabLabel.evaluate((element) => element.getBoundingClientRect().height),
    ).toBeGreaterThanOrEqual(18);
    await page.getByRole('button', { name: 'Explore workspace' }).click();
    const moduleLink = page.getByRole('link', { name: app.module, exact: true });
    await expect(moduleLink).toHaveCSS('flex-direction', 'row');
    await expect(moduleLink).toHaveCSS('padding-left', '18px');
    await moduleLink.click();
    await expect(page.getByRole('heading', { name: app.module, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Go back', exact: true }).click();
    await expect(moduleLink).toBeVisible();
    await page.getByRole('tab', { name: 'Settings', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Make yourself at home.' })).toBeVisible();
    await page.getByRole('radio', { name: 'አማርኛ', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'እንደ ቤትዎ ይሁኑ።' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'እንኳን ደህና መጡ።' })).toBeVisible();
    await page.getByRole('button', { name: 'English', exact: true }).click();
    await page.getByLabel('Phone number or email', { exact: true }).fill('0911111111');
    await page.getByLabel('Password', { exact: true }).fill('test-password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByRole('tab', { name: 'Settings', exact: true }).click();
    await page.getByRole('radio', { name: 'አማርኛ', exact: true }).click();
    await expect(page.getByRole('radio', { name: 'አማርኛ', exact: true })).toBeChecked();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.getByRole('radio', { name: 'English', exact: true }).click();
    await page.getByRole('button', { name: 'Open-source notices', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Font licenses' })).toBeVisible();
    await expect(page.getByText('Poppins', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Go back', exact: true }).click();
    await page.route('**/api/v1/health', async (route) => {
      expect(route.request().headers()).not.toHaveProperty('authorization');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        },
        body: JSON.stringify({ data: { status: 'ok', apiVersion: 1 } }),
      });
    });
    await page.getByRole('button', { name: 'Check connection', exact: true }).click();
    await expect(page.getByText('Connected to Mi’aa', { exact: true })).toBeVisible();
    await page.route('**/api/v1/health', (route) => route.abort());
    await page.getByRole('button', { name: 'Check connection', exact: true }).click();
    await expect(page.getByText('Could not connect', { exact: true })).toBeVisible();
    await page.goto(`${origin}/modules/not-a-real-module`);
    await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
    expect(errors).toEqual([]);
  });
}
