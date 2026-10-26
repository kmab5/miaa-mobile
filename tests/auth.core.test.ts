import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { createAuthController } from '../packages/auth/src/controller';
import { normalizePhone, validPassword, validateInvite } from '../packages/auth/src/validation';
import type { AppRole, MobileSession, TokenStorage } from '@miaa/api';
const NOW = Date.parse('2026-10-23T12:00:00Z');
const TOKEN = 'miaa_m1_' + 'a'.repeat(43);
const NEXT = 'miaa_m1_' + 'b'.repeat(43);
const session = (role: AppRole = 'client', accessToken = TOKEN, hours = 168): MobileSession => ({
  accessToken,
  tokenType: 'Bearer',
  expiresAt: new Date(NOW + hours * 3600000).toISOString(),
  user: { id: 1, role, phoneNumber: '+251911111111', email: null, locale: 'en' },
});
const ok = (data: unknown) => Response.json({ data, requestId: 'test' });
const denied = () =>
  Response.json({ error: { code: 'unauthorized', message: 'No' } }, { status: 401 });
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function fixture(saved: string | null = null, role: AppRole = 'client') {
  let stored = saved;
  const storage: TokenStorage = {
    get: jest.fn(async () => stored),
    set: jest.fn(async (value: string) => {
      stored = value;
    }),
    clear: jest.fn(async () => {
      stored = null;
    }),
  };
  const fetcher = jest.fn<typeof fetch>();
  fetcher.mockImplementation(async (url) =>
    String(url).endsWith('/auth/session') ? ok({ ok: true }) : ok(session(role)),
  );
  const auth = createAuthController({
    role,
    origin: 'https://miaa.example',
    storage,
    fetch: fetcher,
    now: () => NOW,
    storageTimeoutMs: 20,
  });
  return { auth, fetcher, storage, stored: () => stored };
}
afterEach(() => {
  jest.useRealTimers();
});
describe('role-specific authentication and credential storage', () => {
  it.each<AppRole>(['admin', 'mother', 'cyclist', 'client'])(
    'logs %s in with its fixed role and no cookies',
    async (role) => {
      const f = fixture(null, role);
      await f.auth.start();
      await f.auth.login(' 0911111111 ', 'password123');
      expect(f.auth.getSnapshot()).toMatchObject({ phase: 'signedIn', user: { role } });
      expect(f.stored()).toBe(TOKEN);
      const [url, init] = f.fetcher.mock.calls[0]!;
      expect(url).toBe('https://miaa.example/api/v1/auth/password');
      expect(JSON.parse(init!.body as string)).toEqual({
        identifier: '0911111111',
        password: 'password123',
        role,
      });
      expect(init).toMatchObject({ credentials: 'omit', redirect: 'error' });
      expect(init?.headers).not.toHaveProperty('Authorization');
    },
  );
  it('does not store or open another role and revokes its returned credential', async () => {
    const f = fixture();
    await f.auth.start();
    f.fetcher.mockResolvedValueOnce(ok(session('admin')));
    await expect(f.auth.login('phone', 'password')).rejects.toMatchObject({ code: 'wrong_role' });
    expect(f.stored()).toBeNull();
    expect(f.auth.getSnapshot().phase).toBe('signedOut');
    await Promise.resolve();
    expect(f.fetcher.mock.calls.at(-1)![0]).toContain('auth/session');
  });
  it.each([
    null,
    {},
    { ...session(), accessToken: 'wrong' },
    { ...session(), expiresAt: 'bad' },
    { ...session(), user: { ...session().user, id: -1 } },
  ])('rejects malformed authentication payload %#', async (value) => {
    const f = fixture();
    await f.auth.start();
    f.fetcher.mockResolvedValueOnce(ok(value));
    await expect(f.auth.login('phone', 'password')).rejects.toBeDefined();
    expect(f.stored()).toBeNull();
    expect(f.auth.getSnapshot().user).toBeNull();
  });
  it('rejects duplicate submissions rather than issuing two sessions', async () => {
    const f = fixture();
    await f.auth.start();
    const response = deferred<Response>();
    f.fetcher.mockReturnValueOnce(response.promise);
    const first = f.auth.login('phone', 'password');
    await expect(f.auth.login('phone', 'password')).rejects.toMatchObject({ code: 'busy' });
    response.resolve(ok(session()));
    await first;
    expect(f.fetcher).toHaveBeenCalledTimes(1);
  });
  it('requires successful native persistence before granting access', async () => {
    const f = fixture();
    await f.auth.start();
    jest.mocked(f.storage.set).mockRejectedValueOnce(new Error('native failed'));
    await expect(f.auth.login('phone', 'password')).rejects.toMatchObject({
      code: 'storage_error',
    });
    expect(f.auth.getSnapshot()).toMatchObject({
      phase: 'signedOut',
      issue: 'storage_error',
      user: null,
    });
    expect(f.stored()).toBeNull();
  });
  it('prevents a late login response from restoring a logged-out session', async () => {
    const f = fixture();
    await f.auth.start();
    const response = deferred<Response>();
    f.fetcher.mockReturnValueOnce(response.promise);
    const login = f.auth.login('phone', 'password');
    await f.auth.logout();
    response.resolve(ok(session()));
    await expect(login).rejects.toMatchObject({ code: 'request_aborted' });
    expect(f.stored()).toBeNull();
    expect(f.auth.getSnapshot().phase).toBe('signedOut');
  });
  it('does not accept a cancelled response even if a fetch implementation ignores abort', async () => {
    const f = fixture();
    await f.auth.start();
    const response = deferred<Response>();
    f.fetcher.mockReturnValueOnce(response.promise);
    const cancel = new AbortController();
    const login = f.auth.login('phone', 'password', cancel.signal);
    cancel.abort();
    response.resolve(ok(session()));
    await expect(login).rejects.toMatchObject({ code: 'request_aborted' });
    expect(f.stored()).toBeNull();
    expect(f.auth.getSnapshot().user).toBeNull();
  });
  it('serializes a delayed persistence before logout deletion', async () => {
    const f = fixture();
    await f.auth.start();
    const written = deferred<void>();
    jest.mocked(f.storage.set).mockImplementationOnce(async () => {
      await written.promise;
    });
    const login = f.auth.login('phone', 'password');
    while (!jest.mocked(f.storage.set).mock.calls.length) await Promise.resolve();
    const logout = f.auth.logout();
    written.resolve();
    await expect(login).rejects.toMatchObject({ code: 'request_aborted' });
    await logout;
    expect(f.storage.clear).toHaveBeenCalled();
    expect(f.auth.getSnapshot().phase).toBe('signedOut');
  });
});
describe('restoration, access changes and transient failures', () => {
  it('validates a persisted token with the server before rendering identity', async () => {
    const f = fixture(TOKEN);
    const response = deferred<Response>();
    f.fetcher.mockReturnValueOnce(response.promise);
    const start = f.auth.start();
    await Promise.resolve();
    await Promise.resolve();
    expect(f.auth.getSnapshot().user).toBeNull();
    response.resolve(ok(session()));
    await start;
    expect(f.auth.getSnapshot().phase).toBe('signedIn');
    expect(f.fetcher.mock.calls[0]![1]?.headers).toMatchObject({
      Authorization: `Bearer ${TOKEN}`,
    });
  });
  it('keeps the stored token but locks private content during a network outage', async () => {
    const f = fixture(TOKEN);
    f.fetcher.mockRejectedValueOnce(new Error('offline'));
    await f.auth.start();
    expect(f.auth.getSnapshot()).toMatchObject({
      phase: 'blocked',
      user: null,
      issue: 'network_error',
    });
    expect(f.stored()).toBe(TOKEN);
    await f.auth.retry();
    expect(f.auth.getSnapshot().phase).toBe('signedIn');
  });
  it.each([401, 403])('removes revoked/deactivated credentials on HTTP %s', async (status) => {
    const f = fixture(TOKEN);
    f.fetcher.mockResolvedValueOnce(
      Response.json({ error: { code: 'unauthorized', message: 'No' } }, { status }),
    );
    await f.auth.start();
    expect(f.stored()).toBeNull();
    expect(f.auth.getSnapshot().phase).toBe('signedOut');
  });
  it('blocks on unreadable or hanging secure storage instead of treating it as an empty account', async () => {
    const f = fixture(TOKEN);
    jest.mocked(f.storage.get).mockImplementationOnce(() => new Promise(() => undefined));
    await f.auth.start();
    expect(f.auth.getSnapshot()).toMatchObject({ phase: 'blocked', issue: 'storage_error' });
    expect(f.fetcher).not.toHaveBeenCalled();
  });
  it('clears malformed saved credentials without sending them', async () => {
    const f = fixture('not-a-mobile-token');
    await f.auth.start();
    expect(f.fetcher).not.toHaveBeenCalled();
    expect(f.stored()).toBeNull();
  });
  it('locks on background and rechecks access on foreground', async () => {
    const f = fixture(TOKEN);
    await f.auth.start();
    f.auth.setActive(false);
    expect(f.auth.getSnapshot()).toMatchObject({ phase: 'blocked', user: null });
    f.fetcher.mockResolvedValueOnce(denied());
    f.auth.setActive(true);
    for (let i = 0; i < 30; i++) await Promise.resolve();
    expect(f.auth.getSnapshot().phase).toBe('signedOut');
    expect(f.stored()).toBeNull();
  });
  it('renewal near expiry is single-flight and persists the rotated token', async () => {
    const f = fixture(TOKEN);
    f.fetcher
      .mockResolvedValueOnce(ok(session('client', TOKEN, 1)))
      .mockResolvedValueOnce(ok(session('client', NEXT)));
    await Promise.all([f.auth.start(), f.auth.retry()]);
    expect(
      f.fetcher.mock.calls.filter(([url]) => String(url).endsWith('/auth/session/renew')),
    ).toHaveLength(1);
    expect(f.stored()).toBe(NEXT);
    expect(f.auth.getSnapshot().phase).toBe('signedIn');
  });
  it('expires a session with no private read after the expiry boundary', async () => {
    const f = fixture(TOKEN);
    f.fetcher.mockResolvedValueOnce(ok(session('client', TOKEN, -1)));
    await f.auth.start();
    expect(f.auth.getSnapshot().phase).toBe('signedOut');
    expect(f.stored()).toBeNull();
    await expect(f.auth.request('client/profile')).rejects.toMatchObject({
      code: 'session_expired',
    });
  });
  it('fails closed when logout cannot delete storage, and retry only clears rather than restoring it', async () => {
    const f = fixture(TOKEN);
    await f.auth.start();
    jest.mocked(f.storage.clear).mockRejectedValueOnce(new Error('failed'));
    await f.auth.logout();
    expect(f.auth.getSnapshot()).toMatchObject({ phase: 'blocked', issue: 'storage_error' });
    const calls = f.fetcher.mock.calls.length;
    await f.auth.retry();
    expect(f.auth.getSnapshot().phase).toBe('signedOut');
    expect(f.stored()).toBeNull();
    expect(f.fetcher).toHaveBeenCalledTimes(calls);
  });
  it('clears local credentials even when remote logout fails, and explains the failure', async () => {
    const f = fixture(TOKEN);
    await f.auth.start();
    f.fetcher.mockRejectedValueOnce(new Error('offline'));
    await f.auth.logout();
    expect(f.stored()).toBeNull();
    expect(f.auth.getSnapshot()).toMatchObject({ phase: 'signedOut', issue: 'logout_remote' });
  });
});
describe('in-flight session safety', () => {
  it('does not let an old unauthorized response erase a newly signed-in session', async () => {
    const f = fixture(TOKEN);
    await f.auth.start();
    const oldResponse = deferred<Response>();
    f.fetcher.mockReturnValueOnce(oldResponse.promise);
    const oldRead = f.auth.request('client/profile');
    await Promise.resolve();
    await Promise.resolve();
    await f.auth.logout();
    f.fetcher.mockResolvedValueOnce(ok(session('client', NEXT)));
    await f.auth.login('phone', 'password');
    oldResponse.resolve(denied());
    await expect(oldRead).rejects.toBeDefined();
    expect(f.stored()).toBe(NEXT);
    expect(f.auth.getSnapshot().phase).toBe('signedIn');
  });
  it('does not accept a cancelled sign-in while native persistence is finishing', async () => {
    const f = fixture();
    await f.auth.start();
    const written = deferred<void>();
    jest.mocked(f.storage.set).mockImplementationOnce(async () => {
      await written.promise;
    });
    const abort = new AbortController();
    const login = f.auth.login('phone', 'password', abort.signal);
    while (!jest.mocked(f.storage.set).mock.calls.length) await Promise.resolve();
    abort.abort();
    written.resolve();
    await expect(login).rejects.toMatchObject({ code: 'request_aborted' });
    expect(f.auth.getSnapshot().phase).toBe('signedOut');
  });
  it('does not reopen a session after a backgrounded renewal returns late', async () => {
    const f = fixture(TOKEN);
    await f.auth.start();
    const response = deferred<Response>();
    f.fetcher.mockReturnValueOnce(response.promise);
    const renewal = f.auth.renew();
    f.auth.setActive(false);
    response.resolve(ok(session('client', NEXT)));
    await expect(renewal).rejects.toMatchObject({ code: 'request_aborted' });
    expect(f.auth.getSnapshot().user).toBeNull();
    expect(f.stored()).not.toBe(NEXT);
  });
});
describe('Telegram phone proof and account security', () => {
  it('normalizes all backend-supported Ethiopian phone forms', () => {
    for (const value of ['0911111111', '911111111', '251911111111', '+251 911 111 111'])
      expect(normalizePhone(value)).toBe('+251911111111');
    expect(normalizePhone('+1900111111')).toBeNull();
    expect(normalizePhone('127.example.com')).toBeNull();
    expect(validPassword('ሀ'.repeat(24), 8)).toBe(true);
    expect(validPassword('ሀ'.repeat(25), 8)).toBe(false);
  });
  it('never authenticates an existing account from Telegram linked status', async () => {
    const f = fixture();
    await f.auth.start();
    f.fetcher.mockResolvedValueOnce(ok({ state: 'linked' }));
    expect(await f.auth.linkState('t'.repeat(32))).toBe('linked');
    expect(f.stored()).toBeNull();
    expect(f.auth.getSnapshot().phase).toBe('signedOut');
    expect(f.fetcher.mock.calls[0]![1]?.headers).not.toHaveProperty('Authorization');
  });
  it.each<AppRole>(['admin', 'mother', 'cyclist'])(
    'does not offer %s signup through the controller',
    async (role) => {
      const f = fixture(null, role);
      await f.auth.start();
      await expect(f.auth.signup('t'.repeat(32), 'Name')).rejects.toMatchObject({
        code: 'wrong_role',
      });
      expect(f.fetcher).not.toHaveBeenCalled();
    },
  );
  it('sends OTP and explicit role rather than an invite as a login credential', async () => {
    const f = fixture();
    await f.auth.start();
    await f.auth.verifyCode('0911111111', '123456');
    expect(JSON.parse(f.fetcher.mock.calls[0]![1]!.body as string)).toEqual({
      phoneNumber: '+251911111111',
      code: '123456',
      role: 'client',
    });
  });
  it('only opens validated Telegram bot URLs bound to the exact invite token', () => {
    const invite = {
      token: 't'.repeat(32),
      expiresAt: session().expiresAt,
      deepLink: 'https://t.me/miaa_bot?start=' + 't'.repeat(32),
    };
    expect(validateInvite(invite)).toEqual(invite);
    for (const deepLink of [
      'javascript:alert(1)',
      'https://evil.test/miaa_bot',
      'https://t.me.evil.test/miaa_bot',
      'https://t.me/miaa_bot?start=other',
      'https://t.me/miaa_bot?start=' + 't'.repeat(32) + '&redirect=evil',
    ])
      expect(() => validateInvite({ ...invite, deepLink })).toThrow();
  });
  it('password changes keep this session and revoke-all removes it', async () => {
    const f = fixture(TOKEN);
    await f.auth.start();
    f.fetcher.mockResolvedValueOnce(ok({ ok: true }));
    await f.auth.changePassword('oldpassword', 'newpassword');
    expect(f.stored()).toBe(TOKEN);
    expect(JSON.parse(f.fetcher.mock.calls.at(-1)![1]!.body as string)).toEqual({
      currentPassword: 'oldpassword',
      newPassword: 'newpassword',
    });
    f.fetcher.mockResolvedValueOnce(ok({ ok: true }));
    await f.auth.revokeAll();
    expect(f.stored()).toBeNull();
    expect(f.auth.getSnapshot().phase).toBe('signedOut');
  });
});
