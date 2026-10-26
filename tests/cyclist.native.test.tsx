import { StrictMode } from 'react';
import { Linking } from 'react-native';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { AuthContext, useAuth, createAuthController } from '@miaa/auth';
import { LocaleProvider } from '@miaa/i18n';
import {
  CyclistProvider,
  CyclistHomeScreen,
  CyclistRunScreen,
  CyclistLookupScreen,
  CyclistMealScreen,
  CyclistEarningsScreen,
} from '@miaa/cyclist-portal';
import CyclistRoute from '../apps/cyclist/app/cyclist/[screen]';
import { en, am } from '../packages/cyclist-portal/src/text';
import {
  collectItem,
  confirmItem,
  cyclistDishes,
  cyclistEarnings,
  cyclistNow,
  cyclistRun,
  deliveryReceipt,
} from './fixtures/cyclist';
import { mockParams, mockRouter } from './setup.native';
const config = {
  role: 'cyclist' as const,
  variant: 'preview' as const,
  apiOrigin: 'https://miaa.example',
  appVersion: '0.5.0',
  foundationPreview: true as const,
};
function Gate({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  return auth.phase === 'signedIn' ? children : null;
}
async function open(
  element: React.ReactNode,
  locale: 'en' | 'am' = 'en',
  overrides: Record<string, unknown> = {},
  strict = false,
) {
  const requests: { path: string; method: string; body: unknown }[] = [];
  const data: Record<string, unknown> = {
    run: structuredClone(cyclistRun),
    dishes: cyclistDishes,
    earnings: cyclistEarnings,
    lookup: confirmItem,
    ...overrides,
  };
  let lose = false;
  const fetcher = jest.fn(async (url: unknown, input?: RequestInit) => {
    const path = String(url).split('/api/v1/')[1]!;
    const method = input?.method ?? 'GET';
    requests.push({ path, method, body: input?.body ? JSON.parse(String(input.body)) : null });
    let value: unknown;
    let status = 200;
    if (path === 'me')
      value = {
        user: { id: 1, role: 'cyclist', phoneNumber: '+251911111111', email: null, locale },
        expiresAt: new Date(cyclistNow + 7 * 86400000).toISOString(),
      };
    else if (method === 'POST') {
      if (path.endsWith('/collect')) {
        value = deliveryReceipt(collectItem, 'collect');
        data.run = {
          ...cyclistRun,
          readyToCollect: [],
          onTheWay: [{ ...collectItem, status: 'out_for_delivery' }, confirmItem],
        };
      } else if (path.endsWith('/confirm')) {
        value = deliveryReceipt(confirmItem, 'confirm');
        data.run = {
          ...cyclistRun,
          onTheWay: [],
          delivered: [...cyclistRun.delivered, { ...confirmItem, status: 'delivered' }],
        };
        data.earnings = { ...cyclistEarnings, deliveriesToday: 2, deliveriesThisWeek: 6 };
      } else {
        value = { ok: true };
        data.run = { ...cyclistRun, compMealTaken: true };
      }
      if (lose) throw new Error('lost response');
    } else {
      const key = path.split('/')[1]!.split('?')[0]!;
      value = data[key];
      if (value === null) {
        status = 404;
      }
    }
    return {
      ok: status < 400,
      status,
      headers: new Headers(),
      json: async () =>
        status === 404
          ? { error: { code: 'not_found', message: 'Hidden server text' } }
          : { data: value },
    } as Response;
  }) as typeof fetch;
  const auth = createAuthController({
    role: 'cyclist',
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
        <CyclistProvider config={config}>
          <Gate>{element}</Gate>
        </CyclistProvider>
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
const posts = (s: Awaited<ReturnType<typeof open>>) =>
  s.requests.filter((x) => x.method === 'POST');
beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Date, 'now').mockReturnValue(cyclistNow);
  delete mockParams.screen;
});
afterEach(() => {
  jest.restoreAllMocks();
  delete mockParams.screen;
});
test('Cyclist home shows actual assigned counts and links to each workflow', async () => {
  await open(<CyclistHomeScreen />);
  await screen.findByText('Test Cyclist');
  expect(screen.getByText('Assigned meals: 4 · Delivered: 1')).toBeOnTheScreen();
  expect(screen.getByText('Still cooking: 1')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Assigned run' }));
  expect(mockRouter.push).toHaveBeenCalledWith('/cyclist/run');
});
test('collection is individually reviewed and sends one body-free scoped POST', async () => {
  const s = await open(<CyclistRunScreen />);
  await screen.findByText('Sticker: MA-19-01');
  expect(screen.queryByRole('button', { name: 'Confirm package collected' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Review collection · MA-19-01' }));
  expect(posts(s)).toHaveLength(0);
  await fireEvent.press(screen.getByRole('button', { name: 'Confirm package collected' }));
  await screen.findByText('Collection recorded.');
  expect(posts(s)).toEqual([{ path: 'cyclist/deliveries/31/collect', method: 'POST', body: null }]);
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Review collection · MA-19-01' })).toBeNull(),
  );
});
test('handover review completes only the collected delivery and refreshes run', async () => {
  const s = await open(<CyclistRunScreen />);
  await screen.findByText('Replacement meal');
  await fireEvent.press(screen.getByRole('button', { name: 'Review handover · MA-20-01-R1' }));
  expect(screen.getByText(en.confirmHelp)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Confirm delivery completed' }));
  await screen.findByText('Delivery recorded.');
  expect(posts(s)).toEqual([{ path: 'cyclist/deliveries/32/confirm', method: 'POST', body: null }]);
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Review handover · MA-20-01-R1' })).toBeNull(),
  );
});
test('lost collection confirmation requires refreshing actual status without retry', async () => {
  const s = await open(<CyclistRunScreen />);
  await screen.findByRole('button', { name: 'Review collection · MA-19-01' });
  s.lose();
  await fireEvent.press(screen.getByRole('button', { name: 'Review collection · MA-19-01' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Confirm package collected' }));
  await screen.findByText(en.network);
  expect(posts(s)).toHaveLength(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Refresh' }));
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Review collection · MA-19-01' })).toBeNull(),
  );
  expect(posts(s)).toHaveLength(1);
});
test('only on-the-way client has validated calling and fixed-host map links', async () => {
  const call = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  await open(<CyclistRunScreen />);
  await screen.findByText('Sticker: MA-20-01-R1');
  expect(screen.getAllByRole('button', { name: 'Call client' })).toHaveLength(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Call client' }));
  expect(call).toHaveBeenCalledWith('tel:+251911111111');
  await fireEvent.press(screen.getByRole('button', { name: 'Open delivery location' }));
  expect(call).toHaveBeenCalledWith('https://www.google.com/maps/search/?api=1&query=9.01%2C38.75');
});
test('unsafe phone has no call control and OS map-opening failure is recoverable', async () => {
  const call = jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no handler'));
  await open(<CyclistRunScreen />, 'en', {
    run: { ...cyclistRun, onTheWay: [{ ...confirmItem, clientPhone: 'javascript:bad' }] },
  });
  await screen.findByText('Sticker: MA-20-01-R1');
  expect(screen.queryByRole('button', { name: 'Call client' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Open delivery location' }));
  await screen.findByText(en.openFailed);
  expect(call).toHaveBeenCalledTimes(1);
});
test('exact replacement-sticker lookup clears private result when input changes', async () => {
  const s = await open(<CyclistLookupScreen />);
  await fireEvent.changeText(screen.getByLabelText('Package sticker'), '20-01-r1');
  await fireEvent.press(screen.getByRole('button', { name: 'Find sticker' }));
  await screen.findByText('Sticker: MA-20-01-R1');
  expect(
    s.requests.some((x) => x.path === 'cyclist/lookup?sticker=MA-20-01-R1&date=2026-10-26'),
  ).toBe(true);
  await fireEvent.changeText(screen.getByLabelText('Package sticker'), '99-01');
  expect(screen.queryByText('Client: Second Client')).toBeNull();
  s.data.lookup = null;
  await fireEvent.press(screen.getByRole('button', { name: 'Find sticker' }));
  await screen.findByText(en.notFound);
  expect(screen.queryByText('Hidden server text')).toBeNull();
});
test('run search filters only current rows', async () => {
  await open(<CyclistRunScreen />);
  await screen.findByText('Sticker: MA-19-01');
  await fireEvent.changeText(screen.getByLabelText('Search sticker or client'), 'Second Client');
  expect(screen.queryByText('Sticker: MA-19-01')).toBeNull();
  expect(screen.getByText('Sticker: MA-20-01-R1')).toBeOnTheScreen();
});
test('malformed run blocks all delivery actions with explicit retry feedback', async () => {
  await open(<CyclistRunScreen />, 'en', {
    run: { ...cyclistRun, readyToCollect: [{ ...collectItem, latitude: 999 }] },
  });
  await screen.findByText(en.response);
  expect(screen.queryByRole('button', { name: 'Review collection · MA-19-01' })).toBeNull();
});
test('earnings show last-seven-day counts and decimal rate without fabricated payout', async () => {
  await open(<CyclistEarningsScreen />);
  await screen.findByText('Current rate per delivery (ETB): 25.00');
  expect(screen.getByText('Deliveries today: 1')).toBeOnTheScreen();
  expect(screen.getByText('Deliveries in the last 7 days: 5')).toBeOnTheScreen();
  expect(screen.getByText(en.payoutInfo)).toBeOnTheScreen();
  expect(screen.queryByText('125.00')).toBeNull();
});
test('staff meal review sends selected dish and shows the daily completion flag', async () => {
  const s = await open(<CyclistMealScreen />);
  await screen.findByRole('radio', { name: 'Shiro' });
  await fireEvent.press(screen.getByRole('radio', { name: 'Shiro' }));
  expect(screen.getByRole('radio', { name: 'Shiro' })).toBeChecked();
  await fireEvent.press(screen.getByRole('button', { name: 'Review staff meal' }));
  expect(posts(s)).toHaveLength(0);
  await fireEvent.press(screen.getByRole('button', { name: 'Record today’s staff meal' }));
  await screen.findByText(en.mealTaken);
  expect(posts(s)).toEqual([{ path: 'cyclist/comp-meal', method: 'POST', body: { dishId: 5 } }]);
});
test('no named dishes permits explicit null staff meal', async () => {
  const s = await open(<CyclistMealScreen />, 'en', { dishes: [] });
  await screen.findByText(en.noDishes);
  await fireEvent.press(screen.getByRole('button', { name: 'Review staff meal' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Record today’s staff meal' }));
  await screen.findByText(en.mealTaken);
  expect(posts(s)[0]!.body).toEqual({ dishId: null });
});
test('EAT date rollover disables an already-open delivery review', async () => {
  const s = await open(<CyclistRunScreen />);
  await screen.findByRole('button', { name: 'Review collection · MA-19-01' });
  await fireEvent.press(screen.getByRole('button', { name: 'Review collection · MA-19-01' }));
  jest.mocked(Date.now).mockReturnValue(Date.parse('2026-10-26T21:00:00Z'));
  await waitFor(
    () => expect(screen.getByRole('button', { name: 'Confirm package collected' })).toBeDisabled(),
    { timeout: 2000 },
  );
  expect(posts(s)).toHaveLength(0);
});
test('Amharic staff meal choices and labels are functional and dictionaries match', async () => {
  expect(Object.keys(am).sort()).toEqual(Object.keys(en).sort());
  expect(Object.values(am).every((v) => v.trim())).toBe(true);
  await open(<CyclistMealScreen />, 'am');
  await screen.findByRole('radio', { name: 'ሽሮ' });
  await fireEvent.press(screen.getByRole('radio', { name: 'ሽሮ' }));
  expect(screen.getByRole('radio', { name: 'ሽሮ' })).toBeChecked();
  expect(screen.getByRole('header', { name: am.meal })).toBeOnTheScreen();
});
test('Strict Mode replay leaves the Cyclist provider active', async () => {
  await open(<CyclistRunScreen />, 'en', {}, true);
  await screen.findByRole('button', { name: 'Review collection · MA-19-01' });
  expect(screen.getByRole('button', { name: 'Review collection · MA-19-01' })).toBeEnabled();
});
test('protected route allowlist rejects other-role and prototype names', async () => {
  for (const value of ['__proto__', 'tickets', 'orders', 'people']) {
    mockParams.screen = value;
    const s = await open(<CyclistRoute />);
    await screen.findByRole('header', { name: 'This page is not available' });
    expect(s.requests.filter((x) => x.path.startsWith('cyclist/'))).toHaveLength(0);
    await s.result.unmount();
  }
});
test('logout removes the private Cyclist tree and disposes its owner', async () => {
  const s = await open(<CyclistHomeScreen />);
  await screen.findByText('Test Cyclist');
  await act(async () => {
    await s.auth.logout();
  });
  expect(s.auth.getSnapshot().phase).toBe('signedOut');
  expect(screen.queryByText('Test Cyclist')).toBeNull();
});
