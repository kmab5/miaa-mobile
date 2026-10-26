import { fault, todayEAT, type Row } from './contracts';
import { categories, movementTypes, units } from './business-contracts';
import type { Choices, Field } from './forms';
const f = (key: string, type: Field['type'] = 'text', extra: Partial<Field> = {}): Field => ({
  key,
  type,
  ...extra,
});
const methods = ['telebirr', 'cbe', 'chapa', 'cash', 'other'];
export const businessForms = {
  financeEntry: [
    f('direction', 'select', { choices: ['income', 'expense'] }),
    f('amountEtb', 'money'),
    f('category', 'select', { choices: categories }),
    f('description', 'text', { limit: 500 }),
    f('occurredOn', 'date'),
    f('counterparty', 'text', { optional: true, limit: 120 }),
    f('method', 'select', { choices: methods, optional: true }),
    f('reference', 'text', { optional: true, limit: 120 }),
    f('receiptUrl', 'text', { optional: true, limit: 2000 }),
    f('relatedMotherId', 'select', { source: 'mothers', optional: true }),
    f('relatedCyclistId', 'select', { source: 'cyclists', optional: true }),
  ],
  payout: [
    f('kind', 'select', { choices: ['mother', 'cyclist'] }),
    f('personId', 'select', { source: 'payees' }),
    f('amountEtb', 'money'),
    f('occurredOn', 'date'),
    f('periodLabel', 'text', { limit: 120 }),
    f('method', 'select', { choices: methods, optional: true }),
    f('reference', 'text', { optional: true, limit: 120 }),
  ],
  stockItem: [
    f('nameEn', 'text', { limit: 120 }),
    f('nameAm', 'text', { limit: 120 }),
    f('unit', 'select', { choices: units }),
    f('reorderThreshold', 'text', { optional: true, limit: 14 }),
    f('notes', 'text', { optional: true, limit: 2000 }),
    f('active', 'bool'),
  ],
  stockMovement: [
    f('stockItemId', 'select', { source: 'stock' }),
    f('movementType', 'select', { choices: movementTypes }),
    f('quantity', 'text', { limit: 14 }),
    f('unitCostEtb', 'money', { optional: true }),
    f('occurredOn', 'date'),
    f('note', 'text', { optional: true, limit: 2000 }),
    f('createExpense', 'bool'),
  ],
  archiveRecord: [],
  restoreRecord: [],
} satisfies Record<string, Field[]>;
export function isBusinessForm(kind: string): kind is keyof typeof businessForms {
  return Object.hasOwn(businessForms, kind);
}
/** Exact thousandths, including signed adjustments; no binary float stock arithmetic. */
export function thousandths(v: unknown): bigint {
  if (typeof v !== 'string' || !/^-?\d{1,9}(\.\d{1,3})?$/.test(v)) return fault('invalid_input');
  const [whole, frac = ''] = v.replace('-', '').split('.');
  return (BigInt(whole!) * 1000n + BigInt(frac.padEnd(3, '0'))) * (v.startsWith('-') ? -1n : 1n);
}
export function validateBusiness(kind: string, out: Row, options: Choices, now: number): Row {
  if (out.occurredOn && String(out.occurredOn) > todayEAT(now)) fault('invalid_input');
  if (kind === 'financeEntry' || kind === 'payout') {
    if (
      !/^\d{1,9}(\.\d{1,2})?$/.test(String(out.amountEtb)) ||
      !/[1-9]/.test(String(out.amountEtb))
    )
      fault('invalid_input');
    if (kind === 'financeEntry') {
      if (categories.slice(0, 2).includes(String(out.category)) !== (out.direction === 'income'))
        fault('invalid_input');
      if (out.receiptUrl) {
        try {
          const u = new URL(String(out.receiptUrl));
          if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) throw 0;
        } catch {
          fault('invalid_input');
        }
      }
    } else if (!options.payees?.some((r) => r.personId === out.personId && r.kind === out.kind))
      fault('invalid_input');
  }
  if (kind === 'stockItem' && out.reorderThreshold !== undefined) {
    const q = thousandths(out.reorderThreshold);
    if (q < 0n || (['piece', 'wrap', 'package'].includes(String(out.unit)) && q % 1000n !== 0n))
      fault('invalid_input');
  }
  if (kind === 'stockMovement') {
    const item = options.stock?.find((r) => r.id === out.stockItemId && r.active === true);
    if (!item) fault('invalid_input');
    const q = thousandths(out.quantity);
    if (
      q === 0n ||
      (out.movementType !== 'adjustment' && q < 0n) ||
      (['piece', 'wrap', 'package'].includes(String(item.unit)) && q % 1000n !== 0n)
    )
      fault('invalid_input');
    if (
      ['consumption', 'waste'].includes(String(out.movementType)) &&
      q > thousandths(item.currentQuantity)
    )
      fault('invalid_input');
    if (out.movementType !== 'purchase') {
      delete out.unitCostEtb;
      out.createExpense = false;
    }
    if (out.unitCostEtb !== undefined && !/^\d{1,8}(\.\d{1,2})?$/.test(String(out.unitCostEtb)))
      fault('invalid_input');
    if (out.createExpense === true) {
      if (!out.unitCostEtb) fault('invalid_input');
      const [whole, fraction = ''] = String(out.unitCostEtb).split('.');
      const cents = BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, '0'));
      // Reject zero or out-of-ledger-range rounded expenses before the atomic write.
      const rounded = (cents * q + 500n) / 1000n;
      if (rounded <= 0n || rounded > 99999999999n) fault('invalid_input');
    }
  }
  return out;
}
