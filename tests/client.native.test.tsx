import { StrictMode } from 'react';
import { Linking } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { AuthContext, createAuthController } from '@miaa/auth';
import { LocaleProvider } from '@miaa/i18n';
import {
  ClientProvider,
  ClientProfileScreen,
  ClientBrowseScreen,
  ClientTodayScreen,
} from '@miaa/client-portal';
import { clientProfile, clientOffering, clientDishes, clientDetail } from './fixtures/client';
import type { AppConfiguration } from '@miaa/config';
jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 7,
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => '12345678-1234-1234-1234-123456789012' }));
const config: AppConfiguration = {
  role: 'client',
  variant: 'preview',
  apiOrigin: 'https://miaa.example',
  appVersion: '0.3.0',
  foundationPreview: true,
};
async function open(
  element: React.ReactNode,
  locale: 'en' | 'am' = 'en',
  custom?: Record<string, unknown>,
  strict = false,
) {
  const requests: { path: string; method: string; body: unknown }[] = [];
  const token = 'miaa_m1_' + 'a'.repeat(43);
  const fetcher = jest.fn(async (url: unknown, input?: RequestInit) => {
    const path = String(url).split('/api/v1/')[1]!;
    requests.push({
      path,
      method: input?.method ?? 'GET',
      body: input?.body ? JSON.parse(String(input.body)) : null,
    });
    const defaults: Record<string, unknown> = {
      me: {
        user: { id: 1, role: 'client', phoneNumber: '+251911111111', email: null, locale },
        expiresAt: new Date(Date.now() + 86400000 * 7).toISOString(),
      },
      'client/profile': clientProfile,
      'client/address': clientProfile,
      'client/dishes': clientDishes,
      'client/orders': clientDetail,
      'client/payment-instructions': {
        payTelebirr: '0911111111',
        payCbe: null,
        payChapa: null,
        payInstructions: 'Pay off-platform',
      },
    };
    const data =
      custom && path in custom
        ? custom[path]
        : path.startsWith('client/offerings?')
          ? [clientOffering]
          : defaults[path];
    return {
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ data }),
    } as Response;
  }) as typeof fetch;
  const auth = createAuthController({
    role: 'client',
    origin: config.apiOrigin,
    storage: { get: async () => token, set: async () => undefined, clear: async () => undefined },
    fetch: fetcher,
  });
  await auth.start();
  const tree = (
    <AuthContext.Provider value={auth}>
      <LocaleProvider
        defaultLocale={locale}
        storage={{ getItem: async () => null, setItem: async () => undefined }}
      >
        <ClientProvider config={config}>{element}</ClientProvider>
      </LocaleProvider>
    </AuthContext.Provider>
  );
  const result = await render(strict ? <StrictMode>{tree}</StrictMode> : tree);
  return { result, requests, auth, fetcher };
}
test('address saves only the scoped numeric address body, without moving orders', async () => {
  const a = await open(<ClientProfileScreen />);
  await screen.findByLabelText('Latitude');
  await fireEvent.changeText(screen.getByLabelText('Latitude'), '9.02');
  await fireEvent.changeText(screen.getByLabelText('Longitude'), '38.76');
  await fireEvent.changeText(screen.getByLabelText('Directions / address note'), 'Green gate');
  await fireEvent.press(screen.getByRole('button', { name: 'Save address' }));
  await screen.findByText('Address saved.');
  expect(a.requests.find((r) => r.method === 'PATCH')).toEqual({
    path: 'client/address',
    method: 'PATCH',
    body: { latitude: 9.02, longitude: 38.76, addressNote: 'Green gate' },
  });
  expect(a.requests.some((r) => r.path === 'client/orders' && r.method === 'POST')).toBe(false);
});
test('invalid address blocks all address writes', async () => {
  const a = await open(<ClientProfileScreen />);
  await screen.findByLabelText('Latitude');
  await fireEvent.changeText(screen.getByLabelText('Latitude'), '');
  await fireEvent.press(screen.getByRole('button', { name: 'Save address' }));
  await screen.findByText('Check the address, date and all required dish choices.');
  expect(a.requests.some((r) => r.method === 'PATCH')).toBe(false);
});
test('malformed profile is an explicit error without an editable form', async () => {
  await open(<ClientProfileScreen />, 'en', { 'client/profile': { id: 7 } });
  await screen.findByText(
    'The server returned unexpected information. Keep the saved order and try again.',
  );
  expect(screen.queryByLabelText('Latitude')).toBeNull();
});
test('Amharic address form remains functional', async () => {
  const a = await open(<ClientProfileScreen />, 'am');
  await screen.findByLabelText('ኬክሮስ');
  await fireEvent.changeText(screen.getByLabelText('የመንገድ / የአድራሻ ማብራሪያ'), 'ሰማያዊ በር');
  await fireEvent.press(screen.getByRole('button', { name: 'አድራሻ አስቀምጥ' }));
  await waitFor(() => expect(a.requests.some((r) => r.method === 'PATCH')).toBe(true));
});
test('combined dish choices expose the correct checked radio states', async () => {
  await open(<ClientBrowseScreen />);
  const choose = await screen.findByRole('button', { name: /Choose this package/ });
  await waitFor(() => expect(choose).toBeEnabled());
  await fireEvent.press(choose);
  expect(screen.getAllByRole('radio', { name: 'Fasting dish' })).toHaveLength(2);
  expect(screen.getAllByRole('radio', { name: 'Non-fasting dish' })).toHaveLength(3);
  await fireEvent.press(screen.getAllByRole('radio', { name: 'Fasting dish' })[0]!);
  expect(screen.getAllByRole('radio', { name: 'Fasting dish' })[0]).toBeChecked();
});
test('Strict Mode effect replay does not leave the order controller disposed', async () => {
  await open(<ClientBrowseScreen />, 'en', undefined, true);
  const choose = await screen.findByRole('button', { name: /Choose this package/ });
  await waitFor(() => expect(choose).toBeEnabled());
});
test('cyclist phone is offered only for an on-the-way meal and uses a validated tel link', async () => {
  const call = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  const base = {
    deliveryId: 4,
    dishNameEn: 'Lunch',
    dishNameAm: 'ምሳ',
    stickerId: 'MA-1-01',
    motherName: 'Kitchen',
    cyclistName: 'Cyclist',
    cyclistPhone: '+251911111111',
    isCompRedelivery: false,
  };
  const a = await open(<ClientTodayScreen />, 'en', {
    'client/today': [
      { ...base, status: 'preparing' },
      { ...base, deliveryId: 5, status: 'out_for_delivery' },
    ],
  });
  await screen.findByText('On the way');
  expect(screen.getAllByRole('button', { name: 'Call cyclist' })).toHaveLength(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Call cyclist' }));
  expect(call).toHaveBeenCalledWith('tel:+251911111111');
  await a.result.unmount();
  call.mockRestore();
});

test('changing a combined demo date updates the available dish category', async () => {
  await open(<ClientBrowseScreen />, 'en', {
    'client/offerings?latitude=9.01&longitude=38.75': [{ ...clientOffering, duration: 'demo' }],
  });
  const choose = await screen.findByRole('button', { name: /Choose this package/ });
  await waitFor(() => expect(choose).toBeEnabled());
  await fireEvent.press(choose);
  await fireEvent.changeText(
    screen.getByLabelText('Demo delivery date (YYYY-MM-DD)'),
    '2026-10-28',
  );
  expect(screen.getByRole('radio', { name: 'Fasting dish' })).toBeTruthy();
  expect(screen.queryByRole('radio', { name: 'Non-fasting dish' })).toBeNull();
  await fireEvent.changeText(
    screen.getByLabelText('Demo delivery date (YYYY-MM-DD)'),
    '2026-11-02',
  );
  expect(screen.getByRole('radio', { name: 'Non-fasting dish' })).toBeTruthy();
  expect(screen.queryByRole('radio', { name: 'Fasting dish' })).toBeNull();
});
