import { MobileApiError } from '@miaa/api';
export type Value = string | number | boolean | null | Value[] | { [key: string]: Value };
export type Row = { [key: string]: Value };
export type Data = Row | Row[];
export function fault(code = 'invalid_response'): never {
  throw new MobileApiError(
    code === 'invalid_response' ? 502 : 0,
    code,
    'Refresh and review before continuing.',
  );
}
export function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return fault();
  return v as Record<string, unknown>;
}
export function text(v: unknown): string {
  if (typeof v !== 'string') return fault();
  return v;
}
export function number(v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) return fault();
  return v;
}
export function id(v: unknown) {
  const n = number(v, 1, 2147483647);
  if (!Number.isInteger(n)) return fault();
  return n;
}
export function count(v: unknown) {
  const n = number(v);
  if (!Number.isSafeInteger(n)) return fault();
  return n;
}
export function bool(v: unknown) {
  if (typeof v !== 'boolean') return fault();
  return v;
}
export function date(v: unknown) {
  const s = text(v);
  if (
    !/^\d{4}-\d\d-\d\d$/.test(s) ||
    s.startsWith('0000-') ||
    !Number.isFinite(Date.parse(s + 'T00:00:00Z')) ||
    new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) !== s
  )
    return fault();
  return s;
}
export function money(v: unknown) {
  const s = text(v);
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(s)) return fault();
  return s;
}
const enumeration =
  (values: string[]) =>
  (v: unknown): string => {
    const s = text(v);
    if (!values.includes(s)) return fault();
    return s;
  };
export const statuses = ['preparing', 'packaged', 'out_for_delivery', 'delivered', 'cancelled'];
export const status = enumeration(statuses),
  orderStatus = enumeration(['pending_payment', 'active', 'cancelled', 'completed']);
const nullable =
  (parse: (v: unknown) => Value) =>
  (v: unknown): Value =>
    v === null ? null : parse(v);
const instant = (v: unknown) => {
  const s = text(v);
  if (!/^\d{4}-\d\d-\d\dT/.test(s) || !Number.isFinite(Date.parse(s))) return fault();
  return s;
};
const locale = enumeration(['en', 'am']),
  activeStatus = enumeration(['active', 'inactive']),
  category = enumeration(['fasting', 'non_fasting', 'combined', 'demo']),
  duration = enumeration(['demo', 'weekly', 'monthly', 'three_month']),
  paymentStatus = enumeration(['pending', 'confirmed', 'failed']);
