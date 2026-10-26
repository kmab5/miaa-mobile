import {
  choices,
  coordinates,
  eatDate,
  isDate,
  journal,
  orderDetail,
  payload,
  profile,
  validateChoices,
} from '../packages/client-portal/src/validation';
import {
  clientProfile,
  clientDishes,
  clientOffering,
  clientPayload,
  clientDetail,
} from './fixtures/client';
test('exact Client DTOs from the backend portal are accepted', () => {
  expect(profile(clientProfile)).toEqual(clientProfile);
  expect(orderDetail(clientDetail)).toEqual(clientDetail);
  expect(validateChoices(clientPayload, clientOffering, clientDishes, '2026-10-26')).toEqual(
    clientPayload,
  );
});
test.each([
  ['', '38'],
  ['9', ''],
  ['90.1', '0'],
  ['0', '-180.1'],
  ['NaN', '38'],
  ['Infinity', '0'],
])('invalid location %s/%s is refused', (lat, lon) => {
  expect(() => coordinates(lat, lon)).toThrow();
});
test('zero coordinates are valid and never treated as missing', () =>
  expect(coordinates('0', '0')).toEqual({ latitude: 0, longitude: 0 }));
test.each(['2026-13-01', '2026-02-30', '2026-01-00', '2026-99-99', 'not-a-date', '2026-1-01'])(
  'invalid date %s is refused safely',
  (value) => expect(isDate(value)).toBe(false),
);
test('Ethiopian date changes at 21:00 UTC', () =>
  expect(eatDate(Date.parse('2026-10-26T21:00:00Z'))).toBe('2026-10-27'));
test('combined packages use fasting dishes Wednesday and Friday only', () => {
  for (let d = 1; d <= 5; d++)
    expect(choices(clientDishes, 'combined', d).map((v) => v.id)).toEqual([
      d === 3 || d === 5 ? 1 : 2,
    ]);
});
test('inactive dishes cannot be chosen', () =>
  expect(
    choices(
      clientDishes.map((d) => ({ ...d, active: false })),
      'demo',
      1,
    ),
  ).toEqual([]));
test('all five required weekdays must be chosen with valid fasting composition', () => {
  expect(() =>
    validateChoices(
      { ...clientPayload, dishPattern: { '1': 2 } },
      clientOffering,
      clientDishes,
      '2026-10-26',
    ),
  ).toThrow();
  expect(() =>
    validateChoices(
      { ...clientPayload, dishPattern: { ...clientPayload.dishPattern, '3': 2 } },
      clientOffering,
      clientDishes,
      '2026-10-26',
    ),
  ).toThrow();
});
test.each(['2026-10-26', '2026-10-25', '2026-10-31', '2026-11-01'])(
  'demo date %s must be a future weekday',
  (date) => {
    expect(() =>
      validateChoices(
        { ...clientPayload, demoDate: date, dishPattern: { '1': 1 } },
        { ...clientOffering, duration: 'demo', foodCategory: 'demo' },
        clientDishes,
        '2026-10-26',
      ),
    ).toThrow();
  },
);
test('a future demo weekday accepts either active dish', () => {
  for (const id of [1, 2])
    expect(() =>
      validateChoices(
        { ...clientPayload, demoDate: '2026-10-27', dishPattern: { '1': id } },
        { ...clientOffering, duration: 'demo', foodCategory: 'demo' },
        clientDishes,
        '2026-10-26',
      ),
    ).not.toThrow();
});
test('payload never accepts client IDs or commercial price overrides', () => {
  expect(() => payload({ ...clientPayload, clientId: 9 })).toThrow();
  expect(() => payload({ ...clientPayload, priceEtb: '1' })).toThrow();
});
test('payload copies the draft so later edits cannot change a saved intention', () => {
  const draft = structuredClone(clientPayload);
  const result = payload(draft);
  draft.dishPattern['1'] = 99;
  expect(result.dishPattern['1']).toBe(2);
});
test('dish keys and text bounds match server validation', () => {
  expect(() => payload({ ...clientPayload, dishPattern: { '6': 1 } })).toThrow();
  expect(() => payload({ ...clientPayload, notes: 'x'.repeat(1001) })).toThrow();
  expect(() => payload({ ...clientPayload, paymentReference: 'x'.repeat(121) })).toThrow();
});
test('journal validates owner, version and key without clearing damaged records', () => {
  for (const change of [
    { owner: 8 },
    { version: 2 },
    { key: 'bad?key' },
    { createdAt: 'bad' },
    { body: {} },
  ])
    expect(() =>
      journal(
        JSON.stringify({
          version: 1,
          owner: 7,
          key: 'valid-key-123',
          createdAt: new Date().toISOString(),
          state: 'uncertain',
          body: clientPayload,
          ...change,
        }),
        7,
      ),
    ).toThrow();
});

test('a partial legacy location can be completed rather than blocking the profile form', () => {
  expect(profile({ ...clientProfile, latitude: null, hasLocation: false }).hasLocation).toBe(false);
});

test('combined demo composition follows the actual delivery weekday', () => {
  const o = { ...clientOffering, duration: 'demo' as const };
  expect(() =>
    validateChoices(
      { ...clientPayload, demoDate: '2026-10-28', dishPattern: { '1': 1 } },
      o,
      clientDishes,
      '2026-10-26',
    ),
  ).not.toThrow();
  expect(() =>
    validateChoices(
      { ...clientPayload, demoDate: '2026-10-28', dishPattern: { '1': 2 } },
      o,
      clientDishes,
      '2026-10-26',
    ),
  ).toThrow();
});
