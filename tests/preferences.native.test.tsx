import { describe, it, expect, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text, StyleSheet } from 'react-native';
import { LocaleProvider, useTranslation, type PreferenceStorage } from '@miaa/i18n';
import { AppText, FontAvailabilityProvider } from '@miaa/ui';
function Probe() {
  const { ready, locale, persistenceError, setLocale } = useTranslation();
  return (
    <>
      <Text>{ready ? 'ready' : 'loading'}</Text>
      <Text>{locale}</Text>
      <Text>{persistenceError ?? 'saved'}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Amharic"
        onPress={() => void setLocale('am')}
      >
        <Text>Amharic</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="English"
        onPress={() => void setLocale('en')}
      >
        <Text>English</Text>
      </Pressable>
    </>
  );
}
describe('startup and preference races', () => {
  it('recovers from a storage promise that never settles', async () => {
    const storage: PreferenceStorage = {
      getItem: () => new Promise(() => undefined),
      setItem: async () => undefined,
    };
    await render(
      <LocaleProvider defaultLocale="en" storage={storage} loadTimeoutMs={20}>
        <Probe />
      </LocaleProvider>,
    );
    await waitFor(() => expect(screen.getByText('ready')).toBeOnTheScreen());
    expect(screen.getByText('read')).toBeOnTheScreen();
  });
  it('recovers when the native storage bridge throws synchronously', async () => {
    const storage: PreferenceStorage = {
      getItem: () => {
        throw new Error('Storage bridge unavailable');
      },
      setItem: async () => undefined,
    };
    await render(
      <LocaleProvider defaultLocale="en" storage={storage}>
        <Probe />
      </LocaleProvider>,
    );
    await waitFor(() => expect(screen.getByText('ready')).toBeOnTheScreen());
    expect(screen.getByText('read')).toBeOnTheScreen();
  });
  it('retains the last language choice when writes complete slowly', async () => {
    let release: (() => void) | undefined;
    let stored = '';
    let writes = 0;
    const first = new Promise<void>((resolve) => {
      release = resolve;
    });
    const storage: PreferenceStorage = {
      getItem: async () => null,
      setItem: jest.fn(async (_key: string, value: string) => {
        if (++writes === 1) await first;
        stored = value;
      }),
    };
    await render(
      <LocaleProvider defaultLocale="en" storage={storage}>
        <Probe />
      </LocaleProvider>,
    );
    await waitFor(() => expect(screen.getByText('ready')).toBeOnTheScreen());
    await fireEvent.press(screen.getByRole('button', { name: 'Amharic' }));
    await fireEvent.press(screen.getByRole('button', { name: 'English' }));
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    await act(async () => release?.());
    await waitFor(() => expect(storage.setItem).toHaveBeenCalledTimes(2));
    expect(stored).toBe('en');
  });
  it('uses a system fallback when bundled fonts are unavailable', async () => {
    const storage = { getItem: async () => null, setItem: async () => undefined };
    await render(
      <LocaleProvider defaultLocale="am" storage={storage}>
        <FontAvailabilityProvider ready={false}>
          <AppText weight="semibold">Readable fallback</AppText>
        </FontAvailabilityProvider>
      </LocaleProvider>,
    );
    expect(
      StyleSheet.flatten(screen.getByText('Readable fallback').props.style).fontFamily,
    ).toBeUndefined();
  });
});
