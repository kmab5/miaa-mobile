import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { TokenStorage } from '@miaa/api';
import type { AppConfiguration } from '@miaa/config';
/** No personal identity or passwords are persisted. Web previews are memory-only. */
export function createCredentialStorage(config: AppConfiguration): TokenStorage {
  if (Platform.OS === 'web') {
    let token: string | null = null;
    return {
      get: async () => token,
      set: async (v) => {
        token = v;
      },
      clear: async () => {
        token = null;
      },
    };
  }
  const origin = Array.from(config.apiOrigin)
    .map((v) => v.charCodeAt(0).toString(16))
    .join('');
  const options: SecureStore.SecureStoreOptions = {
    keychainService: `com.kmab.miaa.${config.role}.${config.variant}.${origin}`,
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    requireAuthentication: false,
  };
  const key = 'session.v1';
  return {
    get: () => SecureStore.getItemAsync(key, options),
    set: (token) => SecureStore.setItemAsync(key, token, options),
    clear: () => SecureStore.deleteItemAsync(key, options),
  };
}
