import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth, issueCode, type AccountSecurity, AuthFault } from '@miaa/auth';
import { useTranslation, type TranslationKey } from '@miaa/i18n';
import { AppText, Brand, Button, Card, Notice, Page, SectionTitle } from '@miaa/ui';
import { AuthField, AuthIssue, Countdown, useAuthTask, authStyles as styles } from './auth-ui';
export function SecurityScreen() {
  const { controller, user, expiresAt } = useAuth();
  const { t, locale } = useTranslation();
  const router = useRouter();
  const task = useAuthTask();
  const [security, setSecurity] = useState<AccountSecurity | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadPending, setLoadPending] = useState(true);
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [confirm, setConfirm] = useState<'all' | 'unlink' | null>(null);
  const [notice, setNotice] = useState<TranslationKey | null>(null);
  useEffect(() => {
    const controllerAbort = new AbortController();
    void controller
      .security(controllerAbort.signal)
      .then(
        (value) => {
          if (!controllerAbort.signal.aborted) setSecurity(value);
        },
        (error: unknown) => {
          if (!controllerAbort.signal.aborted) setLoadError(issueCode(error));
        },
      )
      .finally(() => {
        if (!controllerAbort.signal.aborted) setLoadPending(false);
      });
    return () => controllerAbort.abort();
  }, [controller]);
  const disabled = task.busy || task.cooldown > 0;
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Page>
          <Brand />
          <Button
            label={t('common.back')}
            tone="secondary"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}
          />
          <View style={styles.group}>
            <AppText variant="title" weight="semibold" accessibilityRole="header">
              {t('auth.security')}
            </AppText>
            <AppText>{t('auth.securityIntro')}</AppText>
          </View>
          <Card>
            <AppText selectable>{user?.phoneNumber}</AppText>
            {user?.email ? <AppText selectable>{user.email}</AppText> : null}
            {expiresAt ? (
              <AppText variant="small">
                {t('auth.expires')}:{' '}
                {new Date(expiresAt).toLocaleString(locale === 'am' ? 'am-ET' : 'en-GB')}
              </AppText>
            ) : null}
            <Button
              label={t('auth.renew')}
              disabled={disabled}
              onPress={() => void task.run(() => controller.renew())}
            />
          </Card>
          <AuthIssue code={loadError} />
          <AuthIssue code={task.error} />
          <Countdown until={task.cooldown} />
          {notice ? <Notice tone="success" title={t('auth.security')} body={t(notice)} /> : null}
          {security ? (
            <>
              <Card>
                <SectionTitle>
                  {t(security.hasPassword ? 'auth.passwordSet' : 'auth.noPassword')}
                </SectionTitle>
                <AppText variant="small">{t('auth.passwordRules')}</AppText>
                {security.hasPassword ? (
                  <AuthField
                    label={t('auth.currentPassword')}
                    value={current}
                    onChangeText={setCurrent}
                    editable={!disabled}
                    secureTextEntry
                    autoComplete="current-password"
                    textContentType="password"
                  />
                ) : null}
                <AuthField
                  label={t('auth.newPassword')}
                  value={password}
                  onChangeText={setPassword}
                  editable={!disabled}
                  secureTextEntry
                  autoComplete="new-password"
                  textContentType="newPassword"
                />
                <AuthField
                  label={t('auth.confirmPassword')}
                  value={confirmation}
                  onChangeText={setConfirmation}
                  editable={!disabled}
                  secureTextEntry
                  autoComplete="new-password"
                  textContentType="newPassword"
                />
                <Button
                  label={t('auth.savePassword')}
                  busy={task.busy}
                  disabled={
                    disabled || !password || !confirmation || (security.hasPassword && !current)
                  }
                  onPress={() =>
                    void task.run(async () => {
                      setNotice(null);
                      try {
                        if (password !== confirmation) throw new AuthFault('password_mismatch');
                        await controller.changePassword(
                          security.hasPassword ? current : undefined,
                          password,
                        );
                        setSecurity({ ...security, hasPassword: true });
                        setNotice('auth.passwordSaved');
                      } finally {
                        setCurrent('');
                        setPassword('');
                        setConfirmation('');
                      }
                    })
                  }
                />
              </Card>
              <Card>
                <SectionTitle>
                  {t(security.telegramLinked ? 'auth.telegramLinked' : 'auth.telegramNotLinked')}
                </SectionTitle>
                {security.telegramLinked ? (
                  <>
                    <AppText variant="small">{t('auth.unlinkBody')}</AppText>
                    <Button
                      label={t('auth.unlink')}
                      tone="secondary"
                      disabled={disabled || !security.hasPassword}
                      onPress={() => setConfirm('unlink')}
                    />
                  </>
                ) : (
                  <AppText variant="small">{t('auth.help')}</AppText>
                )}
              </Card>
            </>
          ) : (
            <Button
              label={t(loadPending ? 'common.loading' : 'common.retry')}
              busy={task.busy || loadPending}
              onPress={() =>
                void task.run(async (signal) => {
                  const value = await controller.security(signal);
                  if (!signal.aborted) {
                    setSecurity(value);
                    setLoadError(null);
                  }
                })
              }
            />
          )}
          <Card>
            <SectionTitle>{t('auth.revokeAll')}</SectionTitle>
            <AppText>{t('auth.revokeBody')}</AppText>
            <Button
              label={t('auth.revokeAll')}
              tone="secondary"
              disabled={disabled}
              onPress={() => setConfirm('all')}
            />
            <Button
              label={t('auth.signOut')}
              tone="quiet"
              disabled={task.busy}
              onPress={() => void task.run(() => controller.logout())}
            />
          </Card>
          {confirm ? (
            <Card>
              <SectionTitle>{t('auth.confirmAction')}</SectionTitle>
              <AppText>{t(confirm === 'all' ? 'auth.revokeBody' : 'auth.unlinkBody')}</AppText>
              <Button
                label={t(confirm === 'all' ? 'auth.revokeAll' : 'auth.unlink')}
                busy={task.busy}
                disabled={disabled}
                onPress={() =>
                  void task.run(async () => {
                    setNotice(null);
                    if (confirm === 'all') await controller.revokeAll();
                    else {
                      await controller.unlinkTelegram();
                      if (security) setSecurity({ ...security, telegramLinked: false });
                      setNotice('auth.unlinked');
                    }
                    setConfirm(null);
                  })
                }
              />
              <Button
                label={t('auth.cancel')}
                tone="secondary"
                disabled={task.busy}
                onPress={() => setConfirm(null)}
              />
            </Card>
          ) : null}
        </Page>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
