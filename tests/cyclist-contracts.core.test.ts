import {
  dateOnly,
  mapURL,
  normalizeSticker,
  parseDishes,
  parseEarnings,
  parseItem,
  parseReceipt,
  parseRun,
  phoneURL,
  todayEAT,
} from '../packages/cyclist-portal/src/contracts';
import {
  collectItem,
  confirmItem,
  cyclistDishes,
  cyclistEarnings,
  cyclistRun,
  deliveryReceipt,
} from './fixtures/cyclist';
test('Cyclist DTOs accept the actual backend shapes', () => {
  expect(parseRun(cyclistRun, '2026-10-26')).toEqual(cyclistRun);
  expect(parseItem(collectItem)).toEqual(collectItem);
  expect(parseDishes(cyclistDishes)).toEqual(cyclistDishes);
  expect(parseEarnings(cyclistEarnings)).toEqual(cyclistEarnings);
});
test.each(['date', 'deadline', 'readyToCollect', 'stillCooking', 'total', 'compMealTaken'])(
  'malformed run %s fails closed',
  (key) => expect(() => parseRun({ ...cyclistRun, [key]: null }, '2026-10-26')).toThrow(),
);
test('mismatched date, bucket state, duplicated IDs or totals fail closed', () => {
  for (const bad of [
    { ...cyclistRun, date: '2026-10-27' },
    { ...cyclistRun, readyToCollect: [confirmItem] },
    { ...cyclistRun, onTheWay: [{ ...collectItem, status: 'out_for_delivery' }] },
    { ...cyclistRun, total: 99 },
  ])
    expect(() => parseRun(bad, '2026-10-26')).toThrow();
});
test.each([
  { latitude: NaN },
  { latitude: 91 },
  { longitude: 181 },
  { longitude: '38.75' },
  { clientPhone: null },
  { status: 'ready' },
  { id: 0 },
])('unsafe item fields %j are refused', (bad) =>
  expect(() => parseItem({ ...collectItem, ...bad })).toThrow(),
);
test('zero and boundary coordinates are valid and safely encoded in a fixed maps URL', () => {
  expect(parseItem({ ...collectItem, latitude: 0, longitude: 0 }).latitude).toBe(0);
  expect(mapURL(0, 0)).toBe('https://www.google.com/maps/search/?api=1&query=0%2C0');
  expect(new URL(mapURL(-90, 180)).hostname).toBe('www.google.com');
  expect(() => mapURL(Infinity, 0)).toThrow();
});
test.each([
  'javascript:alert(1)',
  '+251911111111?x=1',
  '+251911111111\n',
  '123',
  'https://evil.example',
])('unsafe phone %s cannot produce a link', (phone) => expect(phoneURL(phone)).toBeNull());
test('phone formatting is normalized without accepting arbitrary URI schemes', () => {
  expect(phoneURL('+251 (911) 111-111')).toBe('tel:+251911111111');
  expect(phoneURL(null)).toBeNull();
});
test.each([
  [' ma-19-01 ', 'MA-19-01'],
  ['19-01', 'MA-19-01'],
  [' 20 - 01 - r1 ', 'MA-20-01-R1'],
])('lookup %s uses exact canonical sticker %s', (value, expected) =>
  expect(normalizeSticker(value)).toBe(expected),
);
test.each(['', ' '.repeat(5), 'a'.repeat(101), 'MA-1\n-01'])(
  'invalid lookup %j is rejected',
  (value) => expect(() => normalizeSticker(value)).toThrow(),
);
test('EAT date rolls over at 21:00 UTC and rejects invalid date-only strings', () => {
  expect(todayEAT(Date.parse('2026-10-26T20:59:59Z'))).toBe('2026-10-26');
  expect(todayEAT(Date.parse('2026-10-26T21:00:00Z'))).toBe('2026-10-27');
  expect(() => dateOnly('2026-02-30')).toThrow();
});
test('earnings accept decimal strings without calculating money, reject malformed counts/rates', () => {
  for (const bad of [
    { ratePerDelivery: '-1.00' },
    { ratePerDelivery: 'NaN' },
    { deliveriesToday: 6 },
    { deliveriesThisWeek: 1.2 },
  ])
    expect(() => parseEarnings({ ...cyclistEarnings, ...bad })).toThrow();
  expect(() => parseDishes([...cyclistDishes, ...cyclistDishes])).toThrow();
});
test('receipts bind ID, sticker, target state and cyclist confirmation timestamp', () => {
  expect(() =>
    parseReceipt(deliveryReceipt(collectItem, 'collect'), collectItem, 'collect'),
  ).not.toThrow();
  expect(() =>
    parseReceipt(deliveryReceipt(confirmItem, 'confirm'), confirmItem, 'confirm'),
  ).not.toThrow();
  for (const bad of [
    { id: 99 },
    { stickerId: 'MA-OTHER' },
    { status: 'packaged' },
    { cyclistConfirmedAt: null },
  ])
    expect(() =>
      parseReceipt({ ...deliveryReceipt(confirmItem, 'confirm'), ...bad }, confirmItem, 'confirm'),
    ).toThrow();
});
