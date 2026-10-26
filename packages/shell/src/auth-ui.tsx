import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { useTranslation, type TranslationKey } from '@miaa/i18n';
import { AppText, Button, Notice, colors, radius, typography, useBundledFonts } from '@miaa/ui';
import { MobileApiError } from '@miaa/api';
import { issueCode } from '@miaa/auth';
export function AuthField({ label, ...props }: TextInputProps & { label: string }) {
  const { locale } = useTranslation();
  const fonts = useBundledFonts();
  return (
    <View style={authStyles.field}>
      <AppText weight="semibold">{label}</AppText>
      <TextInput
        {...props}
        accessibilityLabel={label}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        placeholderTextColor={colors.muted}
        style={[
          authStyles.input,
          fonts && {
            fontFamily:
              locale === 'am' || props.autoComplete === 'name'
                ? typography.ethiopicRegular
                : typography.latinRegular,
          },
        ]}
      />
    </View>
  );
}
export function useAuthTask() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const pending = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      pending.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (cooldown <= Date.now()) return;
    const timer = setTimeout(() => setCooldown(0), cooldown - Date.now());
    return () => clearTimeout(timer);
  }, [cooldown]);
  async function run(task: (signal: AbortSignal) => Promise<void>) {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError(null);
    try {
      await task(controller.signal);
    } catch (e) {
      if (mounted.current) {
        setError(controller.signal.aborted ? 'request_aborted' : issueCode(e));
        if (e instanceof MobileApiError && e.status === 429)
          setCooldown(Date.now() + Math.min(Math.max(e.retryAfterSeconds ?? 900, 1), 86400) * 1000);
      }
    } finally {
      pending.current = null;
      if (mounted.current) setBusy(false);
    }
  }
  return { busy, error, cooldown, run, setError, cancel: () => pending.current?.abort() };
}
export function AuthIssue({ code }: { code: string | null }) {
  const { t } = useTranslation();
  if (!code) return null;
  const keys: Record<string, TranslationKey> = {
    invalid_input: 'auth.invalidInput',
    validation_error: 'auth.invalidInput',
    invalid_credentials: 'auth.invalidCredentials',
    wrong_role: 'auth.wrongRole',
    network_error: 'auth.network',
    request_aborted: 'auth.cancelled',
    storage_error: 'auth.storage',
    session_expired: 'auth.expired',
    unauthorized: 'auth.expired',
    forbidden: 'auth.expired',
    logout_remote: 'auth.logoutRemote',
    telegram_unavailable: 'auth.telegramUnavailable',
    signup_unavailable: 'auth.signupUnavailable',
    invalid_response: 'auth.responseError',
    wrong_current: 'auth.passwordConflict',
    same_as_current: 'auth.passwordConflict',
    too_short: 'auth.passwordRules',
    too_long: 'auth.passwordRules',
    password_mismatch: 'auth.passwordMismatch',
    rate_limited: 'auth.wait',
    link_failed: 'auth.linkInstructions',
    sessions_revoked: 'auth.sessionsRevoked',
  };
  return (
    <Notice
      tone={code === 'sessions_revoked' ? 'success' : 'error'}
      title={t(code === 'sessions_revoked' ? 'auth.security' : 'auth.error')}
      body={t(keys[code] ?? 'auth.responseError')}
    />
  );
}
export function Countdown({ until }: { until: number }) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until <= Date.now()) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [until]);
  const remaining = Math.max(0, Math.ceil((until - now) / 1000));
  return remaining ? (
    <AppText variant="small" accessibilityLiveRegion="polite">
      {t('auth.wait')} {remaining}
    </AppText>
  ) : null;
}
export function LanguageChoices() {
  const { locale, setLocale, t, persistenceError } = useTranslation();
  return (
    <View style={authStyles.group}>
      <View style={authStyles.row}>
        <Button
          label={t('settings.english')}
          language="en"
          tone={locale === 'en' ? 'quiet' : 'secondary'}
          onPress={() => void setLocale('en')}
        />
        <Button
          label={t('settings.amharic')}
          language="am"
          tone={locale === 'am' ? 'quiet' : 'secondary'}
          onPress={() => void setLocale('am')}
        />
      </View>
      {persistenceError ? (
        <AppText variant="small" accessibilityLiveRegion="polite">
          {t(persistenceError === 'read' ? 'settings.storageFailed' : 'settings.languageFailed')}
        </AppText>
      ) : null}
    </View>
  );
}
export function WebSessionNotice() {
  const { t } = useTranslation();
  return Platform.OS === 'web' ? (
    <AppText variant="small" style={authStyles.muted}>
      {t('auth.webMemory')}
    </AppText>
  ) : null;
}
export const authStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  keyboard: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  field: { gap: 8 },
  input: {
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.muted,
    color: colors.black,
    backgroundColor: colors.white,
    fontSize: 16,
    lineHeight: 26,
  },
  muted: { color: colors.inkSoft },
  group: { gap: 16 },
});
