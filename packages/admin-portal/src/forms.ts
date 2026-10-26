import { normalizePhone, validPassword } from '@miaa/auth/src/validation';
import { date, fault, id, object, text, todayEAT, type Row, type Value } from './contracts';
import { businessForms, isBusinessForm, validateBusiness } from './business-forms';
import { businessIdentity, recordKind } from './business-contracts';
export type Field = {
  key: string;
  type?: 'text' | 'number' | 'money' | 'date' | 'bool' | 'phone' | 'password' | 'select';
  max?: number;
  min?: number;
  limit?: number;
  optional?: boolean;
  nullable?: boolean;
  choices?: string[];
  source?: string;
};
const f = (key: string, type: Field['type'] = 'text', extra: Partial<Field> = {}): Field => ({
  key,
  type,
  ...extra,
});
const name = [
  f('name', 'text', { limit: 120 }),
  f('phoneNumber', 'phone'),
  f('locale', 'select', { choices: ['en', 'am'] }),
];
const location = [
  f('latitude', 'number', { min: -90, max: 90 }),
  f('longitude', 'number', { min: -180, max: 180 }),
  f('addressNote', 'text', { limit: 300, optional: true }),
];
const selector = (key: string, source: string, optional = false): Field =>
  f(key, 'select', { source, optional });
