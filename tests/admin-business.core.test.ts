import { MobileApiError, type RequestOptions } from '@miaa/api';
import { parseRead, safePath, type Row } from '../packages/admin-portal/src/contracts';
import {
  businessIdentity,
  periodPath,
  range,
  recordKinds,
  reports,
} from '../packages/admin-portal/src/business-contracts';
import { thousandths } from '../packages/admin-portal/src/business-forms';
import {
  action,
  initial,
  validate,
  validateAction,
  guardData,
  type FormKind,
} from '../packages/admin-portal/src/forms';
import {
  createAdminController,
  parseJournal,
  type ActionStore,
} from '../packages/admin-portal/src/controller';
import {
  businessReads,
  ledger,
  stock,
  movement,
  payout,
  bin,
  financeBody,
  payoutBody,
  stockBody,
  movementBody,
} from './fixtures/admin-business';
const now = Date.parse('2026-10-26T07:30:00Z');
const options = { stock: [stock], payees: [payout], mothers: [], cyclists: [] };
const draft = (kind: FormKind, body: Row) => ({
  ...initial(kind),
  ...Object.fromEntries(
    Object.entries(body).map(([k, v]) => [k, typeof v === 'boolean' ? v : String(v)]),
  ),
});
const period = '?from=2026-10-01&to=2026-10-26';
test.each(Object.keys(businessReads))('parses actual business DTO %s', (key) => {
  const path =
    key === 'payouts' || key === 'finance/summary' || key.startsWith('analytics/')
      ? key + period
      : key;
  expect(() => parseRead(path, businessReads[key])).not.toThrow();
});
test.each([
  'finance?from=2026-02-30',
  'finance?direction=bad',
  'finance?category=bad',
  'finance?from=2026-10-27&to=2026-10-26',
  'finance?from=2026-10-01&from=2026-10-02',
  'finance?search=x',
  'finance/summary',
  'payouts?from=2026-10-01',
  'analytics/unknown' + period,
  'analytics/revenue' + period + '&direction=income',
  'stock?includeInactive=1',
  'stock/0',
  'stock/2147483648',
  'stock/31/movements?search=x',
  'recycle-bin?kind=mother',
  'finance#x',
  'finance??x',
  'analytics/revenue?from=2024-01-01&to=2026-01-01',
])('blocks unapproved query %s', (path) => expect(() => safePath(path)).toThrow());
test('period bounds are inclusive, calendar-valid and use 366-day difference', () => {
  expect(range('2024-01-01', '2025-01-01')).toEqual({ from: '2024-01-01', to: '2025-01-01' });
  expect(() => range('2024-01-01', '2025-01-02')).toThrow();
  expect(() => range('0000-01-01', '0000-01-01')).toThrow();
  expect(() => periodPath('orders', '2026-10-01', '2026-10-26')).toThrow();
});
test('negative and aggregate report values retain exact decimal strings', () => {
  const r = parseRead('finance/summary' + period, businessReads['finance/summary']) as Row;
  expect(r.totals).toMatchObject({ income: '1000000000.00', net: '-12.50', entryCount: 501 });
});
test('person and archive identities include kind even when numeric IDs coincide', () => {
  const data = parseRead('payouts' + period, businessReads.payouts);
  expect(businessIdentity(data, 'cyclist:1').personName).toBe('Rider One');
  expect(guardData(parseRead('recycle-bin', bin), undefined, 'mother:1')).toMatchObject({
    label: 'Kitchen One',
  });
  expect(() => businessIdentity(data, 'mother:2')).toThrow();
  expect(() => parseRead('payouts' + period, [payout, payout])).toThrow();
  expect(() => parseRead('recycle-bin', [bin[0], bin[0]])).toThrow();
  expect(() => parseRead('recycle-bin', [{ ...bin[0], items: bin[1]!.items }])).toThrow();
});
test.each(['bad', 1, NaN, '1e3', '1.1234', '9999999999', '--1'])(
  'rejects invalid quantity %s',
  (v) => expect(() => thousandths(v)).toThrow(),
);
test('stock arithmetic uses exact thousandths', () => {
  expect(thousandths('999999999.999')).toBe(999999999999n);
  expect(thousandths('-0.001')).toBe(-1n);
  expect(thousandths('0.10') + thousandths('0.20')).toBe(300n);
});
test.each([
  ['financeEntry', financeBody],
  ['payout', payoutBody],
  ['stockItem', stockBody],
  ['stockMovement', movementBody],
] as const)('validated %s has correct write semantics', (kind, body) => {
  const checked = validate(kind, draft(kind, body), options, now);
  expect(checked).toMatchObject(body);
  const a = action(kind, checked, kind === 'stockItem' ? 31 : null);
  expect(validateAction(a)).toMatchObject({ form: kind, path: a.path, body: checked });
  expect(a.method).toBe(kind === 'stockItem' ? 'PATCH' : 'POST');
});
test.each(['0', '-1', '1e2', '1000000000', '1.001'])('invalid finance amount %s', (amount) =>
  expect(() =>
    validate(
      'financeEntry',
      draft('financeEntry', { ...financeBody, amountEtb: amount }),
      options,
      now,
    ),
  ).toThrow(),
);
test('finance enforces direction/category, real calendar, positive amount, URL safety and service description cap', () => {
  for (const change of [
    { direction: 'income' },
    { occurredOn: '2026-10-27' },
    { occurredOn: '2026-02-30' },
    { description: 'x'.repeat(501) },
    { receiptUrl: 'javascript:alert(1)' },
    { receiptUrl: 'https://user:secret@example.com' },
  ] as Row[])
    expect(() =>
      validate('financeEntry', draft('financeEntry', { ...financeBody, ...change }), options, now),
    ).toThrow();
  expect(
    validate(
      'financeEntry',
      draft('financeEntry', { ...financeBody, receiptUrl: 'https://receipts.example/21' }),
      options,
      now,
    ).receiptUrl,
  ).toBe('https://receipts.example/21');
});
test('payouts select an exact report person and allow deliberate overpayment', () => {
  expect(validate('payout', draft('payout', payoutBody), options, now).amountEtb).toBe('5.00');
  expect(() =>
    validate('payout', draft('payout', { ...payoutBody, kind: 'cyclist' }), options, now),
  ).toThrow();
});
test('stock positive-magnitude consumption blocks shortages; adjustments allow signed corrections', () => {
  for (const quantity of ['0', '-1', '2.126'])
    expect(() =>
      validate(
        'stockMovement',
        draft('stockMovement', {
          ...movementBody,
          movementType: 'consumption',
          quantity,
          unitCostEtb: '',
          createExpense: false,
        }),
        options,
        now,
      ),
    ).toThrow();
  const body = validate(
    'stockMovement',
    draft('stockMovement', { ...movementBody, movementType: 'consumption', quantity: '2.125' }),
    options,
    now,
  );
  expect(body).toMatchObject({ quantity: '2.125', createExpense: false });
  expect(body).not.toHaveProperty('unitCostEtb');
  expect(
    validate(
      'stockMovement',
      draft('stockMovement', { ...movementBody, movementType: 'adjustment', quantity: '-3.000' }),
      options,
      now,
    ).quantity,
  ).toBe('-3.000');
});
test('whole units, purchase expense requirements, inactive stock and thresholds are checked', () => {
  expect(() =>
    validate(
      'stockMovement',
      draft('stockMovement', movementBody),
      { ...options, stock: [{ ...stock, unit: 'piece' }] },
      now,
    ),
  ).toThrow();
  expect(() =>
    validate(
      'stockMovement',
      draft('stockMovement', movementBody),
      { ...options, stock: [{ ...stock, active: false }] },
      now,
    ),
  ).toThrow();
  const d = draft('stockMovement', movementBody);
  d.unitCostEtb = '';
  expect(() => validate('stockMovement', d, options, now)).toThrow();
  for (const threshold of ['-1', '0.1234'])
    expect(() =>
      validate(
        'stockItem',
        draft('stockItem', { ...stockBody, reorderThreshold: threshold }),
        options,
        now,
      ),
    ).toThrow();
});
test('purchase expense validates database cost precision and server-rounded zero/overflow bounds', () => {
  for (const change of [
    { unitCostEtb: '100000000.00' },
    { unitCostEtb: '0.00' },
    { unitCostEtb: '0.01', quantity: '0.001' },
    { unitCostEtb: '99999999.99', quantity: '999999999.999' },
  ] as Row[])
    expect(() =>
      validate(
        'stockMovement',
        draft('stockMovement', { ...movementBody, ...change }),
        options,
        now,
      ),
    ).toThrow();
  expect(
    validate(
      'stockMovement',
      draft('stockMovement', { ...movementBody, unitCostEtb: '0.01', quantity: '0.500' }),
      options,
      now,
    ).createExpense,
  ).toBe(true);
});
test.each(recordKinds)(
  'archive and restore %s use fixed kind paths and bodyless methods',
  (kind) => {
    for (const form of ['archiveRecord', 'restoreRecord'] as const) {
      const a = action(form, { recordKind: kind }, 1);
      expect(a.method).toBe(form === 'archiveRecord' ? 'DELETE' : 'POST');
      expect(a.body).toBeUndefined();
      expect(validateAction(a)).toEqual(a);
    }
  },
);
test('arbitrary tables, injected record paths and malformed persisted financial details fail closed', () => {
  for (const kind of ['admins', '__proto__', 'mother/1/restore', 'toString'])
    expect(() => action('archiveRecord', { recordKind: kind }, 1)).toThrow();
  for (const body of [
    { ...financeBody, amountEtb: 12.5 },
    { ...financeBody, description: '' },
    { ...financeBody, direction: 'income' },
    { ...financeBody, extra: true },
  ])
    expect(() => validateAction(action('financeEntry', body, null))).toThrow();
  expect(() =>
    validateAction({ ...action('archiveRecord', { recordKind: 'mother' }, 1), body: {} }),
  ).toThrow();
});
test('response validation rejects NaN rates, duplicate rows, wrong item history and invalid nested totals', () => {
  expect(() => parseRead('payouts' + period, [{ ...payout, rateEtb: NaN }])).toThrow();
  expect(() => parseRead('stock/31/movements', [{ ...movement, stockItemId: 32 }])).toThrow();
  expect(() => parseRead('stock/31', { ...stock, id: 32 })).toThrow();
  expect(() =>
    parseRead('analytics/unit-economics' + period, {
      ...(businessReads['analytics/unit-economics'] as Row),
      lowConfidence: 'true',
    }),
  ).toThrow();
  expect(() =>
    parseRead('analytics/cyclists' + period, [
      { cyclistId: 1, cyclistName: 'Rider', assigned: 1, delivered: 1, completionRate: NaN },
    ]),
  ).toThrow();
  expect(reports).toHaveLength(6);
});

