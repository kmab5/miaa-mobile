import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import Constants from 'expo-constants';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { readAppConfiguration, type AppRole, type AppConfiguration } from '@miaa/config';
import { LocaleProvider, useTranslation } from '@miaa/i18n';
import { AppText, Button, Brand, colors, fontAssets, FontAvailabilityProvider } from '@miaa/ui';
import { AuthProvider, useAuth } from '@miaa/auth';
import { AppContext } from './context';
void SplashScreen.preventAutoHideAsync().catch(() => undefined);
function PassThrough({ children }: { children: ReactNode; config: AppConfiguration }) {
  return children;
}
export function AppRoot({
  role,
  providers: Providers = PassThrough,
}: {
  role: AppRole;
  providers?: ComponentType<{ config: AppConfiguration; children: ReactNode }>;
}) {
  const configuration = useMemo(
    () => readAppConfiguration(Constants.expoConfig?.extra, role),
    [role],
  );
  return (
    <SafeAreaProvider>
      <AppContext.Provider value={configuration}>
        <LocaleProvider>
          <AuthProvider config={configuration}>
            <Providers config={configuration}>
              <RootContent role={role} />
            </Providers>
          </AuthProvider>
        </LocaleProvider>
      </AppContext.Provider>
    </SafeAreaProvider>
  );
}
function RootContent({ role }: { role: AppRole }) {
  const auth = useAuth();
  const { ready, t, locale } = useTranslation();
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const [fontTimeout, setFontTimeout] = useState(false);
  useEffect(() => {
    if (fontsLoaded || fontError) return;
    const timer = setTimeout(() => setFontTimeout(true), 8000);
    return () => clearTimeout(timer);
  }, [fontsLoaded, fontError]);
  useEffect(() => {
    if (ready && (fontsLoaded || fontError || fontTimeout))
      void SplashScreen.hideAsync().catch(() => undefined);
  }, [ready, fontsLoaded, fontError, fontTimeout]);
  if (!ready || (!fontsLoaded && !fontError && !fontTimeout))
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.black} accessibilityLabel={t('common.loading')} />
      </View>
    );
  return (
    <FontAvailabilityProvider ready={fontsLoaded}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.white },
          animation: 'slide_from_right',
          headerTitleStyle: {
            fontFamily: locale === 'am' ? 'EthiopicSemiBold' : 'PoppinsSemiBold',
          },
        }}
      >
        <Stack.Protected guard={auth.phase === 'signedIn'}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="modules/[module]" />
          <Stack.Screen name="security" />
          {role === 'client' ? <Stack.Screen name="client/[screen]" /> : null}
          {role === 'mother' ? <Stack.Screen name="mother/[screen]" /> : null}
          {role === 'cyclist' ? <Stack.Screen name="cyclist/[screen]" /> : null}
        </Stack.Protected>
        <Stack.Protected guard={auth.phase !== 'signedIn'}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
        <Stack.Screen name="licenses" />
        <Stack.Screen name="+not-found" />
      </Stack>
    </FontAvailabilityProvider>
  );
}
/** The boundary does not expose exception messages, configuration or stack traces. */
export function AppRouteError({ retry }: ErrorBoundaryProps) {
  return (
    <SafeAreaProvider>
      <LocaleProvider>
        <FontAvailabilityProvider ready={false}>
          <ErrorContent retry={retry} />
        </FontAvailabilityProvider>
      </LocaleProvider>
    </SafeAreaProvider>
  );
}
function ErrorContent({ retry }: { retry(): void }) {
  const { t } = useTranslation();
  return (
    <SafeAreaView style={styles.error}>
      <Brand />
      <AppText variant="title" weight="semibold" accessibilityRole="header">
        {t('common.problem')}
      </AppText>
      <AppText>{t('common.problemBody')}</AppText>
      <Button label={t('common.retry')} onPress={retry} />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  error: { flex: 1, backgroundColor: colors.white, justifyContent: 'center', padding: 24, gap: 24 },
});
