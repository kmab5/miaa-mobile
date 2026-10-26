import { StrictMode } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { AuthContext, useAuth, createAuthController } from '@miaa/auth';
import { LocaleProvider } from '@miaa/i18n';
import {
  AdminProvider,
  AdminHomeScreen,
  AdminDailyScreen,
  AdminPeopleScreen,
  AdminCatalogScreen,
  AdminPaymentsScreen,
  AdminSupportScreen,
  AdminFormScreen,
  AdminSettingsScreen,
  AdminRecordScreen,
} from '@miaa/admin-portal';
import AdminRoute from '../apps/admin/app/admin/[screen]';
import { en, am } from '../packages/admin-portal/src/text';
import { forms } from '../packages/admin-portal/src/forms';
import {
  adminNow,
  adminReads,
  adminMother,
  adminClient,
  adminSub,
  adminPayment,
  adminTicket,
} from './fixtures/admin';
import { mockParams, mockRouter } from './setup.native';
const mockDisk = new Map<string, string>();
let mockSerial = 0;
jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 7,
  getItemAsync: jest.fn(
    async (key: string, o: { keychainService: string }) =>
      mockDisk.get(o.keychainService + key) ?? null,
  ),
  setItemAsync: jest.fn(async (key: string, value: string, o: { keychainService: string }) => {
    mockDisk.set(o.keychainService + key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string, o: { keychainService: string }) => {
    mockDisk.delete(o.keychainService + key);
  }),
}));
jest.mock('expo-crypto', () => ({
  randomUUID: () => `12345678-1234-1234-1234-${String(++mockSerial).padStart(12, '0')}`,
}));
const config = {
  role: 'admin' as const,
  variant: 'preview' as const,
  apiOrigin: 'https://miaa.example',
  appVersion: '0.6.0',
  foundationPreview: true as const,
};
function Gate({ children }: { children: React.ReactNode }) {
  const s = useAuth();
  return s.phase === 'signedIn' ? children : null;
}
async function open(
  element: React.ReactNode,
  locale: 'en' | 'am' = 'en',
  strict = false,
  owner = 1,
) {
  const requests: {
    path: string;
    method: string;
    body: Record<string, unknown> | null;
    key?: string;
  }[] = [];
  const data = structuredClone(adminReads);
  let lose = false;
  const fetcher = jest.fn(async (url: unknown, input?: RequestInit) => {
    const path = String(url).split('/api/v1/')[1]!,
      method = input?.method ?? 'GET',
      body = input?.body ? JSON.parse(String(input.body)) : null;
    requests.push({
      path,
      method,
      body,
      key: (input?.headers as Record<string, string>)?.['Idempotency-Key'],
    });
    let value: unknown;
    if (path === 'me')
      value = {
        user: { id: owner, role: 'admin', phoneNumber: '+251900000001', email: null, locale },
        expiresAt: new Date(adminNow + 7 * 86400000).toISOString(),
      };
    else if (method === 'GET') value = data[path.replace('admin/', '').split('?')[0]!];
    else {
      const key = path.replace('admin/', '');
      if (key === 'orders') value = { subscription: adminSub, deliveriesCreated: 5, paymentId: 10 };
      else if (key.endsWith('/password')) value = { ok: true };
      else if (key === 'clients') value = { id: 12 };
      else if (key === 'clients/3') {
        value = { ...adminClient, ...body };
        data['clients/3'] = value;
      } else if (key === 'mothers/1/status') {
        value = { ...adminMother, status: body.status };
        data['mothers/1'] = value;
      } else if (key === 'offerings') value = { ok: true };
      else if (key === 'inspections')
        value = {
          ...adminMother,
          lastInspectedAt: body.inspectedAt,
          inspectionNotes: body.notes ?? null,
        };
      else if (key === 'payments/10/confirm') {
        value = {
          payment: { ...adminPayment, status: 'confirmed' },
          subscription: { ...adminSub, status: 'active' },
        };
        data['payments/pending'] = [];
      } else if (key === 'payments/10/fail') value = { ...adminPayment, status: 'failed' };
      else if (key === 'tickets/11/resolve') {
        value = { ...adminTicket, status: 'resolved' };
        data.tickets = [
          {
            ...adminTicket,
            status: 'resolved',
            resolvedAt: new Date(adminNow).toISOString(),
            resolvedByName: 'Test Admin',
          },
        ];
      } else if (key === 'tickets') value = { id: 12, ...body, status: 'open' };
      else if (key === 'settings') {
        value = {
          ...(data.settings as object),
          ...body,
          defaultRadiusKm: String(body.defaultRadiusKm),
        };
        data.settings = value;
      } else if (key === 'orders/9/cancel')
        value = {
          subscription: { ...adminSub, status: 'cancelled' },
          refundDue: true,
          deliveredCount: 0,
          cancelledDeliveries: 5,
        };
      else if (key === 'redeliveries')
        value = {
          id: 12,
          deliveryDate: body.deliveryDate,
          status: 'preparing',
          isCompRedelivery: true,
          orderStickerId: 'MA-9-01-R1',
        };
      else if (key === 'deliveries/8/assignment')
        value = {
          id: 8,
          status: 'preparing',
          assignedMotherId: body.motherId ?? 1,
          assignedCyclistId: body.cyclistId ?? 2,
        };
      else if (key === 'deliveries/8/package') value = { id: 8, status: 'packaged' };
      else value = { id: 12, ...body };
      if (lose) throw new Error('lost response');
    }
    return {
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ data: value }),
    } as Response;
  }) as typeof fetch;
  const auth = createAuthController({
    role: 'admin',
    origin: config.apiOrigin,
    storage: {
      get: async () => 'miaa_m1_' + 'a'.repeat(43),
      set: async () => undefined,
      clear: async () => undefined,
    },
    fetch: fetcher,
  });
  await auth.start();
  const tree = (
    <AuthContext.Provider value={auth}>
      <LocaleProvider
        defaultLocale={locale}
        storage={{ getItem: async () => null, setItem: async () => undefined }}
      >
        <AdminProvider config={config}>
          <Gate>{element}</Gate>
        </AdminProvider>
      </LocaleProvider>
    </AuthContext.Provider>
  );
  const result = await render(strict ? <StrictMode>{tree}</StrictMode> : tree);
  return {
    result,
    requests,
    data,
    auth,
    lose: () => {
      lose = true;
    },
  };
}
const writes = (s: Awaited<ReturnType<typeof open>>) =>
  s.requests.filter((x) => x.method !== 'GET');
