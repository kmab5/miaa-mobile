import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  dictionary,
  initialLocale,
  isLocale,
  type Locale,
  type TranslationKey,
} from './dictionaries';
export const LOCALE_STORAGE_KEY = '@miaa/preferences/locale/v1';
export interface PreferenceStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}
type TranslationContext = {
  locale: Locale;
  ready: boolean;
  persistenceError: 'read' | 'write' | null;
  setLocale(locale: Locale): Promise<void>;
  t(key: TranslationKey): string;
};
const Context = createContext<TranslationContext | null>(null);
function deviceLocale(): Locale {
  try {
    return initialLocale(Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    return 'en';
  }
}
export function LocaleProvider({
  children,
  storage = AsyncStorage,
  defaultLocale,
  loadTimeoutMs = 3000,
}: {
  children: ReactNode;
  storage?: PreferenceStorage;
  defaultLocale?: Locale;
  loadTimeoutMs?: number;
}) {
  const [locale, updateLocale] = useState<Locale>(defaultLocale ?? deviceLocale);
  const [ready, setReady] = useState(false);
  const [persistenceError, setError] = useState<'read' | 'write' | null>(null);
  const mounted = useRef(false);
  const revision = useRef(0);
  const writes = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    let active = true;
    mounted.current = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Preference read timed out.')), loadTimeoutMs);
    });
    Promise.race([Promise.resolve().then(() => storage.getItem(LOCALE_STORAGE_KEY)), deadline])
      .then((value) => {
        if (active && isLocale(value)) updateLocale(value);
      })
      .catch(() => {
        if (active) setError('read');
      })
      .finally(() => {
        clearTimeout(timer);
        if (active) setReady(true);
      });
    return () => {
      clearTimeout(timer);
      active = false;
      mounted.current = false;
    };
  }, [storage, loadTimeoutMs]);
  const setLocale = useCallback(
    async (value: Locale) => {
      if (!isLocale(value)) return;
      updateLocale(value);
      const current = ++revision.current;
      const write = writes.current
        .catch(() => undefined)
        .then(() => storage.setItem(LOCALE_STORAGE_KEY, value));
      writes.current = write;
      try {
        await write;
        if (mounted.current && current === revision.current) setError(null);
      } catch {
        if (mounted.current && current === revision.current) setError('write');
      }
    },
    [storage],
  );
  const value = useMemo<TranslationContext>(
    () => ({ locale, ready, persistenceError, setLocale, t: (key) => dictionary(locale)[key] }),
    [locale, ready, persistenceError, setLocale],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useTranslation(): TranslationContext {
  const context = useContext(Context);
  if (!context) throw new Error('LocaleProvider is required.');
  return context;
}
