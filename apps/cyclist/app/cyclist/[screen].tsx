import { useLocalSearchParams } from 'expo-router';
import {
  CyclistRunScreen,
  CyclistLookupScreen,
  CyclistEarningsScreen,
  CyclistMealScreen,
} from '@miaa/cyclist-portal';
import { NotFoundScreen } from '@miaa/shell';
const screens = {
  run: CyclistRunScreen,
  lookup: CyclistLookupScreen,
  earnings: CyclistEarningsScreen,
  meal: CyclistMealScreen,
};
export function generateStaticParams() {
  return Object.keys(screens).map((screen) => ({ screen }));
}
export default function CyclistScreen() {
  const { screen } = useLocalSearchParams<{ screen?: string | string[] }>();
  const Screen =
    typeof screen === 'string' && Object.hasOwn(screens, screen)
      ? screens[screen as keyof typeof screens]
      : null;
  return Screen ? <Screen /> : <NotFoundScreen />;
}
