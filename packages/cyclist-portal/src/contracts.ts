import { MobileApiError } from '@miaa/api';
export type Status = 'preparing' | 'packaged' | 'out_for_delivery' | 'delivered' | 'cancelled';
export type RunItem = {
  id: number;
  stickerId: string;
  status: Status;
  dishNameEn: string | null;
  dishNameAm: string | null;
  clientName: string;
  clientPhone: string;
  addressNote: string | null;
  latitude: number;
  longitude: number;
  notes: string | null;
  isCompRedelivery: boolean;
};
export type CyclistDay = {
  cyclistName: string;
  motherName: string | null;
  motherPhone: string | null;
  motherAddress: string | null;
  date: string;
  deadline: string;
  readyToCollect: RunItem[];
  onTheWay: RunItem[];
  delivered: RunItem[];
  stillCooking: number;
  total: number;
  compMealTaken: boolean;
};
export type Earnings = {
  deliveriesToday: number;
  deliveriesThisWeek: number;
  ratePerDelivery: string;
};
export type DishOption = { id: number; nameEn: string; nameAm: string };
export function fault(code = 'invalid_response'): never {
  throw new MobileApiError(
    code === 'invalid_response' ? 502 : 0,
    code,
    'Refresh and review before continuing.',
  );
}
function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return fault();
  return v as Record<string, unknown>;
}
function text(v: unknown): string {
  if (typeof v !== 'string') return fault();
  return v;
}
function nullable(v: unknown): string | null {
  return v === null ? null : text(v);
}
function bool(v: unknown): boolean {
  if (typeof v !== 'boolean') return fault();
  return v;
}
function count(v: unknown): number {
  if (!Number.isSafeInteger(v) || Number(v) < 0) return fault();
  return Number(v);
}
export function id(v: unknown): number {
  const n = count(v);
  if (n < 1 || n > 2147483647) return fault();
  return n;
}
export function dateOnly(v: unknown): string {
  const s = text(v);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(s) ||
    s.startsWith('0000-') ||
    !Number.isFinite(Date.parse(s + 'T00:00:00Z')) ||
    new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) !== s
  )
    return fault();
  return s;
}
function array<T>(v: unknown, parse: (v: unknown) => T): T[] {
  if (!Array.isArray(v)) return fault();
  return v.map(parse);
}
export function coordinate(v: unknown, max: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > max) return fault();
  return v;
}
export function parseItem(v: unknown): RunItem {
  const x = object(v);
  if (
    typeof x.status !== 'string' ||
    !['preparing', 'packaged', 'out_for_delivery', 'delivered', 'cancelled'].includes(x.status)
  )
    return fault();
  return {
    id: id(x.id),
    stickerId: text(x.stickerId),
    status: x.status as Status,
    dishNameEn: nullable(x.dishNameEn),
    dishNameAm: nullable(x.dishNameAm),
    clientName: text(x.clientName),
    clientPhone: text(x.clientPhone),
    addressNote: nullable(x.addressNote),
    latitude: coordinate(x.latitude, 90),
    longitude: coordinate(x.longitude, 180),
    notes: nullable(x.notes),
    isCompRedelivery: bool(x.isCompRedelivery),
  };
}
export function parseRun(v: unknown, expectedDate: string): CyclistDay {
  const x = object(v);
  const date = dateOnly(x.date);
  if (date !== expectedDate) return fault();
  const deadline = text(x.deadline);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(deadline)) return fault();
  const readyToCollect = array(x.readyToCollect, parseItem),
    onTheWay = array(x.onTheWay, parseItem),
    delivered = array(x.delivered, parseItem);
  if (
    readyToCollect.some((x) => x.status !== 'packaged') ||
    onTheWay.some((x) => x.status !== 'out_for_delivery') ||
    delivered.some((x) => x.status !== 'delivered')
  )
    return fault();
  const all = [...readyToCollect, ...onTheWay, ...delivered];
  if (new Set(all.map((x) => x.id)).size !== all.length) return fault();
  const stillCooking = count(x.stillCooking),
    total = count(x.total);
  if (total !== all.length + stillCooking) return fault();
  return {
    cyclistName: text(x.cyclistName),
    motherName: nullable(x.motherName),
    motherPhone: nullable(x.motherPhone),
    motherAddress: nullable(x.motherAddress),
    date,
    deadline,
    readyToCollect,
    onTheWay,
    delivered,
    stillCooking,
    total,
    compMealTaken: bool(x.compMealTaken),
  };
}
export function parseDishes(v: unknown): DishOption[] {
  const rows = array(v, (v) => {
    const x = object(v);
    return { id: id(x.id), nameEn: text(x.nameEn), nameAm: text(x.nameAm) };
  });
  if (new Set(rows.map((x) => x.id)).size !== rows.length) return fault();
  return rows;
}
export function parseEarnings(v: unknown): Earnings {
  const x = object(v);
  const rate = text(x.ratePerDelivery);
  if (!/^\d+(?:\.\d{1,2})?$/.test(rate)) return fault();
  const deliveriesToday = count(x.deliveriesToday),
    deliveriesThisWeek = count(x.deliveriesThisWeek);
  if (deliveriesToday > deliveriesThisWeek) return fault();
  return { deliveriesToday, deliveriesThisWeek, ratePerDelivery: rate };
}
export function parseOK(v: unknown) {
  if (object(v).ok !== true) return fault();
}
export function parseReceipt(v: unknown, item: RunItem, action: 'collect' | 'confirm') {
  const x = object(v);
  if (
    id(x.id) !== item.id ||
    text(x.stickerId) !== item.stickerId ||
    x.status !== (action === 'collect' ? 'out_for_delivery' : 'delivered')
  )
    return fault();
  if (action === 'confirm') {
    const at = text(x.cyclistConfirmedAt);
    if (!/^\d{4}-\d\d-\d\dT/.test(at) || !Number.isFinite(Date.parse(at))) return fault();
  }
}
export function todayEAT(now = Date.now()) {
  return new Date(now + 3 * 3600000).toISOString().slice(0, 10);
}
export function allItems(run: CyclistDay) {
  return [...run.readyToCollect, ...run.onTheWay, ...run.delivered];
}
export function normalizeSticker(value: string) {
  const cleaned = value.trim().toUpperCase().replace(/\s+/g, '');
  if (
    !cleaned ||
    value.trim().length > 100 ||
    Array.from(value).some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)
  )
    return fault('invalid_input');
  const result = cleaned.startsWith('MA-') ? cleaned : `MA-${cleaned}`;
  if (result.length > 100) return fault('invalid_input');
  return result;
}
export function phoneURL(value: string | null) {
  if (!value) return null;
  const phone = value.replace(/[ ()-]/g, '');
  return /^\+?\d{7,15}$/.test(phone) ? `tel:${phone}` : null;
}
export function mapURL(latitude: number, longitude: number) {
  coordinate(latitude, 90);
  coordinate(longitude, 180);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;
}
