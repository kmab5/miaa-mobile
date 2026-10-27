import { MobileApiError, type RequestOptions } from '@miaa/api';
import {
  bool,
  money,
  count,
  fault,
  id,
  object,
  parseRead,
  safePath,
  settings,
  subscription,
  signature,
  todayEAT,
  text,
  type Data,
  type Journal,
  type Row,
} from './contracts';
import { action, guardData, isForm, validateAction, type Action } from './forms';
import { decimal, financeEntry, quantity, stockItem, stockMovement } from './business-contracts';
export interface ActionStore {
  read(): Promise<string | null>;
  write(v: string): Promise<void>;
  clear(): Promise<void>;
  exclusive<T>(work: () => Promise<T>): Promise<T>;
}
export type Resource = { data: Data | null; busy: boolean; error: unknown };
export type Review = { action: Action; token: string; previous: string | null; day: string };
export type AdminState = {
  resources: Record<string, Resource>;
  busy: boolean;
  issue: unknown;
  notice: 'saved' | 'cleared' | null;
  receipt: Row | null;
  pending: Journal | null;
  storageReady: boolean;
  retryAt: number;
  journalToken: string | null;
};
export function parseJournal(raw: string | null): Journal | null {
  if (raw === null) return null;
  try {
    const x = object(JSON.parse(raw));
    if (
      x.v !== 1 ||
      typeof x.token !== 'string' ||
      !/^miaa-admin-[a-z0-9-]{36}$/i.test(x.token) ||
      !isForm(x.form) ||
      typeof x.sensitive !== 'boolean' ||
      typeof x.confirmed !== 'boolean' ||
      typeof x.startedAt !== 'string' ||
      !Number.isFinite(Date.parse(x.startedAt))
    )
      throw 0;
    const a = validateAction(x);
    if (x.sensitive && x.body !== undefined) throw 0;
    if (
      x.form === 'order' &&
      !x.confirmed &&
      x.resolved !== true &&
      (x.key !== x.token || !a.body || !a.body.dishPattern)
    )
      throw 0;
    return {
      v: 1,
      token: x.token,
      form: x.form,
      path: a.path,
      method: a.method,
      startedAt: x.startedAt,
      ...(a.body ? { body: a.body } : {}),
      ...(typeof x.key === 'string' ? { key: x.key } : {}),
      sensitive: x.sensitive,
      confirmed: x.confirmed,
      resolved: x.resolved === true,
      resultId: x.resultId === null ? null : id(x.resultId),
    };
  } catch {
    return fault('storage_error');
  }
}
function receipt(a: Action, v: unknown): Row {
  const x = object(v);
  const target = Number(a.path.split('/')[1]);
  const kind = a.form;
  const cents = (v: unknown) => {
    const [w, f = ''] = money(v).split('.');
    return BigInt(w!) * 100n + BigInt(f.padEnd(2, '0'));
  };
  if (kind === 'archiveRecord' || kind === 'restoreRecord') {
    if (x.ok !== true) fault();
    return { id: id(Number(a.path.split('/')[2])), ok: true };
  }
  if (kind === 'financeEntry' || kind === 'payout') {
    const entry = financeEntry(v);
    if (cents(entry.amountEtb) !== cents(a.body?.amountEtb)) fault();
    if (entry.occurredOn !== a.body?.occurredOn) fault();
    if (kind === 'financeEntry')
      for (const key of [
        'description',
        'counterparty',
        'method',
        'reference',
        'receiptUrl',
        'relatedMotherId',
        'relatedCyclistId',
      ])
        if (a.body?.[key] !== undefined && entry[key] !== a.body[key]) fault();
    if (
      kind === 'financeEntry' &&
      (entry.category !== a.body?.category || entry.direction !== a.body?.direction)
    )
      fault();
    if (
      kind === 'payout' &&
      (entry.category !== `${a.body?.kind}_payout` ||
        entry.direction !== 'expense' ||
        entry[a.body?.kind === 'mother' ? 'relatedMotherId' : 'relatedCyclistId'] !==
          a.body?.personId)
    )
      fault();
    return { id: entry.id!, amountEtb: entry.amountEtb!, occurredOn: entry.occurredOn! };
  }
  if (kind === 'stockItem') {
    const item = stockItem(v);
    if (
      (a.method === 'PATCH' && item.id !== target) ||
      item.nameEn !== a.body?.nameEn ||
      item.nameAm !== a.body?.nameAm ||
      item.unit !== a.body?.unit ||
      item.active !== a.body?.active
    )
      fault();
    return { id: item.id!, currentQuantity: item.currentQuantity!, unit: item.unit! };
  }
  if (kind === 'stockMovement') {
    const movement = stockMovement(x.movement);
    if (
      movement.stockItemId !== a.body?.stockItemId ||
      movement.movementType !== a.body?.movementType ||
      movement.occurredOn !== a.body?.occurredOn
    )
      fault();
    const signed = ['consumption', 'waste'].includes(String(a.body?.movementType))
      ? '-' + String(a.body?.quantity)
      : String(a.body?.quantity);
    const scale = (v: string) => {
      const [w, f = ''] = v.replace('-', '').split('.');
      return (BigInt(w!) * 1000n + BigInt(f.padEnd(3, '0'))) * (v.startsWith('-') ? -1n : 1n);
    };
    if (scale(quantity(movement.quantity)) !== scale(quantity(signed))) fault();
    if (
      a.body?.unitCostEtb !== undefined &&
      (movement.unitCostEtb === null || cents(movement.unitCostEtb) !== cents(a.body.unitCostEtb))
    )
      fault();
    const linked = x.financeEntryId === null ? null : id(x.financeEntryId);
    if (
      (a.body?.createExpense === true) !== (linked !== null) ||
      movement.relatedFinanceEntryId !== linked
    )
      fault();
    return {
      id: movement.id!,
      newQuantity: quantity(x.newQuantity),
      financeEntryId: linked,
      totalCostEtb: x.totalCostEtb === null ? null : decimal(x.totalCostEtb),
    };
  }
  if (kind === 'order') {
    const s = subscription(x.subscription);
    if (s.clientId !== a.body?.clientId || s.motherOfferingId !== a.body?.motherOfferingId) fault();
    return {
      id: id(s.id),
      deliveriesCreated: count(x.deliveriesCreated),
      paymentId: id(x.paymentId),
      priceEtb: s.priceEtb!,
      startDate: s.startDate!,
      endDate: s.endDate!,
    };
  }
  if (kind === 'cancelOrder') {
    const s = subscription(x.subscription);
    if (s.id !== target || s.status !== 'cancelled') fault();
    return {
      id: target,
      refundDue: bool(x.refundDue),
      deliveredCount: count(x.deliveredCount),
      cancelledDeliveries: count(x.cancelledDeliveries),
    };
  }
  if (kind.endsWith('Password') || kind === 'offering') {
    if (x.ok !== true) fault();
    return { ok: true };
  }
  if (kind === 'settings') {
    settings(v);
    return { ok: true };
  }
  if (kind === 'paymentConfirm') {
    const p = object(x.payment);
    if (id(p.id) !== target || p.status !== 'confirmed') fault();
    return { id: target, status: 'confirmed' };
  }
  if (kind === 'failPayment') {
    if (id(x.id) !== target || x.status !== 'failed') fault();
    return { id: target, status: 'failed' };
  }
  if (
    ['packageDelivery', 'collectDelivery', 'confirmDelivery', 'assignment', 'changeDish'].includes(
      kind,
    )
  ) {
    if (id(x.id) !== target) fault();
    const expected =
      kind === 'packageDelivery'
        ? 'packaged'
        : kind === 'collectDelivery'
          ? 'out_for_delivery'
          : kind === 'confirmDelivery'
            ? 'delivered'
            : null;
    if (expected && x.status !== expected) fault();
    if (
      kind === 'assignment' &&
      ((a.body?.motherId !== undefined && x.assignedMotherId !== a.body.motherId) ||
        (a.body?.cyclistId !== undefined && x.assignedCyclistId !== a.body.cyclistId))
    )
      fault();
    if (kind === 'changeDish' && x.dishId !== a.body?.dishId) fault();
    return { id: target, status: text(x.status) };
  }
  if (kind === 'resolveTicket' || kind === 'reopenTicket') {
    if (id(x.id) !== target || x.status !== (kind === 'resolveTicket' ? 'resolved' : 'open'))
      fault();
    return { id: target, status: text(x.status) };
  }
  if (
    kind === 'redelivery' &&
    (x.deliveryDate !== a.body?.deliveryDate ||
      x.isCompRedelivery !== true ||
      x.status !== 'preparing' ||
      typeof x.orderStickerId !== 'string' ||
      !/-R\d+$/.test(x.orderStickerId))
  )
    fault();
  const result = id(x.id);
  if (a.method === 'PATCH' && result !== target) fault();
  if (kind === 'ticket' && (x.motherId !== a.body?.motherId || x.message !== a.body?.message))
    fault();
  if (kind === 'motherStatus' || kind === 'cyclistStatus') {
    if (x.status !== a.body?.status) fault();
  }
  return { id: result };
}
export function createAdminController(options: {
  request: <T>(path: string, o?: RequestOptions) => Promise<T>;
  store: ActionStore;
  randomKey: () => string;
  now?: () => number;
}) {
  const now = options.now ?? Date.now;
  let state: AdminState = {
    resources: {},
    busy: false,
    issue: null,
    notice: null,
    receipt: null,
    pending: null,
    storageReady: false,
    retryAt: 0,
    journalToken: null,
  };
  let disposed = false;
  const listeners = new Set<() => void>();
  let revision = 0;
  const reads = new Map<string, { revision: number; ac: AbortController }>();
  const writes = new Set<AbortController>();
  const active = new Map<string, number>();
  const reviews = new WeakSet<Review>(),
    consumed = new WeakSet<Review>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const update = (v: Partial<AdminState>) => {
    if (!disposed) {
      state = { ...state, ...v };
      listeners.forEach((f) => f());
    }
  };
  const alive = () => {
    if (disposed) fault('request_aborted');
  };
  const resource = (path: string, v: Resource) =>
    update({ resources: { ...state.resources, [path]: v } });
  function cooldown(e: unknown) {
    if (disposed) return;
    if (e instanceof MobileApiError && e.retryAfterSeconds) {
      const retryAt = Math.max(state.retryAt, now() + e.retryAfterSeconds * 1000);
      clearTimeout(timer);
      update({ retryAt });
      timer = setTimeout(() => update({ retryAt: 0 }), Math.max(0, retryAt - now()));
    }
  }
  async function load(path: string): Promise<Data | null> {
    const rev = ++revision,
      ac = new AbortController();
    reads.get(path)?.ac.abort();
    reads.set(path, { revision: rev, ac });
    resource(path, { data: null, busy: true, error: null });
    try {
      alive();
      safePath(path);
      const value = await options.request('admin/' + path, { signal: ac.signal });
      alive();
      if (ac.signal.aborted || reads.get(path)?.revision !== rev) return null;
      const data = parseRead(path, value);
      resource(path, { data, busy: false, error: null });
      return data;
    } catch (error) {
      if (!ac.signal.aborted && reads.get(path)?.revision === rev) {
        cooldown(error);
        resource(path, { data: null, busy: false, error });
      }
      return null;
    }
  }
  async function locked(work: () => Promise<void>) {
    try {
      await options.store.exclusive(async () => {
        alive();
        await work();
      });
    } catch (e) {
      if (e instanceof MobileApiError && e.code !== 'storage_error') throw e;
      update({ storageReady: false });
      fault('storage_error');
    }
  }
  function viewJournal(j: Journal | null) {
    update({
      pending: j && !j.confirmed && !j.resolved ? j : null,
      journalToken: j?.token ?? null,
      storageReady: true,
    });
  }
  async function recover() {
    try {
      await locked(async () => {
        const pending = parseJournal(await options.store.read());
        alive();
        viewJournal(pending);
        update({ issue: null });
      });
    } catch (e) {
      update({ storageReady: false, issue: e });
    }
  }
  async function mutate(work: () => Promise<void>) {
    if (disposed || state.busy || state.retryAt > now()) return;
    update({ busy: true, issue: null, notice: null, receipt: null });
    try {
      await work();
    } catch (error) {
      cooldown(error);
      update({ issue: error });
    } finally {
      update({ busy: false });
    }
  }
  async function send(a: Action, j: Journal, retry = false) {
    const ac = new AbortController();
    writes.add(ac);
    let raw: unknown;
    try {
      alive();
      raw = await options.request('admin/' + a.path, {
        method: a.method,
        ...(a.body ? { body: a.body } : {}),
        ...(j.key ? { idempotencyKey: j.key } : {}),
        signal: ac.signal,
      });
      alive();
    } catch (e) {
      if (
        !retry &&
        e instanceof MobileApiError &&
        [400, 401, 403, 413, 415, 429].includes(e.status)
      ) {
        await options.store.clear();
        viewJournal(null);
      }
      throw e;
    } finally {
      writes.delete(ac);
    }
    const result = receipt(a, raw);
    const confirmed: Journal = {
      ...j,
      body: j.form === 'redelivery' ? { sourceDeliveryId: j.body!.sourceDeliveryId! } : undefined,
      key: undefined,
      confirmed: true,
      resultId: typeof result.id === 'number' ? result.id : null,
    };
    await options.store.write(JSON.stringify(confirmed));
    viewJournal(confirmed);
    update({ receipt: { ...result, form: a.form }, notice: 'saved' });
    const paths = Array.from(active.keys());
    await Promise.all(paths.map(load));
  }
  return {
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    getSnapshot: () => state,
    load,
    recover,
    watch(path: string) {
      safePath(path);
      active.set(path, (active.get(path) ?? 0) + 1);
      return () => {
        const n = (active.get(path) ?? 1) - 1;
        if (n === 0) {
          active.delete(path);
          reads.get(path)?.ac.abort();
        } else active.set(path, n);
      };
    },
    review(a: Action) {
      alive();
      if (!isForm(a.form) || state.pending || !state.storageReady) fault('request_pending');
      validateAction(a);
      const copy = JSON.parse(JSON.stringify(a)) as Action;
      if (copy.body) Object.freeze(copy.body);
      if (copy.guard) Object.freeze(copy.guard);
      Object.freeze(copy);
      const r = Object.freeze({
        action: copy,
        token: options.randomKey(),
        previous: state.journalToken,
        day: todayEAT(now()),
      });
      reviews.add(r);
      return r;
    },
    async commit(r: Review) {
      await mutate(async () => {
        if (!reviews.has(r) || consumed.has(r)) fault('state_changed');
        consumed.add(r);
        if (
          ['order', 'redelivery', 'changeDish'].includes(r.action.form) &&
          r.day !== todayEAT(now())
        )
          fault('state_changed');
        await locked(async () => {
          const prior = parseJournal(await options.store.read());
          viewJournal(prior);
          if (prior && !prior.confirmed && !prior.resolved) fault('request_pending');
          if ((prior?.token ?? null) !== r.previous) fault('state_changed');
          const a = r.action;
          if (a.guard) {
            const current = await load(a.guard.path);
            if (!current) fault('refresh_required');
            if (
              JSON.stringify(guardData(current, a.guard.identity, a.guard.key)) !==
              a.guard.fingerprint
            )
              fault('state_changed');
          }
          const j: Journal = {
            v: 1,
            token: r.token,
            form: a.form,
            path: a.path,
            method: a.method,
            startedAt: new Date(now()).toISOString(),
            sensitive: a.sensitive,
            confirmed: false,
            resolved: false,
            resultId: null,
            ...(!a.sensitive && a.body ? { body: a.body } : {}),
            ...(a.form === 'order' ? { key: r.token } : {}),
          };
          await options.store.write(JSON.stringify(j));
          update({ pending: j });
          alive();
          await send(a, j);
        });
      });
    },
    async retryOrder() {
      await mutate(async () => {
        await locked(async () => {
          const j = parseJournal(await options.store.read());
          viewJournal(j);
          if (!j || j.form !== 'order' || j.confirmed || j.resolved || !j.body)
            fault('request_pending');
          await send(action('order', j.body, null), j, true);
        });
      });
    },
    async clearReviewed(expected: Journal) {
      await mutate(async () => {
        await locked(async () => {
          const current = parseJournal(await options.store.read());
          if (current && signature(current) !== signature(expected)) {
            update({ pending: current });
            fault('request_pending');
          }
          if (current) {
            const resolved = {
              ...current,
              body:
                current.form === 'redelivery'
                  ? { sourceDeliveryId: current.body!.sourceDeliveryId! }
                  : undefined,
              key: undefined,
              resolved: true,
            };
            await options.store.write(JSON.stringify(resolved));
            viewJournal(resolved);
          }
          alive();
          update({ pending: null, storageReady: true, notice: 'cleared' });
        });
      });
    },
    dispose() {
      disposed = true;
      clearTimeout(timer);
      reads.forEach((x) => x.ac.abort());
      writes.forEach((x) => x.abort());
      reads.clear();
      writes.clear();
      listeners.clear();
    },
  };
}
export type AdminController = ReturnType<typeof createAdminController>;
