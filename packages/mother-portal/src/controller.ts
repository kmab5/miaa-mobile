import { MobileApiError, type RequestOptions } from '@miaa/api';
import {
  canPackage,
  id,
  parseDay,
  parseDishes,
  parseMarker,
  parseOK,
  parsePackaged,
  parseTickets,
  ticketMessage,
  todayEAT,
  type MotherDay,
  type DishOption,
  type Ticket,
  type TicketMarker,
} from './contracts';
import type { TicketStore } from './storage';
export type Resource<T> = { data: T | null; busy: boolean; error: unknown };
export type MotherState = {
  day: Resource<MotherDay>;
  dishes: Resource<DishOption[]>;
  tickets: Resource<Ticket[]>;
  busy: boolean;
  issue: unknown;
  notice: 'packaged' | 'mealSaved' | 'ticketSent' | 'ticketRecovered' | 'cleared' | null;
  pending: TicketMarker | null;
  storageReady: boolean;
  retryAt: number;
};
const empty = <T>(): Resource<T> => ({ data: null, busy: false, error: null });
export function createMotherController(options: {
  request: <T>(path: string, input?: RequestOptions) => Promise<T>;
  store: TicketStore;
  digest: (text: string) => Promise<string>;
  now?: () => number;
}) {
  const now = options.now ?? Date.now;
  let state: MotherState = {
    day: empty(),
    dishes: empty(),
    tickets: empty(),
    busy: false,
    issue: null,
    notice: null,
    pending: null,
    storageReady: false,
    retryAt: 0,
  };
  let disposed = false;
  const listeners = new Set<() => void>();
  const revisions = { day: 0, dishes: 0, tickets: 0 };
  const aborts = new Set<AbortController>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const update = (patch: Partial<MotherState>) => {
    if (!disposed) {
      state = { ...state, ...patch };
      listeners.forEach((f) => f());
    }
  };
  function fault(code: string): never {
    throw new MobileApiError(0, code, 'Refresh and review before continuing.');
  }
  function alive() {
    if (disposed) fault('request_aborted');
  }
  function cooldown(error: unknown) {
    if (disposed) return;
    if (error instanceof MobileApiError && error.retryAfterSeconds) {
      const retryAt = Math.max(state.retryAt, now() + error.retryAfterSeconds * 1000);
      clearTimeout(timer);
      update({ retryAt });
      timer = setTimeout(() => update({ retryAt: 0 }), Math.max(0, retryAt - now()));
    }
  }
  function recordError(error: unknown) {
    cooldown(error);
    update({ issue: error });
  }
  async function request<T>(path: string, input?: RequestOptions) {
    alive();
    const ac = new AbortController();
    aborts.add(ac);
    try {
      const value = await options.request<T>(path, { ...input, signal: ac.signal });
      alive();
      return value;
    } finally {
      aborts.delete(ac);
    }
  }
  async function read<K extends 'day' | 'dishes' | 'tickets'>(
    key: K,
  ): Promise<MotherState[K]['data']> {
    const revision = ++revisions[key];
    update({ [key]: { data: null, busy: true, error: null } });
    try {
      const raw = await request<unknown>(`mother/${key}`);
      const data =
        key === 'day' ? parseDay(raw) : key === 'dishes' ? parseDishes(raw) : parseTickets(raw);
      if (revision === revisions[key]) update({ [key]: { data, busy: false, error: null } });
      return data as MotherState[K]['data'];
    } catch (error) {
      if (revision === revisions[key]) {
        cooldown(error);
        update({ [key]: { data: null, busy: false, error } });
      }
      return null;
    }
  }
  async function mutate(work: () => Promise<void>) {
    if (disposed || state.busy || state.retryAt > now()) return;
    update({ busy: true, issue: null, notice: null });
    try {
      await work();
    } catch (error) {
      recordError(error);
    } finally {
      update({ busy: false });
    }
  }
  async function storageExclusive(work: () => Promise<void>) {
    try {
      await options.store.exclusive(async () => {
        alive();
        await work();
      });
    } catch (error) {
      if (error instanceof MobileApiError && error.code !== 'storage_error') throw error;
      update({ storageReady: false });
      fault('storage_error');
    }
  }
  async function recover() {
    try {
      await storageExclusive(async () => {
        const pending = parseMarker(await options.store.read());
        alive();
        update({ pending, storageReady: true, issue: null });
      });
    } catch {
      update({
        storageReady: false,
        issue: new MobileApiError(0, 'storage_error', 'Recovery storage unavailable.'),
      });
    }
  }
  async function reconcileTickets() {
    await mutate(async () => {
      const tickets = await read('tickets');
      if (!tickets) return;
      await storageExclusive(async () => {
        let marker: TicketMarker | null;
        try {
          marker = parseMarker(await options.store.read());
        } catch {
          update({ storageReady: false });
          return fault('storage_error');
        }
        update({ pending: marker, storageReady: true });
        if (marker) {
          for (const ticket of tickets) {
            if (
              ticket.id > Math.max(0, ...marker.before) &&
              (await options.digest(ticket.message.trim())) === marker.digest
            ) {
              alive();
              await options.store.clear();
              update({ pending: null, notice: 'ticketRecovered' });
              return;
            }
          }
        }
      });
    });
  }
  return {
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    getSnapshot: () => state,
    recover,
    refreshDay: () => read('day'),
    refreshDishes: () => read('dishes'),
    refreshTickets: reconcileTickets,
    async package(itemId: number) {
      await mutate(async () => {
        id(itemId);
        const day = await read('day');
        if (!canPackage(day, itemId, now())) return fault('deadline_or_state');
        parsePackaged(
          await request(`mother/deliveries/${itemId}/package`, { method: 'POST' }),
          itemId,
        );
        update({ notice: 'packaged' });
        await read('day');
      });
    },
    async meal(dishId: number | null) {
      await mutate(async () => {
        const expected = todayEAT(now());
        const [day, dishes] = await Promise.all([read('day'), read('dishes')]);
        if (!day || !dishes) return fault('refresh_required');
        if (day.date !== expected || todayEAT(now()) !== expected) return fault('refresh_required');
        if (day.compMealTaken) {
          update({ notice: 'mealSaved' });
          return;
        }
        if (dishId !== null && !dishes.some((x) => x.id === dishId)) return fault('invalid_input');
        parseOK(await request('mother/comp-meal', { method: 'POST', body: { dishId } }));
        update({ notice: 'mealSaved' });
        await read('day');
      });
    },
    async submitTicket(message: string) {
      await mutate(async () => {
        const text = ticketMessage(message);
        await storageExclusive(async () => {
          let pending: TicketMarker | null;
          try {
            pending = parseMarker(await options.store.read());
          } catch {
            update({ storageReady: false });
            return fault('storage_error');
          }
          update({ pending, storageReady: true });
          if (pending) return fault('request_pending');
          const tickets = await read('tickets');
          if (!tickets) return fault('refresh_required');
          const digest = await options.digest(text);
          alive();
          const marker: TicketMarker = {
            v: 1,
            digest,
            before: tickets.map((x) => x.id),
            sentAt: new Date(now()).toISOString(),
          };
          try {
            await options.store.write(JSON.stringify(marker));
          } catch {
            update({ storageReady: false });
            return fault('storage_error');
          }
          update({ pending: marker });
          alive();
          try {
            parseOK(await request('mother/tickets', { method: 'POST', body: { message: text } }));
          } catch (error) {
            // Only transport/parser/refusal responses known to happen before the insert prove no ticket.
            if (
              error instanceof MobileApiError &&
              [400, 401, 403, 413, 415, 429].includes(error.status)
            ) {
              await options.store.clear();
              update({ pending: null });
            }
            throw error;
          }
          await options.store.clear();
          update({ pending: null, notice: 'ticketSent' });
          await Promise.all([read('tickets'), read('day')]);
        });
      });
    },
    async clearReviewedPending(expected: TicketMarker) {
      await mutate(async () => {
        await storageExclusive(async () => {
          const current = parseMarker(await options.store.read());
          if (current && JSON.stringify(current) !== JSON.stringify(expected)) {
            update({ pending: current, storageReady: true });
            return fault('request_pending');
          }
          await options.store.clear();
          alive();
          update({ pending: null, storageReady: true, notice: 'cleared' });
        });
      });
    },
    dispose() {
      disposed = true;
      clearTimeout(timer);
      aborts.forEach((x) => x.abort());
      aborts.clear();
      listeners.clear();
    },
  };
}
export type MotherController = ReturnType<typeof createMotherController>;
