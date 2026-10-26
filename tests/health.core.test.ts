import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { checkHealth } from '../packages/api/src/health';
afterEach(() => {
  jest.useRealTimers();
});
describe('credential-free health checks', () => {
  it('uses the versioned endpoint without cookies or bearer credentials', async () => {
    const fetcher = jest
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ data: { status: 'ok', apiVersion: 1 } }));
    await expect(checkHealth('https://miaa.onrender.com', { fetch: fetcher })).resolves.toEqual({
      status: 'ok',
      apiVersion: 1,
    });
    expect(fetcher.mock.calls[0]![0]).toBe('https://miaa.onrender.com/api/v1/health');
    expect(fetcher.mock.calls[0]![1]).toMatchObject({
      credentials: 'omit',
      redirect: 'error',
      headers: { Accept: 'application/json' },
    });
    expect(fetcher.mock.calls[0]![1]?.headers).not.toHaveProperty('Authorization');
  });
  it.each([
    { data: { status: 'ok', apiVersion: 2 } },
    { status: 'ok' },
    { data: null },
    { data: { status: 'down', apiVersion: 1 } },
  ])('rejects incompatible success payloads', async (value) => {
    await expect(
      checkHealth('https://miaa.example', {
        fetch: jest.fn<typeof fetch>().mockResolvedValue(Response.json(value)),
      }),
    ).rejects.toMatchObject({ code: 'invalid_response' });
  });
  it('reports unavailable servers without leaking HTML/error content', async () => {
    await expect(
      checkHealth('https://miaa.example', {
        fetch: jest
          .fn<typeof fetch>()
          .mockResolvedValue(new Response('secret error', { status: 503 })),
      }),
    ).rejects.toMatchObject({ status: 503, code: 'service_unavailable' });
  });
  it('allows cancelling an in-flight check', async () => {
    const abort = new AbortController();
    const fetcher = jest
      .fn<typeof fetch>()
      .mockImplementation(
        async (_url, options) =>
          new Promise((_resolve, reject) =>
            options?.signal?.addEventListener('abort', () => reject(new Error('aborted'))),
          ),
      );
    const pending = checkHealth('https://miaa.example', { fetch: fetcher, signal: abort.signal });
    const assertion = expect(pending).rejects.toMatchObject({ code: 'request_aborted' });
    abort.abort();
    await assertion;
  });
  it('bounds a stalled cold start', async () => {
    jest.useFakeTimers();
    const fetcher = jest
      .fn<typeof fetch>()
      .mockImplementation(
        async (_url, options) =>
          new Promise((_resolve, reject) =>
            options?.signal?.addEventListener('abort', () => reject(new Error('aborted'))),
          ),
      );
    const pending = checkHealth('https://miaa.example', { fetch: fetcher, timeoutMs: 50 });
    const assertion = expect(pending).rejects.toMatchObject({ code: 'request_aborted' });
    await jest.advanceTimersByTimeAsync(50);
    await assertion;
  });
  it('reports network failures and rejects invalid origins before sending', async () => {
    const fetcher = jest.fn<typeof fetch>().mockRejectedValue(new Error('offline'));
    await expect(checkHealth('https://miaa.example', { fetch: fetcher })).rejects.toMatchObject({
      code: 'network_error',
    });
    fetcher.mockClear();
    await expect(
      checkHealth('https://secret:password@miaa.example', { fetch: fetcher }),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
