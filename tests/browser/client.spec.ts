import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { clientProfile, clientOffering, clientDishes, clientDetail } from '../fixtures/client';
const origin = 'http://127.0.0.1:3103';
async function fixture(
  context: BrowserContext,
  mode: 'success' | 'lost' | 'refused' | 'limited' = 'success',
  hasLocation = true,
) {
  let profile = {
    ...clientProfile,
    ...(!hasLocation ? { latitude: null, longitude: null, hasLocation: false } : {}),
  };
  const posts: { key: string | undefined; body: unknown }[] = [];
  const paths: string[] = [];
  await context.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.split('/api/v1/')[1]!;
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      'Access-Control-Expose-Headers': 'Retry-After, X-Request-Id',
    };
    if (req.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    paths.push(path);
    let data: unknown;
    let status = 200;
    let code = 'not_found';
    const session = {
      accessToken: 'miaa_m1_' + 'a'.repeat(43),
      tokenType: 'Bearer',
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      user: { id: 1, role: 'client', phoneNumber: '+251911111111', email: null, locale: 'en' },
    };
    if (path === 'auth/options') data = { password: true, telegram: true, sessionDays: 7 };
    else if (path === 'auth/password' || path === 'me' || path === 'auth/session/renew')
      data = session;
    else if (path === 'auth/session') data = { ok: true };
    else if (path === 'me/security')
      data = { phoneNumber: '+251911111111', email: null, hasPassword: true, telegramLinked: true };
    else if (path === 'client/profile') data = profile;
    else if (path === 'client/address') {
      profile = { ...profile, ...req.postDataJSON(), hasLocation: true };
      data = profile;
    } else if (path === 'client/today')
      data = [
        {
          deliveryId: 31,
          status: 'out_for_delivery',
          dishNameEn: 'Lunch',
          dishNameAm: 'ምሳ',
          stickerId: 'MA-19-01',
          motherName: 'Test Kitchen',
          cyclistName: 'Test Cyclist',
          cyclistPhone: '+251922222222',
          isCompRedelivery: false,
        },
      ];
    else if (path === 'client/dishes') data = clientDishes;
    else if (path === 'client/payment-instructions')
      data = {
        payTelebirr: '0911111111',
        payCbe: '10000000000',
        payChapa: null,
        payInstructions: 'Pay off-platform; admin confirms receipt.',
      };
    else if (path === 'client/offerings') data = [clientOffering];
    else if (path === 'client/orders' && req.method() === 'GET') data = [clientDetail.order];
    else if (path === 'client/orders/19') data = clientDetail;
    else if (path === 'client/orders' && req.method() === 'POST') {
      posts.push({ key: req.headers()['idempotency-key'], body: req.postDataJSON() });
      if (posts.length === 1 && mode === 'lost') {
        await route.abort('failed');
        return;
      }
      if (posts.length === 1 && mode === 'refused') {
        status = 409;
        code = 'business_rule';
      } else if (posts.length === 1 && mode === 'limited') {
        status = 429;
        code = 'rate_limited';
      } else {
        status = 201;
        data = clientDetail;
      }
    } else status = 404;
    await route.fulfill({
      status,
      headers: { ...headers, ...(status === 429 ? { 'Retry-After': '2' } : {}) },
      contentType: 'application/json',
      body: JSON.stringify(
        status >= 400
          ? {
              error: {
                code,
                message:
                  mode === 'refused'
                    ? 'That package is no longer offered.'
                    : 'Backend details must stay private',
              },
              requestId: 'fixture-request',
            }
          : { data },
      ),
    });
  });
  return { posts, paths };
}
async function login(page: Page) {
  await page.getByLabel('Phone number or email', { exact: true }).fill('0911111111');
  await page.getByLabel('Password', { exact: true }).fill('test-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Home', exact: true })).toBeVisible();
}
async function review(page: Page) {
  await page.getByRole('button', { name: 'Browse packages', exact: true }).click();
  await page.getByRole('button', { name: /Choose this package/ }).click();
  for (let i = 0; i < 3; i++)
    await page.getByRole('radio', { name: 'Non-fasting dish', exact: true }).nth(i).click();
  for (let i = 0; i < 2; i++)
    await page.getByRole('radio', { name: 'Fasting dish', exact: true }).nth(i).click();
  await page.getByLabel('Delivery notes', { exact: true }).fill('Call at gate');
  await page.getByRole('button', { name: 'Review order', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Review your order', exact: true })).toBeVisible();
}
test('Client: address, reviewed purchase, durable lost-response recovery, payment details and history', async ({
  page,
  context,
}) => {
  const api = await fixture(context, 'lost');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(origin);
  await login(page);
  await page.getByRole('button', { name: 'Delivery address', exact: true }).click();
  await page.getByLabel('Latitude', { exact: true }).fill('9.02');
  await page.getByLabel('Longitude', { exact: true }).fill('38.76');
  await page.getByLabel('Directions / address note', { exact: true }).fill('Green gate');
  await page.getByRole('button', { name: 'Save address', exact: true }).click();
  await expect(page.getByText('Address saved.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Go back', exact: true }).click();
  await review(page);
  expect(api.posts).toHaveLength(0);
  await expect(page.getByText('Green gate · 9.02, 38.76', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Place order', exact: true }).click();
  await expect(
    page.getByText('The result is not confirmed yet.', { exact: false }).filter({ visible: true }),
  ).toBeVisible();
  expect(api.posts).toHaveLength(1);
  const stored = await page.evaluate(() => Object.values(localStorage).join(' '));
  expect(stored).toContain(api.posts[0]!.key);
  expect(stored).not.toContain('miaa_m1_');
  expect(stored).not.toContain('test-password');
  await page.reload();
  await login(page);
  await expect(page.getByRole('button', { name: 'Retry saved order', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Retry saved order', exact: true }).click();
  await expect(page.getByRole('button', { name: 'View order #19', exact: true })).toBeVisible();
  expect(api.posts).toHaveLength(2);
  expect(api.posts[1]).toEqual(api.posts[0]);
  expect(api.posts[0]!.body).toMatchObject({
    latitude: 9.02,
    longitude: 38.76,
    addressNote: 'Green gate',
    notes: 'Call at gate',
    dishPattern: { '1': 2, '2': 2, '3': 1, '4': 2, '5': 1 },
  });
  await page.getByRole('button', { name: 'View order #19', exact: true }).click();
  await expect(
    page.getByText('MA-19-01', { exact: false }).filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Awaiting administrator confirmation', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Payment instructions', exact: true }).click();
  await expect(page.getByText('10000000000', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Pay off-platform; admin confirms receipt.', { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test('Client: simultaneous reviewed submissions in two tabs create only one order', async ({
  context,
}) => {
  const api = await fixture(context);
  const a = await context.newPage(),
    b = await context.newPage();
  for (const page of [a, b]) {
    await page.goto(origin);
    await login(page);
    await review(page);
  }
  await Promise.all([
    a.getByRole('button', { name: 'Place order', exact: true }).click(),
    b.getByRole('button', { name: 'Place order', exact: true }).click(),
  ]);
  for (const page of [a, b])
    await expect(page.getByRole('button', { name: 'View order #19', exact: true })).toBeVisible();
  expect(api.posts).toHaveLength(1);
});
test('Client: unavailable browser storage prevents order submission', async ({ page, context }) => {
  const api = await fixture(context);
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.includes('.orders.')) throw new Error('Blocked');
      return original.call(this, key, value);
    };
  });
  await page.goto(origin);
  await login(page);
  await review(page);
  await page.getByRole('button', { name: 'Place order', exact: true }).click();
  await expect(
    page.getByText(/Could not safely read or save the order/).filter({ visible: true }),
  ).toBeVisible();
  expect(api.posts).toHaveLength(0);
});
test('Client: an initial refusal needs an explicit new review', async ({ page, context }) => {
  const api = await fixture(context, 'refused');
  await page.goto(origin);
  await login(page);
  await review(page);
  await page.getByRole('button', { name: 'Place order', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start a new order', exact: true })).toBeVisible();
  expect(api.posts).toHaveLength(1);
  await page.getByRole('button', { name: 'Start a new order', exact: true }).click();
  await page.getByRole('button', { name: /Choose this package/ }).click();
  for (let i = 0; i < 3; i++)
    await page.getByRole('radio', { name: 'Non-fasting dish', exact: true }).nth(i).click();
  for (let i = 0; i < 2; i++)
    await page.getByRole('radio', { name: 'Fasting dish', exact: true }).nth(i).click();
  await page.getByRole('button', { name: 'Review order', exact: true }).click();
  expect(api.posts).toHaveLength(1);
  await page.getByRole('button', { name: 'Place order', exact: true }).click();
  await expect(page.getByRole('button', { name: 'View order #19', exact: true })).toBeVisible();
  expect(api.posts).toHaveLength(2);
  expect(api.posts[1]!.key).not.toBe(api.posts[0]!.key);
});
test('Client: missing address explains the next step without a false empty catalog', async ({
  page,
  context,
}) => {
  const api = await fixture(context, 'success', false);
  await page.goto(origin);
  await login(page);
  await page.getByRole('button', { name: 'Browse packages', exact: true }).click();
  await expect(
    page.getByText('Save your delivery location to see nearby packages.', { exact: true }),
  ).toBeVisible();
  expect(api.paths).not.toContain('client/offerings');
  await page.getByRole('button', { name: 'Delivery address', exact: true }).click();
  await expect(page.getByLabel('Latitude', { exact: true })).toHaveValue('');
});
test('Client: 429 cooldown re-enables retry and keeps the saved request', async ({
  page,
  context,
}) => {
  const api = await fixture(context, 'limited');
  await page.goto(origin);
  await login(page);
  await review(page);
  await page.getByRole('button', { name: 'Place order', exact: true }).click();
  const retry = page.getByRole('button', { name: 'Retry saved order', exact: true });
  await expect(retry).toBeDisabled();
  await expect(retry).toBeEnabled({ timeout: 5000 });
  await retry.click();
  await expect(page.getByRole('button', { name: 'View order #19', exact: true })).toBeVisible();
  expect(api.posts).toHaveLength(2);
  expect(api.posts[1]).toEqual(api.posts[0]);
});
test('Client: unavailable order details do not reveal server messages', async ({
  page,
  context,
}) => {
  await fixture(context);
  await page.goto(origin);
  await login(page);
  await page.getByRole('button', { name: 'Order history', exact: true }).click();
  await page.route('**/api/v1/client/orders/19', (route) =>
    route.fulfill({
      status: 404,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        error: { code: 'not_found', message: 'Backend details must stay private' },
      }),
    }),
  );
  await page.getByRole('button', { name: 'View order #19', exact: true }).click();
  await expect(
    page.getByText('This order is unavailable for your account.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Backend details must stay private')).toHaveCount(0);
});

test('Client: a demo order requires one dish and a future weekday', async ({ page, context }) => {
  const api = await fixture(context);
  await context.route('**/api/v1/client/offerings?**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        data: [
          { ...clientOffering, labelEn: 'Demo lunch', duration: 'demo', foodCategory: 'demo' },
        ],
      }),
    }),
  );
  await page.goto(origin);
  await login(page);
  await page.getByRole('button', { name: 'Browse packages', exact: true }).click();
  await page.getByRole('button', { name: /Choose this package/ }).click();
  await page.getByRole('radio', { name: 'Non-fasting dish', exact: true }).click();
  await page.getByRole('button', { name: 'Review order', exact: true }).click();
  await expect(
    page
      .getByText('Check the address, date and all required dish choices.')
      .filter({ visible: true }),
  ).toBeVisible();
  expect(api.posts).toHaveLength(0);
  const date = new Date(Date.now() + 2 * 86400000);
  while ([0, 6].includes(date.getUTCDay())) date.setUTCDate(date.getUTCDate() + 1);
  const day = date.toISOString().slice(0, 10);
  await page.getByLabel('Demo delivery date (YYYY-MM-DD)', { exact: true }).fill(day);
  await page.getByRole('button', { name: 'Review order', exact: true }).click();
  await page.getByRole('button', { name: 'Place order', exact: true }).click();
  await expect(page.getByRole('button', { name: 'View order #19', exact: true })).toBeVisible();
  expect(api.posts).toHaveLength(1);
  expect(api.posts[0]!.body).toMatchObject({ demoDate: day, dishPattern: { '1': 2 } });
});
