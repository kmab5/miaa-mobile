import { StrictMode } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { AuthContext, useAuth, createAuthController } from '@miaa/auth';
import { LocaleProvider } from '@miaa/i18n';
import {
  MotherProvider,
  MotherHomeScreen,
  MotherQueueScreen,
  MotherMealScreen,
  MotherTicketsScreen,
} from '@miaa/mother-portal';
import { createTicketStore } from '../packages/mother-portal/src/storage';
import { en, am } from '../packages/mother-portal/src/text';
import {
  motherDay,
  motherDishes,
  motherTickets,
  motherNow,
  packagedResponse,
} from './fixtures/mother';
import { mockRouter, mockParams } from './setup.native';
import MotherRoute from '../apps/mother/app/mother/[screen]';
const mockDisk = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 7,
  getItemAsync: jest.fn(
    async (key: string, options: { keychainService: string }) =>
      mockDisk.get(options.keychainService + key) ?? null,
  ),
  setItemAsync: jest.fn(
    async (key: string, value: string, options: { keychainService: string }) => {
      mockDisk.set(options.keychainService + key, value);
    },
  ),
  deleteItemAsync: jest.fn(async (key: string, options: { keychainService: string }) => {
    mockDisk.delete(options.keychainService + key);
  }),
}));
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn(async (_algorithm: string, text: string) =>
    jest
      .requireActual<typeof import('node:crypto')>('node:crypto')
      .createHash('sha256')
      .update(text)
      .digest('hex'),
  ),
}));
function TestGate({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  return auth.phase === 'signedIn' ? children : null;
}
const config = {
  role: 'mother' as const,
  variant: 'preview' as const,
  apiOrigin: 'https://miaa.example',
  appVersion: '0.4.0',
  foundationPreview: true as const,
};
async function open(
  element: React.ReactNode,
  locale: 'en' | 'am' = 'en',
  overrides: Record<string, unknown> = {},
  strict = false,
  owner = 1,
) {
  const requests: { path: string; method: string; body: unknown }[] = [];
  const data: Record<string, unknown> = {
    'mother/day': structuredClone(motherDay),
    'mother/dishes': motherDishes,
    'mother/tickets': structuredClone(motherTickets),
    ...overrides,
  };
  let failPost = false;
  const fetcher = jest.fn(async (url: unknown, input?: RequestInit) => {
    const path = String(url).split('/api/v1/')[1]!;
    const method = input?.method ?? 'GET';
    requests.push({ path, method, body: input?.body ? JSON.parse(String(input.body)) : null });
    if (method === 'POST' && failPost) throw new Error('lost response');
    let value: unknown;
    if (path === 'me')
      value = {
        user: { id: owner, role: 'mother', phoneNumber: '+251911111111', email: null, locale },
        expiresAt: new Date(motherNow + 86400000 * 7).toISOString(),
      };
    else if (method === 'POST') {
      if (path.includes('/package')) {
        value = packagedResponse;
        data['mother/day'] = {
          ...motherDay,
          toPrepare: 0,
          done: 2,
          items: motherDay.items.map((x) => ({ ...x, status: 'packaged' })),
          tallies: motherDay.tallies.map((x) => ({ ...x, remaining: 0 })),
        };
      } else if (path === 'mother/comp-meal') {
        value = { ok: true };
        data['mother/day'] = { ...motherDay, compMealTaken: true };
      } else {
        value = { ok: true };
        data['mother/tickets'] = [
          { ...motherTickets[0], id: 18, message: JSON.parse(String(input?.body)).message },
          ...motherTickets,
        ];
      }
    } else value = data[path];
    return {
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ data: value }),
    } as Response;
  }) as typeof fetch;
  const auth = createAuthController({
    role: 'mother',
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
        <MotherProvider config={config}>
          <TestGate>{element}</TestGate>
        </MotherProvider>
      </LocaleProvider>
    </AuthContext.Provider>
  );
  const result = await render(strict ? <StrictMode>{tree}</StrictMode> : tree);
  return {
    result,
    requests,
    data,
    auth,
    fail: () => {
      failPost = true;
    },
  };
}
beforeEach(() => {
  mockDisk.clear();
  jest.clearAllMocks();
  jest.spyOn(Date, 'now').mockReturnValue(motherNow);
});
afterEach(() => {
  jest.restoreAllMocks();
});
const post = (s: Awaited<ReturnType<typeof open>>) => s.requests.filter((x) => x.method === 'POST');
test('Mother home exposes her real queue counts and workflow links', async () => {
  await open(<MotherHomeScreen />);
  await screen.findByText('Test Kitchen');
  expect(screen.getByText('Still preparing: 1 · Beyond preparation: 1')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Preparation queue' }));
  expect(mockRouter.push).toHaveBeenCalledWith('/mother/queue');
});
test('queue shows non-spicy, replacement and notes, and requires packaging review', async () => {
  const s = await open(<MotherQueueScreen />);
  await screen.findByText('Sticker: MA-19-01');
  expect(screen.getByText('Replacement meal')).toBeOnTheScreen();
  expect(screen.getByText('Notes: Please keep warm')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Confirm cooked and packaged' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Review packaging · MA-19-01' }));
  expect(post(s)).toHaveLength(0);
  await fireEvent.press(screen.getByRole('button', { name: 'Confirm cooked and packaged' }));
  await screen.findByText('Packaging recorded.');
  expect(post(s)).toEqual([{ path: 'mother/deliveries/31/package', method: 'POST', body: null }]);
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Review packaging · MA-19-01' })).toBeNull(),
  );
});
test('filters select actual radio state and search only sticker or client', async () => {
  await open(<MotherQueueScreen />);
  await screen.findByText('Sticker: MA-19-01');
  await fireEvent.press(screen.getByRole('radio', { name: 'Packaged' }));
  expect(screen.getByRole('radio', { name: 'Packaged' })).toBeChecked();
  expect(screen.queryByText('Sticker: MA-19-01')).toBeNull();
  await fireEvent.changeText(screen.getByLabelText('Search sticker or client'), 'unknown');
  expect(screen.getByText('No meals match these filters.')).toBeOnTheScreen();
});
test('deadline-passed queue has no enabled packaging action', async () => {
  const s = await open(<MotherQueueScreen />, 'en', {
    'mother/day': { ...motherDay, deadlinePassed: true },
  });
  const button = await screen.findByRole('button', { name: 'Review packaging · MA-19-01' });
  expect(button).toBeDisabled();
  await fireEvent.press(button);
  expect(post(s)).toHaveLength(0);
});
test('clock reaching EAT deadline disables packaging before another read', async () => {
  await open(<MotherQueueScreen />);
  await screen.findByRole('button', { name: 'Review packaging · MA-19-01' });
  jest.mocked(Date.now).mockReturnValue(Date.parse('2026-10-26T08:00:00Z'));
  await waitFor(
    () =>
      expect(screen.getByRole('button', { name: 'Review packaging · MA-19-01' })).toBeDisabled(),
    { timeout: 2000 },
  );
});
test('failed day parsing exposes retry but no queue actions', async () => {
  await open(<MotherQueueScreen />, 'en', { 'mother/day': { ...motherDay, items: null } });
  await screen.findByText(en.response);
  expect(screen.queryByRole('button', { name: 'Review packaging · MA-19-01' })).toBeNull();
});
test('staff meal requires review, saves chosen dish and then hides the form', async () => {
  const s = await open(<MotherMealScreen />);
  const choice = await screen.findByRole('radio', { name: 'Shiro' });
  await fireEvent.press(choice);
  expect(choice).toBeChecked();
  await fireEvent.press(screen.getByRole('button', { name: 'Review staff meal' }));
  expect(post(s)).toHaveLength(0);
  await fireEvent.press(screen.getByRole('button', { name: 'Record today’s staff meal' }));
  await screen.findByText('Today’s staff meal is already recorded.');
  expect(post(s)).toEqual([{ path: 'mother/comp-meal', method: 'POST', body: { dishId: 5 } }]);
});
test('support rejects empty input and review sends a scoped message once', async () => {
  const s = await open(<MotherTicketsScreen />);
  await screen.findByText('Need packaging');
  const button = screen.getByRole('button', { name: 'Review request' });
  await waitFor(() => expect(button).toBeEnabled());
  await fireEvent.press(button);
  await screen.findByText(en.invalid);
  expect(post(s)).toHaveLength(0);
  await fireEvent.changeText(screen.getByLabelText('Your request'), '  Need containers  ');
  await fireEvent.press(button);
  expect(post(s)).toHaveLength(0);
  await fireEvent.press(screen.getByRole('button', { name: 'Send request' }));
  await screen.findByText('Request sent.');
  expect(post(s)).toEqual([
    { path: 'mother/tickets', method: 'POST', body: { message: 'Need containers' } },
  ]);
  await waitFor(() => expect(screen.getByLabelText('Your request').props.value).toBe(''));
});
test('uncertain support send survives remount and requires history/office review to clear', async () => {
  const s = await open(<MotherTicketsScreen />);
  await screen.findByText('Need packaging');
  await fireEvent.changeText(screen.getByLabelText('Your request'), 'Need containers');
  await fireEvent.press(screen.getByRole('button', { name: 'Review request' }));
  s.fail();
  await fireEvent.press(screen.getByRole('button', { name: 'Send request' }));
  await screen.findByText(en.network);
  expect(post(s)).toHaveLength(1);
  await s.result.unmount();
  const next = await open(<MotherTicketsScreen />);
  await screen.findByText('Check the previous request');
  await screen.findByText('Need packaging');
  expect(screen.getByRole('button', { name: 'Review request' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'I have checked with the office' }));
  expect(screen.getByText(en.clearWarning)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Allow another request' }));
  await screen.findByText(en.cleared);
  expect(post(next)).toHaveLength(0);
});
test('pending support marker stays scoped to authenticated account', async () => {
  const s = await open(<MotherTicketsScreen />);
  await screen.findByText('Need packaging');
  await fireEvent.changeText(screen.getByLabelText('Your request'), 'Help');
  await fireEvent.press(screen.getByRole('button', { name: 'Review request' }));
  s.fail();
  await fireEvent.press(screen.getByRole('button', { name: 'Send request' }));
  await screen.findByText(en.network);
  await s.result.unmount();
  await open(<MotherTicketsScreen />, 'en', {}, false, 2);
  await screen.findByText('Need packaging');
  expect(screen.queryByText('Check the previous request')).toBeNull();
  expect(screen.getByRole('button', { name: 'Review request' })).toBeEnabled();
});
test('corrupt storage blocks support sending but still permits queue reads', async () => {
  await createTicketStore(config, 1).write('damaged');
  const s = await open(<MotherTicketsScreen />);
  await screen.findByText(en.storage);
  expect(screen.getByRole('button', { name: 'Review request' })).toBeDisabled();
  expect(post(s)).toHaveLength(0);
});
test('Amharic workflow labels and choices remain functional', async () => {
  await open(<MotherMealScreen />, 'am');
  await screen.findByRole('radio', { name: 'ሽሮ' });
  expect(screen.getByRole('header', { name: am.meal })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('radio', { name: 'ሽሮ' }));
  expect(screen.getByRole('radio', { name: 'ሽሮ' })).toBeChecked();
});
test('Strict Mode replay preserves the Mother controller and recovery storage', async () => {
  await open(<MotherTicketsScreen />, 'en', {}, true);
  await screen.findByText('Need packaging');
  expect(screen.getByRole('button', { name: 'Review request' })).toBeEnabled();
});
test('Mother dictionary keys match and have nonempty translations', () => {
  expect(Object.keys(am).sort()).toEqual(Object.keys(en).sort());
  expect(Object.values(am).every((v) => v.trim())).toBe(true);
});
test('logout disposes the Mother provider and aborts private state ownership', async () => {
  const s = await open(<MotherHomeScreen />);
  await screen.findByText('Test Kitchen');
  await act(async () => {
    await s.auth.logout();
  });
  expect(s.auth.getSnapshot().phase).toBe('signedOut');
});

test('Mother deep-link allowlist rejects prototype and foreign workflow names', async () => {
  for (const path of ['__proto__', 'orders', 'people']) {
    mockParams.screen = path;
    const page = await open(<MotherRoute />);
    await screen.findByRole('header', { name: 'This page is not available' });
    expect(page.requests.filter((x) => x.path.startsWith('mother/'))).toHaveLength(0);
    await page.result.unmount();
  }
  delete mockParams.screen;
});
