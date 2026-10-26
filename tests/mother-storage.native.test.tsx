import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createTicketStore } from '../packages/mother-portal/src/storage';
import type { AppConfiguration } from '@miaa/config';
jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 7,
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
const config: AppConfiguration = {
  role: 'mother',
  variant: 'preview',
  apiOrigin: 'https://miaa.example',
  appVersion: '0.4.0',
  foundationPreview: true,
};
const os = Platform.OS;
let values: Map<string, string>;
beforeEach(() => {
  Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
  values = new Map();
  jest
    .mocked(SecureStore.getItemAsync)
    .mockImplementation(async (key, options) => values.get(options?.keychainService + key) ?? null);
  jest.mocked(SecureStore.setItemAsync).mockImplementation(async (key, value, options) => {
    values.set(options?.keychainService + key, value);
  });
  jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async (key, options) => {
    values.delete(options?.keychainService + key);
  });
});
afterEach(() => {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  jest.clearAllMocks();
});
test('request marker round-trips with device-only keychain options and no shared access group', async () => {
  const s = createTicketStore(config, 7);
  const marker = JSON.stringify({
    v: 1,
    digest: 'a'.repeat(64),
    before: Array.from({ length: 50 }, (_, i) => 2147483647 - i),
    sentAt: new Date().toISOString(),
  });
  expect(Buffer.byteLength(marker)).toBeLessThan(1500);
  await s.exclusive(() => s.write(marker));
  expect(await s.read()).toBe(marker);
  const options = jest.mocked(SecureStore.setItemAsync).mock.calls[0]![2];
  expect(options).toMatchObject({ keychainAccessible: 7, requireAuthentication: false });
  expect(options).not.toHaveProperty('accessGroup');
  await s.clear();
  expect(await s.read()).toBeNull();
});
test('account, origin and variant isolate markers while app version preserves recovery', async () => {
  await createTicketStore(config, 7).write('owner');
  expect(await createTicketStore(config, 8).read()).toBeNull();
  expect(await createTicketStore({ ...config, variant: 'production' }, 7).read()).toBeNull();
  expect(
    await createTicketStore({ ...config, apiOrigin: 'https://other.example' }, 7).read(),
  ).toBeNull();
  expect(await createTicketStore({ ...config, appVersion: '0.5.0' }, 7).read()).toBe('owner');
});
test('same-scope native stores serialize operations and recover after a failed operation', async () => {
  const a = createTicketStore(config, 7),
    b = createTicketStore(config, 7);
  const events: number[] = [];
  const failed = a.exclusive(async () => {
    events.push(1);
    await Promise.resolve();
    events.push(2);
    throw new Error('expected');
  });
  const next = b.exclusive(async () => {
    events.push(3);
  });
  await expect(failed).rejects.toThrow();
  await next;
  expect(events).toEqual([1, 2, 3]);
});
test('native read failures propagate rather than becoming missing markers', async () => {
  jest.mocked(SecureStore.getItemAsync).mockRejectedValueOnce(new Error('keychain'));
  await expect(createTicketStore(config, 7).read()).rejects.toThrow('keychain');
});
test('browser preview refuses exclusive mutation without Web Locks', async () => {
  Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
  const descriptor = Object.getOwnPropertyDescriptor(navigator, 'locks');
  Object.defineProperty(navigator, 'locks', { value: undefined, configurable: true });
  try {
    await expect(createTicketStore(config, 7).exclusive(async () => undefined)).rejects.toThrow(
      'Web Locks',
    );
  } finally {
    if (descriptor) Object.defineProperty(navigator, 'locks', descriptor);
    else Reflect.deleteProperty(navigator, 'locks');
  }
});
