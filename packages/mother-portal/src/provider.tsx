import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';
import { useAuth } from '@miaa/auth';
import type { AppConfiguration } from '@miaa/config';
import { createMotherController, type MotherController } from './controller';
import { createTicketStore } from './storage';
const Context = createContext<MotherController | null>(null);
export function MotherProvider({
  config,
  children,
}: {
  config: AppConfiguration;
  children: ReactNode;
}) {
  const auth = useAuth();
  const owner = auth.phase === 'signedIn' && auth.user?.role === 'mother' ? auth.user.id : null;
  const model = useMemo(
    () =>
      owner === null
        ? null
        : createMotherController({
            request: auth.controller.request,
            store: createTicketStore(config, owner),
            digest: (text) => digestStringAsync(CryptoDigestAlgorithm.SHA256, text),
          }),
    [owner, config, auth.controller],
  );
  const mounted = useRef<MotherController | null>(null);
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
export function useMother() {
  const model = useContext(Context);
  if (!model) throw new Error('An authenticated Mother provider is required.');
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  return { ...state, model };
}