type Parser = (v: unknown) => Value;
function shape(v: unknown, fields: Record<string, Parser>): Row {
  const x = object(v);
  const out: Row = {};
  for (const [key, parse] of Object.entries(fields)) out[key] = parse(x[key]);
  return out;
}
export function array(v: unknown, parse: (v: unknown) => Row, max = 10000): Row[] {
  if (!Array.isArray(v) || v.length > max) return fault();
  const rows = v.map(parse);
  const ids = rows.map((x) => x.id).filter((x) => typeof x === 'number');
  if (new Set(ids).size !== ids.length) return fault();
  return rows;
}
const basePerson = { id, name: text, phoneNumber: text };
const location = {
  latitude: nullable((v) => number(v, -90, 90)),
  longitude: nullable((v) => number(v, -180, 180)),
  addressNote: nullable(text),
};
export function person(v: unknown, kind: string, detail = false): Row {
  const fields: Record<string, Parser> = { ...basePerson };
  if (kind !== 'cyclists') Object.assign(fields, location);
  if (kind === 'mothers')
    Object.assign(fields, {
      deliveryRadiusKm: money,
      maxDailyCapacity: count,
      payRatePerMealEtb: money,
      status: activeStatus,
      lastInspectedAt: nullable(date),
      inspectionNotes: nullable(text),
    });
  else if (kind === 'cyclists')
    Object.assign(fields, {
      assignedMotherId: nullable(id),
      payRatePerDeliveryEtb: money,
      status: activeStatus,
    });
  if (kind !== 'mothers' || detail) fields.locale = locale;
  return shape(v, fields);
}
export function dish(v: unknown) {
  return shape(v, {
    id,
    nameEn: text,
    nameAm: text,
    isFasting: bool,
    hasNonSpicyVariant: bool,
    active: bool,
  });
}
export function pack(v: unknown) {
  return shape(v, {
    id,
    labelEn: text,
    labelAm: text,
    foodCategory: category,
    duration,
    mealsPerDayChoiceCount: count,
    active: bool,
  });
}
export function offering(v: unknown) {
  return shape(v, {
    offeringId: nullable(id),
    packageTypeId: id,
    labelEn: text,
    labelAm: text,
    foodCategory: category,
    duration,
    priceEtb: nullable(money),
    active: bool,
  });
}
export function delivery(v: unknown): Row {
  return shape(v, {
    id,
    stickerId: text,
    status,
    deliveryDate: date,
    clientId: id,
    clientName: text,
    clientPhone: text,
    latitude: (v) => number(v, -90, 90),
    longitude: (v) => number(v, -180, 180),
    addressNote: nullable(text),
    notes: nullable(text),
    dishId: nullable(id),
    dishNameEn: nullable(text),
    dishNameAm: nullable(text),
    dishIsFasting: nullable(bool),
    nonSpicyRequested: bool,
    isCompRedelivery: bool,
    motherId: nullable(id),
    motherName: nullable(text),
    cyclistId: nullable(id),
    cyclistName: nullable(text),
    cyclistPhone: nullable(text),
    motherConfirmedAt: nullable(instant),
    cyclistConfirmedAt: nullable(instant),
    clientConfirmedAt: nullable(instant),
  });
}
function counts(v: unknown) {
  return shape(v, Object.fromEntries(statuses.map((s) => [s, count])));
}
export function board(v: unknown, expected: string): Row {
  const x = object(v);
  if (date(x.date) !== expected) return fault();
  const groups = array(x.groups, (v) =>
    shape(v, {
      motherId: nullable(id),
      motherName: text,
      capacity: nullable(count),
      counts,
      unassignedCount: count,
      deliveries: (v) => array(v, delivery),
    }),
  );
  const items = groups.flatMap((x) => x.deliveries as Row[]);
  if (
    new Set(items.map((x) => x.id)).size !== items.length ||
    items.some((x) => x.deliveryDate !== expected)
  )
    return fault();
  const tally = counts(x.counts);
  for (const s of statuses)
    if (tally[s] !== items.filter((x) => x.status === s).length) return fault();
  if (count(x.total) !== items.filter((x) => x.status !== 'cancelled').length) return fault();
  return { date: expected, total: count(x.total), counts: tally, groups };
}
export function orderRow(v: unknown) {
  return shape(v, {
    id,
    clientName: text,
    clientPhone: text,
    motherName: text,
    labelEn: text,
    labelAm: text,
    priceEtb: money,
    startDate: date,
    endDate: date,
    status: orderStatus,
    deliveredCount: count,
    totalCount: count,
    paymentStatus: nullable(paymentStatus),
  });
}
export function subscription(v: unknown) {
  return shape(v, {
    id,
    clientId: id,
    motherOfferingId: id,
    priceEtb: money,
    latitude: (v) => number(v, -90, 90),
    longitude: (v) => number(v, -180, 180),
    addressNote: nullable(text),
    notes: nullable(text),
    startDate: date,
    endDate: date,
    status: orderStatus,
  });
}
export function payment(v: unknown) {
  return shape(v, {
    id,
    subscriptionId: id,
    amountEtb: money,
    method: enumeration(['telebirr', 'cbe', 'chapa', 'cash', 'other']),
    status: paymentStatus,
    reference: nullable(text),
    confirmedAt: nullable(instant),
  });
}
export function ticket(v: unknown) {
  return shape(v, {
    id,
    motherId: id,
    message: text,
    status: enumeration(['open', 'resolved']),
    createdAt: instant,
    resolvedAt: nullable(instant),
    motherName: text,
    resolvedByName: nullable(text),
  });
}
export function settings(v: unknown) {
  return shape(v, {
    prepDeadline: (v) => {
      const s = text(v);
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) return fault();
      return s;
    },
    defaultMotherRateEtb: money,
    defaultCyclistRateEtb: money,
    defaultRadiusKm: money,
    payTelebirr: nullable(text),
    payCbe: nullable(text),
    payChapa: nullable(text),
    payInstructions: nullable(text),
  });
}
export function safePath(path: string): string {
  if (
    !/^(?:day|prep-sheets|run-sheets|labels)(?:\?date=\d{4}-\d\d-\d\d)$/.test(path) &&
    !/^(?:reassign-options|settings|payments\/pending|mothers(?:\/[1-9]\d*(?:\/offerings)?)?|cyclists(?:\/[1-9]\d*)?|clients(?:\/[1-9]\d*)?|orders(?:\/[1-9]\d*)?|dishes|packages|tickets)(?:\?(?:includeInactive=(?:true|false)|search=[^#]*|status=(?:active|pending_payment|cancelled|completed|open|resolved)))?$/.test(
      path,
    )
  )
    return fault('invalid_input');
  return path;
}
export function parseRead(path: string, v: unknown): Data {
  safePath(path);
  const key = path.split('?')[0]!;
  const expected = new URLSearchParams(path.split('?')[1]).get('date');
  if (key === 'day') return board(v, date(expected));
  if (key === 'settings') return settings(v);
  if (key === 'reassign-options')
    return shape(v, {
      motherOptions: (v) => array(v, (v) => shape(v, { id, name: text })),
      cyclistOptions: (v) => array(v, (v) => shape(v, { id, name: text })),
    });
  if (key === 'prep-sheets' || key === 'run-sheets')
    return array(v, (v) => {
      const x = object(v);
      if (date(x.date) !== expected) return fault();
      return key === 'prep-sheets'
        ? shape(v, {
            motherId: nullable(id),
            motherName: text,
            date,
            deadline: text,
            total: count,
            tallies: (v) =>
              array(v, (v) =>
                shape(v, {
                  dishId: nullable(id),
                  dishNameEn: text,
                  dishNameAm: text,
                  isFasting: nullable(bool),
                  total: count,
                  nonSpicy: count,
                }),
              ),
            deliveries: (v) => array(v, delivery),
          })
        : shape(v, {
            cyclistId: nullable(id),
            cyclistName: text,
            cyclistPhone: nullable(text),
            motherName: nullable(text),
            date,
            total: count,
            deliveries: (v) => array(v, delivery),
          });
    });
  if (key === 'labels')
    return array(v, (v) => {
      const x = shape(v, {
        stickerId: text,
        clientName: text,
        clientPhone: text,
        addressNote: nullable(text),
        dishNameEn: nullable(text),
        dishNameAm: nullable(text),
        nonSpicyRequested: bool,
        notes: nullable(text),
        motherName: nullable(text),
        deliveryDate: date,
      });
      if (x.deliveryDate !== expected) return fault();
      return x;
    });
  if (/^(mothers|cyclists|clients)\/[1-9]\d*$/.test(key)) {
    const row = person(v, key.split('/')[0]!, true);
    if (row.id !== Number(key.split('/')[1])) return fault();
    return row;
  }
  if (/^mothers\/\d+\/offerings$/.test(key)) return array(v, offering);
  if (['mothers', 'cyclists', 'clients'].includes(key))
    return array(v, (v) => person(v, key), key === 'clients' ? 200 : 10000);
  if (key === 'dishes') return array(v, dish);
  if (key === 'packages') return array(v, pack);
  if (key === 'orders') return array(v, orderRow, 200);
  if (key === 'tickets') return array(v, ticket, 200);
  if (key === 'payments/pending')
    return array(
      v,
      (v) => shape(v, { payment, subscriptionId: id, subscriptionStatus: orderStatus }),
      100,
    );
  if (/^orders\/\d+$/.test(key)) {
    const x = object(v);
    const sub = subscription(x.subscription);
    if (sub.id !== Number(key.split('/')[1])) return fault();
    return {
      ...shape(v, {
        clientName: text,
        clientPhone: text,
        motherId: id,
        motherName: text,
        labelEn: text,
        labelAm: text,
        foodCategory: category,
        duration,
      }),
      subscription: sub,
      payments: array(x.payments, payment),
      deliveries: array(x.deliveries, (v) => {
        const x = object(v),
          d = object(x.delivery);
        return {
          id: id(d.id),
          deliveryDate: date(d.deliveryDate),
          status: status(d.status),
          stickerId: text(d.orderStickerId),
          dishId: nullable(id)(d.dishId),
          dishNameEn: nullable(text)(x.dishNameEn),
          dishNameAm: nullable(text)(x.dishNameAm),
          isCompRedelivery: bool(d.isCompRedelivery),
        };
      }),
    };
  }
  return fault();
}
export function rows(data: Data | null): Row[] {
  return Array.isArray(data) ? data : [];
}
export function row(data: Data | null): Row | null {
  return data && !Array.isArray(data) ? data : null;
}
export function todayEAT(now = Date.now()) {
  return new Date(now + 10800000).toISOString().slice(0, 10);
}
export type Journal = {
  v: 1;
  token: string;
  form: string;
  path: string;
  method: 'POST' | 'PATCH';
  startedAt: string;
  body?: Row;
  key?: string;
  sensitive: boolean;
  confirmed: boolean;
  resolved: boolean;
  resultId: number | null;
};

export function signature(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(signature).join(',') + ']';
  if (value && typeof value === 'object') {
    const x = value as Record<string, unknown>;
    return (
      '{' +
      Object.keys(x)
        .filter((k) => x[k] !== undefined)
        .sort()
        .map((k) => JSON.stringify(k) + ':' + signature(x[k]))
        .join(',') +
      '}'
    );
  }
  return JSON.stringify(value) ?? 'null';
}
