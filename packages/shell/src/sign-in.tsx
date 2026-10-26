import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth, type AuthOptions, type TelegramInvite, type LinkState } from '@miaa/auth';
import { useTranslation } from '@miaa/i18n';
import { AppText, Brand, Button, Card, Notice, Page, Pill, colors } from '@miaa/ui';
import { useAppConfiguration } from './context';
import { workspaces } from './catalog';
import {
  AuthField,
  AuthIssue,
  Countdown,
  LanguageChoices,
  WebSessionNotice,
  useAuthTask,
  authStyles as styles,
} from './auth-ui';
export function SignInScreen() {
  const { controller, phase, issue } = useAuth();
  const { t } = useTranslation();
  const { role } = useAppConfiguration();
  const router = useRouter();
  const task = useAuthTask();
  const [mode, setMode] = useState<'password' | 'telegram' | 'link'>('password');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [sent, setSent] = useState(false);
  const [until, setUntil] = useState(0);
  const [invite, setInvite] = useState<TelegramInvite | null>(null);
  const [linkState, setLinkState] = useState<LinkState | null>(null);
  const [options, setOptions] = useState<AuthOptions | null>(null);
  const [optionsFailed, setOptionsFailed] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    void controller.authOptions(abort.signal).then(
      (value) => {
        if (!abort.signal.aborted) setOptions(value);
      },
      () => {
        if (!abort.signal.aborted) setOptionsFailed(true);
      },
    );
    return () => abort.abort();
  }, [controller]);
  useEffect(() => {
    if (until <= Date.now()) return;
    const timer = setTimeout(() => setUntil(0), until - Date.now());
    return () => clearTimeout(timer);
  }, [until]);
  function choose(value: typeof mode) {
    task.setError(null);
    setPassword('');
    setCode('');
    setName('');
    setSent(false);
    setInvite(null);
    setLinkState(null);
    setMode(value);
  }
  function sendCode() {
    void task.run(async (signal) => {
      const result = await controller.requestCode(phone, signal);
      if (!signal.aborted) {
        setSent(true);
        setCode('');
        setUntil(Date.now() + Math.min(result.retryAfterSeconds, 86400) * 1000);
      }
    });
  }
  const waitUntil = Math.max(until, task.cooldown);
  const cooling = waitUntil > 0;
  if (phase === 'starting' || phase === 'checking')
    return (
      <SafeAreaView style={styles.safe}>
        <Page>
          <Brand />
          <ActivityIndicator color={colors.black} />
          <AppText accessibilityLiveRegion="polite">{t('auth.checking')}</AppText>
        </Page>
      </SafeAreaView>
    );
  if (phase === 'blocked')
    return (
      <SafeAreaView style={styles.safe}>
        <Page>
          <Brand />
          <AppText variant="title" weight="semibold" accessibilityRole="header">
            {t('auth.blocked')}
          </AppText>
          <AppText>{t('auth.blockedBody')}</AppText>
          <AuthIssue code={issue} />
          <Button
            label={t('common.retry')}
            busy={task.busy}
            onPress={() => void task.run(() => controller.retry())}
          />
          <Button
            label={t('auth.signOut')}
            tone="secondary"
            disabled={task.busy}
            onPress={() => void task.run(() => controller.logout())}
          />
        </Page>
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Page>
          <View style={styles.header}>
            <Brand />
            <Pill tone="pink">{t(workspaces[role].title)}</Pill>
          </View>
          <View style={styles.group}>
            <AppText variant="hero" weight="semibold" accessibilityRole="header">
              {t('auth.title')}
            </AppText>
            <AppText style={styles.muted}>{t('auth.intro')}</AppText>
          </View>
          <LanguageChoices />
          <AuthIssue code={issue} />
          <View style={styles.row}>
            <Button
              label={t('auth.passwordMode')}
              tone={mode === 'password' ? 'quiet' : 'secondary'}
              disabled={task.busy}
              onPress={() => choose('password')}
            />
            <Button
              label={t('auth.telegramMode')}
              tone={mode !== 'password' ? 'quiet' : 'secondary'}
              disabled={task.busy || options?.telegram !== true}
              onPress={() => choose('telegram')}
            />
          </View>
          {options?.telegram === false ? (
            <AppText variant="small">{t('auth.telegramUnavailable')}</AppText>
          ) : null}
          {optionsFailed ? (
            <Button
              label={t('auth.optionsRetry')}
              tone="secondary"
              busy={task.busy}
              onPress={() =>
                void task.run(async (signal) => {
                  const value = await controller.authOptions(signal);
                  if (!signal.aborted) {
                    setOptions(value);
                    setOptionsFailed(false);
                  }
                })
              }
            />
          ) : null}
          <Card>
            {mode === 'password' ? (
              <>
                <AuthField
                  label={t('auth.identifier')}
                  value={identifier}
                  onChangeText={setIdentifier}
                  editable={!task.busy}
                  maxLength={255}
                  autoComplete="username"
                  textContentType="username"
                />
                <AuthField
                  label={t('auth.password')}
                  value={password}
                  onChangeText={setPassword}
                  editable={!task.busy}
                  secureTextEntry
                  autoComplete="current-password"
                  textContentType="password"
                  onSubmitEditing={() => {
                    if (!task.busy && task.cooldown === 0)
                      void task.run(async (signal) => {
                        try {
                          await controller.login(identifier, password, signal);
                        } finally {
                          setPassword('');
                        }
                      });
                  }}
                />
                <Button
                  label={t('auth.signIn')}
                  busy={task.busy}
                  disabled={task.cooldown > 0 || !identifier.trim() || !password}
                  onPress={() =>
                    void task.run(async (signal) => {
                      try {
                        await controller.login(identifier, password, signal);
                      } finally {
                        setPassword('');
                      }
                    })
                  }
                />
                <AppText variant="small" style={styles.muted}>
                  {t('auth.help')}
                </AppText>
              </>
            ) : (
              <>
                <AuthField
                  label={t('auth.phone')}
                  value={phone}
                  onChangeText={setPhone}
                  editable={!task.busy && !sent && !invite}
                  maxLength={20}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                />
                <AppText variant="small" style={styles.muted}>
                  {t('auth.phoneHint')}
                </AppText>
                {mode === 'telegram' ? (
                  <>
                    {sent ? (
                      <>
                        <AppText>{t('auth.codeSent')}</AppText>
                        <AuthField
                          label={t('auth.code')}
                          value={code}
                          onChangeText={setCode}
                          editable={!task.busy}
                          maxLength={6}
                          keyboardType="number-pad"
                          autoComplete="one-time-code"
                          textContentType="oneTimeCode"
                        />
                        <Button
                          label={t('auth.verify')}
                          busy={task.busy}
                          disabled={task.cooldown > 0 || !/^\d{6}$/.test(code)}
                          onPress={() =>
                            void task.run(async (signal) => {
                              try {
                                await controller.verifyCode(phone, code, signal);
                              } finally {
                                setCode('');
                              }
                            })
                          }
                        />
                      </>
                    ) : null}
                    <Button
                      label={t(sent ? 'auth.resend' : 'auth.sendCode')}
                      tone={sent ? 'secondary' : 'primary'}
                      busy={task.busy}
                      disabled={cooling || !phone.trim()}
                      onPress={sendCode}
                    />
                    <Button
                      label={t(role === 'client' ? 'auth.link' : 'auth.linkStaff')}
                      tone="secondary"
                      disabled={task.busy}
                      onPress={() => choose('link')}
                    />
                    {sent ? (
                      <Button
                        label={t('auth.changePhone')}
                        tone="quiet"
                        disabled={task.busy}
                        onPress={() => {
                          setSent(false);
                          setCode('');
                        }}
                      />
                    ) : null}
                  </>
                ) : (
                  <>
                    {!invite ? (
                      <Button
                        label={t('auth.createInvite')}
                        busy={task.busy}
                        disabled={cooling || !phone.trim()}
                        onPress={() =>
                          void task.run(async (signal) => {
                            const value = await controller.invite(phone, signal);
                            if (!signal.aborted) {
                              setInvite(value);
                              setLinkState('waiting');
                            }
                          })
                        }
                      />
                    ) : (
                      <>
                        <AppText>{t('auth.linkInstructions')}</AppText>
                        <Button
                          label={t('auth.openTelegram')}
                          disabled={task.busy}
                          onPress={() =>
                            void task.run(async () => {
                              await Linking.openURL(invite.deepLink);
                            })
                          }
                        />
                        <Button
                          label={t('auth.checkLink')}
                          tone="secondary"
                          busy={task.busy}
                          disabled={cooling}
                          onPress={() =>
                            void task.run(async (signal) => {
                              const state = await controller.linkState(invite.token, signal);
                              if (!signal.aborted) {
                                setLinkState(state);
                                if (state === 'expired') setInvite(null);
                              }
                            })
                          }
                        />
                        {linkState === 'waiting' ? <AppText>{t('auth.waiting')}</AppText> : null}
                        {linkState === 'linked' ? (
                          <>
                            <AppText>{t('auth.linked')}</AppText>
                            <Button
                              label={t('auth.sendCode')}
                              disabled={task.busy}
                              onPress={() => {
                                setInvite(null);
                                setMode('telegram');
                                setSent(false);
                              }}
                            />
                          </>
                        ) : null}
                        {linkState === 'signup_ready' && role === 'client' ? (
                          <>
                            <AppText>{t('auth.signupReady')}</AppText>
                            <AuthField
                              label={t('auth.name')}
                              value={name}
                              onChangeText={setName}
                              editable={!task.busy}
                              maxLength={120}
                              autoComplete="name"
                              textContentType="name"
                            />
                            <Button
                              label={t('auth.signup')}
                              busy={task.busy}
                              disabled={cooling || name.trim().length < 2}
                              onPress={() =>
                                void task.run((signal) =>
                                  controller.signup(invite.token, name, signal),
                                )
                              }
                            />
                          </>
                        ) : null}
                      </>
                    )}
                    {linkState === 'expired' ? <AppText>{t('auth.inviteExpired')}</AppText> : null}
                    <Button
                      label={t('common.back')}
                      tone="quiet"
                      disabled={task.busy}
                      onPress={() => choose('telegram')}
                    />
                  </>
                )}
              </>
            )}
            {task.busy ? (
              <>
                <AppText variant="small">{t('settings.slow')}</AppText>
                <Button label={t('auth.cancel')} tone="secondary" onPress={task.cancel} />
              </>
            ) : null}
            <AuthIssue code={task.error} />
            <Countdown until={waitUntil} />
          </Card>
          {role !== 'client' ? (
            <Notice title={t(workspaces[role].title)} body={t('auth.staffOnly')} />
          ) : null}
          <WebSessionNotice />
          <Button
            label={t('settings.licenses')}
            tone="quiet"
            onPress={() => router.push('/licenses')}
          />
        </Page>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
