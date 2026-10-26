import { describe, it, expect, jest } from '@jest/globals';
import { createMobileApi, type TokenStorage, MobileApiError } from '../packages/api/src/client';
const session = {
  accessToken: 'test-native-secret',
  tokenType: 'Bearer',
  expiresAt: '2026-10-28T00:00:00Z',
  user: {
    id: 1,
    role: 'client',
    phoneNumber: '+251911111111',
    email: null,
    locale: 'en',
  },
};
function fixture() {
  let token: string | null = null;
  const storage: TokenStorage = {
    get: async () => token,
    set: async (value) => {
      token = value;
    },
    clear: async () => {
      token = null;
    },
  };
  const fetcher = jest.fn<typeof fetch>();
  const api = createMobileApi({
    origin: 'https://miaa.example',
    storage,
    fetch: fetcher,
  });
  return { api, storage, fetcher };
}
const ok = (data: unknown) => Response.json({ data, requestId: 'test' });
describe('shared native transport', () => {
  it('saves login credentials only through the secure-storage adapter', async () => {
    const f = fixture();
    f.fetcher.mockResolvedValueOnce(ok(session));
    await f.api.login('0911111111', 'password', 'client');
    expect(await f.storage.get()).toBe(session.accessToken);
    const [, init] = f.fetcher.mock.calls[0]!;
    expect(init?.credentials).toBe('omit');
    expect(init?.redirect).toBe('error');
    expect(init?.headers).not.toHaveProperty('Authorization');
  });
  it('requires a stored session for protected requests', async () => {
    const f = fixture();
    await expect(f.api.me()).rejects.toMatchObject({ status: 401 });
    expect(f.fetcher).not.toHaveBeenCalled();
  });
  it('adds bearer credentials, JSON body and retry key', async () => {
    const f = fixture();
    await f.storage.set(session.accessToken);
    f.fetcher.mockResolvedValueOnce(ok({ id: 2 }));
    await f.api.request('client/orders', {
      method: 'POST',
      body: { motherOfferingId: 2 },
      idempotencyKey: 'request-123',
    });
    expect(f.fetcher.mock.calls[0]![1]?.headers).toMatchObject({
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': 'request-123',
    });
  });
  it('clears an invalid session on 401', async () => {
    const f = fixture();
    await f.storage.set('old');
    f.fetcher.mockResolvedValueOnce(
      Response.json(
        {
          error: { code: 'unauthorized', message: 'Sign in' },
          requestId: 'abc',
        },
        { status: 401 },
      ),
    );
    await expect(f.api.me()).rejects.toMatchObject({
      status: 401,
      requestId: 'abc',
    });
    expect(await f.storage.get()).toBeNull();
  });
  it('does not clear a newer session when an older request fails', async () => {
    const f = fixture();
    await f.storage.set('old');
    f.fetcher.mockImplementationOnce(async () => {
      await f.storage.set('new');
      return Response.json(
        { error: { code: 'unauthorized', message: 'Sign in' } },
        { status: 401 },
      );
    });
    await expect(f.api.me()).rejects.toBeInstanceOf(MobileApiError);
    expect(await f.storage.get()).toBe('new');
  });
  it('shares a single renewal among concurrent callers', async () => {
    const f = fixture();
    await f.storage.set('old');
    f.fetcher.mockResolvedValueOnce(ok(session));
    await Promise.all([f.api.renew(), f.api.renew()]);
    expect(f.fetcher).toHaveBeenCalledTimes(1);
    expect(await f.storage.get()).toBe(session.accessToken);
  });
  it('does not automatically retry writes on connection failure', async () => {
    const f = fixture();
    await f.storage.set('old');
    f.fetcher.mockRejectedValueOnce(new Error('offline'));
    await expect(
      f.api.request('client/orders', { method: 'POST', body: {} }),
    ).rejects.toMatchObject({ code: 'network_error' });
    expect(f.fetcher).toHaveBeenCalledTimes(1);
  });
  it('preserves sessions and server retry guidance on 429', async () => {
    const f = fixture();
    await f.storage.set('old');
    f.fetcher.mockResolvedValueOnce(
      Response.json(
        { error: { code: 'rate_limited', message: 'Wait' } },
        { status: 429, headers: { 'Retry-After': '60' } },
      ),
    );
    await expect(f.api.me()).rejects.toMatchObject({ retryAfterSeconds: 60 });
    expect(await f.storage.get()).toBe('old');
  });
  it('rejects invalid success envelopes', async () => {
    const f = fixture();
    await f.storage.set('old');
    f.fetcher.mockResolvedValueOnce(Response.json({ wrong: true }));
    await expect(f.api.me()).rejects.toMatchObject({ status: 502 });
  });
  it.each([
    'http://miaa.example',
    'https://user:secret@miaa.example',
    'https://miaa.example/path',
    'https://miaa.example?token=secret',
    'https://miaa.example/#secret',
  ])('rejects unsafe origins %s', (origin) => {
    const f = fixture();
    expect(() => createMobileApi({ origin, storage: f.storage })).toThrow();
  });
  it('never sends tokens to an absolute URL passed as a path', async () => {
    const f = fixture();
    await f.storage.set('secret');
    await expect(f.api.request('https://attacker.test')).rejects.toThrow();
    expect(f.fetcher).not.toHaveBeenCalled();
  });
});
