import { AppRoot } from '@miaa/shell';
import { ClientProvider } from '@miaa/client-portal';
export { AppRouteError as ErrorBoundary } from '@miaa/shell';
export default function RootLayout() {
  return <AppRoot role="client" providers={ClientProvider} />;
}
