import { useLocalSearchParams } from 'expo-router';
import {
  ClientTodayScreen,
  ClientBrowseScreen,
  ClientProfileScreen,
  ClientPaymentsScreen,
  ClientOrdersScreen,
  ClientOrderScreen,
} from '@miaa/client-portal';
import { NotFoundScreen } from '@miaa/shell';
const screens = {
  today: ClientTodayScreen,
  browse: ClientBrowseScreen,
  profile: ClientProfileScreen,
  payments: ClientPaymentsScreen,
  orders: ClientOrdersScreen,
  order: ClientOrderScreen,
};
export function generateStaticParams() {
  return Object.keys(screens).map((screen) => ({ screen }));
}
export default function ClientScreen() {
  const { screen } = useLocalSearchParams<{ screen?: string | string[] }>();
  const Screen =
    typeof screen === 'string' && Object.hasOwn(screens, screen)
      ? screens[screen as keyof typeof screens]
      : null;
  return Screen ? <Screen /> : <NotFoundScreen />;
}
