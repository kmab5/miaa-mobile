import { createContext, useContext } from 'react';
import type { AppConfiguration } from '@miaa/config';
export const AppContext = createContext<AppConfiguration | null>(null);
export function useAppConfiguration(): AppConfiguration {
  const context = useContext(AppContext);
  if (!context) throw new Error('AppRoot is required.');
  return context;
}
