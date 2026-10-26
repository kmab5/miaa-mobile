import type { ReactNode } from 'react';
import { StyleSheet, View, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MobileApiError } from '@miaa/api';
import {
  AppText,
  Brand,
  Button,
  Notice,
  Page,
  colors,
  radius,
  typography,
  useBundledFonts,
} from '@miaa/ui';
import { useMotherText, type Key } from './text';
export function MotherPage({
  title,
  home = false,
  children,
}: {
  title: string;
  home?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const { t } = useMotherText();
  return (
    <SafeAreaView
      style={styles.safe}
      edges={home ? ['top', 'left', 'right'] : ['top', 'bottom', 'left', 'right']}
    >
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Page>
          {home ? (
            <Brand />
          ) : (
            <Button
              label={t('back')}
              tone="secondary"
              icon="back"
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/workspace'))}
            />
          )}
          <AppText variant={home ? 'hero' : 'title'} weight="semibold" accessibilityRole="header">
            {title}
          </AppText>
          {children}
        </Page>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function Data({ children }: { children: ReactNode }) {
  return (
    <AppText language="am" selectable>
      {children}
    </AppText>
  );
}
export function Issue({ error }: { error: unknown }) {
  const { t } = useMotherText();
  if (!error) return null;
  const code = error instanceof MobileApiError ? error.code : 'network_error';
  const key: Key =
    code === 'invalid_input'
      ? 'invalid'
      : code === 'invalid_response'
        ? 'response'
        : code === 'storage_error'
          ? 'storage'
          : code === 'deadline_or_state' ||
              code === 'business_rule' ||
              code === 'invalid_transition'
            ? 'conflict'
            : code === 'refresh_required'
              ? 'refreshRequired'
              : code === 'request_pending'
                ? 'pending'
                : code === 'rate_limited'
                  ? 'wait'
                  : 'network';
  return (
    <View style={styles.group}>
      <Notice title={t('unavailable')} body={t(key)} tone="error" />
      {error instanceof MobileApiError && error.requestId ? (
        <AppText selectable variant="small">
          {t('requestId')}: {error.requestId}
        </AppText>
      ) : null}
    </View>
  );
}
export function Field({
  label,
  value,
  onChangeText,
  multiline = false,
  maxLength = 100,
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  multiline?: boolean;
  maxLength?: number;
  editable?: boolean;
}) {
  const fonts = useBundledFonts();
  return (
    <View style={styles.group}>
      <AppText weight="semibold">{label}</AppText>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        maxLength={maxLength}
        editable={editable}
        style={[styles.input, fonts && { fontFamily: typography.ethiopicRegular }]}
      />
    </View>
  );
}
export function DateTime({ value }: { value: string }) {
  const { locale } = useMotherText();
  return (
    <AppText selectable>
      {new Intl.DateTimeFormat(locale === 'am' ? 'am-ET' : 'en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Africa/Addis_Ababa',
      }).format(new Date(value))}
    </AppText>
  );
}
export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  group: { gap: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  input: {
    minHeight: 52,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.muted,
    borderRadius: radius.card,
    color: colors.black,
    backgroundColor: colors.white,
    fontSize: 16,
    lineHeight: 26,
  },
});
