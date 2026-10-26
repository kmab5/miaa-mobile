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
import type { AppConfiguration } from '@miaa/config';
import { useAuth } from '@miaa/auth';
import { createOrderController, type OrderController } from './orders';
import { createOrderStore } from './storage';
const Context = createContext<OrderController | null>(null);
export function ClientProvider({
  config,
  children,
}: {
  config: AppConfiguration;
  children: ReactNode;
}) {
  const auth = useAuth();
  const owner = auth.phase === 'signedIn' && auth.user?.role === 'client' ? auth.user.id : null;
  const model = useMemo(
    () =>
      owner === null
        ? null
        : createOrderController({
            owner,
            store: createOrderStore(config, owner),
            request: auth.controller.request,
            randomKey: () => `miaa-${randomUUID()}`,
          }),
    [owner, config, auth.controller],
  );
  const mounted = useRef<OrderController | null>(null);
  useEffect(() => {
    if (!model) return;
    mounted.current = model;
    void model.recover();
    return () => {
      mounted.current = null;
      // React Strict Mode replays effects with the same controller. A real removal
      // or account change still cancels it before the next asynchronous continuation.
      queueMicrotask(() => {
        if (mounted.current !== model) model.dispose();
      });
    };
  }, [model]);
  return <Context.Provider value={model}>{children}</Context.Provider>;
}
export function useOrder() {
  const model = useContext(Context);
  if (!model) throw new Error('An authenticated Client provider is required.');
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  return { ...state, model, retryReady: state.retryAt === 0 };
}
