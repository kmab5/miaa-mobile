import { parseRead, safePath, board } from '../packages/admin-portal/src/contracts';
import {
  forms,
  initial,
  validate,
  action,
  guardData,
  type FormKind,
} from '../packages/admin-portal/src/forms';
import {
  adminBoard,
  adminClient,
  adminCyclist,
  adminDish,
  adminNonfast,
  adminMother,
  adminOffering,
  adminPackage,
  adminReads,
  adminSettings,
} from './fixtures/admin';
const options = {
  mothers: [adminMother],
  cyclists: [adminCyclist],
  clients: [adminClient],
  dishes: [adminDish, adminNonfast],
  packages: [adminPackage],
  offerings: [adminOffering],
};
test.each(Object.keys(adminReads))('backend Admin read contract: %s', (key) => {
  const path = ['day', 'prep-sheets', 'run-sheets', 'labels'].includes(key)
    ? key + '?date=2026-10-26'
    : key;
  expect(() => parseRead(path, adminReads[key])).not.toThrow();
});
test.each([
  '../day',
  'https://evil.example',
  'finance',
  'records/mothers/1',
  'mothers/0',
  'clients/3?includeInactive=true&x=1',
  'day?date=bad',
  'settings#x',
])('unapproved read path %s is refused', (path) => expect(() => safePath(path)).toThrow());
test('board response binds date, status counts and unique delivery identity', () => {
  expect(() => board({ ...adminBoard, date: '2026-10-27' }, '2026-10-26')).toThrow();
  expect(() => board({ ...adminBoard, total: 99 }, '2026-10-26')).toThrow();
  expect(() => parseRead('clients/999', adminClient)).toThrow();
});
test('read parsers omit server-only/private unrequested keys', () => {
  expect(
    parseRead('clients/3', { ...adminClient, passwordHash: 'secret', userId: 99 }),
  ).not.toHaveProperty('passwordHash');
});
test('people forms normalize phones and preserve zero coordinates', () => {
  const draft = initial('mother', adminMother);
  draft.phoneNumber = '0911111111';
  draft.latitude = '0';
  draft.longitude = '0';
  expect(validate('mother', draft, options)).toMatchObject({
    phoneNumber: '+251911111111',
    latitude: 0,
    longitude: 0,
  });
});
test.each(['', 'NaN', 'Infinity', '91'])('invalid latitude %s blocks form payload', (value) => {
  const draft = initial('client', adminClient);
  draft.latitude = value;
  expect(() => validate('client', draft, options)).toThrow();
});
test.each(['-1', '1.001', 'NaN', '1e3'])(
  'money %s cannot use floats or unsupported precision',
  (value) =>
    expect(() =>
      validate(
        'offering',
        { motherId: '1', packageTypeId: '6', priceEtb: value, active: true },
        options,
      ),
    ).toThrow(),
);
test('inactive selector targets and missing assignments are blocked', () => {
  expect(() => validate('assignment', { motherId: '', cyclistId: '' }, options)).toThrow();
  expect(() =>
    validate(
      'offering',
      { motherId: '1', packageTypeId: '6', priceEtb: '100', active: true },
      { ...options, mothers: [{ ...adminMother, status: 'inactive' }] },
    ),
  ).toThrow();
});
test('staff password validation enforces 8 characters and 72 UTF-8 bytes', () => {
  expect(validate('motherPassword', { newPassword: 'password-123' }, options)).toEqual({
    newPassword: 'password-123',
  });
  expect(() => validate('motherPassword', { newPassword: 'short' }, options)).toThrow();
  expect(() => validate('motherPassword', { newPassword: 'ሀ'.repeat(25) }, options)).toThrow();
});
test('settings validation accepts clearing instructions but rejects invalid clock', () => {
  const draft = initial('settings', adminSettings);
  draft.payInstructions = '';
  expect(validate('settings', draft, options)).not.toHaveProperty('payInstructions');
  draft.prepDeadline = '25:00';
  expect(() => validate('settings', draft, options)).toThrow();
});
test('combined subscription validates weekday dish pattern and strips UI-only mother selector', () => {
  const d = {
    clientId: '3',
    motherId: '1',
    motherOfferingId: '7',
    latitude: '9',
    longitude: '38',
    addressNote: '',
    demoDate: '',
    notes: '',
    paymentMethod: 'cash',
    paymentReference: '',
    weekday1: '5',
    weekday2: '5',
    weekday3: '4',
    weekday4: '5',
    weekday5: '4',
  };
  const body = validate('order', d, options, Date.parse('2026-10-26T07:30:00Z'));
  expect(body.dishPattern).toEqual({ '1': 5, '2': 5, '3': 4, '4': 5, '5': 4 });
  expect(body).not.toHaveProperty('motherId');
  expect(body).not.toHaveProperty('demoDate');
  expect(() => validate('order', { ...d, weekday3: '5' }, options)).toThrow();
});
test('combined demo uses its actual future weekday and only that dish key', () => {
  const d = {
    clientId: '3',
    motherId: '1',
    motherOfferingId: '7',
    latitude: '9',
    longitude: '38',
    addressNote: '',
    demoDate: '2026-10-28',
    notes: '',
    paymentMethod: 'cash',
    paymentReference: '',
    weekday3: '4',
  };
  const opts = { ...options, offerings: [{ ...adminOffering, duration: 'demo' }] };
  expect(validate('order', d, opts, Date.parse('2026-10-26T07:30:00Z')).dishPattern).toEqual({
    '3': 4,
  });
  expect(() => validate('order', { ...d, demoDate: '2026-10-31' }, opts)).toThrow();
});
test('replacement requires a future weekday and audit reason', () => {
  const now = Date.parse('2026-10-26T07:30:00Z');
  expect(() =>
    validate(
      'redelivery',
      { deliveryDate: '2026-10-26', dishId: '4', reason: 'Replacement' },
      options,
      now,
    ),
  ).toThrow();
  expect(
    validate(
      'redelivery',
      { deliveryDate: '2026-10-27', dishId: '4', reason: ' Replacement ' },
      options,
      now,
    ).reason,
  ).toBe('Replacement');
});
const paths: Partial<Record<FormKind, [string, number | null]>> = {
  mother: ['mothers', null],
  cyclist: ['cyclists', null],
  client: ['clients', null],
  dish: ['dishes', null],
  package: ['packages', null],
  offering: ['offerings', null],
  inspection: ['inspections', null],
  ticket: ['tickets', null],
  order: ['orders', null],
  settings: ['settings', null],
  motherPassword: ['mothers/1/password', 1],
  cyclistPassword: ['cyclists/2/password', 2],
  motherStatus: ['mothers/1/status', 1],
  cyclistStatus: ['cyclists/2/status', 2],
  assignment: ['deliveries/8/assignment', 8],
  changeDish: ['deliveries/8/dish', 8],
  redelivery: ['redeliveries', 8],
  paymentConfirm: ['payments/10/confirm', 10],
  packageDelivery: ['deliveries/8/package', 8],
  collectDelivery: ['deliveries/8/collect', 8],
  confirmDelivery: ['deliveries/8/confirm', 8],
  cancelOrder: ['orders/9/cancel', 9],
  failPayment: ['payments/10/fail', 10],
  resolveTicket: ['tickets/11/resolve', 11],
  reopenTicket: ['tickets/11/reopen', 11],
};
test.each(Object.keys(forms) as FormKind[])(
  'form %s has a bounded known action endpoint',
  (kind) => {
    expect(paths[kind]).toBeTruthy();
    const [path, target] = paths[kind]!;
    expect(action(kind, {}, target).path).toBe(path);
  },
);
test('offering preflight guards the exact priced row rather than a UI-only identifier', () =>
  expect(guardData([adminOffering], 7)).toEqual(adminOffering));
