import { Redirect, useLocalSearchParams } from 'expo-router';
import { ModuleScreen, NotFoundScreen } from '@miaa/shell';
const aliases = {
  daily: 'daily',
  people: 'people',
  ordersAdmin: 'orders',
  catalog: 'catalog',
  support: 'support',
} as const;
export default function LegacyAdminModule() {
  const { module } = useLocalSearchParams<{ module?: string | string[] }>();
  if (module === 'reports') return <ModuleScreen />;
  const path =
    typeof module === 'string' && Object.hasOwn(aliases, module)
      ? aliases[module as keyof typeof aliases]
      : null;
  return path ? <Redirect href={`/admin/${path}`} /> : <NotFoundScreen />;
}
