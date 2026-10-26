import { beforeEach, describe, it, expect, jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { AppContext } from '../packages/shell/src/context';
import { HomeScreen, WorkspaceScreen, ModuleScreen } from '../packages/shell/src/screens';
import { SettingsScreen } from '../packages/shell/src/settings';
import { LocaleProvider, type PreferenceStorage } from '@miaa/i18n';
import { roles, type AppRole } from '@miaa/config';
import { workspaces } from '../packages/shell/src/catalog';
import { en, am } from '../packages/i18n/src/dictionaries';
import { mockParams, mockRouter } from './setup.native';
const configuration = (role: AppRole) => ({
  role,
  variant: 'preview' as const,
  apiOrigin: 'https://miaa.example',
  appVersion: '0.1.0',
  foundationPreview: true as const,
});
function storage(): PreferenceStorage {
  let value: string | null = null;
  return {
    getItem: jest.fn(async () => value),
    setItem: jest.fn(async (_key: string, next: string) => {
      value = next;
    }),
  };
}
async function open(element: React.ReactNode, role: AppRole = 'client', preferences = storage()) {
  const result = await render(
    <AppContext.Provider value={configuration(role)}>
      <LocaleProvider defaultLocale="en" storage={preferences}>
        {element}
      </LocaleProvider>
    </AppContext.Provider>,
  );
  return { ...result, preferences };
}
beforeEach(() => {
  jest.clearAllMocks();
  delete mockParams.module;
  mockRouter.canGoBack.mockReturnValue(true);
});
describe('four independent workspaces', () => {
  it.each(roles)(
    '%s home presents the correct role and navigates to its workspace',
    async (role) => {
      await open(<HomeScreen />, role);
      expect(screen.getByRole('header', { name: en[workspaces[role].headline] })).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: en['common.openWorkspace'] }));
      expect(mockRouter.push).toHaveBeenCalledWith('/workspace');
      expect(screen.getByText(en['common.noAccount'])).toBeOnTheScreen();
    },
  );
  it.each(roles)('%s exposes every planned module as a working route', async (role) => {
    await open(<WorkspaceScreen />, role);
    for (const module of workspaces[role].modules) {
      await fireEvent.press(screen.getByRole('link', { name: en[module.title] }));
      expect(mockRouter.push).toHaveBeenLastCalledWith({
        pathname: '/modules/[module]',
        params: { module: module.id },
      });
    }
  });
  it('renders a valid module, supports back and handles a direct deep link', async () => {
    mockParams.module = 'today';
    await open(<ModuleScreen />);
    expect(screen.getByRole('header', { name: en['module.today'] })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: en['common.back'] }));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    mockRouter.canGoBack.mockReturnValue(false);
    await fireEvent.press(screen.getByRole('button', { name: en['common.back'] }));
    expect(mockRouter.replace).toHaveBeenLastCalledWith('/workspace');
  });
  it('rejects modules from another role and provides a return path', async () => {
    mockParams.module = 'people';
    await open(<ModuleScreen />, 'client');
    expect(screen.getByRole('header', { name: en['common.notFound'] })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: en['common.openWorkspace'] }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/workspace');
  });
});
describe('persistent bilingual preferences', () => {
  it('switches all copy and restores the language after remounting', async () => {
    const preferences = storage();
    const page = await open(<SettingsScreen />, 'mother', preferences);
    await fireEvent.press(screen.getByRole('radio', { name: 'አማርኛ' }));
    await waitFor(() =>
      expect(screen.getByRole('header', { name: am['settings.title'] })).toBeOnTheScreen(),
    );
    await waitFor(() =>
      expect(preferences.setItem).toHaveBeenCalledWith('@miaa/preferences/locale/v1', 'am'),
    );
    await page.unmount();
    await open(<SettingsScreen />, 'mother', preferences);
    await waitFor(() =>
      expect(screen.getByRole('header', { name: am['settings.title'] })).toBeOnTheScreen(),
    );
    expect(screen.getByRole('radio', { name: 'አማርኛ' })).toBeChecked();
  });
  it('continues working when saved preferences cannot be read', async () => {
    const preferences = storage();
    jest.mocked(preferences.getItem).mockRejectedValueOnce(new Error('unavailable'));
    await open(<SettingsScreen />, 'client', preferences);
    await waitFor(() => expect(screen.getByText(en['settings.storageFailed'])).toBeOnTheScreen());
    await fireEvent.press(screen.getByRole('radio', { name: 'አማርኛ' }));
    await waitFor(() =>
      expect(screen.getByRole('header', { name: am['settings.title'] })).toBeOnTheScreen(),
    );
  });
  it('reports save failures and allows retrying the same language', async () => {
    const preferences = storage();
    jest.mocked(preferences.setItem).mockRejectedValueOnce(new Error('unavailable'));
    await open(<SettingsScreen />, 'client', preferences);
    await fireEvent.press(screen.getByRole('radio', { name: 'አማርኛ' }));
    await waitFor(() => expect(screen.getByText(am['settings.languageFailed'])).toBeOnTheScreen());
    await fireEvent.press(screen.getByRole('radio', { name: 'አማርኛ' }));
    await waitFor(() =>
      expect(screen.queryByText(am['settings.languageFailed'])).not.toBeOnTheScreen(),
    );
  });
});
describe('connection check feedback', () => {
  it('shows a real successful result without logging in', async () => {
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { status: 'ok', apiVersion: 1 } }),
    } as Response);
    await open(<SettingsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: en['settings.check'] }));
    await waitFor(() => expect(screen.getByText(en['settings.connected'])).toBeOnTheScreen());
    expect(jest.mocked(fetch).mock.calls[0]![1]?.headers).not.toHaveProperty('Authorization');
  });
  it('shows a helpful retry state on a failed connection', async () => {
    global.fetch = jest.fn<typeof fetch>().mockRejectedValue(new Error('offline'));
    await open(<SettingsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: en['settings.check'] }));
    await waitFor(() => expect(screen.getByText(en['settings.disconnected'])).toBeOnTheScreen());
    expect(screen.getByRole('button', { name: en['settings.check'] })).toBeEnabled();
  });
  it('allows cancelling a slow request and cancels on unmount', async () => {
    global.fetch = jest
      .fn<typeof fetch>()
      .mockImplementation(
        async (_url, options) =>
          new Promise((_resolve, reject) =>
            options?.signal?.addEventListener('abort', () => reject(new Error('aborted'))),
          ),
      );
    const page = await open(<SettingsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: en['settings.check'] }));
    await fireEvent.press(screen.getByRole('button', { name: en['settings.cancel'] }));
    await waitFor(() => expect(screen.getByText(en['settings.cancelled'])).toBeOnTheScreen());
    await fireEvent.press(screen.getByRole('button', { name: en['settings.check'] }));
    const signal = jest.mocked(fetch).mock.calls.at(-1)![1]?.signal;
    await page.unmount();
    expect(signal?.aborted).toBe(true);
  });
});
