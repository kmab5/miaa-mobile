import { MobileApiError } from '@miaa/api';
import type {
  ClientProfile,
  Dish,
  Offering,
  OrderDetail,
  OrderPayload,
  OrderRow,
  PaymentInstructions,
  TodayLunch,
  Journal,
} from './contracts';
export const fail = (code = 'invalid_response'): never => {
  throw new MobileApiError(502, code, 'Invalid Client data.');
};
export const object = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : fail();
const text = (v: unknown): v is string => typeof v === 'string';
const optionalText = (v: unknown) => v === null || text(v);
const id = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) > 0;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const money = (v: unknown) => text(v) && /^\d+(?:\.\d{1,2})?$/.test(v);
export const isDate = (v: unknown): v is string =>
  text(v) &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  Number.isFinite(Date.parse(v + 'T12:00:00Z')) &&
  new Date(v + 'T12:00:00Z').toISOString().slice(0, 10) === v;
const deliveryStates = ['preparing', 'packaged', 'out_for_delivery', 'delivered', 'cancelled'];
export function list<T>(v: unknown, parse: (v: unknown) => T): T[] {
  if (!Array.isArray(v) || v.length > 10000) return fail();
  return v.map(parse);
}
export function profile(v: unknown): ClientProfile {
  const p = object(v);
  if (
    !id(p.id) ||
    !text(p.name) ||
    !text(p.phoneNumber) ||
    !optionalText(p.addressNote) ||
    typeof p.hasLocation !== 'boolean' ||
    !(p.latitude === null || (finite(p.latitude) && Math.abs(p.latitude) <= 90)) ||
    !(p.longitude === null || (finite(p.longitude) && Math.abs(p.longitude) <= 180)) ||
    p.hasLocation !== (p.latitude !== null && p.longitude !== null)
  )
    return fail();
  return p as ClientProfile;
}
export function offering(v: unknown): Offering {
  const p = object(v);
  if (
    !id(p.offeringId) ||
    !id(p.motherId) ||
    !id(p.packageTypeId) ||
    !text(p.motherName) ||
    !text(p.labelEn) ||
    !text(p.labelAm) ||
    !['fasting', 'non_fasting', 'combined', 'demo'].includes(String(p.foodCategory)) ||
    !['demo', 'weekly', 'monthly', 'three_month'].includes(String(p.duration)) ||
    !money(p.priceEtb) ||
    (p.distanceKm !== undefined && (!finite(p.distanceKm) || p.distanceKm < 0))
  )
    return fail();
  return p as Offering;
}
export function dish(v: unknown): Dish {
  const p = object(v);
  if (
    !id(p.id) ||
    !text(p.nameEn) ||
    !text(p.nameAm) ||
    typeof p.isFasting !== 'boolean' ||
    typeof p.active !== 'boolean' ||
    typeof p.hasNonSpicyVariant !== 'boolean'
  )
    return fail();
  return p as Dish;
}
export function orderRow(v: unknown): OrderRow {
  const p = object(v);
  if (
    !id(p.id) ||
    !text(p.labelEn) ||
    !text(p.labelAm) ||
    !text(p.motherName) ||
    !money(p.priceEtb) ||
    !isDate(p.startDate) ||
    !isDate(p.endDate) ||
    !['pending_payment', 'active', 'cancelled', 'completed'].includes(String(p.status)) ||
    !(
      p.paymentStatus === null ||
      ['pending', 'confirmed', 'failed'].includes(String(p.paymentStatus))
    ) ||
    !Number.isInteger(p.total) ||
    !Number.isInteger(p.delivered) ||
    Number(p.total) < 0 ||
    Number(p.delivered) < 0 ||
    Number(p.delivered) > Number(p.total)
  )
    return fail();
  return p as OrderRow;
}
function delivery(v: unknown) {
  const p = object(v);
  if (
    !id(p.id) ||
    !isDate(p.deliveryDate) ||
    !deliveryStates.includes(String(p.status)) ||
    !optionalText(p.dishNameEn) ||
    !optionalText(p.dishNameAm) ||
    !text(p.stickerId) ||
    typeof p.isCompRedelivery !== 'boolean'
  )
    return fail();
  return p as OrderDetail['deliveries'][number];
}
export function orderDetail(v: unknown): OrderDetail {
  const p = object(v);
  orderRow(p.order);
  if (!optionalText(p.addressNote) || !optionalText(p.notes)) return fail();
  if (p.payment !== null) {
    const pay = object(p.payment);
    if (
      !id(pay.id) ||
      !money(pay.amountEtb) ||
      !text(pay.method) ||
      !['pending', 'confirmed', 'failed'].includes(String(pay.status)) ||
      !optionalText(pay.reference)
    )
      return fail();
  }
  list(p.deliveries, delivery);
  return p as OrderDetail;
}
export function lunch(v: unknown): TodayLunch {
  const p = object(v);
  if (
    !id(p.deliveryId) ||
    !deliveryStates.includes(String(p.status)) ||
    !text(p.stickerId) ||
    !optionalText(p.dishNameEn) ||
    !optionalText(p.dishNameAm) ||
    !optionalText(p.motherName) ||
    !optionalText(p.cyclistName) ||
    !optionalText(p.cyclistPhone) ||
    typeof p.isCompRedelivery !== 'boolean'
  )
    return fail();
  return p as TodayLunch;
}
export function instructions(v: unknown): PaymentInstructions {
  const p = object(v);
  if (!['payTelebirr', 'payCbe', 'payChapa', 'payInstructions'].every((k) => optionalText(p[k])))
    return fail();
  return p as PaymentInstructions;
}
export function coordinates(lat: string, lon: string) {
  if (!lat.trim() || !lon.trim()) return fail('invalid_input');
  const latitude = Number(lat),
    longitude = Number(lon);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  )
    return fail('invalid_input');
  return { latitude, longitude };
}
export function payload(v: unknown): OrderPayload {
  const p = object(v);
  const allowed = [
    'motherOfferingId',
    'latitude',
    'longitude',
    'addressNote',
    'notes',
    'paymentMethod',
    'paymentReference',
    'demoDate',
    'dishPattern',
  ];
  if (
    Object.keys(p).some((k) => !allowed.includes(k)) ||
    !id(p.motherOfferingId) ||
    !finite(p.latitude) ||
    !finite(p.longitude) ||
    Math.abs(p.latitude) > 90 ||
    Math.abs(p.longitude) > 180 ||
    !['telebirr', 'cbe', 'chapa', 'cash', 'other'].includes(String(p.paymentMethod))
  )
    return fail('invalid_input');
  for (const [k, max] of [
    ['addressNote', 300],
    ['notes', 1000],
    ['paymentReference', 120],
  ] as const)
    if (p[k] !== undefined && (!text(p[k]) || p[k].length > max)) return fail('invalid_input');
  if (p.demoDate !== undefined && !isDate(p.demoDate)) return fail('invalid_input');
  const pattern = object(p.dishPattern);
  if (
    !Object.keys(pattern).length ||
    Object.entries(pattern).some(([k, d]) => !['1', '2', '3', '4', '5'].includes(k) || !id(d))
  )
    return fail('invalid_input');
  return JSON.parse(JSON.stringify(p)) as OrderPayload;
}
export function journal(raw: string, owner: number): Journal {
  try {
    const p = object(JSON.parse(raw));
    if (p.version !== 1 || p.owner !== owner) return fail('storage_error');
    if (p.state === 'confirmed' && id(p.orderId)) return p as Journal;
    if (
      !['prepared', 'uncertain', 'rejected'].includes(String(p.state)) ||
      !text(p.key) ||
      !/^[-\w.:]{8,128}$/.test(p.key) ||
      !text(p.createdAt) ||
      !Number.isFinite(Date.parse(p.createdAt))
    )
      return fail('storage_error');
    payload(p.body);
    return p as Journal;
  } catch {
    return fail('storage_error');
  }
}
export function choices(dishes: Dish[], category: Offering['foodCategory'], weekday: number) {
  const fasting =
    category === 'demo'
      ? null
      : category === 'fasting' || (category === 'combined' && [3, 5].includes(weekday));
  return dishes.filter((d) => d.active && (fasting === null || d.isFasting === fasting));
}
export function validateChoices(p: OrderPayload, o: Offering, dishes: Dish[], today: string) {
  if (p.motherOfferingId !== o.offeringId) return fail('invalid_input');
  if (o.duration === 'demo') {
    if (
      !p.demoDate ||
      !isDate(p.demoDate) ||
      p.demoDate <= today ||
      [0, 6].includes(new Date(p.demoDate + 'T12:00:00Z').getUTCDay()) ||
      !choices(dishes, o.foodCategory, new Date(p.demoDate + 'T12:00:00Z').getUTCDay()).some(
        (d) => d.id === p.dishPattern['1'],
      )
    )
      return fail('invalid_input');
  } else
    for (let day = 1; day <= 5; day++)
      if (!choices(dishes, o.foodCategory, day).some((d) => d.id === p.dishPattern[String(day)]))
        return fail('invalid_input');
  return p;
}
export function eatDate(now = Date.now()) {
  return new Date(now + 3 * 3600000).toISOString().slice(0, 10);
}
