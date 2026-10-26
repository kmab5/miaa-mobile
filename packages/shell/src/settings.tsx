import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { checkHealth } from '@miaa/api';
import { useTranslation, type Locale } from '@miaa/i18n';
import {
  AppText,
  Brand,
  Button,
  Card,
  colors,
  Icon,
  Notice,
  Page,
  Pill,
  SectionTitle,
  radius,
} from '@miaa/ui';
import { useAuth } from '@miaa/auth';
import { useAppConfiguration } from './context';
import { workspaces } from './catalog';
type Connection = 'idle' | 'checking' | 'connected' | 'failed' | 'cancelled';
export function ConnectionCard() {
  const { apiOrigin } = useAppConfiguration();
  const { t } = useTranslation();
  const [connection, setConnection] = useState<Connection>('idle');
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);
  async function check() {
    if (controller.current) return;
    const current = new AbortController();
    controller.current = current;
    setConnection('checking');
    try {
      await checkHealth(apiOrigin, { signal: current.signal });
      if (mounted.current) setConnection('connected');
    } catch {
      if (mounted.current) setConnection(current.signal.aborted ? 'cancelled' : 'failed');
    } finally {
      if (controller.current === current) controller.current = null;
    }
  }
  return (
    <Card>
      <View style={styles.row}>
        <View style={styles.icon}>
          <Icon name={connection === 'failed' ? 'disconnected' : 'connected'} />
        </View>
        <AppText weight="semibold" style={styles.flex}>
          {t('settings.connection')}
        </AppText>
      </View>
      <AppText variant="small" style={styles.muted}>
        {t('settings.connectionIntro')}
      </AppText>
      <View accessibilityLiveRegion="polite">
        {connection === 'checking' ? (
          <AppText variant="small" style={styles.muted}>
            {t('settings.slow')}
          </AppText>
        ) : connection === 'connected' ? (
          <Notice
            tone="success"
            icon="check"
            title={t('settings.connected')}
            body={t('settings.aboutBody')}
          />
        ) : connection === 'failed' ? (
          <Notice
            tone="error"
            icon="disconnected"
            title={t('settings.disconnected')}
            body={t('settings.disconnectedBody')}
          />
        ) : connection === 'cancelled' ? (
          <AppText variant="small">{t('settings.cancelled')}</AppText>
        ) : null}
      </View>
      <Button
        label={t(connection === 'checking' ? 'settings.checking' : 'settings.check')}
        onPress={() => void check()}
        tone="secondary"
        busy={connection === 'checking'}
      />
      {connection === 'checking' ? (
        <Button
          label={t('settings.cancel')}
          tone="quiet"
          onPress={() => controller.current?.abort()}
        />
      ) : null}
    </Card>
  );
}
export function SettingsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { role, appVersion } = useAppConfiguration();
  const { t, locale, setLocale, persistenceError } = useTranslation();
  function languageChoice(value: Locale, label: string) {
    const selected = locale === value;
    return (
      <Pressable
        accessibilityRole="radio"
        accessibilityLabel={label}
        accessibilityState={{ checked: selected }}
        aria-checked={selected}
        onPress={() => void setLocale(value)}
        style={({ pressed }) => [
          styles.language,
          selected && styles.selectedLanguage,
          pressed && styles.pressed,
        ]}
      >
        <AppText weight="semibold" language={value}>
          {label}
        </AppText>
        {selected ? <Icon name="check" size={18} /> : <View style={styles.unchecked} />}
      </Pressable>
    );
  }
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <Page>
        <View style={styles.header}>
          <Brand />
          <Pill tone="pink">{t(workspaces[role].title)}</Pill>
        </View>
        <View style={styles.intro}>
          <AppText variant="title" weight="semibold" accessibilityRole="header">
            {t('settings.title')}
          </AppText>
          <AppText style={styles.muted}>{t('settings.intro')}</AppText>
        </View>
        <Card>
          <SectionTitle>{t('settings.language')}</SectionTitle>
          <AppText variant="small" style={styles.muted}>
            {t('settings.languageHint')}
          </AppText>
          <View style={styles.languageGroup} accessibilityLabel={t('settings.language')}>
            {languageChoice('en', t('settings.english'))}
            {languageChoice('am', t('settings.amharic'))}
          </View>
          {persistenceError ? (
            <AppText variant="small" accessibilityLiveRegion="polite" style={styles.error}>
              {t(
                persistenceError === 'read' ? 'settings.storageFailed' : 'settings.languageFailed',
              )}
            </AppText>
          ) : null}
        </Card>
        {user ? (
          <Card>
            <SectionTitle>{t('auth.security')}</SectionTitle>
            <AppText>{user.phoneNumber}</AppText>
            <Button
              label={t('auth.security')}
              icon="admin"
              onPress={() => router.push('/security')}
            />
          </Card>
        ) : null}
        <ConnectionCard />
        <Card style={styles.about}>
          <AppText weight="semibold">{t('settings.about')}</AppText>
          <AppText
            variant="small"
            style={styles.muted}
          >{`Mi'aa ${t(workspaces[role].title)} · ${t('settings.version')} ${appVersion}`}</AppText>
          <AppText variant="small" style={styles.muted}>
            {t('settings.aboutBody')}
          </AppText>
          <Button
            label={t('settings.licenses')}
            tone="secondary"
            icon="info"
            onPress={() => router.push('/licenses')}
          />
        </Card>
      </Page>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  intro: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.subtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  muted: { color: colors.muted },
  flex: { flex: 1 },
  languageGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  language: {
    minHeight: 52,
    minWidth: 125,
    flexGrow: 1,
    flexBasis: 125,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
  },
  selectedLanguage: { borderColor: colors.black, backgroundColor: colors.greenSoft },
  unchecked: { width: 18 },
  pressed: { opacity: 0.7 },
  error: { color: colors.danger },
  about: { backgroundColor: colors.subtle, borderColor: colors.subtle },
});
