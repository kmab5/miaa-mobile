import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@miaa/auth';
import type { AppConfiguration } from '@miaa/config';
import { todayEAT } from './contracts';
import { createCyclistController, type CyclistController } from './controller';
const DayContext = createContext('');
const Context = createContext<CyclistController | null>(null);
export function CyclistProvider({ children }: { config: AppConfiguration; children: ReactNode }) {
  const auth = useAuth();
  const owner = auth.phase === 'signedIn' && auth.user?.role === 'cyclist' ? auth.user.id : null;
  const [today, setToday] = useState(() => todayEAT());
  useEffect(() => {
    if (owner === null) return;
    const timer = setInterval(() => setToday(todayEAT()), 1000);
    return () => clearInterval(timer);
  }, [owner]);
  const model = useMemo(
    () =>
      owner === null
        ? null
        : createCyclistController({
            request: auth.controller.request,
          }),
    [owner, auth.controller],
  );
  const mounted = useRef<CyclistController | null>(null);
  useEffect(() => {
    if (!model) return;
    mounted.current = model;
    return () => {
      mounted.current = null;
      queueMicrotask(() => {
        if (mounted.current !== model) model.dispose();
      });
    };
  }, [model]);
  return (
    <Context.Provider value={model}>
      <DayContext.Provider value={today}>{children}</DayContext.Provider>
    </Context.Provider>
  );
}
export function useCyclist() {
  const model = useContext(Context);
  if (!model) throw new Error('An authenticated Cyclist provider is required.');
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  return { ...state, model };
}

export function useCyclistDate() {
  return useContext(DayContext);
}
