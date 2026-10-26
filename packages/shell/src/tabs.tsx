import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tabs } from 'expo-router';
import { useTranslation } from '@miaa/i18n';
import { colors, Icon, typography, useBundledFonts } from '@miaa/ui';
export function AppTabs() {
  const { t, locale } = useTranslation();
  const insets = useSafeAreaInsets();
  const fontsReady = useBundledFonts();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.black,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.border,
          height: 72 + insets.bottom,
          paddingTop: 8,
          paddingBottom: Math.max(8, insets.bottom),
        },
        tabBarItemStyle: { paddingVertical: 0 },
        tabBarLabelStyle: {
          fontFamily: fontsReady
            ? locale === 'am'
              ? typography.ethiopicSemiBold
              : typography.latinSemiBold
            : undefined,
          fontSize: 11,
          lineHeight: locale === 'am' ? 20 : 18,
          paddingBottom: 0,
          flexShrink: 0,
        },
        sceneStyle: { backgroundColor: colors.white },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('nav.home'),
          tabBarIcon: ({ color, size }) => <Icon name="home" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="workspace"
        options={{
          title: t('nav.workspace'),
          tabBarIcon: ({ color, size }) => <Icon name="workspace" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('nav.settings'),
          tabBarIcon: ({ color, size }) => <Icon name="settings" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
