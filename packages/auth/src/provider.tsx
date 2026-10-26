import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import type { AppConfiguration } from '@miaa/config';
import { createAuthController, type AuthController } from './controller';
import { createCredentialStorage } from './storage';
export const AuthContext = createContext<AuthController | null>(null);
export function AuthProvider({
  children,
  config,
}: {
  children: ReactNode;
  config: AppConfiguration;
}) {
  const controller = useMemo(
    () =>
      createAuthController({
        role: config.role,
        origin: config.apiOrigin,
        storage: createCredentialStorage(config),
        allowDevelopmentHttp: config.variant === 'development',
      }),
    [config],
  );
  useEffect(() => {
    controller.setActive(AppState.currentState == null || AppState.currentState === 'active');
    void controller.retry();
    const subscription = AppState.addEventListener('change', (state) =>
      controller.setActive(state === 'active'),
    );
    const timer = setInterval(() => {
      void controller.tick();
    }, 30000);
    return () => {
      subscription.remove();
      clearInterval(timer);
      controller.setActive(false);
    };
  }, [controller]);
  return <AuthContext.Provider value={controller}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const controller = useContext(AuthContext);
  if (!controller) throw new Error('AuthProvider is required.');
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  return { ...snapshot, controller };
}
