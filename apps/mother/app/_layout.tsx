import { AppRoot } from '@miaa/shell';
import { MotherProvider } from '@miaa/mother-portal';
export { AppRouteError as ErrorBoundary } from '@miaa/shell';
export default function RootLayout() {
  return <AppRoot role="mother" providers={MotherProvider} />;
}
