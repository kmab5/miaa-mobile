import {
  canPackage,
  parseDay,
  parseDishes,
  parseTickets,
  parsePackaged,
  parseMarker,
  ticketMessage,
  todayEAT,
  validDate,
} from '../packages/mother-portal/src/contracts';
import {
  motherDay,
  motherDishes,
  motherTickets,
  motherNow,
  packagedResponse,
} from './fixtures/mother';
// Dictionary imports include a hook but do not render a native tree.
test('backend Mother DTOs validate with nullable legacy fields', () => {
  expect(parseDay(motherDay)).toEqual(motherDay);
  expect(parseDishes(motherDishes)).toEqual(motherDishes);
  expect(parseTickets(motherTickets)).toEqual(motherTickets);
  expect(() => parsePackaged(packagedResponse, 31)).not.toThrow();
});
test.each(['date', 'deadline', 'items', 'tallies', 'compMealTaken', 'toPrepare'])(
  'malformed day %s fails closed',
  (key) => expect(() => parseDay({ ...motherDay, [key]: null })).toThrow(),
);
test('unknown delivery status and duplicate identifiers are refused', () => {
  expect(() =>
    parseDay({ ...motherDay, items: [{ ...motherDay.items[0], status: 'ready' }] }),
  ).toThrow();
  expect(() => parseDishes([...motherDishes, ...motherDishes])).toThrow();
  expect(() => parseTickets([...motherTickets, ...motherTickets])).toThrow();
});
test('invalid tally bounds and oversized ticket page fail closed', () => {
  expect(() =>
    parseDay({ ...motherDay, tallies: [{ ...motherDay.tallies[0], remaining: 3 }] }),
  ).toThrow();
  expect(() =>
    parseTickets(Array.from({ length: 51 }, (_, i) => ({ ...motherTickets[0], id: i + 1 }))),
  ).toThrow();
});
test.each(['2026-02-30', '0000-01-01', '2026-1-01', 'NaN'])('invalid date %s is refused', (v) =>
  expect(validDate(v)).toBe(false),
);
test('packaging is blocked exactly at 11:00 EAT regardless of stale server flag', () => {
  expect(canPackage(motherDay, 31, motherNow)).toBe(true);
  expect(canPackage(motherDay, 31, Date.parse('2026-10-26T07:59:59.999Z'))).toBe(true);
  expect(canPackage(motherDay, 31, Date.parse('2026-10-26T08:00:00Z'))).toBe(false);
  expect(canPackage({ ...motherDay, deadlinePassed: true }, 31, motherNow)).toBe(false);
});
test('only today’s preparing assigned identifier may be packaged', () => {
  expect(canPackage(motherDay, 32, motherNow)).toBe(false);
  expect(canPackage(motherDay, 99, motherNow)).toBe(false);
  expect(canPackage({ ...motherDay, date: '2026-10-27' }, 31, motherNow)).toBe(false);
  expect(canPackage(null, 31, motherNow)).toBe(false);
});
test('EAT rolls over at 21:00 UTC independently of device timezone', () => {
  expect(todayEAT(Date.parse('2026-10-26T20:59:59Z'))).toBe('2026-10-26');
  expect(todayEAT(Date.parse('2026-10-26T21:00:00Z'))).toBe('2026-10-27');
});
test('a receipt must refer to the requested identifier and packaged state', () => {
  expect(() => parsePackaged({ ...packagedResponse, id: 32 }, 31)).toThrow();
  expect(() => parsePackaged({ ...packagedResponse, status: 'delivered' }, 31)).toThrow();
  expect(() => parsePackaged({ ...packagedResponse, motherConfirmedAt: null }, 31)).toThrow();
});
test('request trimming and exact 2000-character boundary match backend', () => {
  expect(ticketMessage('  እርዳታ  ')).toBe('እርዳታ');
  expect(ticketMessage('a'.repeat(2000))).toHaveLength(2000);
  expect(() => ticketMessage(' ')).toThrow();
  expect(() => ticketMessage('a'.repeat(2001))).toThrow();
});
test('corrupt recovery storage never becomes an empty marker', () => {
  expect(parseMarker(null)).toBeNull();
  for (const raw of ['', '{}', 'null', '{"v":1,"digest":"x"}'])
    expect(() => parseMarker(raw)).toThrow();
});