function setup() {
  let disk: string | null = null,
    serial = 0;
  let queue: Promise<unknown> = Promise.resolve();
  const store: ActionStore = {
    read: jest.fn(async () => disk),
    write: jest.fn(async (v) => {
      disk = v;
    }),
    clear: jest.fn(async () => {
      disk = null;
    }),
    exclusive: (work) => {
      const task = queue.catch(() => undefined).then(work);
      queue = task;
      return task;
    },
  };
  const data = structuredClone(businessReads);
  const request = jest.fn(async (path: string, input?: RequestOptions): Promise<unknown> => {
    const key = path.replace('admin/', '').split('?')[0]!;
    if (!input?.method || input.method === 'GET') return structuredClone(data[key]);
    expect(parseJournal(disk)?.confirmed).toBe(false);
    if (key === 'finance') return { ...ledger, ...(input.body as Row) };
    if (key === 'payouts')
      return { ...ledger, amountEtb: '5.00', category: 'mother_payout', relatedMotherId: 1 };
    if (key === 'stock/31' || key === 'stock') return { ...stock, ...(input.body as Row) };
    if (key === 'stock/movements')
      return { movement, newQuantity: '4.250', financeEntryId: 21, totalCostEtb: '21.25' };
    return { ok: true };
  });
  const opts = {
    request: request as <T>(p: string, o?: RequestOptions) => Promise<T>,
    store,
    randomKey: () => `miaa-admin-12345678-1234-1234-1234-${String(++serial).padStart(12, '0')}`,
    now: () => now,
  };
  const model = createAdminController(opts);
  return {
    model,
    store,
    request,
    data,
    opts,
    get disk() {
      return disk;
    },
    setDisk: (v: string | null) => {
      disk = v;
    },
  };
}
const writes = (s: ReturnType<typeof setup>) =>
  s.request.mock.calls.filter((c) => c[1]?.method && c[1].method !== 'GET');
