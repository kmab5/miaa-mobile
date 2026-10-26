import { Redirect, useLocalSearchParams } from 'expo-router';
import { NotFoundScreen } from '@miaa/shell';
const aliases = {
  today: 'today',
  discover: 'browse',
  orders: 'orders',
  address: 'profile',
} as const;
export default function LegacyClientModule() {
  const { module } = useLocalSearchParams<{ module?: string | string[] }>();
  const path =
    typeof module === 'string' && Object.hasOwn(aliases, module)
      ? aliases[module as keyof typeof aliases]
      : null;
  return path ? <Redirect href={`/client/${path}`} /> : <NotFoundScreen />;
}
