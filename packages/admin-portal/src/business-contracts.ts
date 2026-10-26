import {
  array,
  bool,
  count,
  date,
  enumeration,
  fault,
  id,
  instant,
  nullable,
  number,
  object,
  shape,
  text,
  type Data,
  type Row,
} from './contracts';

export const categories = [
  'subscription_income',
  'other_income',
  'ingredients',
  'packaging',
  'mother_payout',
  'cyclist_payout',
  'transport',
  'marketing',
  'hosting_software',
  'equipment',
  'refund_or_comp',
  'other_expense',
];
export const recordKinds = [
  'mother',
  'cyclist',
  'client',
  'dish',
  'packageType',
  'offering',
  'subscription',
  'delivery',
  'payment',
  'ticket',
  'compMeal',
  'financeEntry',
  'stockItem',
  'stockMovement',
];
export const reports = ['revenue', 'packages', 'volume', 'mothers', 'cyclists', 'unit-economics'];
export const units = ['piece', 'kg', 'litre', 'wrap', 'package'];
export const movementTypes = ['purchase', 'consumption', 'waste', 'adjustment'];
export function recordKind(v: unknown): string {
  return enumeration(recordKinds)(v);
}
/** Decimal strings stay strings. Reports may exceed a single-entry input limit. */
export function decimal(v: unknown, scale = 2): string {
  const s = text(v);
  if (!new RegExp(`^-?\\d{1,18}(\\.\\d{1,${scale}})?$`).test(s)) fault();
  return s;
}
export const quantity = (v: unknown) => decimal(v, 3);
const nonnegative = (v: unknown) => {
  const s = decimal(v);
  if (s.startsWith('-')) fault();
  return s;
};
export function range(from: unknown, to: unknown) {
  try {
    const a = date(from),
      b = date(to);
    if (a > b || Date.parse(b) - Date.parse(a) > 366 * 86400000) fault();
    return { from: a, to: b };
  } catch {
    return fault('invalid_input');
  }
}
export function periodPath(key: string, from: unknown, to: unknown): string {
  const r = range(from, to);
  const path = `${key}?from=${r.from}&to=${r.to}`;
  if (!businessPath(path)) fault('invalid_input');
  return path;
}
/** Only fixed resource names, strict query keys and bounded periods reach the network. */
export function businessPath(path: string): boolean {
  const [key, query, extra] = path.split('?');
  if (extra !== undefined || path.includes('#')) return false;
  if (
    !/^(finance(?:\/summary)?|payouts|stock(?:\/[1-9]\d*(?:\/movements)?)?|recycle-bin|analytics\/[a-z-]+)$/.test(
      key!,
    )
  )
    return false;
  if (key!.startsWith('analytics/') && !reports.includes(key!.slice(10))) fault('invalid_input');
  if (/^stock\//.test(key!)) id(Number(key!.split('/')[1]));
  const params = new URLSearchParams(query);
  const keys = [...params.keys()];
  if (new Set(keys).size !== keys.length) fault('invalid_input');
  const ranged = key === 'payouts' || key === 'finance/summary' || key!.startsWith('analytics/');
  const allowed = ranged
    ? ['from', 'to']
    : key === 'finance'
      ? ['from', 'to', 'direction', 'category']
      : key === 'stock'
        ? ['includeInactive']
        : [];
  if (keys.some((k) => !allowed.includes(k))) fault('invalid_input');
  if (ranged || (params.has('from') && params.has('to')))
    range(params.get('from'), params.get('to'));
  else
    for (const k of ['from', 'to'])
      if (params.has(k)) {
        try {
          date(params.get(k));
        } catch {
          fault('invalid_input');
        }
      }
  if (params.has('direction') && !['income', 'expense'].includes(params.get('direction')!))
    fault('invalid_input');
  if (params.has('category') && !categories.includes(params.get('category')!))
    fault('invalid_input');
  if (params.has('includeInactive') && !['true', 'false'].includes(params.get('includeInactive')!))
    fault('invalid_input');
  return true;
}
const method = nullable(enumeration(['telebirr', 'cbe', 'chapa', 'cash', 'other']));
export function financeEntry(v: unknown): Row {
  return shape(v, {
    id,
    direction: enumeration(['income', 'expense']),
    amountEtb: nonnegative,
    category: enumeration(categories),
    description: text,
    occurredOn: date,
    counterparty: nullable(text),
    method,
    reference: nullable(text),
    receiptUrl: nullable(text),
    relatedMotherId: nullable(id),
    relatedCyclistId: nullable(id),
    relatedPaymentId: nullable(id),
    createdAt: instant,
  });
}
export function stockItem(v: unknown, level = false): Row {
  return shape(v, {
    id,
    nameEn: text,
    nameAm: text,
    unit: enumeration(units),
    currentQuantity: quantity,
    reorderThreshold: nullable(quantity),
    notes: nullable(text),
    active: bool,
    ...(level
      ? { lowStock: bool, negative: bool, movementCount: count, lastMovementOn: nullable(date) }
      : {}),
  });
}
export function stockMovement(v: unknown, history = false): Row {
  return shape(v, {
    id,
    stockItemId: id,
    movementType: enumeration(movementTypes),
    quantity,
    unitCostEtb: nullable(nonnegative),
    occurredOn: date,
    relatedFinanceEntryId: nullable(id),
    note: nullable(text),
    createdAt: instant,
    ...(history ? { runningBalance: quantity, linkedExpenseAmount: nullable(nonnegative) } : {}),
  });
}
function unique(rows: Row[], key: (r: Row) => string) {
  if (new Set(rows.map(key)).size !== rows.length) fault();
  return rows;
}
export function businessIdentity(data: Data, key: string): Row {
  const list = Array.isArray(data)
    ? data.flatMap((r) => (Array.isArray(r.items) ? (r.items as Row[]) : [r]))
    : [];
  return list.find((r) => `${r.kind}:${r.personId ?? r.id}` === key) ?? fault('state_changed');
}
export function parseBusinessRead(path: string, v: unknown): Data {
  if (!businessPath(path)) fault();
  const key = path.split('?')[0]!;
  if (key === 'finance')
    return array(
      v,
      (x) => ({ ...financeEntry(x), createdByName: nullable(text)(object(x).createdByName) }),
      500,
    );
  if (key === 'finance/summary')
    return shape(v, {
      totals: (x) =>
        shape(x, { income: nonnegative, expense: nonnegative, net: decimal, entryCount: count }),
      categories: (x) =>
        unique(
          array(x, (y) =>
            shape(y, {
              category: enumeration(categories),
              direction: enumeration(['income', 'expense']),
              total: nonnegative,
              count,
            }),
          ),
          (r) => `${r.direction}:${r.category}`,
        ),
    });
  if (key === 'payouts')
    return unique(
      array(v, (x) =>
        shape(x, {
          kind: enumeration(['mother', 'cyclist']),
          personId: id,
          personName: text,
          unitCount: count,
          rateEtb: (x) => (x === 'mixed' ? 'mixed' : nonnegative(x)),
          totalEtb: nonnegative,
          usedFallbackRate: bool,
          alreadyPaidEtb: nonnegative,
          outstandingEtb: decimal,
        }),
      ),
      (r) => `${r.kind}:${r.personId}`,
    );
  if (key === 'stock') return array(v, (x) => stockItem(x, true));
  if (/^stock\/\d+$/.test(key)) {
    const r = stockItem(v);
    if (r.id !== Number(key.split('/')[1])) fault();
    return r;
  }
  if (/^stock\/\d+\/movements$/.test(key))
    return array(v, (x) => {
      const r = stockMovement(x, true);
      if (r.stockItemId !== Number(key.split('/')[1])) fault();
      return r;
    });
  if (key === 'recycle-bin')
    return unique(
      array(
        v,
        (x) => {
          const g = object(x),
            kind = recordKind(g.kind);
          return {
            kind,
            label: text(g.label),
            items: array(
              g.items,
              (y) => {
                const item = shape(y, {
                  kind: recordKind,
                  id,
                  label: text,
                  deletedAt: instant,
                  deletedBy: nullable(text),
                });
                if (item.kind !== kind) fault();
                return item;
              },
              200,
            ),
          };
        },
        14,
      ),
      (r) => String(r.kind),
    );
  const ratio = (x: unknown) => number(x, 0, 1);
  if (key === 'analytics/revenue')
    return shape(v, {
      cashCollected: nonnegative,
      serviceDelivered: nonnegative,
      cashServiceGap: decimal,
      paidSubscriptionCount: count,
      mealsDelivered: count,
      compMealsDelivered: count,
      revenuePerMeal: nullable(nonnegative),
    });
  if (key === 'analytics/packages')
    return shape(
      v,
      Object.fromEntries(
        ['byCategory', 'byDuration', 'byDish'].map((k) => [
          k,
          (x: unknown) =>
            unique(
              array(x, (y) => shape(y, { label: text, count, share: ratio })),
              (r) => String(r.label),
            ),
        ]),
      ),
    );
  if (key === 'analytics/volume')
    return unique(
      array(v, (x) => shape(x, { date, delivered: count, cancelled: count }), 367),
      (r) => String(r.date),
    );
  if (key === 'analytics/mothers')
    return unique(
      array(v, (x) =>
        shape(x, {
          motherId: id,
          motherName: text,
          assigned: count,
          packagedOrBeyond: count,
          delivered: count,
          completionRate: ratio,
          onTimeRate: nullable(ratio),
          onTimeJudgeable: count,
          compRedeliveries: count,
        }),
      ),
      (r) => String(r.motherId),
    );
  if (key === 'analytics/cyclists')
    return unique(
      array(v, (x) =>
        shape(x, {
          cyclistId: id,
          cyclistName: text,
          assigned: count,
          delivered: count,
          completionRate: ratio,
        }),
      ),
      (r) => String(r.cyclistId),
    );
  if (key === 'analytics/unit-economics')
    return shape(v, {
      mealsDelivered: count,
      revenuePerMeal: nullable(nonnegative),
      costPerMeal: nullable(nonnegative),
      marginPerMeal: nullable(decimal),
      marginPercent: nullable((x) => number(x, -Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)),
      costBreakdown: (x) =>
        array(x, (y) =>
          shape(y, { category: enumeration(categories), total: nonnegative, perMeal: nonnegative }),
        ),
      totalDirectCost: nonnegative,
      modelled: (x) => shape(x, { fastingCost: nonnegative, nonFastingCost: nonnegative }),
      lowConfidence: bool,
    });
  return fault();
}
