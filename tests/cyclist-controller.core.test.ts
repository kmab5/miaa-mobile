import { MobileApiError, type RequestOptions } from '@miaa/api';
import { createCyclistController } from '../packages/cyclist-portal/src/controller';
import {
  collectItem,
  confirmItem,
  cyclistDishes,
  cyclistEarnings,
  cyclistNow,
  cyclistRun,
  deliveryReceipt,
} from './fixtures/cyclist';
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}
function setup() {
  let now = cyclistNow;
  const data: Record<string, unknown> = {
    run: structuredClone(cyclistRun),
    dishes: cyclistDishes,
    earnings: cyclistEarnings,
    lookup: collectItem,
  };
  const request = jest.fn(async (path: string, input?: RequestOptions) => {
    if (input?.method === 'POST') {
      if (path.endsWith('/collect')) return deliveryReceipt(collectItem, 'collect');
      if (path.endsWith('/confirm')) return deliveryReceipt(confirmItem, 'confirm');
      return { ok: true };
    }
    return structuredClone(data[path.split('/')[1]!.split('?')[0]!]);
  });
  const model = createCyclistController({
    request: request as <T>(p: string, o?: RequestOptions) => Promise<T>,
    now: () => now,
  });
  return {
    model,
    data,
    request,
    advance: (v: number) => {
      now = v;
    },
  };
}
const posts = (s: ReturnType<typeof setup>) =>
  s.request.mock.calls.filter((x) => x[1]?.method === 'POST');
