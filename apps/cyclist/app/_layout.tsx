import { AppRoot } from '@miaa/shell';
import { CyclistProvider } from '@miaa/cyclist-portal';
export { AppRouteError as ErrorBoundary } from '@miaa/shell';
export default function RootLayout() {
  return <AppRoot role="cyclist" providers={CyclistProvider} />;
}
