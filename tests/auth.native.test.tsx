import { describe, it, expect, jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { AuthContext, createAuthController } from '@miaa/auth';
import { AppContext } from '../packages/shell/src/context';
import { SignInScreen } from '../packages/shell/src/sign-in';
import { SecurityScreen } from '../packages/shell/src/security';
import { LocaleProvider } from '@miaa/i18n';
import type { AppRole } from '@miaa/config';
const token = 'miaa_m1_' + 'a'.repeat(43);
const session = (role: AppRole) => ({
  accessToken: token,
  tokenType: 'Bearer',
  expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
  user: { id: 1, role, phoneNumber: '+251911111111', email: null, locale: 'en' },
});
async function open(role: AppRole = 'client', connected = false) {
  const fetcher = jest.fn<typeof fetch>();
  const data = (value: unknown) =>
    ({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ data: value }),
    }) as Response;
  fetcher.mockImplementation(async (url) =>
    String(url).endsWith('auth/options')
      ? data({ password: true, telegram: true, sessionDays: 7 })
      : data(session(role)),
  );
  const auth = createAuthController({
    role,
    origin: 'https://miaa.example',
    storage: {
      get: async () => (connected ? token : null),
      set: async () => undefined,
      clear: async () => undefined,
    },
    fetch: fetcher,
  });
  await auth.start();
  const element = connected ? <SecurityScreen /> : <SignInScreen />;
  const page = await render(
    <AppContext.Provider
      value={{
        role,
        variant: 'preview',
        apiOrigin: 'https://miaa.example',
        appVersion: '0.2.0',
        foundationPreview: true,
      }}
    >
      <AuthContext.Provider value={auth}>
        <LocaleProvider
          defaultLocale="en"
          storage={{ getItem: async () => null, setItem: async () => undefined }}
        >
          {element}
        </LocaleProvider>
      </AuthContext.Provider>
    </AppContext.Provider>,
  );
  return { page, auth, fetcher, data };
}
async function type(label: string, value: string) {
  await fireEvent.changeText(screen.getByLabelText(label), value);
}
describe('authentication screens', () => {
  it.each<AppRole>(['admin', 'mother', 'cyclist', 'client'])(
    '%s password form sends the fixed role and clears the secret after failure',
    async (role) => {
      const f = await open(role);
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Use Telegram' })).toBeEnabled(),
      );
      await type('Phone number or email', '0911111111');
      expect(screen.getByText('አማርኛ')).toHaveStyle({ fontFamily: 'EthiopicSemiBold' });
      await type('Password', 'secret-password');
      f.fetcher.mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers(),
        json: async () => ({
          error: { code: 'invalid_credentials', message: 'secret backend details' },
        }),
      } as Response);
      await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
      await waitFor(() =>
        expect(screen.getByText(/These details are invalid or expired/)).toBeOnTheScreen(),
      );
      expect(screen.getByLabelText('Password')).toHaveProp('value', '');
      expect(screen.queryByText('secret backend details')).not.toBeOnTheScreen();
      expect(JSON.parse(f.fetcher.mock.calls.at(-1)![1]!.body as string).role).toBe(role);
    },
  );
  it('allows code verification during the resend cooldown', async () => {
    const f = await open();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Use Telegram' })).toBeEnabled());
    await fireEvent.press(screen.getByRole('button', { name: 'Use Telegram' }));
    await type('Phone number', '0911111111');
    f.fetcher.mockResolvedValueOnce(f.data({ accepted: true, retryAfterSeconds: 60 }));
    await fireEvent.press(screen.getByRole('button', { name: 'Send Telegram code' }));
    await waitFor(() => expect(screen.getByLabelText('6-digit code')).toBeOnTheScreen());
    expect(screen.getByRole('button', { name: 'Send another code' })).toBeDisabled();
    await type('6-digit code', '123456');
    expect(screen.getByRole('button', { name: 'Verify & sign in' })).toBeEnabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Verify & sign in' }));
    await waitFor(() => expect(f.auth.getSnapshot().phase).toBe('signedIn'));
  });
  it('does not create a session from a linked Telegram invite', async () => {
    const f = await open();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Use Telegram' })).toBeEnabled());
    await fireEvent.press(screen.getByRole('button', { name: 'Use Telegram' }));
    await fireEvent.press(
      screen.getByRole('button', { name: 'Connect Telegram / create account' }),
    );
    await type('Phone number', '0911111111');
    const invite = 't'.repeat(32);
    f.fetcher.mockResolvedValueOnce(
      f.data({
        token: invite,
        deepLink: 'https://t.me/miaa_bot?start=' + invite,
        expiresAt: session('client').expiresAt,
      }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Get Telegram link' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Check verification' })).toBeOnTheScreen(),
    );
    f.fetcher.mockResolvedValueOnce(f.data({ state: 'linked' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Check verification' }));
    await waitFor(() =>
      expect(screen.getByText(/Telegram is connected. Request a sign-in code/)).toBeOnTheScreen(),
    );
    expect(f.auth.getSnapshot().phase).toBe('signedOut');
    expect(screen.queryByRole('button', { name: 'Create Client account' })).not.toBeOnTheScreen();
  });
  it('offers verified signup only in the Client app', async () => {
    const f = await open();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Use Telegram' })).toBeEnabled());
    await fireEvent.press(screen.getByRole('button', { name: 'Use Telegram' }));
    await fireEvent.press(
      screen.getByRole('button', { name: 'Connect Telegram / create account' }),
    );
    await type('Phone number', '0911111111');
    const invite = 't'.repeat(32);
    f.fetcher.mockResolvedValueOnce(
      f.data({
        token: invite,
        deepLink: 'https://t.me/miaa_bot?start=' + invite,
        expiresAt: session('client').expiresAt,
      }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Get Telegram link' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Check verification' })).toBeOnTheScreen(),
    );
    f.fetcher.mockResolvedValueOnce(f.data({ state: 'signup_ready' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Check verification' }));
    await waitFor(() => expect(screen.getByLabelText('Your full name')).toBeOnTheScreen());
    await type('Your full name', 'Test Client');
    await fireEvent.press(screen.getByRole('button', { name: 'Create Client account' }));
    await waitFor(() => expect(f.auth.getSnapshot().phase).toBe('signedIn'));
    expect(JSON.parse(f.fetcher.mock.calls.at(-1)![1]!.body as string)).toEqual({
      inviteToken: invite,
      name: 'Test Client',
    });
  });
  it('translates authentication without retaining typed passwords across mode changes', async () => {
    await open();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Use Telegram' })).toBeEnabled());
    expect(screen.getByText('አማርኛ')).toHaveStyle({ fontFamily: 'EthiopicSemiBold' });
    await type('Password', 'secret-password');
    await fireEvent.press(screen.getByRole('button', { name: 'Use Telegram' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Use password' }));
    expect(screen.getByLabelText('Password')).toHaveProp('value', '');
    await fireEvent.press(screen.getByRole('button', { name: 'አማርኛ' }));
    await waitFor(() =>
      expect(screen.getByRole('header', { name: 'እንኳን ደህና መጡ።' })).toBeOnTheScreen(),
    );
  });
  it('requires confirmation before revoking all devices and disables unlink without a password', async () => {
    const f = await open('client', true);
    f.fetcher.mockResolvedValueOnce(
      f.data({
        phoneNumber: '+251911111111',
        email: null,
        hasPassword: false,
        telegramLinked: true,
      }),
    );
    // Initial security read may already be in flight; explicitly retry its malformed fixture result.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Try again' })).toBeOnTheScreen(),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Disconnect Telegram' })).toBeOnTheScreen(),
    );
    expect(screen.getByRole('button', { name: 'Disconnect Telegram' })).toBeDisabled();
    const before = f.fetcher.mock.calls.length;
    await fireEvent.press(screen.getByRole('button', { name: 'Sign out all devices' }));
    expect(f.fetcher.mock.calls.length).toBe(before);
    expect(screen.getByRole('header', { name: 'Confirm this action' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('header', { name: 'Confirm this action' })).not.toBeOnTheScreen();
  });
});
