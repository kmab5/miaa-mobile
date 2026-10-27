import { createHash } from 'node:crypto';
import { createAuthController } from '../packages/auth/src/controller';
import type { AppRole } from '@miaa/api';
import { createAdminController, type ActionStore } from '../packages/admin-portal/src/controller';
import { action } from '../packages/admin-portal/src/forms';
import { type Row } from '../packages/admin-portal/src/contracts';
import { createMotherController } from '../packages/mother-portal/src/controller';
import { createCyclistController } from '../packages/cyclist-portal/src/controller';
import { allItems } from '../packages/cyclist-portal/src/contracts';
import { lunch } from '../packages/client-portal/src/validation';
import { adminDelivery, adminBoard, adminOrderDetail, adminSub, adminNow } from './fixtures/admin';

const lunches = (v: unknown) => {
  if (!Array.isArray(v)) throw new Error('Expected lunch list');
  return v.map(lunch);
};

/** Shared HTTP contract fixture, not a database/backend integration test. No production requests. */
async function scenario() {
  const roles: AppRole[] = ['admin', 'mother', 'cyclist', 'client'];
  const tokens = Object.fromEntries(
    roles.map((r, i) => [r, 'miaa_m1_' + String.fromCharCode(97 + i).repeat(43)]),
  );
  const revoked = new Set<string>();
  const delivery = structuredClone(adminDelivery);
  const paymentStatus = 'pending';
  const calls: { role: AppRole; path: string; method: string }[] = [];
  const runItem = () => ({
    id: delivery.id,
    stickerId: delivery.stickerId,
    status: delivery.status,
    dishNameEn: delivery.dishNameEn,
    dishNameAm: delivery.dishNameAm,
    clientName: delivery.clientName,
    clientPhone: delivery.clientPhone,
    addressNote: delivery.addressNote,
    latitude: delivery.latitude,
    longitude: delivery.longitude,
    notes: delivery.notes,
    isCompRedelivery: delivery.isCompRedelivery,
  });
  const reply = (data: unknown) => Response.json({ data });
  const failure = (status: number, code: string) =>
    Response.json({ error: { code, message: code } }, { status });
  const fetcher = jest.fn(async (url: unknown, input?: RequestInit) => {
    const path = String(url).split('/api/v1/')[1]!,
      method = input?.method ?? 'GET';
    const token = (input?.headers as Record<string, string>)?.Authorization?.slice(7) ?? '';
    const role = roles.find((r) => tokens[r] === token);
    if (!role || revoked.has(token)) return failure(401, 'unauthorized');
    calls.push({ role, path, method });
    if (path === 'me')
      return reply({
        user: {
          id: roles.indexOf(role) + 1,
          role,
          phoneNumber: '+251911111111',
          email: null,
          locale: 'en',
        },
        expiresAt: '2026-11-10T00:00:00Z',
      });
    if (path === 'auth/session' && method === 'DELETE') {
      revoked.add(token);
      return reply({ ok: true });
    }
    if (!path.startsWith(role + '/')) return failure(403, 'forbidden');
    if (path === 'admin/day?date=2026-10-26') {
      const counts = Object.fromEntries(
        ['preparing', 'packaged', 'out_for_delivery', 'delivered', 'cancelled'].map((s) => [
          s,
          delivery.status === s ? 1 : 0,
        ]),
      );
      return reply({
        ...adminBoard,
        total: delivery.status === 'cancelled' ? 0 : 1,
        counts,
        groups: [
          {
            motherId: 1,
            motherName: 'Test Kitchen',
            capacity: 20,
            counts,
            unassignedCount: 0,
            deliveries: [delivery],
          },
        ],
      });
    }
    if (path === 'admin/orders/9') return reply({ ...adminOrderDetail, subscription: adminSub });
    if (path === 'admin/orders/9/cancel' && method === 'POST') {
      if (delivery.status !== 'delivered') delivery.status = 'cancelled';
      return reply({
        subscription: { ...adminSub, status: 'cancelled' },
        refundDue: false,
        deliveredCount: delivery.status === 'delivered' ? 1 : 0,
        cancelledDeliveries: delivery.status === 'cancelled' ? 1 : 0,
      });
    }
    if (path === 'mother/day') {
      const live = delivery.status !== 'cancelled',
        preparing = live && delivery.status === 'preparing';
      return reply({
        motherName: 'Test Kitchen',
        date: '2026-10-26',
        deadline: '11:00',
        deadlinePassed: false,
        items: live
          ? [
              {
                ...runItem(),
                dishIsFasting: delivery.dishIsFasting,
                nonSpicyRequested: delivery.nonSpicyRequested,
              },
            ]
          : [],
        tallies: live
          ? [
              {
                dishNameEn: 'Shiro',
                dishNameAm: 'ሽሮ',
                total: 1,
                nonSpicy: 1,
                remaining: preparing ? 1 : 0,
              },
            ]
          : [],
        toPrepare: preparing ? 1 : 0,
        done: live && !preparing ? 1 : 0,
        compMealTaken: false,
        openTickets: 0,
      });
    }
    if (path === 'mother/deliveries/8/package' && method === 'POST') {
      if (delivery.status !== 'preparing') return failure(409, 'business_rule');
      delivery.status = 'packaged';
      delivery.motherConfirmedAt = new Date(adminNow).toISOString();
      return reply({ ...delivery, stickerId: delivery.stickerId });
    }
    if (path === 'cyclist/run?date=2026-10-26') {
      const list = (status: string) => (delivery.status === status ? [runItem()] : []);
      return reply({
        cyclistName: 'Test Cyclist',
        motherName: 'Test Kitchen',
        motherPhone: '+251911111111',
        motherAddress: 'Kitchen gate',
        date: '2026-10-26',
        deadline: '11:00',
        readyToCollect: list('packaged'),
        onTheWay: list('out_for_delivery'),
        delivered: list('delivered'),
        stillCooking: delivery.status === 'preparing' ? 1 : 0,
        total: delivery.status === 'cancelled' ? 0 : 1,
        compMealTaken: false,
      });
    }
    if (path === 'cyclist/earnings?date=2026-10-26')
      return reply({
        deliveriesToday: delivery.status === 'delivered' ? 1 : 0,
        deliveriesThisWeek: delivery.status === 'delivered' ? 1 : 0,
        ratePerDelivery: '25.00',
      });
    if (path === 'cyclist/deliveries/8/collect' && method === 'POST') {
      if (delivery.status !== 'packaged') return failure(409, 'business_rule');
      delivery.status = 'out_for_delivery';
      return reply(delivery);
    }
    if (path === 'cyclist/deliveries/8/confirm' && method === 'POST') {
      if (delivery.status !== 'out_for_delivery') return failure(409, 'business_rule');
      delivery.status = 'delivered';
      delivery.cyclistConfirmedAt = new Date(adminNow).toISOString();
      return reply(delivery);
    }
    if (path === 'client/today')
      return reply(
        delivery.status === 'cancelled'
          ? []
          : [
              {
                ...runItem(),
                deliveryId: delivery.id,
                motherName: delivery.motherName,
                cyclistName: delivery.cyclistName,
                cyclistPhone: delivery.cyclistPhone,
              },
            ],
      );
    return failure(404, 'not_found');
  }) as typeof fetch;
  const sessions = await Promise.all(
    roles.map(async (role) => {
      let saved: string | null = tokens[role]!;
      const auth = createAuthController({
        role,
        origin: 'https://miaa.example',
        now: () => adminNow,
        fetch: fetcher,
        storage: {
          get: async () => saved,
          set: async (v) => {
            saved = v;
          },
          clear: async () => {
            saved = null;
          },
        },
      });
      await auth.start();
      expect(auth.getSnapshot().phase).toBe('signedIn');
      return auth;
    }),
  );
  const auth = Object.fromEntries(roles.map((r, i) => [r, sessions[i]!])) as Record<
    AppRole,
    (typeof sessions)[number]
  >;
  const store = (): ActionStore => {
    let disk: string | null = null;
    let chain: Promise<unknown> = Promise.resolve();
    return {
      read: async () => disk,
      write: async (v) => {
        disk = v;
      },
      clear: async () => {
        disk = null;
      },
      exclusive: (work) => {
        const task = chain.catch(() => undefined).then(work);
        chain = task;
        return task;
      },
    };
  };
  const admin = createAdminController({
    request: auth.admin.request,
    store: store(),
    now: () => adminNow,
    randomKey: () => 'miaa-admin-12345678-1234-1234-1234-123456789012',
  });
  const mother = createMotherController({
    request: auth.mother.request,
    store: store(),
    now: () => adminNow,
    digest: async (v) => createHash('sha256').update(v).digest('hex'),
  });
  const cyclist = createCyclistController({ request: auth.cyclist.request, now: () => adminNow });
  await admin.recover();
  await mother.recover();
  return {
    auth,
    admin,
    mother,
    cyclist,
    calls,
    delivery,
    get paymentStatus() {
      return paymentStatus;
    },
    revoke: (role: AppRole) => revoked.add(tokens[role]!),
    dispose() {
      admin.dispose();
      mother.dispose();
      cyclist.dispose();
      sessions.forEach((s) => s.setActive(false));
    },
  };
}
test('one pending-payment delivery progresses from kitchen to rider and client across four authenticated apps', async () => {
  const s = await scenario();
  try {
    const board = (await s.admin.load('day?date=2026-10-26')) as Row;
    expect((board.counts as Row).preparing).toBe(1);
    await s.mother.refreshDay();
    expect(s.mother.getSnapshot().day.data?.toPrepare).toBe(1);
    await s.cyclist.refreshRun();
    expect(s.cyclist.getSnapshot().run.data?.stillCooking).toBe(1);
    expect(lunches(await s.auth.client.request('client/today'))[0]?.status).toBe('preparing');
    await s.mother.package(8);
    expect(s.mother.getSnapshot().notice).toBe('packaged');
    await s.cyclist.refreshRun();
    const first = s.cyclist.getSnapshot().run.data!.readyToCollect[0]!;
    expect(first.stickerId).toBe('MA-9-01');
    await s.cyclist.commit(s.cyclist.review(first, 'collect', '2026-10-26'));
    expect(lunches(await s.auth.client.request('client/today'))[0]?.status).toBe(
      'out_for_delivery',
    );
    const onWay = s.cyclist.getSnapshot().run.data!.onTheWay[0]!;
    await s.cyclist.commit(s.cyclist.review(onWay, 'confirm', '2026-10-26'));
    expect(lunches(await s.auth.client.request('client/today'))[0]?.status).toBe('delivered');
    expect(s.cyclist.getSnapshot().earnings.data?.deliveriesToday).toBe(1);
    const final = (await s.admin.load('day?date=2026-10-26')) as Row;
    expect((final.counts as Row).delivered).toBe(1);
    expect(s.paymentStatus).toBe('pending');
    expect(s.calls.filter((c) => c.method === 'POST')).toHaveLength(3);
  } finally {
    s.dispose();
  }
});
test('Admin cancellation removes unfinished work from both staff queues and client today', async () => {
  const s = await scenario();
  try {
    const source = await s.admin.load('orders/9');
    const review = s.admin.review(
      action('cancelOrder', {}, 9, { path: 'orders/9', fingerprint: JSON.stringify(source) }),
    );
    expect(Object.isFrozen(review.action.guard)).toBe(true);
    await s.admin.commit(review);
    expect(s.admin.getSnapshot().notice).toBe('saved');
    await s.mother.refreshDay();
    await s.cyclist.refreshRun();
    expect(s.mother.getSnapshot().day.data?.items).toEqual([]);
    expect(allItems(s.cyclist.getSnapshot().run.data!)).toEqual([]);
    expect(lunches(await s.auth.client.request('client/today'))).toEqual([]);
    expect(s.delivery.status).toBe('cancelled');
    expect(s.paymentStatus).toBe('pending');
  } finally {
    s.dispose();
  }
});
test('a kitchen transition invalidates a stale Admin delivery review before a conflicting mutation', async () => {
  const s = await scenario();
  try {
    const path = 'day?date=2026-10-26',
      source = await s.admin.load(path);
    const review = s.admin.review(
      action('assignment', { cyclistId: 2 }, 8, { path, fingerprint: JSON.stringify(source) }),
    );
    await s.mother.package(8);
    await s.admin.commit(review);
    expect(s.admin.getSnapshot().issue).toMatchObject({ code: 'state_changed' });
    expect(s.calls.some((c) => c.method === 'PATCH')).toBe(false);
  } finally {
    s.dispose();
  }
});
test.each(['admin', 'mother', 'cyclist', 'client'] as const)(
  '%s cannot request private work while backgrounded or after revocation',
  async (role) => {
    const s = await scenario();
    try {
      const auth = s.auth[role],
        before = s.calls.length;
      auth.setActive(false);
      expect(auth.getSnapshot()).toMatchObject({ phase: 'blocked', user: null });
      await expect(auth.request(role + '/day')).rejects.toMatchObject({ code: 'session_expired' });
      expect(s.calls).toHaveLength(before);
      s.revoke(role);
      auth.setActive(true);
      // Foreground validation is asynchronous; retry joins its validation promise.
      await auth.retry();
      expect(auth.getSnapshot().phase).not.toBe('signedIn');
      expect(auth.getSnapshot().user).toBeNull();
    } finally {
      s.dispose();
    }
  },
);
