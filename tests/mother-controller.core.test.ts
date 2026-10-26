import { createHash } from 'node:crypto';
import { MobileApiError, type RequestOptions } from '@miaa/api';
import { createMotherController } from '../packages/mother-portal/src/controller';
import type { TicketStore } from '../packages/mother-portal/src/storage';
import {
  motherDay,
  motherDishes,
  motherTickets,
  motherNow,
  packagedResponse,
} from './fixtures/mother';
const digest = async (text: string) => createHash('sha256').update(text).digest('hex');
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}
function setup() {
  let value: string | null = null;
  let now = motherNow;
  let chain: Promise<unknown> = Promise.resolve();
  const store: TicketStore = {
    read: jest.fn(async () => value),
    write: jest.fn(async (raw) => {
      value = raw;
    }),
    clear: jest.fn(async () => {
      value = null;
    }),
    exclusive: async (work) => {
      const task = chain.catch(() => undefined).then(work);
      chain = task;
      return task;
    },
  };
  const response: Record<string, unknown> = {
    'mother/day': structuredClone(motherDay),
    'mother/dishes': motherDishes,
    'mother/tickets': structuredClone(motherTickets),
    'mother/deliveries/31/package': packagedResponse,
    'mother/comp-meal': { ok: true },
  };
  const request = jest.fn(async (path: string, input?: RequestOptions) => {
    if (input?.method === 'POST' && path === 'mother/tickets') return { ok: true };
    return structuredClone(response[path]);
  });
  const model = createMotherController({
    request: request as <T>(p: string, o?: RequestOptions) => Promise<T>,
    store,
    digest,
    now: () => now,
  });
  return {
    model,
    store,
    request,
    response,
    get raw() {
      return value;
    },
    setRaw: (raw: string | null) => {
      value = raw;
    },
    advance: (v: number) => {
      now = v;
    },
  };
}
const posts = (s: ReturnType<typeof setup>) =>
  s.request.mock.calls.filter((c) => c[1]?.method === 'POST');
