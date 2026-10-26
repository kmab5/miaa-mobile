import { test, expect, type Page } from '@playwright/test';
const roles = ['admin', 'mother', 'cyclist', 'client'] as const;
const token = 'miaa_m1_' + 'a'.repeat(43);
function session(role: string) {
  return {
    accessToken: token,
    tokenType: 'Bearer',
    expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    user: { id: 1, role, phoneNumber: '+251911111111', email: null, locale: 'en' },
  };
}
async function mockApi(page: Page, role: string) {
  const calls: { path: string; body: unknown; auth?: string }[] = [];
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.split('/api/v1/')[1]!;
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    };
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    const body = request.postDataJSON();
    const auth = request.headers().authorization;
    calls.push({ path, body, auth });
    let data: unknown = { ok: true };
    let status = 200;
    if (path === 'auth/options') data = { password: true, telegram: true, sessionDays: 7 };
    if (path === 'auth/password') {
      expect(auth).toBeUndefined();
      expect(body.role).toBe(role);
      if (body.password === 'wrong') {
        status = 401;
        data = null;
      } else data = session(role);
    }
    if (path === 'me' || path === 'auth/session/renew') data = session(role);
    if (path === 'me/security')
      data = { phoneNumber: '+251911111111', email: null, hasPassword: true, telegramLinked: true };
    if (path === 'auth/otp/request') data = { accepted: true, retryAfterSeconds: 60 };
    if (path === 'auth/otp/verify') data = session(role);
    if (path === 'auth/telegram/invite')
      data = {
        token: 't'.repeat(32),
        deepLink: 'https://t.me/miaa_bot?start=' + 't'.repeat(32),
        expiresAt: session(role).expiresAt,
      };
    if (path === 'auth/telegram/status') data = { state: 'signup_ready' };
    if (path === 'auth/signup') data = session('client');
    await route.fulfill({
      status,
      headers,
      contentType: 'application/json',
      body: JSON.stringify(
        status === 401
          ? { error: { code: 'invalid_credentials', message: 'Never show this backend message' } }
          : { data },
      ),
    });
  });
  return calls;
}
for (const [index, role] of roles.entries()) {
  test(`${role}: guarded deep link, password errors, account security, logout, and memory-only web session`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const calls = await mockApi(page, role);
    const origin = `http://127.0.0.1:${3100 + index}`;
    await page.goto(`${origin}/security`);
    await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'አማርኛ', exact: true }).getByText('አማርኛ', { exact: true }),
    ).toHaveCSS('font-family', /EthiopicSemiBold/);
    await expect(
      page.getByText('Browser preview: sign-in lasts only until this page is reloaded.'),
    ).toBeVisible();
    await page.getByLabel('Phone number or email', { exact: true }).fill('0911111111');
    await page.getByLabel('Password', { exact: true }).fill('wrong');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByText(/These details are invalid or expired/)).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
    await expect(page.getByText('Never show this backend message')).toHaveCount(0);
    await page.getByLabel('Password', { exact: true }).fill('test-password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Settings', exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Account & security', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Account & security', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Password is set', { exact: true })).toBeVisible();
    await page.getByLabel('Current password', { exact: true }).fill('old-password');
    await page.getByLabel('New password', { exact: true }).fill('new-password');
    await page.getByLabel('Confirm new password', { exact: true }).fill('different');
    await page.getByRole('button', { name: 'Save password', exact: true }).click();
    await expect(page.getByText('The new passwords do not match.')).toBeVisible();
    expect(calls.filter((c) => c.path === 'me/password')).toHaveLength(0);
    await page.getByLabel('Current password', { exact: true }).fill('old-password');
    await page.getByLabel('New password', { exact: true }).fill('new-password');
    await page.getByLabel('Confirm new password', { exact: true }).fill('new-password');
    await page.getByRole('button', { name: 'Save password', exact: true }).click();
    await expect(
      page.getByText('Password saved. Your other sessions have been signed out.'),
    ).toBeVisible();
    expect(calls.find((c) => c.path === 'me/password')?.auth).toBe(`Bearer ${token}`);
    await expect(page.getByLabel('New password', { exact: true })).toHaveValue('');
    await page.getByRole('button', { name: 'Sign out all devices', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Confirm this action', exact: true }),
    ).toBeVisible();
    expect(calls.filter((c) => c.path === 'me/sessions')).toHaveLength(0);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
    await page.getByLabel('Phone number or email', { exact: true }).fill('0911111111');
    await page.getByLabel('Password', { exact: true }).fill('test-password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Home', exact: true })).toBeVisible();
    const persisted = await page.evaluate(() =>
      [...Object.values(localStorage), ...Object.values(sessionStorage)].join(' '),
    );
    expect(persisted).not.toContain(token);
    expect(persisted).not.toContain('test-password');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    expect(errors).toEqual([]);
  });
}
test('Client: verified Telegram signup and explicit revoke-all confirmation', async ({ page }) => {
  const calls = await mockApi(page, 'client');
  await page.goto('http://127.0.0.1:3103');
  await page.getByRole('button', { name: 'Use Telegram', exact: true }).click();
  await page
    .getByRole('button', { name: 'Connect Telegram / create account', exact: true })
    .click();
  await page.getByLabel('Phone number', { exact: true }).fill('0911111111');
  await page.getByRole('button', { name: 'Get Telegram link', exact: true }).click();
  await page.getByRole('button', { name: 'Check verification', exact: true }).click();
  await page.getByLabel('Your full name', { exact: true }).fill('Test Client');
  expect(calls.filter((c) => c.path === 'auth/signup')).toHaveLength(0);
  await page.getByRole('button', { name: 'Create Client account', exact: true }).click();
  await page.getByRole('tab', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Account & security', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out all devices', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out all devices', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  await expect(page.getByText('All sessions have been signed out.', { exact: true })).toBeVisible();
  expect(calls.filter((c) => c.path === 'me/sessions')).toHaveLength(1);
});
