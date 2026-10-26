import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createActionStore, utf8Chunks } from '../packages/admin-portal/src/storage';
import type { AppConfiguration } from '@miaa/config';
jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 7,
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
let mockGeneration = 0;
jest.mock('expo-crypto', () => ({
  randomUUID: () => `12345678-1234-1234-1234-${String(++mockGeneration).padStart(12, '0')}`,
}));
const config: AppConfiguration = {
  role: 'admin',
  variant: 'preview',
  apiOrigin: 'https://miaa.example',
  appVersion: '0.6.0',
  foundationPreview: true,
};
const os = Platform.OS;
let values: Map<string, string>;
beforeEach(() => {
  Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
  values = new Map();
  jest
    .mocked(SecureStore.getItemAsync)
    .mockImplementation(
      async (key, options) => values.get(options?.keychainService + ':' + key) ?? null,
    );
  jest.mocked(SecureStore.setItemAsync).mockImplementation(async (key, value, options) => {
    values.set(options?.keychainService + ':' + key, value);
  });
  jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async (key, options) => {
    values.delete(options?.keychainService + ':' + key);
  });
});
afterEach(() => {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  jest.clearAllMocks();
});
test('UTF-8 chunks remain below iOS limits without splitting Ethiopic or emoji characters', () => {
  const value = 'ምሳ🥕'.repeat(1000);
  const parts = utf8Chunks(value);
  expect(parts.join('')).toBe(value);
  for (const part of parts) expect(Buffer.byteLength(part, 'utf8')).toBeLessThanOrEqual(1500);
});
test('long action drafts round-trip through device-only chunks and a committed head', async () => {
  const s = createActionStore(config, 7);
  const value = JSON.stringify({ notes: 'ምሳ'.repeat(1000) });
  await s.exclusive(() => s.write(value));
  expect(await s.exclusive(() => s.read())).toBe(value);
  for (const call of jest.mocked(SecureStore.setItemAsync).mock.calls) {
    expect(Buffer.byteLength(call[1], 'utf8')).toBeLessThanOrEqual(1500);
    expect(call[2]).toMatchObject({ keychainAccessible: 7, requireAuthentication: false });
    expect(call[2]).not.toHaveProperty('accessGroup');
  }
  await s.exclusive(() => s.clear());
  expect(await s.read()).toBeNull();
  expect(values.size).toBe(0);
});
test('failed head commit retains the previous recoverable action', async () => {
  const s = createActionStore(config, 7);
  await s.write('original');
  const setter = jest.mocked(SecureStore.setItemAsync).getMockImplementation()!;
  jest.mocked(SecureStore.setItemAsync).mockImplementation(async (key, value, options) => {
    if (key === 'pending.v1') throw new Error('Commit failed');
    return setter(key, value, options);
  });
  await expect(s.write('replacement')).rejects.toThrow();
  expect(await s.read()).toBe('original');
});
test('a missing or damaged chunk refuses recovery instead of treating it as an empty journal', async () => {
  const s = createActionStore(config, 7);
  await s.write('original');
  for (const key of values.keys()) if (!key.endsWith('pending.v1')) values.delete(key);
  await expect(s.read()).rejects.toMatchObject({ code: 'storage_error' });
});
test('owner, variant and backend each have independent secure journals', async () => {
  await createActionStore(config, 7).write('owner-7');
  await createActionStore(config, 8).write('owner-8');
  await createActionStore({ ...config, variant: 'development' }, 7).write('dev');
  await createActionStore({ ...config, apiOrigin: 'https://other.example' }, 7).write('other');
  expect(await createActionStore(config, 7).read()).toBe('owner-7');
  expect(await createActionStore(config, 8).read()).toBe('owner-8');
  expect(await createActionStore({ ...config, variant: 'development' }, 7).read()).toBe('dev');
});
test('independent native controllers serialize their read/write critical sections', async () => {
  const events: number[] = [];
  const a = createActionStore(config, 7),
    b = createActionStore(config, 7);
  await Promise.all([
    a.exclusive(async () => {
      events.push(1);
      await Promise.resolve();
      events.push(2);
    }),
    b.exclusive(async () => {
      events.push(3);
    }),
  ]);
  expect(events).toEqual([1, 2, 3]);
});
