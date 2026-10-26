import { MobileApiError, type RequestOptions } from '@miaa/api';
import type { Journal, OrderDetail, OrderPayload, OrderStore } from './contracts';
import { journal, orderDetail, payload } from './validation';
export type ClientRequest = <T>(path: string, options?: RequestOptions) => Promise<T>;
// The v0.19 endpoint reads order details AFTER committing. A generic 404/409
// can therefore follow a successful insert. Only known pre-commit refusals may
// unlock a new intention; unknown messages conservatively keep the original key.
export function definitiveRefusal(error: MobileApiError) {
  if (
    error.status === 400 &&
    ['invalid_input', 'invalid_json', 'idempotency_key_required'].includes(error.code)
  )
    return true;
  if (error.status !== 409 || error.code !== 'business_rule' || typeof error.message !== 'string')
    return false;
  const fixed = [
    'That package is no longer offered.',
    'Choose a delivery date for a demo package.',
    'A demo delivery must be booked for a future date.',
    'Deliveries run Monday to Friday only. Choose a weekday.',
    'That package covers no delivery days.',
    'Choose a dish for the demo day.',
    'The kitchen is full for one of these days. Choose another kitchen or date, or reassign deliveries before reducing capacity.',
  ];
  return (
    fixed.includes(error.message) ||
    /^The kitchen is full on \d{4}-\d{2}-\d{2} \(\d+ meals\/day\)\. Raise her capacity or choose another mother\.$/.test(
      error.message,
    ) ||
    /^That address is \d+\.\d km from the kitchen, outside the \d+(?:\.\d+)? km delivery radius\.$/.test(
      error.message,
    ) ||
    /^Choose a dish for every weekday \(missing day [1-5]\)\.$/.test(error.message) ||
    /^".{1,500}" is no longer available\.$/.test(error.message) ||
    /^".{1,500}" is a (?:non-)?fasting dish, but this package needs a (?:non-)?fasting dish on day [1-5]\.$/.test(
      error.message,
    )
  );
}
export type OrderState = {
  ready: boolean;
  busy: boolean;
  pending: Journal | null;
  result: OrderDetail | null;
  issue: string | null;
  requestId: string | null;
  retryAt: number;
};
/** The journal is committed BEFORE network I/O. Unknown outcomes never unlock a new order. */
export function createOrderController(options: {
  owner: number;
  store: OrderStore;
  request: ClientRequest;
  randomKey: () => string;
  now?: () => number;
}) {
  const now = options.now ?? Date.now;
  let active = true;
  let state: OrderState = {
    ready: false,
    busy: false,
    pending: null,
    result: null,
    issue: null,
    requestId: null,
    retryAt: 0,
  };
  const listeners = new Set<() => void>();
  const submittedReviews = new WeakSet<OrderPayload>();
  let running = false;
  let abort: AbortController | null = null;
  let cooldown: ReturnType<typeof setTimeout> | undefined;
  const set = (next: Partial<OrderState>) => {
    if (!active) return;
    state = { ...state, ...next };
    listeners.forEach((f) => f());
  };
  const check = () => {
    if (!active || abort?.signal.aborted)
      throw new MobileApiError(0, 'request_aborted', 'Cancelled.');
  };
  const read = async () => {
    const raw = await options.store.read();
    return raw === null ? null : journal(raw, options.owner);
  };
  async function task(work: () => Promise<void>) {
    if (running || !active) return;
    running = true;
    abort = new AbortController();
    set({ busy: true, issue: null, requestId: null });
    try {
      await options.store.exclusive(async () => {
        check();
        await work();
      });
    } catch (e) {
      const delay =
        e instanceof MobileApiError && e.status === 429
          ? Math.min(Math.max(e.retryAfterSeconds ?? 60, 1), 86400) * 1000
          : 0;
      set({
        issue: e instanceof MobileApiError ? e.code : 'storage_error',
        requestId: e instanceof MobileApiError ? (e.requestId ?? null) : null,
        ...(delay ? { retryAt: now() + delay } : {}),
      });
      if (delay) {
        clearTimeout(cooldown);
        cooldown = setTimeout(() => {
          set({ retryAt: 0, ...(state.issue === 'rate_limited' ? { issue: null } : {}) });
        }, delay);
      }
    } finally {
      running = false;
      abort = null;
      set({ busy: false });
    }
  }
  async function persist(value: Journal) {
    await options.store.write(JSON.stringify(value));
    check();
    set({ pending: value });
  }
  async function send(record: Exclude<Journal, { state: 'confirmed' }>) {
    check();
    if (record.state === 'rejected') return;
    const first = record.state === 'prepared';
    const uncertain = { ...record, state: 'uncertain' as const };
    await persist(uncertain);
    try {
      const raw = await options.request<unknown>('client/orders', {
        method: 'POST',
        body: record.body,
        idempotencyKey: record.key,
        signal: abort?.signal,
      });
      check();
      const result = orderDetail(raw);
      await persist({
        version: 1,
        owner: options.owner,
        state: 'confirmed',
        orderId: result.order.id,
      });
      set({ result, ready: true, retryAt: 0 });
      clearTimeout(cooldown);
    } catch (e) {
      if (first && e instanceof MobileApiError && definitiveRefusal(e)) {
        await persist({ ...record, state: 'rejected' });
      }
      throw e;
    }
  }
  return {
    subscribe: (f: () => void) => {
      listeners.add(f);
      return () => {
        listeners.delete(f);
      };
    },
    getSnapshot: () => state,
    recover: () =>
      task(async () => {
        const record = await read();
        check();
        set({ pending: record, ready: true });
      }),
    create: (body: OrderPayload, observed = JSON.stringify(state.pending)) =>
      task(async () => {
        if (submittedReviews.has(body)) return;
        if (now() < state.retryAt) return;
        const existing = await read();
        check();
        // Another tab/controller may have completed an order since this review began.
        // Surface its receipt instead of turning a concurrent click into a new intention.
        if (JSON.stringify(existing) !== observed) {
          set({ pending: existing, ready: true });
          return;
        }
        if (existing && existing.state !== 'confirmed') {
          set({ pending: existing, ready: true });
          return;
        }
        const validated = payload(body);
        const record: Exclude<Journal, { state: 'confirmed' }> = {
          version: 1,
          owner: options.owner,
          key: options.randomKey(),
          body: validated,
          state: 'prepared',
          createdAt: new Date(now()).toISOString(),
        };
        journal(JSON.stringify(record), options.owner);
        await persist(record);
        submittedReviews.add(body);
        await send(record);
      }),
    retry: () =>
      task(async () => {
        if (now() < state.retryAt) return;
        const record = await read();
        check();
        if (record && record.state !== 'confirmed') await send(record);
        else set({ pending: record, ready: true });
      }),
    discardRejected: () =>
      task(async () => {
        const record = await read();
        check();
        if (record?.state !== 'rejected') return;
        await options.store.clear();
        check();
        set({ pending: null, issue: null, ready: true });
      }),
    dispose: () => {
      active = false;
      abort?.abort();
      clearTimeout(cooldown);
      listeners.clear();
    },
  };
}
export type OrderController = ReturnType<typeof createOrderController>;
