import { MobileApiError, type RequestOptions } from '@miaa/api';
import {
  createAdminController,
  parseJournal,
  type ActionStore,
} from '../packages/admin-portal/src/controller';
import { action } from '../packages/admin-portal/src/forms';
import { parseRead, type Row } from '../packages/admin-portal/src/contracts';
import {
  adminReads,
  adminMother,
  adminNow,
  adminOrderBody,
  adminSub,
  adminPayment,
} from './fixtures/admin';
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}
function setup() {
  let disk: string | null = null;
  let chain: Promise<unknown> = Promise.resolve();
  let serial = 0;
  const store: ActionStore = {
    read: jest.fn(async () => disk),
    write: jest.fn(async (raw) => {
      disk = raw;
    }),
    clear: jest.fn(async () => {
      disk = null;
    }),
    exclusive: async (work) => {
      const task = chain.catch(() => undefined).then(work);
      chain = task;
      return task;
    },
  };
  const data = structuredClone(adminReads);
  const request = jest.fn(async (path: string, input?: RequestOptions) => {
    const key = path.replace('admin/', '').split('?')[0]!;
    if (!input?.method || input.method === 'GET') return structuredClone(data[key]);
    if (key === 'orders') return { subscription: adminSub, deliveriesCreated: 5, paymentId: 10 };
    if (key.endsWith('/password')) return { ok: true };
    if (key === 'mothers') return { id: 12 };
    if (key === 'mothers/1') return adminMother;
    if (key === 'payments/10/confirm')
      return {
        payment: { ...adminPayment, status: 'confirmed' },
        subscription: { ...adminSub, status: 'active' },
      };
    return { id: 11 };
  });
  const randomKey = () =>
    `miaa-admin-12345678-1234-1234-1234-${String(++serial).padStart(12, '0')}`;
  const options = {
    request: request as <T>(p: string, o?: RequestOptions) => Promise<T>,
    store,
    randomKey,
    now: () => adminNow,
  };
  const model = createAdminController(options);
  return {
    model,
    store,
    request,
    data,
    options,
    get disk() {
      return disk;
    },
    setDisk: (v: string | null) => {
      disk = v;
    },
  };
}
const writes = (s: ReturnType<typeof setup>) =>
  s.request.mock.calls.filter((x) => x[1]?.method && x[1].method !== 'GET');
