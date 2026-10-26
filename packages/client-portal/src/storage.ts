import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { randomUUID } from 'expo-crypto';
import type { AppConfiguration } from '@miaa/config';
import type { OrderStore } from './contracts';
import { fail } from './validation';
const queues = new Map<string, Promise<unknown>>();
export function utf8Chunks(value: string, max = 1500) {
  const result: string[] = [];
  let part = '',
    size = 0;
  for (const char of value) {
    const p = char.codePointAt(0)!;
    const bytes = p < 128 ? 1 : p < 2048 ? 2 : p < 65536 ? 3 : 4;
    if (size + bytes > max) {
      result.push(part);
      part = '';
      size = 0;
    }
    part += char;
    size += bytes;
  }
  if (part) result.push(part);
  return result;
}
/** Chunks stay below historical iOS SecureStore value limits. The head is the commit point. */
export function createOrderStore(config: AppConfiguration, owner: number): OrderStore {
  const origin = Array.from(config.apiOrigin)
    .map((c) => c.charCodeAt(0).toString(16))
    .join('');
  const namespace = `com.kmab.miaa.orders.${config.variant}.${origin}.${owner}`;
  if (Platform.OS === 'web') {
    const key = namespace + '.v1';
    return {
      read: async () => localStorage.getItem(key),
      write: async (value) => {
        localStorage.setItem(key, value);
      },
      clear: async () => {
        localStorage.removeItem(key);
      },
      exclusive: async (action) => {
        if (!globalThis.navigator?.locks) return fail('storage_error');
        return navigator.locks.request(key, action);
      },
    };
  }
  const options: SecureStore.SecureStoreOptions = {
    keychainService: namespace,
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    requireAuthentication: false,
  };
  const head = 'pending.v1';
  async function metadata() {
    const raw = await SecureStore.getItemAsync(head, options);
    if (raw === null) return null;
    try {
      const value = JSON.parse(raw) as { generation: unknown; count: unknown };
      if (
        typeof value.generation !== 'string' ||
        !/^[-a-z0-9]{36}$/i.test(value.generation) ||
        !Number.isInteger(value.count) ||
        Number(value.count) < 1 ||
        Number(value.count) > 16
      )
        return fail('storage_error');
      return { generation: value.generation, count: Number(value.count) };
    } catch {
      return fail('storage_error');
    }
  }
  async function removeChunks(old: Awaited<ReturnType<typeof metadata>>) {
    if (!old) return;
    for (let i = 0; i < old.count; i++)
      await SecureStore.deleteItemAsync(`pending.${old.generation}.${i}`, options).catch(
        () => undefined,
      );
  }
  return {
    exclusive: async (action) => {
      const preceding = queues.get(namespace) ?? Promise.resolve();
      const current = preceding.catch(() => undefined).then(action);
      queues.set(namespace, current);
      try {
        return await current;
      } finally {
        if (queues.get(namespace) === current) queues.delete(namespace);
      }
    },
    read: async () => {
      const saved = await metadata();
      if (!saved) return null;
      let value = '';
      for (let i = 0; i < saved.count; i++) {
        const part = await SecureStore.getItemAsync(`pending.${saved.generation}.${i}`, options);
        if (part === null) return fail('storage_error');
        value += part;
      }
      return value;
    },
    write: async (value) => {
      const parts = utf8Chunks(value);
      if (!parts.length || parts.length > 16) return fail('storage_error');
      const old = await metadata();
      const generation = randomUUID();
      for (const [index, part] of parts.entries())
        await SecureStore.setItemAsync(`pending.${generation}.${index}`, part, options);
      await SecureStore.setItemAsync(
        head,
        JSON.stringify({ generation, count: parts.length }),
        options,
      );
      await removeChunks(old);
    },
    clear: async () => {
      const old = await metadata();
      await SecureStore.deleteItemAsync(head, options);
      await removeChunks(old);
    },
  };
}
