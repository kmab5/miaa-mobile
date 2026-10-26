import { MobileApiError, type RequestOptions } from '@miaa/api';
import {
  allItems,
  dateOnly,
  fault,
  normalizeSticker,
  parseDishes,
  parseEarnings,
  parseItem,
  parseOK,
  parseReceipt,
  parseRun,
  todayEAT,
  type CyclistDay,
  type DishOption,
  type Earnings,
  type RunItem,
} from './contracts';
export type Resource<T> = { data: T | null; date: string | null; busy: boolean; error: unknown };
export type Review = { date: string; item: RunItem; action: 'collect' | 'confirm' };
export type CyclistState = {
  run: Resource<CyclistDay>;
  dishes: Resource<DishOption[]>;
  earnings: Resource<Earnings>;
  lookup: Resource<RunItem> & { query: string };
  busy: boolean;
  issue: unknown;
  notice: 'collected' | 'confirmed' | 'mealSaved' | null;
  retryAt: number;
};
const empty = <T>(): Resource<T> => ({ data: null, date: null, busy: false, error: null });
export function createCyclistController(options: {
  request: <T>(path: string, input?: RequestOptions) => Promise<T>;
  now?: () => number;
}) {
  const now = options.now ?? Date.now;
  let state: CyclistState = {
    run: empty(),
    dishes: empty(),
    earnings: empty(),
    lookup: { ...empty(), query: '' },
    busy: false,
    issue: null,
    notice: null,
    retryAt: 0,
  };
  let disposed = false;
  const listeners = new Set<() => void>();
  const reads = new Map<string, { revision: number; abort: AbortController }>();
  let sequence = 0;
  const writes = new Set<AbortController>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const reviews = new WeakSet<Review>();
  const consumed = new WeakSet<Review>();
  const update = (patch: Partial<CyclistState>) => {
    if (!disposed) {
      state = { ...state, ...patch };
      listeners.forEach((f) => f());
    }
  };
  const alive = () => {
    if (disposed) fault('request_aborted');
  };
  function cooldown(error: unknown) {
    if (disposed) return;
    if (error instanceof MobileApiError && error.retryAfterSeconds) {
      const retryAt = Math.max(state.retryAt, now() + error.retryAfterSeconds * 1000);
      clearTimeout(timer);
      update({ retryAt });
      timer = setTimeout(() => update({ retryAt: 0 }), Math.max(0, retryAt - now()));
    }
  }
  async function read<K extends 'run' | 'dishes' | 'earnings'>(
    key: K,
    date = todayEAT(now()),
  ): Promise<CyclistState[K]['data']> {
    const revision = ++sequence;
    const ac = new AbortController();
    reads.get(key)?.abort.abort();
    reads.set(key, { revision, abort: ac });
    update({ [key]: { data: null, date, busy: true, error: null } });
    try {
      alive();
      const raw = await options.request<unknown>(`cyclist/${key}?date=${date}`, {
        signal: ac.signal,
      });
      alive();
      if (ac.signal.aborted || reads.get(key)?.revision !== revision) return null;
      const data =
        key === 'run'
          ? parseRun(raw, date)
          : key === 'dishes'
            ? parseDishes(raw)
            : parseEarnings(raw);
      update({ [key]: { data, date, busy: false, error: null } });
      return data as CyclistState[K]['data'];
    } catch (error) {
      if (!ac.signal.aborted && reads.get(key)?.revision === revision) {
        cooldown(error);
        update({ [key]: { data: null, date, busy: false, error } });
      }
      return null;
    }
  }
  function clearLookup() {
    reads.get('lookup')?.abort.abort();
    reads.delete('lookup');
    update({ lookup: { ...empty(), query: '' } });
  }
  async function lookup(value: string) {
    clearLookup();
    const date = todayEAT(now());
    let query: string;
    try {
      query = normalizeSticker(value);
    } catch (error) {
      update({ lookup: { ...empty(), query: '', error } });
      return;
    }
    const ac = new AbortController();
    const revision = ++sequence;
    reads.set('lookup', { revision, abort: ac });
    update({ lookup: { data: null, date, query, busy: true, error: null } });
    try {
      alive();
      const item = parseItem(
        await options.request(`cyclist/lookup?sticker=${encodeURIComponent(query)}&date=${date}`, {
          signal: ac.signal,
        }),
      );
      alive();
      if (ac.signal.aborted || reads.get('lookup')?.revision !== revision) return;
      if (item.stickerId.toUpperCase() !== query || item.status === 'cancelled') fault();
      update({ lookup: { data: item, date, query, busy: false, error: null } });
    } catch (error) {
      if (!ac.signal.aborted && reads.get('lookup')?.revision === revision) {
        cooldown(error);
        update({ lookup: { data: null, date, query, busy: false, error } });
      }
    }
  }
  async function post(path: string, body?: unknown) {
    alive();
    const ac = new AbortController();
    writes.add(ac);
    try {
      const raw = await options.request(path, {
        method: 'POST',
        ...(body === undefined ? {} : { body }),
        signal: ac.signal,
      });
      alive();
      return raw;
    } finally {
      writes.delete(ac);
    }
  }
  async function mutate(work: () => Promise<void>) {
    if (disposed || state.busy || state.retryAt > now()) return;
    update({ busy: true, issue: null, notice: null });
    try {
      await work();
    } catch (error) {
      cooldown(error);
      update({ issue: error });
    } finally {
      update({ busy: false });
    }
  }
  function review(item: RunItem, action: 'collect' | 'confirm', date: string): Review {
    alive();
    dateOnly(date);
    const known =
      state.run.data && state.run.date === date
        ? allItems(state.run.data).find((x) => x.id === item.id)
        : null;
    const found = known ?? (state.lookup.date === date ? state.lookup.data : null);
    if (
      !found ||
      JSON.stringify(found) !== JSON.stringify(item) ||
      date !== todayEAT(now()) ||
      item.status !== (action === 'collect' ? 'packaged' : 'out_for_delivery')
    )
      return fault('state_changed');
    const result: Review = Object.freeze({ date, item: Object.freeze({ ...item }), action });
    reviews.add(result);
    return result;
  }
  return {
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    getSnapshot: () => state,
    refreshRun: () => read('run'),
    refreshDishes: () => read('dishes'),
    refreshEarnings: () => read('earnings'),
    lookup,
    clearLookup,
    review,
    async commit(review: Review) {
      await mutate(async () => {
        if (!reviews.has(review) || consumed.has(review)) return fault('state_changed');
        consumed.add(review);
        if (review.date !== todayEAT(now())) return fault('state_changed');
        const run = await read('run', review.date);
        if (!run) return fault('refresh_required');
        const item = allItems(run).find((x) => x.id === review.item.id);
        if (
          !item ||
          JSON.stringify(item) !== JSON.stringify(review.item) ||
          review.date !== todayEAT(now())
        ) {
          clearLookup();
          return fault('state_changed');
        }
        parseReceipt(
          await post(`cyclist/deliveries/${item.id}/${review.action}`),
          item,
          review.action,
        );
        clearLookup();
        update({ notice: review.action === 'collect' ? 'collected' : 'confirmed' });
        await Promise.all([read('run'), read('earnings')]);
      });
    },
    async meal(dishId: number | null, expectedDate: string) {
      await mutate(async () => {
        dateOnly(expectedDate);
        if (expectedDate !== todayEAT(now())) return fault('state_changed');
        const [run, dishes] = await Promise.all([
          read('run', expectedDate),
          read('dishes', expectedDate),
        ]);
        if (!run || !dishes) return fault('refresh_required');
        if (expectedDate !== todayEAT(now())) return fault('state_changed');
        if (run.compMealTaken) {
          update({ notice: 'mealSaved' });
          return;
        }
        if (dishId !== null && !dishes.some((x) => x.id === dishId)) return fault('invalid_input');
        parseOK(await post('cyclist/comp-meal', { dishId }));
        update({ notice: 'mealSaved' });
        await read('run');
      });
    },
    dispose() {
      disposed = true;
      clearTimeout(timer);
      reads.forEach((x) => x.abort.abort());
      writes.forEach((x) => x.abort());
      reads.clear();
      writes.clear();
      listeners.clear();
    },
  };
}
export type CyclistController = ReturnType<typeof createCyclistController>;
