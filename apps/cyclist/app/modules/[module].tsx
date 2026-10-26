import { Redirect, useLocalSearchParams } from 'expo-router';
import { NotFoundScreen } from '@miaa/shell';
const aliases = { run: 'run', lookup: 'lookup', earnings: 'earnings', meal: 'meal' } as const;
export default function LegacyCyclistModule() {
  const { module } = useLocalSearchParams<{ module?: string | string[] }>();
  const path =
    typeof module === 'string' && Object.hasOwn(aliases, module)
      ? aliases[module as keyof typeof aliases]
      : null;
  return path ? <Redirect href={`/cyclist/${path}`} /> : <NotFoundScreen />;
}
