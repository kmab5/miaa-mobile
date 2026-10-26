import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { AppConfiguration } from '@miaa/config';
export interface TicketStore {
  read(): Promise<string | null>;
  write(raw: string): Promise<void>;
  clear(): Promise<void>;
  exclusive<T>(work: () => Promise<T>): Promise<T>;
}
const queues = new Map<string, Promise<unknown>>();
/** A small recovery marker; no message, client name, address or credential is stored. */
export function createTicketStore(config: AppConfiguration, owner: number): TicketStore {
  const origin = Array.from(config.apiOrigin)
    .map((c) => c.charCodeAt(0).toString(16))
    .join('');
  const namespace = `com.kmab.miaa.mother.requests.${config.variant}.${origin}.${owner}`;
  const options: SecureStore.SecureStoreOptions = {
    keychainService: namespace,
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    requireAuthentication: false,
  };
  return {
    read: async () =>
      Platform.OS === 'web'
        ? localStorage.getItem(namespace)
        : SecureStore.getItemAsync('pending.v1', options),
    write: async (raw) => {
      if (Platform.OS === 'web') localStorage.setItem(namespace, raw);
      else await SecureStore.setItemAsync('pending.v1', raw, options);
    },
    clear: async () => {
      if (Platform.OS === 'web') localStorage.removeItem(namespace);
      else await SecureStore.deleteItemAsync('pending.v1', options);
    },
    exclusive: async (work) => {
      if (Platform.OS === 'web') {
        if (!globalThis.navigator?.locks)
          throw new Error('Request recovery storage requires Web Locks.');
        return navigator.locks.request(namespace, work);
      }
      const preceding = queues.get(namespace) ?? Promise.resolve();
      const next = preceding.catch(() => undefined).then(work);
      queues.set(namespace, next);
      try {
        return await next;
      } finally {
        if (queues.get(namespace) === next) queues.delete(namespace);
      }
    },
  };
}