export const forms = {
  ...businessForms,
  mother: [
    ...name,
    ...location,
    f('deliveryRadiusKm', 'number', { min: 0.1, max: 50 }),
    f('maxDailyCapacity', 'number', { min: 1, max: 500 }),
    f('payRatePerMealEtb', 'money'),
  ],
  cyclist: [
    ...name,
    selector('assignedMotherId', 'mothers', true),
    f('payRatePerDeliveryEtb', 'money'),
  ],
  client: [...name, ...location],
  dish: [
    f('nameEn', 'text', { limit: 120 }),
    f('nameAm', 'text', { limit: 120 }),
    f('isFasting', 'bool'),
    f('hasNonSpicyVariant', 'bool'),
    f('active', 'bool'),
  ],
  package: [
    f('labelEn', 'text', { limit: 160 }),
    f('labelAm', 'text', { limit: 160 }),
    f('foodCategory', 'select', { choices: ['fasting', 'non_fasting', 'combined', 'demo'] }),
    f('duration', 'select', { choices: ['demo', 'weekly', 'monthly', 'three_month'] }),
    f('mealsPerDayChoiceCount', 'number', { min: 1, max: 10 }),
    f('active', 'bool'),
  ],
  offering: [
    selector('motherId', 'mothers'),
    selector('packageTypeId', 'packages'),
    f('priceEtb', 'money'),
    f('active', 'bool'),
  ],
  inspection: [
    selector('motherId', 'mothers'),
    f('inspectedAt', 'date'),
    f('notes', 'text', { limit: 2000, optional: true }),
  ],
  motherPassword: [f('newPassword', 'password')],
  cyclistPassword: [f('newPassword', 'password')],
  motherStatus: [f('status', 'select', { choices: ['active', 'inactive'] })],
  cyclistStatus: [f('status', 'select', { choices: ['active', 'inactive'] })],
  ticket: [selector('motherId', 'mothers'), f('message', 'text', { limit: 2000 })],
  assignment: [selector('motherId', 'mothers', true), selector('cyclistId', 'cyclists', true)],
  changeDish: [selector('dishId', 'dishes')],
  redelivery: [
    f('deliveryDate', 'date'),
    selector('dishId', 'dishes', true),
    f('reason', 'text', { limit: 1000 }),
  ],
  paymentConfirm: [f('reference', 'text', { limit: 120 })],
  settings: [
    f('prepDeadline'),
    f('defaultMotherRateEtb', 'money'),
    f('defaultCyclistRateEtb', 'money'),
    f('defaultRadiusKm', 'number', { min: 0.1, max: 50 }),
    f('payTelebirr', 'text', { limit: 200, optional: true }),
    f('payCbe', 'text', { limit: 200, optional: true }),
    f('payChapa', 'text', { limit: 200, optional: true }),
    f('payInstructions', 'text', { limit: 2000, optional: true }),
  ],
  order: [
    selector('clientId', 'clients'),
    selector('motherId', 'mothers'),
    selector('motherOfferingId', 'offerings'),
    ...location,
    f('demoDate', 'date', { optional: true }),
    f('notes', 'text', { limit: 1000, optional: true }),
    f('paymentMethod', 'select', { choices: ['telebirr', 'cbe', 'chapa', 'cash', 'other'] }),
    f('paymentReference', 'text', { limit: 120, optional: true }),
    ...['1', '2', '3', '4', '5'].map((n) => selector('weekday' + n, 'dishes')),
  ],
  packageDelivery: [],
  collectDelivery: [],
  confirmDelivery: [],
  cancelOrder: [],
  failPayment: [],
  resolveTicket: [],
  reopenTicket: [],
} satisfies Record<string, Field[]>;
export type FormKind = keyof typeof forms;
export function isForm(v: unknown): v is FormKind {
  return typeof v === 'string' && Object.hasOwn(forms, v);
}
export type Choices = Record<string, Row[]>;
export type Draft = Record<string, string | boolean>;
export function optionId(field: Field, r: Row) {
  return field.key === 'personId'
    ? r.personId
    : field.key === 'motherOfferingId'
      ? r.offeringId
      : field.key === 'packageTypeId' && r.packageTypeId
        ? r.packageTypeId
        : r.id;
}
export function validate(kind: FormKind, draft: Draft, options: Choices, now = Date.now()): Row {
  const out: Row = {};
  const offer = options.offerings?.find((x) => x.offeringId === Number(draft.motherOfferingId));
  const demo = offer?.duration === 'demo';
  for (const field of forms[kind] as Field[]) {
    const raw = draft[field.key];
    if (kind === 'order' && field.key.startsWith('weekday')) continue;
    if (kind === 'order' && field.key === 'demoDate' && !demo) continue;
    if (field.type === 'bool') {
      if (typeof raw !== 'boolean') fault('invalid_input');
      out[field.key] = raw;
      continue;
    }
    if (typeof raw !== 'string') fault('invalid_input');
    const value = field.type === 'password' ? raw : raw.trim();
    if (!value && field.optional) {
      if (field.key === 'assignedMotherId') out[field.key] = null;
      continue;
    }
    if (!value || value.length > (field.limit ?? 2000)) fault('invalid_input');
    if (field.type === 'phone') {
      const phone = normalizePhone(value);
      if (!phone) fault('invalid_input');
      out[field.key] = phone;
    } else if (field.type === 'password') {
      if (!validPassword(value, 8)) fault('invalid_input');
      out[field.key] = value;
    } else if (field.type === 'money') {
      if (!/^\d{1,9}(\.\d{1,2})?$/.test(value)) fault('invalid_input');
      out[field.key] = value;
    } else if (field.type === 'date') {
      try {
        out[field.key] = date(value);
      } catch {
        fault('invalid_input');
      }
    } else if (field.type === 'number') {
      const n = Number(value);
      if (
        !Number.isFinite(n) ||
        n < (field.min ?? 0) ||
        n > (field.max ?? 1e9) ||
        ((field.key === 'maxDailyCapacity' || field.key === 'mealsPerDayChoiceCount') &&
          !Number.isInteger(n))
      )
        fault('invalid_input');
      out[field.key] = n;
    } else if (field.choices) {
      if (!field.choices.includes(value)) fault('invalid_input');
      out[field.key] = value;
    } else if (field.source) {
      const n = Number(value);
      const match = options[field.source]?.find(
        (x) =>
          optionId(field, x) === n &&
          (kind === 'financeEntry' || (x.active !== false && x.status !== 'inactive')),
      );
      if (!match) fault('invalid_input');
      out[field.key] = id(n);
    } else out[field.key] = value;
  }
  if (kind === 'assignment' && !out.motherId && !out.cyclistId) fault('invalid_input');
  if (kind === 'settings' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(out.prepDeadline)))
    fault('invalid_input');
  if (kind === 'order') {
    if (!offer || offer.active !== true || !offer.offeringId) fault('invalid_input');
    const pattern: Row = {};
    let weekdays = [1, 2, 3, 4, 5];
    if (demo) {
      const d = out.demoDate;
      if (typeof d !== 'string' || d <= todayEAT(now)) fault('invalid_input');
      const wd = new Date(d + 'T00:00:00Z').getUTCDay();
      if (wd < 1 || wd > 5) fault('invalid_input');
      weekdays = [wd];
    }
    for (const wd of weekdays) {
      const chosen = Number(draft['weekday' + wd]);
      const dish = options.dishes?.find((x) => x.id === chosen && x.active === true);
      const fasting =
        offer.foodCategory === 'fasting'
          ? true
          : offer.foodCategory === 'non_fasting'
            ? false
            : offer.foodCategory === 'combined'
              ? [3, 5].includes(wd)
              : null;
      if (!dish || (fasting !== null && dish.isFasting !== fasting)) fault('invalid_input');
      pattern[String(wd)] = id(chosen);
    }
    out.dishPattern = pattern;
    delete out.motherId;
  }
  if (kind === 'redelivery') {
    const d = String(out.deliveryDate),
      wd = new Date(d + 'T00:00:00Z').getUTCDay();
    if (d <= todayEAT(now) || wd < 1 || wd > 5) fault('invalid_input');
  }
  return isBusinessForm(kind) ? validateBusiness(kind, out, options, now) : out;
}
export function initial(kind: FormKind, source: Row | null = null): Draft {
  const d: Draft = {};
  for (const field of forms[kind] as Field[]) {
    const value = source?.[field.key];
    d[field.key] =
      field.type === 'bool'
        ? typeof value === 'boolean'
          ? value
          : field.key === 'active'
        : value == null
          ? ''
          : String(value);
  }
  if ('locale' in d && !d.locale) d.locale = 'en';
  if ('paymentMethod' in d && !d.paymentMethod) d.paymentMethod = 'cash';
  if ('inspectedAt' in d && !d.inspectedAt) d.inspectedAt = todayEAT();
  if ('occurredOn' in d && !d.occurredOn) d.occurredOn = todayEAT();
  if (kind === 'financeEntry' && !d.direction) d.direction = 'expense';
  if (kind === 'stockMovement' && !d.movementType) d.movementType = 'purchase';
  if (kind === 'stockItem' && !d.unit) d.unit = 'piece';
  return d;
}
export type Guard = { path: string; identity?: number; key?: string; fingerprint: string };
export type Action = {
  form: FormKind;
  path: string;
  method: 'POST' | 'PATCH' | 'DELETE';
  body?: Row;
  guard?: Guard;
  sensitive: boolean;
};
export function action(kind: FormKind, body: Row, target: number | null, guard?: Guard): Action {
  if (kind === 'archiveRecord' || kind === 'restoreRecord') {
    const path = `records/${recordKind(body.recordKind)}/${id(target)}${kind === 'restoreRecord' ? '/restore' : ''}`;
    return {
      form: kind,
      path,
      method: kind === 'archiveRecord' ? 'DELETE' : 'POST',
      sensitive: false,
      ...(guard ? { guard } : {}),
    };
  }
  const base: Partial<Record<FormKind, string>> = {
    mother: 'mothers',
    cyclist: 'cyclists',
    client: 'clients',
    dish: 'dishes',
    package: 'packages',
    stockItem: 'stock',
  };
  let path = base[kind],
    method: 'POST' | 'PATCH' = target ? 'PATCH' : 'POST';
  let payload: Row | undefined = body;
  if (path) {
    if (target) path += '/' + id(target);
  } else {
    const fixed: Partial<Record<FormKind, string>> = {
      offering: 'offerings',
      inspection: 'inspections',
      ticket: 'tickets',
      order: 'orders',
      redelivery: 'redeliveries',
      settings: 'settings',
      financeEntry: 'finance',
      payout: 'payouts',
      stockMovement: 'stock/movements',
    };
    path = fixed[kind];
    if (path) method = kind === 'settings' ? 'PATCH' : 'POST';
    if (!path) {
      if (!target) fault('invalid_input');
      id(target);
      const mappings: Partial<Record<FormKind, string>> = {
        motherPassword: `mothers/${target}/password`,
        cyclistPassword: `cyclists/${target}/password`,
        motherStatus: `mothers/${target}/status`,
        cyclistStatus: `cyclists/${target}/status`,
        assignment: `deliveries/${target}/assignment`,
        changeDish: `deliveries/${target}/dish`,
        packageDelivery: `deliveries/${target}/package`,
        collectDelivery: `deliveries/${target}/collect`,
        confirmDelivery: `deliveries/${target}/confirm`,
        cancelOrder: `orders/${target}/cancel`,
        paymentConfirm: `payments/${target}/confirm`,
        failPayment: `payments/${target}/fail`,
        resolveTicket: `tickets/${target}/resolve`,
        reopenTicket: `tickets/${target}/reopen`,
      };
      path = mappings[kind];
      if (
        [
          'packageDelivery',
          'collectDelivery',
          'confirmDelivery',
          'cancelOrder',
          'paymentConfirm',
          'failPayment',
          'resolveTicket',
          'reopenTicket',
        ].includes(kind)
      )
        method = 'POST';
      else method = 'PATCH';
      if (
        [
          'packageDelivery',
          'collectDelivery',
          'confirmDelivery',
          'cancelOrder',
          'failPayment',
          'resolveTicket',
          'reopenTicket',
        ].includes(kind)
      )
        payload = undefined;
    }
  }
  if (!path) fault('invalid_input');
  if (kind === 'redelivery') {
    if (!target) fault('invalid_input');
    payload = { ...body, sourceDeliveryId: id(target) };
  }
  return {
    form: kind,
    path,
    method,
    ...(payload ? { body: payload } : {}),
    ...(guard ? { guard } : {}),
    sensitive: kind.endsWith('Password'),
  };
}
export function validateAction(value: unknown): Action {
  const x = object(value);
  if (!isForm(x.form) || typeof x.sensitive !== 'boolean') fault('storage_error');
  const body = x.body === undefined ? undefined : (object(x.body) as Row);
  if (body) {
    const allowed = new Set((forms[x.form] as Field[]).map((f) => f.key));
    if (x.form === 'order') {
      allowed.delete('motherId');
      for (let d = 1; d <= 5; d++) allowed.delete('weekday' + d);
      allowed.add('dishPattern');
    }
    if (x.form === 'redelivery') allowed.add('sourceDeliveryId');
    if (isBusinessForm(x.form) && !['archiveRecord', 'restoreRecord'].includes(x.form)) {
      const fields = forms[x.form] as Field[];
      const draft: Draft = {};
      for (const f of fields)
        draft[f.key] =
          body[f.key] === undefined
            ? f.type === 'bool'
              ? false
              : ''
            : f.type === 'bool'
              ? (body[f.key] as boolean)
              : String(body[f.key]);
      const choices: Choices = {
        mothers: [{ id: body.relatedMotherId! }],
        cyclists: [{ id: body.relatedCyclistId! }],
        payees: [{ kind: body.kind!, personId: body.personId! }],
        stock: [
          { id: body.stockItemId!, active: true, unit: 'kg', currentQuantity: '999999999.999' },
        ],
      };
      const checked = validate(x.form, draft, choices);
      for (const [key, value] of Object.entries(checked))
        if (body[key] !== value) fault('storage_error');
      for (const [key, value] of Object.entries(body))
        if (checked[key] !== value) fault('storage_error');
    }

    if (Object.keys(body).some((k) => !allowed.has(k))) fault('storage_error');
    if (x.form === 'order') {
      id(body.clientId);
      id(body.motherOfferingId);
      for (const [k, max] of [
        ['latitude', 90],
        ['longitude', 180],
      ] as const)
        if (
          typeof body[k] !== 'number' ||
          !Number.isFinite(body[k]) ||
          Math.abs(body[k] as number) > max
        )
          fault('storage_error');
      if (!['cash', 'telebirr', 'cbe', 'chapa', 'other'].includes(String(body.paymentMethod)))
        fault('storage_error');
      const pattern = object(body.dishPattern);
      for (const [k, v] of Object.entries(pattern)) {
        if (!['1', '2', '3', '4', '5'].includes(k)) fault('storage_error');
        id(v);
      }
    }
  }
  const path = text(x.path);
  const parts = path.split('/');
  let target: number | null = null;
  if (parts.length > 1 && /^\d+$/.test(parts[1]!)) target = id(Number(parts[1]));
  if (x.form === 'redelivery') target = id(body?.sourceDeliveryId);
  const archive = x.form === 'archiveRecord' || x.form === 'restoreRecord';
  if (archive && body !== undefined) fault('storage_error');
  if (archive) target = id(Number(parts[2]));
  const built = action(x.form, archive ? { recordKind: parts[1]! } : (body ?? {}), target);
  if (built.path !== path || built.method !== x.method || built.sensitive !== x.sensitive)
    fault('storage_error');
  delete built.body;
  return { ...built, ...(body ? { body } : {}) };
}
export function guardData(data: Value | Row[], identity?: number, key?: string): Value {
  if (key !== undefined) return businessIdentity(data as Row | Row[], key);
  if (identity === undefined) return data;
  if (Array.isArray(data)) {
    const item = (data as Row[]).find(
      (x) =>
        x.id === identity ||
        x.offeringId === identity ||
        (x.payment &&
          typeof x.payment === 'object' &&
          !Array.isArray(x.payment) &&
          (x.payment as Row).id === identity),
    );
    if (item) return item;
  }
  if (!Array.isArray(data) && data && typeof data === 'object' && Array.isArray(data.groups)) {
    const item = (data.groups as Row[])
      .flatMap((g) => g.deliveries as Row[])
      .find((x) => x.id === identity);
    if (item) return item;
  }
  return fault('state_changed');
}