async function review(s: ReturnType<typeof setup>, action: 'collect' | 'confirm' = 'collect') {
  await s.model.refreshRun();
  return s.model.review(action === 'collect' ? collectItem : confirmItem, action, '2026-10-26');
}
test('collection rechecks own date/run and uses only its endpoint, then refreshes counts', async () => {
  const s = setup();
  const r = await review(s);
  s.request.mockClear();
  await s.model.commit(r);
  expect(s.request.mock.calls.map((x) => x[0])).toEqual([
    'cyclist/run?date=2026-10-26',
    'cyclist/deliveries/31/collect',
    'cyclist/run?date=2026-10-26',
    'cyclist/earnings?date=2026-10-26',
  ]);
  expect(posts(s)[0]![1]).not.toHaveProperty('body');
  expect(s.model.getSnapshot().notice).toBe('collected');
});
test('delivery confirmation follows collection and accepts cyclist-only backend policy', async () => {
  const s = setup();
  const r = await review(s, 'confirm');
  await s.model.commit(r);
  expect(posts(s)[0]![0]).toBe('cyclist/deliveries/32/confirm');
  expect(s.model.getSnapshot().notice).toBe('confirmed');
});
test('collection is allowed before kitchen prep target when package is ready', async () => {
  const s = setup();
  const r = await review(s);
  await s.model.commit(r);
  expect(posts(s)).toHaveLength(1);
});
test('cooking/unassigned items and wrong action cannot be reviewed', async () => {
  const s = setup();
  await s.model.refreshRun();
  for (const item of [
    { ...collectItem, id: 99 },
    { ...collectItem, status: 'preparing' as const },
  ])
    expect(() => s.model.review(item, 'collect', '2026-10-26')).toThrow();
  expect(() => s.model.review(collectItem, 'confirm', '2026-10-26')).toThrow();
  expect(posts(s)).toHaveLength(0);
});
test.each(['clientName', 'addressNote', 'stickerId'])(
  'changed reviewed %s blocks mutation',
  async (key) => {
    const s = setup();
    const r = await review(s);
    s.data.run = { ...cyclistRun, readyToCollect: [{ ...collectItem, [key]: 'Changed' }] };
    await s.model.commit(r);
    expect(posts(s)).toHaveLength(0);
    expect(s.model.getSnapshot().issue).toMatchObject({ code: 'state_changed' });
  },
);
test('reassigned or advanced delivery cannot be confirmed from stale review', async () => {
  const s = setup();
  const r = await review(s);
  s.data.run = { ...cyclistRun, readyToCollect: [], total: 3 };
  await s.model.commit(r);
  expect(posts(s)).toHaveLength(0);
});
test('consumed review and fast double taps never generate duplicate POSTs', async () => {
  const s = setup();
  const r = await review(s);
  await Promise.all([s.model.commit(r), s.model.commit(r)]);
  await s.model.commit(r);
  expect(posts(s)).toHaveLength(1);
});
test('lost receipt is not auto-retried; a refreshed advanced run blocks another collect', async () => {
  const s = setup();
  const r = await review(s);
  s.request.mockImplementation(async (path, input) => {
    if (input?.method === 'POST') {
      s.data.run = {
        ...cyclistRun,
        readyToCollect: [],
        onTheWay: [{ ...collectItem, status: 'out_for_delivery' }, confirmItem],
      };
      throw new MobileApiError(0, 'network_error', 'lost');
    }
    return structuredClone(s.data[path.split('/')[1]!.split('?')[0]!]);
  });
  await s.model.commit(r);
  expect(posts(s)).toHaveLength(1);
  expect(s.model.getSnapshot().notice).toBeNull();
  await s.model.refreshRun();
  expect(() => s.model.review(collectItem, 'collect', '2026-10-26')).toThrow();
});
test('malformed delivery receipt never reports successful completion', async () => {
  const s = setup();
  const r = await review(s, 'confirm');
  s.request.mockImplementation(async (path, input) =>
    input?.method === 'POST'
      ? { ...deliveryReceipt(confirmItem, 'confirm'), id: 99 }
      : structuredClone(s.data[path.split('/')[1]!.split('?')[0]!]),
  );
  await s.model.commit(r);
  expect(s.model.getSnapshot().issue).toMatchObject({ code: 'invalid_response' });
  expect(s.model.getSnapshot().notice).toBeNull();
});
test('review cannot survive EAT midnight or a clock change before posting', async () => {
  const s = setup();
  const r = await review(s);
  s.advance(Date.parse('2026-10-26T21:00:00Z'));
  await s.model.commit(r);
  expect(posts(s)).toHaveLength(0);
});
test('exact lookup is URL encoded and remains bound to its requested sticker and date', async () => {
  const s = setup();
  await s.model.lookup('19-01');
  expect(s.request.mock.calls[0]![0]).toBe('cyclist/lookup?sticker=MA-19-01&date=2026-10-26');
  expect(s.model.getSnapshot().lookup.data?.id).toBe(31);
  s.data.lookup = confirmItem;
  await s.model.lookup('19-01');
  expect(s.model.getSnapshot().lookup.data).toBeNull();
  expect(s.model.getSnapshot().lookup.error).toMatchObject({ code: 'invalid_response' });
});
test('lookup query characters cannot inject API query parameters', async () => {
  const s = setup();
  await s.model.lookup('1&date=2000-01-01');
  expect(s.request.mock.calls[0]![0]).toContain('sticker=MA-1%26DATE%3D2000-01-01&date=2026-10-26');
});
test('editing/clearing lookup aborts pending request and ignores its late result', async () => {
  const s = setup();
  const d = deferred<unknown>();
  s.request.mockImplementationOnce(() => d.promise);
  const work = s.model.lookup('19-01');
  const signal = s.request.mock.calls[0]![1]!.signal;
  s.model.clearLookup();
  expect(signal?.aborted).toBe(true);
  d.resolve(collectItem);
  await work;
  expect(s.model.getSnapshot().lookup.data).toBeNull();
  expect(s.model.getSnapshot().lookup.query).toBe('');
});
test('lookup 404 does not reveal a previous client and invalid input sends nothing', async () => {
  const s = setup();
  await s.model.lookup('19-01');
  s.request.mockRejectedValueOnce(new MobileApiError(404, 'not_found', 'missing'));
  await s.model.lookup('99-01');
  expect(s.model.getSnapshot().lookup.data).toBeNull();
  expect(s.model.getSnapshot().lookup.error).toMatchObject({ code: 'not_found' });
  s.request.mockClear();
  await s.model.lookup('');
  expect(s.request).not.toHaveBeenCalled();
});
test('a lookup result permits review but mutation still verifies current assigned run', async () => {
  const s = setup();
  await s.model.lookup('19-01');
  const r = s.model.review(s.model.getSnapshot().lookup.data!, 'collect', '2026-10-26');
  await s.model.commit(r);
  expect(posts(s)).toHaveLength(1);
});
test('latest run request wins and aborts its superseded read', async () => {
  const s = setup();
  const d = deferred<unknown>();
  s.request.mockImplementationOnce(() => d.promise);
  const old = s.model.refreshRun();
  const signal = s.request.mock.calls[0]![1]!.signal;
  await s.model.refreshRun();
  expect(signal?.aborted).toBe(true);
  d.resolve({ ...cyclistRun, cyclistName: 'Old' });
  await old;
  expect(s.model.getSnapshot().run.data?.cyclistName).toBe('Test Cyclist');
});
test('read failure removes stale run data and leaves an explicit error', async () => {
  const s = setup();
  await s.model.refreshRun();
  s.request.mockRejectedValueOnce(new Error('offline'));
  await s.model.refreshRun();
  expect(s.model.getSnapshot().run.data).toBeNull();
  expect(s.model.getSnapshot().run.error).toBeTruthy();
});
test('staff meal validates current date and dish and sends no recipient override', async () => {
  const s = setup();
  await s.model.meal(5, '2026-10-26');
  expect(posts(s)[0]).toEqual([
    'cyclist/comp-meal',
    expect.objectContaining({ body: { dishId: 5 } }),
  ]);
  expect(s.model.getSnapshot().notice).toBe('mealSaved');
});
test('already recorded meal, removed dish and stale day never write', async () => {
  const s = setup();
  await s.model.meal(99, '2026-10-26');
  expect(posts(s)).toHaveLength(0);
  s.data.run = { ...cyclistRun, compMealTaken: true };
  await s.model.meal(5, '2026-10-26');
  expect(posts(s)).toHaveLength(0);
  s.advance(Date.parse('2026-10-26T21:00:00Z'));
  await s.model.meal(null, '2026-10-26');
  expect(posts(s)).toHaveLength(0);
});
test('staff meal supports no named dish', async () => {
  const s = setup();
  s.data.dishes = [];
  await s.model.meal(null, '2026-10-26');
  expect(posts(s)[0]![1]!.body).toEqual({ dishId: null });
});
test('date rollover during staff-meal preflight blocks the POST', async () => {
  const s = setup();
  s.request.mockImplementation(async (path) => {
    if (path.startsWith('cyclist/dishes')) s.advance(Date.parse('2026-10-26T21:00:00Z'));
    return structuredClone(s.data[path.split('/')[1]!.split('?')[0]!]);
  });
  await s.model.meal(5, '2026-10-26');
  expect(posts(s)).toHaveLength(0);
});
test('Retry-After from a read blocks mutations and resets after the cooldown', async () => {
  jest.useFakeTimers();
  try {
    const s = setup();
    const r = await review(s);
    s.request.mockRejectedValueOnce(new MobileApiError(429, 'rate_limited', 'wait', undefined, 2));
    await s.model.refreshRun();
    expect(s.model.getSnapshot().retryAt).toBe(cyclistNow + 2000);
    await s.model.commit(r);
    expect(posts(s)).toHaveLength(0);
    s.advance(cyclistNow + 2000);
    jest.advanceTimersByTime(2000);
    expect(s.model.getSnapshot().retryAt).toBe(0);
    s.model.dispose();
  } finally {
    jest.useRealTimers();
  }
});
test('dispose cancels requests and cannot publish late private data', async () => {
  const s = setup();
  const d = deferred<unknown>();
  s.request.mockImplementationOnce(() => d.promise);
  const pending = s.model.refreshRun();
  const signal = s.request.mock.calls[0]![1]!.signal;
  s.model.dispose();
  expect(signal?.aborted).toBe(true);
  d.resolve(cyclistRun);
  await pending;
  expect(s.model.getSnapshot().run.data).toBeNull();
});
test('a backend success followed by failed refresh keeps a truthful receipt notice and read error', async () => {
  const s = setup();
  const r = await review(s);
  let after = false;
  s.request.mockImplementation(async (path, input) => {
    if (input?.method === 'POST') {
      after = true;
      return deliveryReceipt(collectItem, 'collect');
    }
    if (after) throw new Error('refresh offline');
    return cyclistRun;
  });
  await s.model.commit(r);
  expect(s.model.getSnapshot().notice).toBe('collected');
  expect(s.model.getSnapshot().run.error).toBeTruthy();
  expect(posts(s)).toHaveLength(1);
});
