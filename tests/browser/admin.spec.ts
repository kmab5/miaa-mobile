import { test, expect, type Page } from '@playwright/test';
import { adminReads } from '../fixtures/admin';
import { businessReads, ledger } from '../fixtures/admin-business';
const origin = 'http://127.0.0.1:3100';
async function api(page: Page, mode: 'normal' | 'malformed' = 'normal') {
  const writes: { path: string; method: string; body: unknown }[] = [];
  const data = { ...adminReads, ...businessReads };
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname.split('/api/v1/')[1]!,
      method = req.method();
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      'Access-Control-Expose-Headers': 'Retry-After',
    };
    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    const session = {
      accessToken: 'miaa_m1_' + 'a'.repeat(43),
      tokenType: 'Bearer',
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      user: { id: 1, role: 'admin', phoneNumber: '+251911111111', email: null, locale: 'en' },
    };
    let value: unknown;
    if (path === 'auth/options') value = { password: true, telegram: true, sessionDays: 7 };
    else if (path === 'auth/password') value = session;
    else if (path === 'me') value = { user: session.user, expiresAt: session.expiresAt };
    else if (path === 'auth/session') value = { ok: true };
    else if (path.startsWith('admin/')) {
      const key = path.replace('admin/', '');
      if (method === 'GET' && mode === 'malformed' && key === 'finance') {
        await route.fulfill({
          status: 429,
          headers: { ...headers, 'Retry-After': 'Infinity' },
          contentType: 'application/json',
          body: JSON.stringify({
            error: { code: {}, message: [], details: { x: {} } },
            requestId: { bad: 'object' },
          }),
        });
        return;
      }
      if (method === 'GET') value = data[key];
      else {
        const body = req.postDataJSON();
        writes.push({ path, method, body });
        if (key === 'finance') value = { ...ledger, ...body };
        else if (key.startsWith('records/')) value = { ok: true };
      }
    }
    await route.fulfill({
      status: value === undefined ? 404 : 200,
      headers,
      contentType: 'application/json',
      body: JSON.stringify(
        value === undefined
          ? { error: { code: 'not_found', message: 'Fixture route unavailable' } }
          : { data: value },
      ),
    });
  });
  return writes;
}
async function login(page: Page) {
  await page.goto(origin);
  await page.getByLabel('Phone number or email', { exact: true }).fill('0911111111');
  await page.getByLabel('Password', { exact: true }).fill('test-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Run the lunch service' })).toBeVisible();
}
test('Admin finance/report/stock/archive workflows navigate at a narrow viewport without runtime errors', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const writes = await api(page);
  await login(page);
  await page.getByRole('button', { name: 'Finance and reports', exact: true }).click();
  await page.getByRole('button', { name: 'Finance ledger', exact: true }).click();
  await expect(page.getByText('Net (ETB): -12.50', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Staff payouts', exact: true }).click();
  await expect(page.getByText('Outstanding in period (ETB): -5.00', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Stock', exact: true }).click();
  await expect(page.getByText('Current quantity: 2.125', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'View details · Flour / ዱቄት', exact: true }).click();
  await expect(page.getByText('Running balance: 2.125', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Analytics', exact: true }).click();
  await page.getByRole('radio', { name: 'Unit economics', exact: true }).click();
  await expect(page.getByText('Margin percent: -20.0%', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Archive and restore', exact: true }).click();
  await page.getByRole('button', { name: 'Restore · Client profile #1', exact: true }).click();
  await expect(page.getByText(/Restoring a client also reactivates/)).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(writes).toHaveLength(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(errors).toEqual([]);
});
test('Admin ledger confirmation records a single reviewed write in the browser recovery workflow', async ({
  page,
}) => {
  const writes = await api(page);
  await login(page);
  await page.getByRole('button', { name: 'Finance and reports', exact: true }).click();
  await page.getByRole('button', { name: 'Finance ledger', exact: true }).click();
  await page.getByRole('button', { name: 'Record ledger entry', exact: true }).click();
  await page.getByRole('radio', { name: 'Ingredients', exact: true }).click();
  await page.getByLabel('Amount (ETB)', { exact: true }).fill('12.50');
  await page.getByLabel('Description', { exact: true }).fill('Flour');
  await page.getByRole('button', { name: 'Review changes', exact: true }).click();
  expect(writes).toHaveLength(0);
  await page.getByRole('button', { name: 'Confirm changes', exact: true }).click();
  await expect(
    page.getByText('Change recorded.', { exact: true }).filter({ visible: true }).first(),
  ).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({
    path: 'admin/finance',
    method: 'POST',
    body: { amountEtb: '12.50', category: 'ingredients' },
  });
});
test('malformed error data produces accessible feedback and a bounded cooldown rather than a page crash', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await api(page, 'malformed');
  await login(page);
  await page.getByRole('button', { name: 'Finance and reports', exact: true }).click();
  await page.getByRole('button', { name: 'Finance ledger', exact: true }).click();
  await expect(page.getByRole('alert').first()).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Record ledger entry', exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
