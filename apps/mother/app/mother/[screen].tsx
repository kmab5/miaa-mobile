import { useLocalSearchParams } from 'expo-router';
import { MotherQueueScreen, MotherMealScreen, MotherTicketsScreen } from '@miaa/mother-portal';
import { NotFoundScreen } from '@miaa/shell';
const screens = { queue: MotherQueueScreen, meal: MotherMealScreen, tickets: MotherTicketsScreen };
export function generateStaticParams() {
  return Object.keys(screens).map((screen) => ({ screen }));
}
export default function MotherScreen() {
  const { screen } = useLocalSearchParams<{ screen?: string | string[] }>();
  const Screen =
    typeof screen === 'string' && Object.hasOwn(screens, screen)
      ? screens[screen as keyof typeof screens]
      : null;
  return Screen ? <Screen /> : <NotFoundScreen />;
}
