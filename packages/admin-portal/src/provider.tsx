import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { randomUUID } from 'expo-crypto';
import { useAuth } from '@miaa/auth';
import type { AppConfiguration } from '@miaa/config';
import { createAdminController, type AdminController } from './controller';
import { createActionStore } from './storage';
const Context = createContext<AdminController | null>(null);
export function AdminProvider({
  config,
  children,
}: {
  config: AppConfiguration;
  children: ReactNode;
}) {
  const auth = useAuth();
  const owner = auth.phase === 'signedIn' && auth.user?.role === 'admin' ? auth.user.id : null;
  const model = useMemo(
    () =>
      owner === null
        ? null
        : createAdminController({
            request: auth.controller.request,
            store: createActionStore(config, owner),
            randomKey: () => `miaa-admin-${randomUUID()}`,
          }),
    [owner, config, auth.controller],
  );
  const mounted = useRef<AdminController | null>(null);
  useEffect(() => {
    if (!model) return;
    mounted.current = model;
    void model.recover();
    return () => {
      mounted.current = null;
      queueMicrotask(() => {
        if (mounted.current !== model) model.dispose();
      });
    };
  }, [model]);
  return <Context.Provider value={model}>{children}</Context.Provider>;
}
export function useAdmin() {
  const model = useContext(Context);
  if (!model) throw new Error('An authenticated Admin provider is required.');
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  return { ...state, model };
}
