import { MobileApiError } from '@miaa/api';
import {
  createOrderController,
  definitiveRefusal,
  type ClientRequest,
} from '../packages/client-portal/src/orders';
import type { OrderStore } from '../packages/client-portal/src/contracts';
import { clientPayload, clientDetail } from './fixtures/client';
function memory() {
  let value: string | null = null;
  let queue: Promise<unknown> = Promise.resolve();
  const store: OrderStore = {
    read: jest.fn(async () => value),
    write: jest.fn(async (v) => {
      value = v;
    }),
    clear: jest.fn(async () => {
      value = null;
    }),
    exclusive: async (action) => {
      const result = queue.catch(() => undefined).then(action);
      queue = result;
      return result;
    },
  };
  return {
    store,
    value: () => value,
    set: (v: string | null) => {
      value = v;
    },
  };
}
function setup(
  shared = memory(),
  request: ClientRequest = jest.fn(async () => clientDetail) as ClientRequest,
) {
  const key = jest.fn(() => `test-request-${keys++}`);
  const c = createOrderController({ owner: 7, store: shared.store, request, randomKey: key });
  return { c, shared, request, key };
}
let keys = 1;
const network = () => new MobileApiError(0, 'network_error', 'Lost response');
describe('Client durable order intentions', () => {
  test.each([
    new MobileApiError(404, 'not_found', 'Order not found.'),
    new MobileApiError(
      409,
      'business_rule',
      'Another update happened at the same time. Please try again.',
    ),
  ])('a possible post-commit error never unlocks a second intention', async (error) => {
    const request = jest.fn(async () => {
      throw error;
    }) as ClientRequest;
    const a = setup(memory(), request);
    await a.c.recover();
    await a.c.create({ ...clientPayload });
    await a.c.discardRejected();
    expect(a.c.getSnapshot().pending?.state).toBe('uncertain');
    await a.c.create({ ...clientPayload, notes: 'Must stay blocked' });
    expect(request).toHaveBeenCalledTimes(1);
  });
  test('a review made before another receipt cannot become a new intention', async () => {
    const a = setup();
    await a.c.recover();
    const revision = JSON.stringify(a.c.getSnapshot().pending);
    await a.c.create({ ...clientPayload }, revision);
    await a.c.create({ ...clientPayload, notes: 'Stale review' }, revision);
    expect(a.request).toHaveBeenCalledTimes(1);
  });
  test('only recognizable pre-commit errors permit an explicit new review', () => {
    expect(
      definitiveRefusal(new MobileApiError(400, 'invalid_input', 'Check the submitted fields.')),
    ).toBe(true);
    expect(
      definitiveRefusal(
        new MobileApiError(
          409,
          'business_rule',
          'The kitchen is full on 2026-11-02 (20 meals/day). Raise her capacity or choose another mother.',
        ),
      ),
    ).toBe(true);
    expect(
      definitiveRefusal(
        new MobileApiError(
          409,
          'business_rule',
          'This request key already belongs to another or archived order. Use a new key for a new order.',
        ),
      ),
    ).toBe(false);
  });
  test('the same reviewed snapshot cannot create another order after success', async () => {
    const a = setup();
    await a.c.recover();
    const reviewed = structuredClone(clientPayload);
    await a.c.create(reviewed);
    await a.c.create(reviewed);
    expect(a.request).toHaveBeenCalledTimes(1);
    expect(a.key).toHaveBeenCalledTimes(1);
  });
  test('commits payload and uncertain marker before POST, then saves a receipt', async () => {
    const s = memory();
    const request = jest.fn(async () => {
      expect(JSON.parse(s.value()!).state).toBe('uncertain');
      expect(JSON.parse(s.value()!).body).toEqual(clientPayload);
      return clientDetail;
    }) as ClientRequest;
    const { c } = setup(s, request);
    await c.recover();
    await c.create(clientPayload);
    expect(c.getSnapshot().result).toEqual(clientDetail);
    expect(JSON.parse(s.value()!)).toEqual({
      version: 1,
      owner: 7,
      state: 'confirmed',
      orderId: 19,
    });
  });
  test('a lost response survives controller replacement and retries exact key and body', async () => {
    const request = jest
      .fn()
      .mockRejectedValueOnce(network())
      .mockResolvedValue(clientDetail) as ClientRequest;
    const a = setup(memory(), request);
    await a.c.recover();
    await a.c.create(clientPayload);
    expect(a.c.getSnapshot().pending?.state).toBe('uncertain');
    a.c.dispose();
    const b = setup(a.shared, request);
    await b.c.recover();
    await b.c.retry();
    const calls = (request as jest.Mock).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][1].idempotencyKey).toBe(calls[1][1].idempotencyKey);
    expect(calls[0][1].body).toEqual(calls[1][1].body);
    expect(b.key).not.toHaveBeenCalled();
    expect(b.c.getSnapshot().pending?.state).toBe('confirmed');
  });
  test('double press while a request is in flight never submits twice', async () => {
    let done!: (v: unknown) => void;
    const request = jest.fn(
      () =>
        new Promise<unknown>((resolve) => {
          done = resolve;
        }),
    ) as ClientRequest;
    const { c } = setup(memory(), request);
    await c.recover();
    const first = c.create(clientPayload);
    await new Promise<unknown>((resolve) => setImmediate(resolve));
    await c.create(clientPayload);
    done(clientDetail);
    await first;
    expect(request).toHaveBeenCalledTimes(1);
  });
  test('simultaneous controllers sharing a journal surface the first receipt instead of creating two orders', async () => {
    const s = memory();
    const request = jest.fn(async () => clientDetail) as ClientRequest;
    const a = setup(s, request),
      b = setup(s, request);
    await Promise.all([a.c.recover(), b.c.recover()]);
    await Promise.all([a.c.create(clientPayload), b.c.create(clientPayload)]);
    expect(request).toHaveBeenCalledTimes(1);
    expect(b.c.getSnapshot().pending?.state).toBe('confirmed');
    expect(b.key).not.toHaveBeenCalled();
  });
  test('an explicitly reviewed next order can replace a known confirmed receipt', async () => {
    const { c, request } = setup();
    await c.recover();
    await c.create(clientPayload);
    await c.create({ ...clientPayload, notes: 'A separate intended order' });
    expect(request).toHaveBeenCalledTimes(2);
  });
  test.each(['read', 'write'] as const)(
    'unavailable %s storage refuses all network writes',
    async (method) => {
      const a = setup();
      (a.shared.store[method] as jest.Mock).mockRejectedValue(new Error('Unavailable'));
      await a.c.recover();
      await a.c.create(clientPayload);
      expect(a.request).not.toHaveBeenCalled();
      expect(a.c.getSnapshot().issue).toBe('storage_error');
    },
  );
  test('failure saving the uncertain marker sends no POST', async () => {
    const a = setup();
    (a.shared.store.write as jest.Mock)
      .mockImplementationOnce(async (v) => a.shared.set(v))
      .mockRejectedValueOnce(new Error('Storage'));
    await a.c.recover();
    await a.c.create(clientPayload);
    expect(a.request).not.toHaveBeenCalled();
    expect(JSON.parse(a.shared.value()!).state).toBe('prepared');
  });
  test('failure saving the receipt keeps the original intention and can recover by replay', async () => {
    const a = setup();
    (a.shared.store.write as jest.Mock)
      .mockImplementationOnce(async (v) => a.shared.set(v))
      .mockImplementationOnce(async (v) => a.shared.set(v))
      .mockRejectedValueOnce(new Error('Storage'))
      .mockImplementation(async (v) => a.shared.set(v));
    await a.c.recover();
    await a.c.create(clientPayload);
    expect(JSON.parse(a.shared.value()!).state).toBe('uncertain');
    await a.c.create({ ...clientPayload, notes: 'Must not replace' });
    expect(a.request).toHaveBeenCalledTimes(1);
    await a.c.retry();
    expect(a.request).toHaveBeenCalledTimes(2);
    expect(a.c.getSnapshot().pending?.state).toBe('confirmed');
    expect(a.key).toHaveBeenCalledTimes(1);
  });
  test.each([
    'broken JSON',
    JSON.stringify({ version: 1, owner: 99, state: 'confirmed', orderId: 19 }),
  ])('corrupt or foreign journal remains intact', async (raw) => {
    const a = setup();
    a.shared.set(raw);
    await a.c.recover();
    await a.c.create(clientPayload);
    expect(a.c.getSnapshot().ready).toBe(false);
    expect(a.shared.value()).toBe(raw);
    expect(a.request).not.toHaveBeenCalled();
  });
  test('definitive initial refusal allows an explicit new intention', async () => {
    const request = jest
      .fn()
      .mockRejectedValueOnce(
        new MobileApiError(409, 'business_rule', 'That package is no longer offered.'),
      )
      .mockResolvedValue(clientDetail) as ClientRequest;
    const a = setup(memory(), request);
    await a.c.recover();
    await a.c.create(clientPayload);
    expect(a.c.getSnapshot().pending?.state).toBe('rejected');
    await a.c.discardRejected();
    await a.c.create({ ...clientPayload });
    expect(a.key).toHaveBeenCalledTimes(2);
    expect(a.c.getSnapshot().pending?.state).toBe('confirmed');
  });
  test('a refusal after an unknown outcome cannot discard its key', async () => {
    const request = jest
      .fn()
      .mockRejectedValueOnce(network())
      .mockRejectedValueOnce(new MobileApiError(409, 'business_rule', 'Archived')) as ClientRequest;
    const a = setup(memory(), request);
    await a.c.recover();
    await a.c.create(clientPayload);
    await a.c.retry();
    await a.c.discardRejected();
    expect(a.c.getSnapshot().pending?.state).toBe('uncertain');
    expect(a.shared.value()).not.toBeNull();
  });
  test('malformed successful response remains an uncertain order', async () => {
    const request = jest.fn(async () => ({ ok: true })) as ClientRequest;
    const a = setup(memory(), request);
    await a.c.recover();
    await a.c.create(clientPayload);
    expect(a.c.getSnapshot().pending?.state).toBe('uncertain');
    expect(a.c.getSnapshot().issue).toBe('invalid_response');
  });
  test('cancellation during storage prevents a later network submission', async () => {
    const a = setup();
    await a.c.recover();
    let release!: () => void;
    (a.shared.store.write as jest.Mock).mockImplementation(async (v) => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      a.shared.set(v);
    });
    const work = a.c.create(clientPayload);
    await new Promise<unknown>((resolve) => setImmediate(resolve));
    a.c.dispose();
    release();
    await work;
    expect(a.request).not.toHaveBeenCalled();
    expect(JSON.parse(a.shared.value()!).state).toBe('prepared');
  });
  test('late success after session disposal cannot update the journal receipt', async () => {
    let release!: (v: unknown) => void;
    const request = jest.fn(
      () =>
        new Promise<unknown>((resolve) => {
          release = resolve;
        }),
    ) as ClientRequest;
    const a = setup(memory(), request);
    await a.c.recover();
    const work = a.c.create(clientPayload);
    await new Promise<unknown>((resolve) => setImmediate(resolve));
    a.c.dispose();
    release(clientDetail);
    await work;
    expect(JSON.parse(a.shared.value()!).state).toBe('uncertain');
  });
  test('429 retry delay is respected and retains the same key', async () => {
    let now = 1000;
    const s = memory();
    const request = jest
      .fn()
      .mockRejectedValueOnce(new MobileApiError(429, 'rate_limited', 'Wait', undefined, 2))
      .mockResolvedValue(clientDetail) as ClientRequest;
    const c = createOrderController({
      owner: 7,
      store: s.store,
      request,
      randomKey: () => 'same-key-123',
      now: () => now,
    });
    await c.recover();
    await c.create(clientPayload);
    await c.retry();
    expect(request).toHaveBeenCalledTimes(1);
    now = 3001;
    await c.retry();
    expect(request).toHaveBeenCalledTimes(2);
    expect((request as jest.Mock).mock.calls[1][1].idempotencyKey).toBe('same-key-123');
    c.dispose();
  });
});

test('cooldown expiry updates every subscriber without another user action', async () => {
  jest.useFakeTimers({ now: 1000 });
  const request = jest
    .fn()
    .mockRejectedValueOnce(new MobileApiError(429, 'rate_limited', 'Wait', undefined, 2))
    .mockResolvedValue(clientDetail) as ClientRequest;
  const a = setup(memory(), request);
  try {
    await a.c.recover();
    await a.c.create({ ...clientPayload });
    expect(a.c.getSnapshot().retryAt).toBe(3000);
    jest.advanceTimersByTime(2000);
    expect(a.c.getSnapshot().retryAt).toBe(0);
    await a.c.retry();
    expect(request).toHaveBeenCalledTimes(2);
  } finally {
    a.c.dispose();
    jest.useRealTimers();
  }
});
