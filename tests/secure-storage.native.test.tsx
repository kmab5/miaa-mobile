import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createCredentialStorage } from '../packages/auth/src/storage';
import type { AppConfiguration } from '@miaa/config';
jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 7,
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));
const config: AppConfiguration = {
  role: 'client',
  variant: 'preview',
  apiOrigin: 'https://miaa.onrender.com',
  appVersion: '0.2.0',
  foundationPreview: true,
};
const os = Platform.OS;
afterEach(() => {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  jest.clearAllMocks();
});
describe('native credential isolation', () => {
  it('uses the same device-only secure service on read/write/delete', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    const storage = createCredentialStorage(config);
    await storage.set('native-secret');
    await storage.get();
    await storage.clear();
    const options = jest.mocked(SecureStore.setItemAsync).mock.calls[0]![2];
    expect(options).toMatchObject({ keychainAccessible: 7, requireAuthentication: false });
    expect(options).not.toHaveProperty('accessGroup');
    expect(jest.mocked(SecureStore.getItemAsync).mock.calls[0]).toEqual(['session.v1', options]);
    expect(jest.mocked(SecureStore.deleteItemAsync).mock.calls[0]).toEqual(['session.v1', options]);
  });
  it('separates role, build variant, and backend to prevent credential reuse', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    for (const extra of [
      {},
      { role: 'admin' as const },
      { variant: 'development' as const },
      { apiOrigin: 'https://other.example' },
    ])
      await createCredentialStorage({ ...config, ...extra }).get();
    const services = jest
      .mocked(SecureStore.getItemAsync)
      .mock.calls.map((c) => c[1]?.keychainService);
    expect(new Set(services).size).toBe(4);
  });
  it('never persists web preview credentials in a browser or native store', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    const first = createCredentialStorage(config);
    await first.set('memory-secret');
    expect(await first.get()).toBe('memory-secret');
    expect(await createCredentialStorage(config).get()).toBeNull();
    await first.clear();
    expect(await first.get()).toBeNull();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
  });
});