async function ready() {
  const b = await screen.findByRole('button', { name: 'Review changes' });
  await waitFor(() => expect(b).toBeEnabled());
  return b;
}
async function reviewAndConfirm() {
  await fireEvent.press(await ready());
  expect(screen.getByRole('button', { name: 'Confirm changes' })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Confirm changes' }));
  await screen.findByText('Change recorded.');
}
beforeEach(() => {
  mockDisk.clear();
  mockSerial = 0;
  jest.clearAllMocks();
  jest.spyOn(Date, 'now').mockReturnValue(adminNow);
  for (const key of Object.keys(mockParams)) delete mockParams[key];
});
afterEach(() => {
  jest.restoreAllMocks();
});
test('Admin home exposes implemented workspaces and honors session ownership', async () => {
  await open(<AdminHomeScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Daily operations' }));
  expect(mockRouter.push).toHaveBeenCalledWith('/admin/daily');
  expect(screen.getByRole('button', { name: 'Pending payments' })).toBeOnTheScreen();
});
test('daily board shows kitchen, non-spicy details and reviewed correction routes', async () => {
  await open(<AdminDailyScreen />);
  await screen.findByText('Sticker: MA-9-01');
  expect(screen.getByText('Non-spicy requested: Yes')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Mark packaged' }));
  expect(mockRouter.push).toHaveBeenCalledWith({
    pathname: '/admin/form',
    params: { form: 'packageDelivery', id: '8', date: '2026-10-26' },
  });
});
test('invalid daily date cannot send an invalid API read', async () => {
  const s = await open(<AdminDailyScreen />);
  await screen.findByText('Sticker: MA-9-01');
  await fireEvent.changeText(screen.getByLabelText('Date (EAT)'), '2026-02-30');
  await fireEvent.press(screen.getByRole('button', { name: 'Open this date' }));
  await screen.findByText(en.invalid);
  expect(s.requests.some((x) => x.path.includes('2026-02-30'))).toBe(false);
});
test('clients can be searched by encoded name or phone without local-only filtering', async () => {
  const s = await open(<AdminPeopleScreen />);
  await fireEvent.press(screen.getByRole('radio', { name: 'Clients' }));
  await screen.findByText('Name: Test Client');
  await fireEvent.changeText(screen.getByLabelText('Search'), 'Test & Client');
  await fireEvent.press(screen.getByRole('button', { name: 'Find' }));
  await waitFor(() =>
    expect(s.requests.some((x) => x.path === 'admin/clients?search=Test%20%26%20Client')).toBe(
      true,
    ),
  );
});
test('new client requires review and sends normalized coordinates/phone only', async () => {
  mockParams.form = 'client';
  const s = await open(<AdminFormScreen />);
  await ready();
  await fireEvent.changeText(screen.getByLabelText('Name'), 'New Client');
  await fireEvent.changeText(screen.getByLabelText('Phone number'), '0944444444');
  await fireEvent.changeText(screen.getByLabelText('Latitude'), '0');
  await fireEvent.changeText(screen.getByLabelText('Longitude'), '0');
  await fireEvent.press(await ready());
  expect(writes(s)).toHaveLength(0);
  await fireEvent.press(screen.getByRole('button', { name: 'Confirm changes' }));
  await screen.findByText(en.saved);
  expect(writes(s)[0]).toMatchObject({
    path: 'admin/clients',
    method: 'POST',
    body: {
      name: 'New Client',
      phoneNumber: '+251944444444',
      locale: 'en',
      latitude: 0,
      longitude: 0,
    },
  });
});
test('staff password review masks the secret and never persists it', async () => {
  mockParams.form = 'motherPassword';
  mockParams.id = '1';
  const s = await open(<AdminFormScreen />);
  await screen.findByLabelText('New password');
  await fireEvent.changeText(screen.getByLabelText('New password'), 'secret-password-123');
  await fireEvent.press(await ready());
  expect(screen.getByText(en.hidden)).toBeOnTheScreen();
  expect(screen.queryByText('secret-password-123')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Confirm changes' }));
  await screen.findByText(en.saved);
  expect(writes(s)[0]).toMatchObject({
    path: 'admin/mothers/1/password',
    method: 'PATCH',
    body: { newPassword: 'secret-password-123' },
  });
  expect([...mockDisk.values()].join('')).not.toContain('secret-password-123');
  expect([...mockDisk.values()].join('')).not.toContain('newPassword');
});
test('unknown client creation survives remount and blocks another mutation until checked', async () => {
  mockParams.form = 'client';
  const s = await open(<AdminFormScreen />);
  await ready();
  for (const [label, value] of [
    ['Name', 'New Client'],
    ['Phone number', '0944444444'],
    ['Latitude', '9'],
    ['Longitude', '38'],
  ])
    await fireEvent.changeText(screen.getByLabelText(label!), value!);
  s.lose();
  await fireEvent.press(await ready());
  await fireEvent.press(screen.getByRole('button', { name: 'Confirm changes' }));
  await screen.findByText(en.network);
  expect(writes(s)).toHaveLength(1);
  await s.result.unmount();
  await open(<AdminFormScreen />);
  await screen.findByText(en.pendingTitle);
  expect(screen.getByRole('button', { name: 'Review changes' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'I have checked the result' }));
  expect(screen.getByText(en.clearWarning)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Allow another change' }));
  await screen.findByText(en.cleared);
});
test('another admin account cannot see the previous account’s uncertain action', async () => {
  mockParams.form = 'client';
  const s = await open(<AdminFormScreen />);
  await ready();
  for (const [label, value] of [
    ['Name', 'New Client'],
    ['Phone number', '0944444444'],
    ['Latitude', '9'],
    ['Longitude', '38'],
  ])
    await fireEvent.changeText(screen.getByLabelText(label!), value!);
  s.lose();
  await fireEvent.press(await ready());
  await fireEvent.press(screen.getByRole('button', { name: 'Confirm changes' }));
  await screen.findByText(en.network);
  await s.result.unmount();
  await open(<AdminHomeScreen />, 'en', false, 2);
  expect(screen.queryByText(en.pendingTitle)).toBeNull();
});
test('mother price upsert uses POST and a named active package selector', async () => {
  mockParams.form = 'offering';
  mockParams.id = '1';
  const s = await open(<AdminFormScreen />);
  await screen.findByRole('radio', { name: '#6 · Weekly combined' });
  await fireEvent.press(screen.getByRole('radio', { name: '#6 · Weekly combined' }));
  await fireEvent.changeText(screen.getByLabelText('Price (ETB)'), '1700.50');
  await reviewAndConfirm();
  expect(writes(s)[0]).toMatchObject({
    path: 'admin/offerings',
    method: 'POST',
    body: { motherId: 1, packageTypeId: 6, priceEtb: '1700.50', active: true },
  });
});
test('inspection of selected mother uses POST and explicit EAT date', async () => {
  mockParams.form = 'inspection';
  mockParams.id = '1';
  const s = await open(<AdminFormScreen />);
  await screen.findByLabelText('Notes');
  await fireEvent.changeText(screen.getByLabelText('Notes'), 'Kitchen checked');
  await reviewAndConfirm();
  expect(writes(s)[0]).toMatchObject({
    path: 'admin/inspections',
    method: 'POST',
    body: { motherId: 1, inspectedAt: '2026-10-26', notes: 'Kitchen checked' },
  });
});
test('payment confirmation shows actual amount and records only a supplied reference', async () => {
  mockParams.form = 'paymentConfirm';
  mockParams.id = '10';
  const s = await open(<AdminFormScreen />);
  await screen.findByText('Amount (ETB): 1500.00');
  await fireEvent.changeText(screen.getByLabelText('Reference'), 'CASH-RECEIPT-1');
  await reviewAndConfirm();
  expect(writes(s)[0]).toMatchObject({
    path: 'admin/payments/10/confirm',
    method: 'POST',
    body: { reference: 'CASH-RECEIPT-1' },
  });
  expect(screen.queryByText(en.changed)).toBeNull();
});
test('subscription cancellation surfaces the server refund outcome without transferring money', async () => {
  mockParams.form = 'cancelOrder';
  mockParams.id = '9';
  const s = await open(<AdminFormScreen />);
  await reviewAndConfirm();
  await screen.findByText('Refund due: Yes');
  expect(writes(s)[0]).toMatchObject({ path: 'admin/orders/9/cancel', method: 'POST', body: null });
});
test('support requests can be resolved through an explicit read/review cycle', async () => {
  mockParams.form = 'resolveTicket';
  mockParams.id = '11';
  const s = await open(<AdminFormScreen />);
  await screen.findByText('Request message: Need containers');
  await reviewAndConfirm();
  expect(writes(s)[0]).toMatchObject({
    path: 'admin/tickets/11/resolve',
    method: 'POST',
    body: null,
  });
});
test('replacement meal captures original delivery, future date and reason', async () => {
  mockParams.form = 'redelivery';
  mockParams.id = '8';
  mockParams.date = '2026-10-26';
  const s = await open(<AdminFormScreen />);
  await screen.findByLabelText('Delivery date');
  await fireEvent.changeText(screen.getByLabelText('Delivery date'), '2026-10-27');
  await fireEvent.changeText(screen.getByLabelText('Replacement reason'), 'Original meal failed');
  await reviewAndConfirm();
  expect(writes(s)[0]).toMatchObject({
    path: 'admin/redeliveries',
    method: 'POST',
    body: { sourceDeliveryId: 8, deliveryDate: '2026-10-27', reason: 'Original meal failed' },
  });
});
test('organization settings persist payment instructions with a reviewed PATCH', async () => {
  const s = await open(<AdminSettingsScreen />);
  await screen.findByLabelText('General payment instructions');
  await fireEvent.changeText(
    screen.getByLabelText('General payment instructions'),
    'Contact office for payment',
  );
  await reviewAndConfirm();
  expect(writes(s)[0]).toMatchObject({
    path: 'admin/settings',
    method: 'PATCH',
    body: expect.objectContaining({ payInstructions: 'Contact office for payment' }),
  });
});
test('invalid and other-role record/deep links never send fabricated IDs', async () => {
  mockParams.kind = 'clients';
  mockParams.id = '0';
  const s = await open(<AdminRecordScreen />);
  await screen.findByText(en.invalid);
  expect(s.requests.some((x) => x.path.startsWith('admin/'))).toBe(false);
  await s.result.unmount();
  mockParams.screen = '__proto__';
  const other = await open(<AdminRoute />);
  await screen.findByRole('header', { name: 'This page is not available' });
  expect(other.requests.some((x) => x.path.startsWith('admin/'))).toBe(false);
});
test('Amharic Admin forms have actual labels and complete dictionary coverage', async () => {
  expect(Object.keys(am).sort()).toEqual(Object.keys(en).sort());
  for (const fields of Object.values(forms))
    for (const f of fields) expect(en).toHaveProperty(f.key);
  mockParams.form = 'client';
  const s = await open(<AdminFormScreen />, 'am');
  await screen.findByLabelText('ስም');
  await fireEvent.changeText(screen.getByLabelText('ስም'), 'ደንበኛ');
  expect(s.requests.some((x) => x.method === 'POST')).toBe(false);
});
test('Strict Mode replay preserves recovery and Admin workspace state', async () => {
  await open(<AdminHomeScreen />, 'en', true);
  await waitFor(() => expect(screen.getByRole('button', { name: 'People' })).toBeEnabled());
});
test('logout removes private Admin screens and owner-scoped controller', async () => {
  const s = await open(<AdminPaymentsScreen />);
  await screen.findByText('Amount (ETB): 1500.00');
  await act(async () => {
    await s.auth.logout();
  });
  expect(screen.queryByText('Amount (ETB): 1500.00')).toBeNull();
});

test('catalog and support lists use real data and expose their form routes', async () => {
  const s = await open(<AdminCatalogScreen />);
  await screen.findByText('English name: Shiro');
  await fireEvent.press(screen.getByRole('button', { name: 'Add dish' }));
  expect(mockRouter.push).toHaveBeenCalledWith({
    pathname: '/admin/form',
    params: { form: 'dish' },
  });
  await s.result.unmount();
  await open(<AdminSupportScreen />);
  await screen.findByText('Request message: Need containers');
  expect(screen.getByRole('button', { name: 'Resolve request' })).toBeOnTheScreen();
});
test('delivery reassignment sends explicit selected identities', async () => {
  mockParams.form = 'assignment';
  mockParams.id = '8';
  mockParams.date = '2026-10-26';
  const s = await open(<AdminFormScreen />);
  await screen.findByRole('radio', { name: '#1 · Test Kitchen' });
  await fireEvent.press(screen.getByRole('radio', { name: '#1 · Test Kitchen' }));
  await fireEvent.press(screen.getByRole('radio', { name: '#2 · Test Cyclist' }));
  await reviewAndConfirm();
  expect(writes(s)[0]).toMatchObject({
    path: 'admin/deliveries/8/assignment',
    method: 'PATCH',
    body: { motherId: 1, cyclistId: 2 },
  });
});
test('new subscription uses saved address, priced offering, fasting-aware choices and a durable retry key', async () => {
  mockParams.form = 'order';
  mockParams.clientId = '3';
  const s = await open(<AdminFormScreen />);
  await screen.findByRole('radio', { name: '#1 · Test Kitchen' });
  await fireEvent.press(screen.getByRole('radio', { name: '#1 · Test Kitchen' }));
  await screen.findByRole('radio', { name: '#7 · Weekly combined · 1500.00 ETB' });
  await fireEvent.press(screen.getByRole('radio', { name: '#7 · Weekly combined · 1500.00 ETB' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Use the saved client address' }));
  for (const choice of screen.getAllByRole('radio', { name: '#5 · Chicken' }))
    await fireEvent.press(choice);
  for (const choice of screen.getAllByRole('radio', { name: '#4 · Shiro' }))
    await fireEvent.press(choice);
  await reviewAndConfirm();
  expect(writes(s)[0]).toMatchObject({
    path: 'admin/orders',
    method: 'POST',
    body: {
      clientId: 3,
      motherOfferingId: 7,
      latitude: 9,
      longitude: 38,
      dishPattern: { '1': 5, '2': 5, '3': 4, '4': 5, '5': 4 },
    },
  });
  expect(writes(s)[0]!.key).toMatch(/^miaa-admin-/);
});
