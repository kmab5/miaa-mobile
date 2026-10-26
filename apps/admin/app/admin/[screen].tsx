import { useLocalSearchParams } from 'expo-router';
import {
  AdminDailyScreen,
  AdminPeopleScreen,
  AdminCatalogScreen,
  AdminOrdersScreen,
  AdminPaymentsScreen,
  AdminSupportScreen,
  AdminSettingsScreen,
  AdminRecordScreen,
  AdminFormScreen,
} from '@miaa/admin-portal';
import { NotFoundScreen } from '@miaa/shell';
const screens = {
  daily: AdminDailyScreen,
  people: AdminPeopleScreen,
  catalog: AdminCatalogScreen,
  orders: AdminOrdersScreen,
  payments: AdminPaymentsScreen,
  support: AdminSupportScreen,
  settings: AdminSettingsScreen,
  record: AdminRecordScreen,
  form: AdminFormScreen,
};
export function generateStaticParams() {
  return Object.keys(screens).map((screen) => ({ screen }));
}
export default function AdminScreen() {
  const params = useLocalSearchParams<{ screen?: string | string[] }>();
  const Screen =
    typeof params.screen === 'string' && Object.hasOwn(screens, params.screen)
      ? screens[params.screen as keyof typeof screens]
      : null;
  return Screen ? <Screen key={JSON.stringify(params)} /> : <NotFoundScreen />;
}