test.each([
  ['financeEntry', financeBody, null],
  ['payout', payoutBody, null],
  ['stockItem', stockBody, 31],
  ['stockMovement', movementBody, 31],
] as const)('durable reviewed %s write saves a minimal receipt', async (kind, body, target) => {
  const s = setup();
  await s.model.recover();
  const review = s.model.review(action(kind, body, target));
  expect(writes(s)).toHaveLength(0);
  await s.model.commit(review);
  expect(writes(s)).toHaveLength(1);
  expect(s.model.getSnapshot()).toMatchObject({ notice: 'saved', pending: null });
  expect(parseJournal(s.disk)).toMatchObject({ confirmed: true, form: kind });
  expect(parseJournal(s.disk)?.body).toBeUndefined();
  await s.model.commit(review);
  expect(writes(s)).toHaveLength(1);
  s.model.dispose();
});
test('archive and restoration bind fresh composite targets and keep bodyless durable DELETE/POST methods', async () => {
  const s = setup();
  await s.model.recover();
  const data = await s.model.load('recycle-bin');
  const item = businessIdentity(data!, 'mother:1');
  const guard = { path: 'recycle-bin', key: 'mother:1', fingerprint: JSON.stringify(item) };
  await s.model.commit(s.model.review(action('restoreRecord', { recordKind: 'mother' }, 1, guard)));
  expect(writes(s)[0]).toMatchObject(['admin/records/mother/1/restore', { method: 'POST' }]);
  expect(writes(s)[0]![1]).not.toHaveProperty('body');
  await s.model.commit(s.model.review(action('archiveRecord', { recordKind: 'client' }, 1)));
  expect(writes(s)[1]).toMatchObject(['admin/records/client/1', { method: 'DELETE' }]);
  expect(parseJournal(s.disk)).toMatchObject({ confirmed: true, method: 'DELETE' });
  s.model.dispose();
});
test('payout preflight blocks a changed historical report; same ID in another role cannot satisfy it', async () => {
  const s = setup();
  await s.model.recover();
  const path = 'payouts' + period,
    data = await s.model.load(path);
  const r = s.model.review(
    action('payout', payoutBody, null, {
      path,
      key: 'mother:1',
      fingerprint: JSON.stringify(businessIdentity(data!, 'mother:1')),
    }),
  );
  s.data.payouts = [{ ...payout, alreadyPaidEtb: '45.00' }, (businessReads.payouts as Row[])[1]!];
  await s.model.commit(r);
  expect(writes(s)).toHaveLength(0);
  expect(s.model.getSnapshot().issue).toMatchObject({ code: 'state_changed' });
  s.model.dispose();
});
test.each(['financeEntry', 'payout', 'stockMovement', 'archiveRecord', 'restoreRecord'] as const)(
  'uncertain %s remains blocked across restart, without automatic resend',
  async (kind) => {
    const s = setup();
    await s.model.recover();
    s.request.mockRejectedValueOnce(new MobileApiError(0, 'network_error', 'Lost response'));
    const body =
      kind === 'financeEntry'
        ? financeBody
        : kind === 'payout'
          ? payoutBody
          : kind === 'stockMovement'
            ? movementBody
            : { recordKind: 'mother' };
    await s.model.commit(s.model.review(action(kind, body, 1)));
    expect(writes(s)).toHaveLength(1);
    expect(parseJournal(s.disk)).toMatchObject({ form: kind, confirmed: false });
    const restarted = createAdminController(s.opts);
    await restarted.recover();
    expect(restarted.getSnapshot().pending?.form).toBe(kind);
    expect(() => restarted.review(action('financeEntry', financeBody, null))).toThrow();
    await restarted.retryOrder();
    expect(writes(s)).toHaveLength(1);
    await restarted.clearReviewed(restarted.getSnapshot().pending!);
    expect(parseJournal(s.disk)).toMatchObject({ resolved: true, form: kind });
    s.model.dispose();
    restarted.dispose();
  },
);
test('invalid movement acknowledgement and journal failure do not report success or permit duplicate writes', async () => {
  const s = setup();
  await s.model.recover();
  s.request.mockResolvedValueOnce({
    movement: { ...movement, stockItemId: 32 },
    newQuantity: '4.25',
    financeEntryId: 21,
    totalCostEtb: '21.25',
  });
  await s.model.commit(s.model.review(action('stockMovement', movementBody, null)));
  expect(s.model.getSnapshot()).toMatchObject({ notice: null, pending: { form: 'stockMovement' } });
  expect(writes(s)).toHaveLength(1);
  s.model.dispose();
  const t = setup();
  await t.model.recover();
  (t.store.write as jest.Mock).mockRejectedValueOnce(new Error('Disk full'));
  await t.model.commit(t.model.review(action('financeEntry', financeBody, null)));
  expect(writes(t)).toHaveLength(0);
  expect(t.model.getSnapshot().storageReady).toBe(false);
  t.model.dispose();
});
