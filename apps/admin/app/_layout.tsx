import { AppRoot } from '@miaa/shell';
import { AdminProvider } from '@miaa/admin-portal';
export { AppRouteError as ErrorBoundary } from '@miaa/shell';
export default function RootLayout() {
  return <AppRoot role="admin" providers={AdminProvider} />;
}