test('packaging re-reads own day and sends only the delivery path, then refreshes', async () => {
  const s = setup();
  await s.model.package(31);
  expect(s.request.mock.calls.map((x) => x[0])).toEqual([
    'mother/day',
    'mother/deliveries/31/package',
    'mother/day',
  ]);
  expect(posts(s)[0]![1]).not.toHaveProperty('body');
  expect(s.model.getSnapshot().notice).toBe('packaged');
});
test.each([0, 32, 99])('unassigned, non-preparing or invalid id %i never writes', async (item) => {
  const s = setup();
  await s.model.package(item);
  expect(posts(s)).toHaveLength(0);
  expect(s.model.getSnapshot().issue).toBeTruthy();
});
test('fresh server deadline and actual EAT deadline both prevent packaging', async () => {
  const s = setup();
  s.response['mother/day'] = { ...motherDay, deadlinePassed: true };
  await s.model.package(31);
  expect(posts(s)).toHaveLength(0);
  s.response['mother/day'] = motherDay;
  s.advance(Date.parse('2026-10-26T08:00:00Z'));
  await s.model.package(31);
  expect(posts(s)).toHaveLength(0);
});
test('double taps send a single packaging confirmation', async () => {
  const s = setup();
  await Promise.all([s.model.package(31), s.model.package(31)]);
  expect(posts(s)).toHaveLength(1);
});
test('lost packaging response is not retried and refresh reads actual advanced status', async () => {
  const s = setup();
  s.request.mockImplementation(async (path, input) => {
    if (input?.method === 'POST') {
      s.response['mother/day'] = {
        ...motherDay,
        items: motherDay.items.map((x) => ({ ...x, status: 'packaged' })),
      };
      throw new MobileApiError(0, 'network_error', 'lost');
    }
    return s.response[path];
  });
  await s.model.package(31);
  expect(posts(s)).toHaveLength(1);
  await s.model.refreshDay();
  await s.model.package(31);
  expect(posts(s)).toHaveLength(1);
});
test('malformed write receipt never reports success', async () => {
  const s = setup();
  s.response['mother/deliveries/31/package'] = { ...packagedResponse, id: 9 };
  await s.model.package(31);
  expect(s.model.getSnapshot().notice).toBeNull();
  expect(s.model.getSnapshot().issue).toBeTruthy();
});
test('latest day read wins when an older request completes late', async () => {
  const s = setup();
  const a = deferred<unknown>();
  s.request.mockImplementationOnce(() => a.promise);
  const old = s.model.refreshDay();
  await s.model.refreshDay();
  a.resolve({ ...motherDay, motherName: 'Stale' });
  await old;
  expect(s.model.getSnapshot().day.data?.motherName).toBe('Test Kitchen');
});
test('failed refresh clears old private data rather than leaving actionable stale queue', async () => {
  const s = setup();
  await s.model.refreshDay();
  s.request.mockRejectedValueOnce(new Error('offline'));
  await s.model.refreshDay();
  expect(s.model.getSnapshot().day.data).toBeNull();
  expect(s.model.getSnapshot().day.error).toBeTruthy();
});
test('staff meal validates today and chosen dish and sends no recipient override', async () => {
  const s = setup();
  await s.model.meal(5);
  expect(posts(s)[0]).toEqual([
    'mother/comp-meal',
    expect.objectContaining({ body: { dishId: 5 } }),
  ]);
  expect(s.model.getSnapshot().notice).toBe('mealSaved');
});
test('recorded daily meal avoids another write even after an ambiguous earlier response', async () => {
  const s = setup();
  s.response['mother/day'] = { ...motherDay, compMealTaken: true };
  await s.model.meal(5);
  expect(posts(s)).toHaveLength(0);
  expect(s.model.getSnapshot().notice).toBe('mealSaved');
});
test('meal supports unnamed dish but rejects outside batch or stale day', async () => {
  const s = setup();
  await s.model.meal(99);
  expect(posts(s)).toHaveLength(0);
  s.response['mother/dishes'] = [];
  await s.model.meal(null);
  expect(posts(s)).toHaveLength(1);
  s.response['mother/day'] = { ...motherDay, date: '2026-10-25' };
  await s.model.meal(null);
  expect(posts(s)).toHaveLength(1);
});
test('storage is committed before support POST and contains no raw message or credential', async () => {
  const s = setup();
  s.request.mockImplementation(async (path, input) => {
    if (input?.method === 'POST') {
      expect(s.raw).not.toBeNull();
      expect(s.raw).not.toContain('My private request');
      expect(s.raw).not.toContain('miaa_m1');
      return { ok: true };
    }
    return s.response[path];
  });
  await s.model.submitTicket(' My private request ');
  expect(posts(s)[0]).toEqual([
    'mother/tickets',
    expect.objectContaining({ body: { message: 'My private request' } }),
  ]);
  expect(s.raw).toBeNull();
  expect(s.model.getSnapshot().notice).toBe('ticketSent');
});
test.each(['', ' '.repeat(5), 'x'.repeat(2001)])(
  'invalid support message blocks all requests',
  async (text) => {
    const s = setup();
    await s.model.submitTicket(text);
    expect(s.request).not.toHaveBeenCalled();
  },
);
test('failed marker persistence refuses POST and fail-closes request storage', async () => {
  const s = setup();
  jest.mocked(s.store.write).mockRejectedValueOnce(new Error('disk'));
  await s.model.submitTicket('Help');
  expect(posts(s)).toHaveLength(0);
  expect(s.model.getSnapshot().storageReady).toBe(false);
});
test('corrupt stored marker blocks a new ticket and recovery', async () => {
  const s = setup();
  s.setRaw('{}');
  await s.model.recover();
  expect(s.model.getSnapshot().storageReady).toBe(false);
  await s.model.submitTicket('Help');
  expect(posts(s)).toHaveLength(0);
  expect(s.raw).toBe('{}');
});
test('uncertain ticket survives a new controller and blocks another POST', async () => {
  const s = setup();
  s.request.mockImplementation(async (path, input) => {
    if (input?.method === 'POST') throw new MobileApiError(0, 'network_error', 'lost');
    return s.response[path];
  });
  await s.model.submitTicket('Help');
  expect(s.raw).not.toBeNull();
  const restored = createMotherController({
    request: s.request as <T>(p: string, o?: RequestOptions) => Promise<T>,
    store: s.store,
    digest,
    now: () => motherNow,
  });
  await restored.recover();
  expect(restored.getSnapshot().pending).not.toBeNull();
  await restored.submitTicket('Another');
  expect(posts(s)).toHaveLength(1);
});
test('matching new request is reconciled from history without another write', async () => {
  const s = setup();
  s.request.mockImplementation(async (path, input) => {
    if (input?.method === 'POST') throw new MobileApiError(0, 'network_error', 'lost');
    return s.response[path];
  });
  await s.model.submitTicket('Help');
  s.response['mother/tickets'] = [
    { ...motherTickets[0], id: 18, message: 'Help' },
    ...motherTickets,
  ];
  await s.model.refreshTickets();
  expect(s.raw).toBeNull();
  expect(s.model.getSnapshot().notice).toBe('ticketRecovered');
  expect(posts(s)).toHaveLength(1);
});
test('old identical request is not mistaken for the new attempt', async () => {
  const s = setup();
  s.request.mockImplementation(async (path, input) => {
    if (input?.method === 'POST') throw new Error('lost');
    return s.response[path];
  });
  await s.model.submitTicket('Need packaging');
  await s.model.refreshTickets();
  expect(s.raw).not.toBeNull();
  expect(s.model.getSnapshot().pending).not.toBeNull();
});
test('unknown 409 or malformed success keeps support marker', async () => {
  for (const error of [new MobileApiError(409, 'business_rule', 'unknown'), null]) {
    const s = setup();
    s.request.mockImplementation(async (path, input) => {
      if (input?.method === 'POST') {
        if (error) throw error;
        return { ok: false };
      }
      return s.response[path];
    });
    await s.model.submitTicket('Help');
    expect(s.raw).not.toBeNull();
    expect(s.model.getSnapshot().notice).toBeNull();
  }
});
test('known pre-insert rate limit clears marker and respects Retry-After', async () => {
  jest.useFakeTimers();
  try {
    const s = setup();
    s.request.mockImplementation(async (path, input) => {
      if (input?.method === 'POST')
        throw new MobileApiError(429, 'rate_limited', 'wait', undefined, 2);
      return s.response[path];
    });
    await s.model.submitTicket('Help');
    expect(s.raw).toBeNull();
    expect(s.model.getSnapshot().retryAt).toBe(motherNow + 2000);
    await s.model.submitTicket('Help');
    expect(posts(s)).toHaveLength(1);
    s.advance(motherNow + 2000);
    jest.advanceTimersByTime(2000);
    expect(s.model.getSnapshot().retryAt).toBe(0);
    s.model.dispose();
  } finally {
    jest.useRealTimers();
  }
});
test('confirmed insert plus storage-clear failure retains recovery barrier', async () => {
  const s = setup();
  jest.mocked(s.store.clear).mockRejectedValueOnce(new Error('disk'));
  await s.model.submitTicket('Help');
  expect(s.raw).not.toBeNull();
  expect(s.model.getSnapshot().notice).toBeNull();
  await s.model.submitTicket('Another');
  expect(posts(s)).toHaveLength(1);
});
test('two same-device controllers serialize ticket checks through one store', async () => {
  const s = setup();
  s.request.mockImplementation(async (path, input) => {
    if (input?.method === 'POST') throw new Error('lost');
    return s.response[path];
  });
  const other = createMotherController({
    request: s.request as <T>(p: string, o?: RequestOptions) => Promise<T>,
    store: s.store,
    digest,
    now: () => motherNow,
  });
  await Promise.all([s.model.submitTicket('Help'), other.submitTicket('Help')]);
  expect(posts(s)).toHaveLength(1);
});
test('explicit reviewed reminder clearing does not send a request', async () => {
  const s = setup();
  s.setRaw(
    JSON.stringify({
      v: 1,
      digest: 'a'.repeat(64),
      before: [],
      sentAt: new Date(motherNow).toISOString(),
    }),
  );
  await s.model.recover();
  await s.model.clearReviewedPending(s.model.getSnapshot().pending!);
  expect(s.raw).toBeNull();
  expect(posts(s)).toHaveLength(0);
});
test('dispose aborts reads and ignores late data', async () => {
  const s = setup();
  const d = deferred<unknown>();
  s.request.mockImplementationOnce(() => d.promise);
  const work = s.model.refreshDay();
  const signal = s.request.mock.calls[0]![1]!.signal;
  s.model.dispose();
  expect(signal?.aborted).toBe(true);
  d.resolve(motherDay);
  await work;
  expect(s.model.getSnapshot().day.data).toBeNull();
});
test('disposal while saving marker cannot send a ticket', async () => {
  const s = setup();
  jest.mocked(s.store.write).mockImplementationOnce(async (raw) => {
    s.setRaw(raw);
    s.model.dispose();
  });
  await s.model.submitTicket('Help');
  expect(posts(s)).toHaveLength(0);
  expect(s.raw).not.toBeNull();
});

test('a stale office review cannot clear a different newer pending request', async () => {
  const s = setup();
  const old = {
    v: 1,
    digest: 'a'.repeat(64),
    before: [],
    sentAt: new Date(motherNow).toISOString(),
  } as const;
  s.setRaw(JSON.stringify(old));
  await s.model.recover();
  const reviewed = s.model.getSnapshot().pending!;
  const newer = { ...old, digest: 'b'.repeat(64) };
  s.setRaw(JSON.stringify(newer));
  await s.model.clearReviewedPending(reviewed);
  expect(s.raw).toBe(JSON.stringify(newer));
  expect(s.model.getSnapshot().pending?.digest).toBe(newer.digest);
});