async function prepared(
  s: ReturnType<typeof setup>,
  kind: 'mother' | 'order' | 'motherPassword' = 'mother',
) {
  await s.model.recover();
  return s.model.review(
    action(
      kind,
      kind === 'order'
        ? adminOrderBody
        : kind === 'motherPassword'
          ? { newPassword: 'private-password' }
          : { name: 'Test Kitchen' },
      kind === 'motherPassword' ? 1 : null,
    ),
  );
}
test('journal is committed before POST; confirmation keeps only a revision receipt', async () => {
  const s = setup();
  const r = await prepared(s);
  s.request.mockImplementationOnce(async () => {
    expect(s.disk).toContain('Test Kitchen');
    return { id: 12 };
  });
  await s.model.commit(r);
  expect(writes(s)).toHaveLength(1);
  expect(s.model.getSnapshot().notice).toBe('saved');
  expect(s.model.getSnapshot().pending).toBeNull();
  expect(s.disk).not.toContain('Test Kitchen');
  expect(parseJournal(s.disk)).toMatchObject({ confirmed: true, resultId: 12 });
});
test('unsafe read path is rejected before network and failed reads remove stale data', async () => {
  const s = setup();
  await s.model.load('../finance');
  expect(s.request).not.toHaveBeenCalled();
  await s.model.load('mothers/1');
  s.request.mockRejectedValueOnce(new Error('offline'));
  await s.model.load('mothers/1');
  expect(s.model.getSnapshot().resources['mothers/1']?.data).toBeNull();
});
test('record preflight refuses changed snapshot before journal write or mutation', async () => {
  const s = setup();
  await s.model.recover();
  const source = parseRead('mothers/1', adminMother);
  const r = s.model.review(
    action('mother', { name: 'Changed' }, 1, {
      path: 'mothers/1',
      fingerprint: JSON.stringify(source),
    }),
  );
  s.data['mothers/1'] = { ...adminMother, name: 'Someone edited' };
  await s.model.commit(r);
  expect(writes(s)).toHaveLength(0);
  expect(s.store.write).not.toHaveBeenCalled();
  expect(s.model.getSnapshot().issue).toMatchObject({ code: 'state_changed' });
});
test('failed persistence refuses all mutations and malformed storage fails closed', async () => {
  const s = setup();
  const r = await prepared(s);
  jest.mocked(s.store.write).mockRejectedValueOnce(new Error('disk'));
  await s.model.commit(r);
  expect(writes(s)).toHaveLength(0);
  expect(s.model.getSnapshot().storageReady).toBe(false);
  s.setDisk('{}');
  await s.model.recover();
  expect(s.model.getSnapshot().storageReady).toBe(false);
});
test('unknown creation result survives restart and blocks another write', async () => {
  const s = setup();
  const r = await prepared(s);
  s.request.mockRejectedValueOnce(new MobileApiError(0, 'network_error', 'lost'));
  await s.model.commit(r);
  expect(s.model.getSnapshot().pending).not.toBeNull();
  const other = createAdminController(s.options);
  await other.recover();
  expect(() => other.review(action('mother', { name: 'Another' }, null))).toThrow();
  expect(writes(s)).toHaveLength(1);
});
test('order retry after restart reuses exactly the original key and payload', async () => {
  const s = setup();
  const r = await prepared(s, 'order');
  s.request.mockRejectedValueOnce(new MobileApiError(0, 'network_error', 'lost'));
  await s.model.commit(r);
  const first = writes(s)[0]![1]!;
  const other = createAdminController(s.options);
  await other.recover();
  await other.retryOrder();
  const second = writes(s)[1]![1]!;
  expect(second.body).toEqual(first.body);
  expect(second.idempotencyKey).toBe(first.idempotencyKey);
  expect(other.getSnapshot().receipt).toMatchObject({ id: 9, paymentId: 10 });
  expect(parseJournal(s.disk)).toMatchObject({ confirmed: true });
});
test('retry errors never replace an uncertain order key or body', async () => {
  const s = setup();
  const r = await prepared(s, 'order');
  s.request.mockRejectedValueOnce(new MobileApiError(0, 'network_error', 'lost'));
  await s.model.commit(r);
  const before = s.disk;
  s.request.mockRejectedValueOnce(new MobileApiError(409, 'business_rule', 'archived'));
  await s.model.retryOrder();
  expect(s.disk).toBe(before);
  expect(s.model.getSnapshot().pending?.key).toBe(r.token);
});
test('password recovery stores no password or password hash, including unknown response', async () => {
  const s = setup();
  const r = await prepared(s, 'motherPassword');
  s.request.mockRejectedValueOnce(new MobileApiError(0, 'network_error', 'lost'));
  await s.model.commit(r);
  expect(writes(s)[0]![1]!.body).toEqual({ newPassword: 'private-password' });
  expect(s.disk).not.toContain('private-password');
  expect(s.disk).not.toContain('newPassword');
  expect(parseJournal(s.disk)).toMatchObject({ sensitive: true });
});
test('known pre-insert 400 clears unresolved marker without erasing future ability to review', async () => {
  const s = setup();
  const r = await prepared(s);
  s.request.mockRejectedValueOnce(new MobileApiError(400, 'invalid_input', 'bad'));
  await s.model.commit(r);
  expect(s.model.getSnapshot().pending).toBeNull();
  expect(s.model.getSnapshot().journalToken).toBeNull();
  expect(() => s.model.review(action('mother', { name: 'Again' }, null))).not.toThrow();
});
test('unknown 404/409 or malformed receipt retains recovery barrier', async () => {
  for (const error of [
    new MobileApiError(404, 'not_found', 'missing'),
    new MobileApiError(409, 'business_rule', 'unknown'),
    null,
  ]) {
    const s = setup();
    const r = await prepared(s);
    if (error) s.request.mockRejectedValueOnce(error);
    else s.request.mockResolvedValueOnce({ unexpected: true });
    await s.model.commit(r);
    expect(s.model.getSnapshot().pending).not.toBeNull();
    expect(s.model.getSnapshot().notice).toBeNull();
  }
});
test('double taps and consumed reviews never repeat a creation', async () => {
  const s = setup();
  const r = await prepared(s);
  await Promise.all([s.model.commit(r), s.model.commit(r)]);
  await s.model.commit(r);
  expect(writes(s)).toHaveLength(1);
});
test('concurrent controllers reject a stale review after a successful intervening creation', async () => {
  const s = setup();
  await s.model.recover();
  const other = createAdminController(s.options);
  await other.recover();
  const a = s.model.review(action('mother', { name: 'Test' }, null)),
    b = other.review(action('mother', { name: 'Test' }, null));
  await Promise.all([s.model.commit(a), other.commit(b)]);
  expect(writes(s)).toHaveLength(1);
  expect(other.getSnapshot().issue).toMatchObject({ code: 'state_changed' });
});
test('explicit checked-result clearing retains a revision tombstone and permits a new review', async () => {
  const s = setup();
  const r = await prepared(s);
  s.request.mockRejectedValueOnce(new MobileApiError(0, 'network_error', 'lost'));
  await s.model.commit(r);
  const pending = s.model.getSnapshot().pending!;
  await s.model.clearReviewed(pending);
  expect(s.model.getSnapshot().pending).toBeNull();
  expect(parseJournal(s.disk)).toMatchObject({ resolved: true });
  expect(() => s.model.review(action('mother', { name: 'Another' }, null))).not.toThrow();
  expect(writes(s)).toHaveLength(1);
});
test('stale checked-result review cannot release a newer unresolved action', async () => {
  const s = setup();
  const r = await prepared(s);
  s.request.mockRejectedValueOnce(new MobileApiError(0, 'network_error', 'lost'));
  await s.model.commit(r);
  const original = s.model.getSnapshot().pending!;
  const newer = { ...original, token: 'miaa-admin-99999999-9999-9999-9999-999999999999' };
  s.setDisk(JSON.stringify(newer));
  await s.model.clearReviewed(original);
  expect(parseJournal(s.disk)?.token).toBe(newer.token);
  expect(s.model.getSnapshot().pending?.token).toBe(newer.token);
});
test('confirmed receipt persistence failure keeps the unresolved barrier', async () => {
  const s = setup();
  const r = await prepared(s);
  const save = jest.mocked(s.store.write).getMockImplementation()!;
  jest.mocked(s.store.write).mockImplementation(async (raw) => {
    if (JSON.parse(raw).confirmed) throw new Error('disk');
    await save(raw);
  });
  await s.model.commit(r);
  expect(s.model.getSnapshot().pending).not.toBeNull();
  expect(s.model.getSnapshot().notice).toBeNull();
  expect(writes(s)).toHaveLength(1);
});
test('only watched resources refresh after success, not all historical reads', async () => {
  const s = setup();
  await s.model.load('clients');
  const leave = s.model.watch('mothers');
  const r = await prepared(s);
  s.request.mockClear();
  await s.model.commit(r);
  expect(s.request.mock.calls.map((x) => x[0])).toEqual(['admin/mothers', 'admin/mothers']);
  leave();
});
test('review body is a deep copy of the editor and unissued reviews cannot mutate', async () => {
  const s = setup();
  await s.model.recover();
  const body = structuredClone(adminOrderBody);
  const r = s.model.review(action('order', body, null));
  (body.dishPattern as Row)['1'] = 999;
  await s.model.commit(r);
  expect((writes(s)[0]![1]!.body as Row).dishPattern).toEqual(adminOrderBody.dishPattern);
  await s.model.commit({
    action: action('mother', {}, null),
    token: 'fake',
    previous: null,
    day: '2026-10-26',
  });
  expect(writes(s)).toHaveLength(1);
});
test('superseded reads abort and cannot publish late results', async () => {
  const s = setup();
  const d = deferred<unknown>();
  s.request.mockImplementationOnce(() => d.promise);
  const old = s.model.load('mothers/1');
  const signal = s.request.mock.calls[0]![1]!.signal;
  await s.model.load('mothers/1');
  d.resolve({ ...adminMother, name: 'Old' });
  await old;
  expect(signal?.aborted).toBe(true);
  expect((s.model.getSnapshot().resources['mothers/1']?.data as Row).name).toBe('Test Kitchen');
});
test('read Retry-After blocks writes until controller cooldown expires', async () => {
  jest.useFakeTimers();
  try {
    const s = setup();
    const r = await prepared(s);
    s.request.mockRejectedValueOnce(new MobileApiError(429, 'rate_limited', 'wait', undefined, 2));
    await s.model.load('mothers');
    await s.model.commit(r);
    expect(writes(s)).toHaveLength(0);
    jest.advanceTimersByTime(2000);
    expect(s.model.getSnapshot().retryAt).toBe(0);
    s.model.dispose();
  } finally {
    jest.useRealTimers();
  }
});
test('disposal between persistence and POST leaves recovery data and sends nothing', async () => {
  const s = setup();
  const r = await prepared(s);
  jest.mocked(s.store.write).mockImplementationOnce(async (raw) => {
    s.setDisk(raw);
    s.model.dispose();
  });
  await s.model.commit(r);
  expect(writes(s)).toHaveLength(0);
  expect(s.disk).not.toBeNull();
});
test('malicious stored endpoint, method and password content fail journal recovery', () => {
  const base = {
    v: 1,
    token: 'miaa-admin-12345678-1234-1234-1234-123456789012',
    form: 'motherPassword',
    path: 'mothers/1/password',
    method: 'PATCH',
    sensitive: true,
    startedAt: new Date(adminNow).toISOString(),
    confirmed: false,
    resolved: false,
    resultId: null,
  };
  expect(parseJournal(JSON.stringify(base))).toMatchObject({ sensitive: true });
  for (const bad of [
    { path: 'finance' },
    { method: 'DELETE' },
    { body: { newPassword: 'secret' } },
    { token: 'not-a-key' },
  ])
    expect(() => parseJournal(JSON.stringify({ ...base, ...bad }))).toThrow();
});
const mutations: [string, number | null, Row, unknown][] = [
  ['mother', null, { name: 'New' }, { id: 12 }],
  ['mother', 1, { name: 'Edited' }, { id: 1 }],
  ['cyclist', null, { name: 'New' }, { id: 12 }],
  ['cyclist', 2, { name: 'Edited' }, { id: 2 }],
  ['client', null, { name: 'New' }, { id: 12 }],
  ['client', 3, { name: 'Edited' }, { id: 3 }],
  ['dish', null, { nameEn: 'New' }, { id: 12 }],
  ['dish', 4, { active: false }, { id: 4 }],
  ['package', null, { labelEn: 'New' }, { id: 12 }],
  ['package', 6, { active: false }, { id: 6 }],
  ['offering', 1, { motherId: 1, packageTypeId: 6, priceEtb: '100', active: true }, { ok: true }],
  ['inspection', 1, { motherId: 1, inspectedAt: '2026-10-26' }, { id: 1 }],
  ['motherStatus', 1, { status: 'inactive' }, { id: 1, status: 'inactive' }],
  ['cyclistStatus', 2, { status: 'inactive' }, { id: 2, status: 'inactive' }],
  ['motherPassword', 1, { newPassword: 'secret-123' }, { ok: true }],
  ['cyclistPassword', 2, { newPassword: 'secret-123' }, { ok: true }],
  ['ticket', null, { motherId: 1, message: 'Help' }, { id: 12, motherId: 1, message: 'Help' }],
  ['resolveTicket', 11, {}, { id: 11, status: 'resolved' }],
  ['reopenTicket', 11, {}, { id: 11, status: 'open' }],
  [
    'assignment',
    8,
    { motherId: 1, cyclistId: 2 },
    { id: 8, status: 'preparing', assignedMotherId: 1, assignedCyclistId: 2 },
  ],
  ['changeDish', 8, { dishId: 4 }, { id: 8, status: 'preparing', dishId: 4 }],
  ['packageDelivery', 8, {}, { id: 8, status: 'packaged' }],
  ['collectDelivery', 8, {}, { id: 8, status: 'out_for_delivery' }],
  ['confirmDelivery', 8, {}, { id: 8, status: 'delivered' }],
  [
    'redelivery',
    8,
    { deliveryDate: '2026-10-27', reason: 'Replacement' },
    {
      id: 12,
      deliveryDate: '2026-10-27',
      isCompRedelivery: true,
      status: 'preparing',
      orderStickerId: 'MA-9-01-R1',
    },
  ],
  ['paymentConfirm', 10, { reference: 'CASH-1' }, { payment: { id: 10, status: 'confirmed' } }],
  ['failPayment', 10, {}, { id: 10, status: 'failed' }],
  [
    'cancelOrder',
    9,
    {},
    {
      subscription: { ...adminSub, status: 'cancelled' },
      refundDue: true,
      deliveredCount: 0,
      cancelledDeliveries: 5,
    },
  ],
];
test.each(mutations)(
  'reviewed %s action accepts its real acknowledgement shape',
  async (kind, target, body, result) => {
    const s = setup();
    await s.model.recover();
    const r = s.model.review(action(kind as Parameters<typeof action>[0], body, target));
    s.request.mockResolvedValueOnce(result);
    await s.model.commit(r);
    expect(writes(s)).toHaveLength(1);
    expect(s.model.getSnapshot().notice).toBe('saved');
    expect(s.model.getSnapshot().pending).toBeNull();
    expect(parseJournal(s.disk)).toMatchObject({ confirmed: true });
    if (['offering', 'inspection', 'redelivery'].includes(kind))
      expect(writes(s)[0]![1]!.method).toBe('POST');
  },
);
