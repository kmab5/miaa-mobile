import { MobileApiError } from '@miaa/api';
export type Status = 'preparing' | 'packaged' | 'out_for_delivery' | 'delivered' | 'cancelled';
export type QueueItem = {
  id: number;
  stickerId: string;
  status: Status;
  dishNameEn: string | null;
  dishNameAm: string | null;
  dishIsFasting: boolean | null;
  nonSpicyRequested: boolean;
  clientName: string;
  addressNote: string | null;
  notes: string | null;
  isCompRedelivery: boolean;
};
export type MotherDay = {
  motherName: string;
  date: string;
  deadline: string;
  deadlinePassed: boolean;
  items: QueueItem[];
  tallies: {
    dishNameEn: string;
    dishNameAm: string;
    total: number;
    nonSpicy: number;
    remaining: number;
  }[];
  toPrepare: number;
  done: number;
  compMealTaken: boolean;
  openTickets: number;
};
export type DishOption = { id: number; nameEn: string; nameAm: string };
export type Ticket = {
  id: number;
  message: string;
  status: 'open' | 'resolved';
  createdAt: string;
  resolvedAt: string | null;
};
export function invalid(): never {
  throw new MobileApiError(502, 'invalid_response', 'Unexpected Mother API response.');
}
function obj(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return invalid();
  return v as Record<string, unknown>;
}
function str(v: unknown): string {
  if (typeof v !== 'string') return invalid();
  return v;
}
function nullable(v: unknown): string | null {
  return v === null ? null : str(v);
}
function bool(v: unknown): boolean {
  if (typeof v !== 'boolean') return invalid();
  return v;
}
function count(v: unknown): number {
  if (!Number.isSafeInteger(v) || Number(v) < 0) return invalid();
  return Number(v);
}
export function id(v: unknown): number {
  const n = count(v);
  if (!n || n > 2147483647) return invalid();
  return n;
}
export function validDate(v: unknown): v is string {
  return (
    typeof v === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    !v.startsWith('0000-') &&
    Number.isFinite(Date.parse(v + 'T00:00:00Z')) &&
    new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) === v
  );
}
function date(v: unknown): string {
  if (!validDate(v)) return invalid();
  return v;
}
function instant(v: unknown): string {
  const s = str(v);
  if (!/^\d{4}-\d\d-\d\dT/.test(s) || !Number.isFinite(Date.parse(s))) return invalid();
  return s;
}
function array<T>(v: unknown, parse: (v: unknown) => T): T[] {
  if (!Array.isArray(v)) return invalid();
  return v.map(parse);
}
function unique<T extends { id: number }>(items: T[]): T[] {
  if (new Set(items.map((x) => x.id)).size !== items.length) return invalid();
  return items;
}
export function parseStatus(v: unknown): Status {
  if (!['preparing', 'packaged', 'out_for_delivery', 'delivered', 'cancelled'].includes(String(v)))
    return invalid();
  return v as Status;
}
export function parseDay(v: unknown): MotherDay {
  const x = obj(v);
  const deadline = str(x.deadline);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(deadline)) return invalid();
  const items = unique(
    array(x.items, (v) => {
      const a = obj(v);
      return {
        id: id(a.id),
        stickerId: str(a.stickerId),
        status: parseStatus(a.status),
        dishNameEn: nullable(a.dishNameEn),
        dishNameAm: nullable(a.dishNameAm),
        dishIsFasting: a.dishIsFasting === null ? null : bool(a.dishIsFasting),
        nonSpicyRequested: bool(a.nonSpicyRequested),
        clientName: str(a.clientName),
        addressNote: nullable(a.addressNote),
        notes: nullable(a.notes),
        isCompRedelivery: bool(a.isCompRedelivery),
      };
    }),
  );
  const tallies = array(x.tallies, (v) => {
    const a = obj(v);
    const total = count(a.total),
      nonSpicy = count(a.nonSpicy),
      remaining = count(a.remaining);
    if (nonSpicy > total || remaining > total) return invalid();
    return {
      dishNameEn: str(a.dishNameEn),
      dishNameAm: str(a.dishNameAm),
      total,
      nonSpicy,
      remaining,
    };
  });
  return {
    motherName: str(x.motherName),
    date: date(x.date),
    deadline,
    deadlinePassed: bool(x.deadlinePassed),
    items,
    tallies,
    toPrepare: count(x.toPrepare),
    done: count(x.done),
    compMealTaken: bool(x.compMealTaken),
    openTickets: count(x.openTickets),
  };
}
export function parseDishes(v: unknown): DishOption[] {
  return unique(
    array(v, (v) => {
      const a = obj(v);
      return { id: id(a.id), nameEn: str(a.nameEn), nameAm: str(a.nameAm) };
    }),
  );
}
export function parseTickets(v: unknown): Ticket[] {
  const rows = unique(
    array(v, (v) => {
      const a = obj(v);
      if (a.status !== 'open' && a.status !== 'resolved') return invalid();
      return {
        id: id(a.id),
        message: str(a.message),
        status: a.status as Ticket['status'],
        createdAt: instant(a.createdAt),
        resolvedAt: a.resolvedAt === null ? null : instant(a.resolvedAt),
      };
    }),
  );
  if (rows.length > 50) return invalid();
  return rows;
}
export function parseOK(v: unknown) {
  if (obj(v).ok !== true) return invalid();
}
export function parsePackaged(v: unknown, expected: number) {
  const a = obj(v);
  if (id(a.id) !== expected || a.status !== 'packaged') return invalid();
  str(a.stickerId);
  instant(a.motherConfirmedAt);
}
export function todayEAT(now = Date.now()) {
  return new Date(now + 3 * 3600000).toISOString().slice(0, 10);
}
export function canPackage(day: MotherDay | null, itemId: number, now = Date.now()) {
  return (
    !!day &&
    day.date === todayEAT(now) &&
    !day.deadlinePassed &&
    now < Date.parse(`${day.date}T${day.deadline}:00+03:00`) &&
    day.items.some((x) => x.id === itemId && x.status === 'preparing')
  );
}
export function ticketMessage(value: string) {
  const text = value.trim();
  if (!text || text.length > 2000)
    throw new MobileApiError(400, 'invalid_input', 'Write a request of 1–2000 characters.');
  return text;
}
export type TicketMarker = { v: 1; digest: string; before: number[]; sentAt: string };
export function parseMarker(raw: string | null): TicketMarker | null {
  if (raw === null) return null;
  try {
    const x = obj(JSON.parse(raw));
    if (
      x.v !== 1 ||
      typeof x.digest !== 'string' ||
      !/^[a-f0-9]{64}$/.test(x.digest) ||
      !Array.isArray(x.before) ||
      x.before.length > 50
    )
      throw 0;
    return { v: 1, digest: x.digest, before: x.before.map(id), sentAt: instant(x.sentAt) };
  } catch {
    throw new MobileApiError(0, 'storage_error', 'Cannot read request recovery marker.');
  }
}
