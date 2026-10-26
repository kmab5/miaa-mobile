import { Redirect, useLocalSearchParams } from 'expo-router';
import { NotFoundScreen } from '@miaa/shell';
const aliases = { preparation: 'queue', meal: 'meal', requests: 'tickets' } as const;
export default function LegacyMotherModule() {
  const { module } = useLocalSearchParams<{ module?: string | string[] }>();
  const path =
    typeof module === 'string' && Object.hasOwn(aliases, module)
      ? aliases[module as keyof typeof aliases]
      : null;
  return path ? <Redirect href={`/mother/${path}`} /> : <NotFoundScreen />;
}
