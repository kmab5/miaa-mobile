import { createContext, useContext, type ReactNode } from 'react';
const Context = createContext(true);
export function FontAvailabilityProvider({
  ready,
  children,
}: {
  ready: boolean;
  children: ReactNode;
}) {
  return <Context.Provider value={ready}>{children}</Context.Provider>;
}
export const useBundledFonts = () => useContext(Context);
