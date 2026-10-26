import type { Row } from '../../packages/admin-portal/src/contracts';
export const ledger = {
  id: 21,
  direction: 'expense',
  amountEtb: '12.50',
  category: 'ingredients',
  description: 'Flour',
  occurredOn: '2026-10-26',
  counterparty: null,
  method: 'cash',
  reference: null,
  receiptUrl: null,
  relatedMotherId: null,
  relatedCyclistId: null,
  relatedPaymentId: null,
  createdAt: '2026-10-26T07:00:00Z',
  createdByName: 'Office',
};
export const stock = {
  id: 31,
  nameEn: 'Flour',
  nameAm: 'ዱቄት',
  unit: 'kg',
  currentQuantity: '2.125',
  reorderThreshold: '3.000',
  notes: null,
  active: true,
  lowStock: true,
  negative: false,
  movementCount: 1,
  lastMovementOn: '2026-10-26',
};
export const movement = {
  id: 41,
  stockItemId: 31,
  movementType: 'purchase',
  quantity: '2.125',
  unitCostEtb: '10.00',
  occurredOn: '2026-10-26',
  relatedFinanceEntryId: 21,
  note: 'Receipt checked',
  createdAt: '2026-10-26T07:00:00Z',
  runningBalance: '2.125',
  linkedExpenseAmount: '21.25',
};
export const payout = {
  kind: 'mother',
  personId: 1,
  personName: 'Kitchen One',
  unitCount: 2,
  rateEtb: 'mixed',
  totalEtb: '35.00',
  usedFallbackRate: true,
  alreadyPaidEtb: '40.00',
  outstandingEtb: '-5.00',
};
export const bin = [
  {
    kind: 'client',
    label: 'Clients',
    items: [
      {
        kind: 'client',
        id: 1,
        label: 'Client One',
        deletedAt: '2026-10-26T07:00:00Z',
        deletedBy: null,
      },
    ],
  },
  {
    kind: 'mother',
    label: 'Mothers',
    items: [
      {
        kind: 'mother',
        id: 1,
        label: 'Kitchen One',
        deletedAt: '2026-10-26T07:00:00Z',
        deletedBy: 'Office',
      },
    ],
  },
];
export const businessReads: Record<string, unknown> = {
  finance: [ledger],
  'finance/summary': {
    totals: { income: '1000000000.00', expense: '1000000012.50', net: '-12.50', entryCount: 501 },
    categories: [
      { category: 'ingredients', direction: 'expense', total: '1000000012.50', count: 501 },
    ],
  },
  payouts: [
    payout,
    {
      ...payout,
      kind: 'cyclist',
      personName: 'Rider One',
      rateEtb: '15.00',
      usedFallbackRate: false,
      totalEtb: '30.00',
      alreadyPaidEtb: '0.00',
      outstandingEtb: '30.00',
    },
  ],
  stock: [stock],
  'stock/31': stock,
  'stock/31/movements': [movement],
  'recycle-bin': bin,
  'analytics/revenue': {
    cashCollected: '100.00',
    serviceDelivered: '150.00',
    cashServiceGap: '-50.00',
    paidSubscriptionCount: 1,
    mealsDelivered: 2,
    compMealsDelivered: 1,
    revenuePerMeal: '75.00',
  },
  'analytics/packages': {
    byCategory: [{ label: 'combined', count: 2, share: 1 }],
    byDuration: [{ label: 'weekly', count: 2, share: 1 }],
    byDish: [
      { label: 'fasting', count: 1, share: 0.5 },
      { label: 'non_fasting', count: 1, share: 0.5 },
    ],
  },
  'analytics/volume': [{ date: '2026-10-26', delivered: 2, cancelled: 1 }],
  'analytics/mothers': [
    {
      motherId: 1,
      motherName: 'Kitchen One',
      assigned: 3,
      packagedOrBeyond: 3,
      delivered: 2,
      completionRate: 2 / 3,
      onTimeRate: null,
      onTimeJudgeable: 0,
      compRedeliveries: 1,
    },
  ],
  'analytics/cyclists': [
    { cyclistId: 1, cyclistName: 'Rider One', assigned: 3, delivered: 2, completionRate: 2 / 3 },
  ],
  'analytics/unit-economics': {
    mealsDelivered: 2,
    revenuePerMeal: '75.00',
    costPerMeal: '90.00',
    marginPerMeal: '-15.00',
    marginPercent: -0.2,
    costBreakdown: [{ category: 'ingredients', total: '270.00', perMeal: '90.00' }],
    totalDirectCost: '270.00',
    modelled: { fastingCost: '230.00', nonFastingCost: '275.00' },
    lowConfidence: true,
  },
};
export const financeBody: Row = {
  direction: 'expense',
  amountEtb: '12.50',
  category: 'ingredients',
  description: 'Flour',
  occurredOn: '2026-10-26',
};
export const payoutBody: Row = {
  kind: 'mother',
  personId: 1,
  amountEtb: '5.00',
  occurredOn: '2026-10-26',
  periodLabel: 'October',
};
export const stockBody: Row = { nameEn: 'Flour', nameAm: 'ዱቄት', unit: 'kg', active: true };
export const movementBody: Row = {
  stockItemId: 31,
  movementType: 'purchase',
  quantity: '2.125',
  unitCostEtb: '10.00',
  occurredOn: '2026-10-26',
  createExpense: true,
};
