import { useCallback, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MobileApiError } from '@miaa/api';
import {
  AppText,
  Brand,
  Button,
  Card,
  Notice,
  Page,
  colors,
  radius,
  typography,
  useBundledFonts,
} from '@miaa/ui';
import { useAdmin } from './provider';
import { en, label, useAdminText } from './text';
import { type Data, type Journal, type Row, type Value } from './contracts';
import type { Resource, Review } from './controller';
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
export function AdminPage({
  title,
  home = false,
  children,
}: {
  title: string;
  home?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const { t } = useAdminText();
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
              icon="back"
              tone="secondary"
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
export function DataText({ children }: { children: ReactNode }) {
  return (
    <AppText language="am" selectable>
      {children}
    </AppText>
  );
}
export function Field({
  label,
  value,
  onChangeText,
  numeric = false,
  password = false,
  limit = 2000,
  disabled = false,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  numeric?: boolean;
  password?: boolean;
  limit?: number;
  disabled?: boolean;
}) {
  const fonts = useBundledFonts();
  return (
    <View style={styles.group}>
      <AppText weight="semibold">{label}</AppText>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        editable={!disabled}
        maxLength={limit}
        secureTextEntry={password}
        autoCapitalize="none"
        autoCorrect={false}
        multiline={!password && !numeric && limit > 300}
        inputMode={numeric ? 'decimal' : 'text'}
        style={[
          styles.input,
          fonts && { fontFamily: numeric ? typography.latinRegular : typography.ethiopicRegular },
        ]}
      />
    </View>
  );
}
export function Issue({ error }: { error: unknown }) {
  const { t } = useAdminText();
  if (!error) return null;
  const code = error instanceof MobileApiError ? error.code : 'network_error';
  const key =
    code === 'invalid_input'
      ? 'invalid'
      : code === 'invalid_response'
        ? 'response'
        : code === 'storage_error'
          ? 'storage'
          : code === 'request_pending'
            ? 'pending'
            : code === 'rate_limited'
              ? 'wait'
              : code === 'refresh_required'
                ? 'refreshRequired'
                : [
                      'state_changed',
                      'not_found',
                      'business_rule',
                      'invalid_state',
                      'invalid_transition',
                    ].includes(code)
                  ? 'changed'
                  : 'network';
  return (
    <>
      <Notice title={t('unavailable')} body={t(key)} tone="error" />
      {error instanceof MobileApiError && error.requestId ? (
        <AppText selectable>
          {t('requestId')}: {error.requestId}
        </AppText>
      ) : null}
    </>
  );
}
export function useResource(path: string | null) {
  const { model, resources } = useAdmin();
  useFocusEffect(
    useCallback(() => {
      if (!path) return;
      const leave = model.watch(path);
      void model.load(path);
      return leave;
    }, [model, path]),
  );
  return {
    data: null,
    busy: false,
    error: null,
    ...(path ? resources[path] : {}),
    refresh: () => {
      if (path) void model.load(path);
    },
  };
}
export function Controls({ resource }: { resource: Resource & { refresh: () => void } }) {
  const { t } = useAdminText();
  return (
    <>
      <Issue error={resource.error} />
      <Button
        label={resource.busy ? t('loading') : t('refresh')}
        tone="secondary"
        busy={resource.busy}
        onPress={resource.refresh}
      />
    </>
  );
}
export function RecordValues({ value }: { value: Row }) {
  const { t, locale } = useAdminText();
  return (
    <View style={styles.group}>
      {Object.entries(value)
        .filter(
          ([key, v]) =>
            Object.hasOwn(en, key) && v !== null && typeof v !== 'object' && key !== 'newPassword',
        )
        .map(([key, v]) => {
          let display =
            typeof v === 'boolean'
              ? t(v ? 'yes' : 'no')
              : typeof v === 'string' && Object.hasOwn(en, label(v))
                ? t(label(v))
                : String(v);
          if (
            typeof v === 'string' &&
            /^\d{4}-\d\d-\d\dT/.test(v) &&
            Number.isFinite(Date.parse(v))
          )
            display = new Intl.DateTimeFormat(locale === 'am' ? 'am-ET' : 'en-GB', {
              dateStyle: 'medium',
              timeStyle: 'short',
              timeZone: 'Africa/Addis_Ababa',
            }).format(new Date(v));
          return (
            <DataText key={key}>
              {t(key)}: {display}
            </DataText>
          );
        })}
    </View>
  );
}
export function Feedback() {
  const s = useAdmin();
  const { t } = useAdminText();
  return (
    <>
      <Issue error={s.issue} />
      {s.notice ? <Notice title={t(s.notice)} body="" tone="success" /> : null}
      {s.receipt ? (
        <Card>
          <RecordValues value={s.receipt} />
        </Card>
      ) : null}
      {s.retryAt !== 0 ? <AppText accessibilityLiveRegion="polite">{t('wait')}</AppText> : null}
    </>
  );
}
export function Recovery() {
  const s = useAdmin();
  const { t } = useAdminText();
  const [checked, setChecked] = useState<Journal | null>(null);
  const p = s.pending;
  return (
    <>
      <Feedback />
      {!s.storageReady ? (
        <Button label={t('recover')} busy={s.busy} onPress={() => void s.model.recover()} />
      ) : null}
      {p ? (
        <Card>
          <Notice title={t('pendingTitle')} body={t('pendingHelp')} />
          <AppText weight="semibold">{t(p.form)}</AppText>
          {!p.sensitive && p.body ? <RecordValues value={p.body} /> : null}
          {/^\w+\/[1-9]\d*/.test(p.path) ? (
            <AppText>
              {t('id')}: {p.path.split('/')[1]}
            </AppText>
          ) : null}
          <AppText selectable>
            {t('reference')}: {p.token}
          </AppText>
          {p.resultId ? (
            <AppText>
              {t('resultId')}: {p.resultId}
            </AppText>
          ) : null}
          {p.form === 'order' && !p.confirmed ? (
            <Button
              label={t('retryOrder')}
              disabled={s.busy || s.retryAt !== 0}
              onPress={() => void s.model.retryOrder()}
            />
          ) : null}
          {checked ? (
            <>
              <AppText>{t('clearWarning')}</AppText>
              <Button
                label={t('clearConfirm')}
                disabled={s.busy}
                onPress={() => {
                  setChecked(null);
                  void s.model.clearReviewed(checked);
                }}
              />
              <Button label={t('cancel')} tone="secondary" onPress={() => setChecked(null)} />
            </>
          ) : (
            <Button
              label={t('clearReview')}
              tone="secondary"
              disabled={s.busy}
              onPress={() => setChecked(p)}
            />
          )}
        </Card>
      ) : null}
    </>
  );
}
export function ReviewCard({
  review,
  onCancel,
  children,
}: {
  review: Review;
  onCancel: () => void;
  children?: ReactNode;
}) {
  const s = useAdmin();
  const { t } = useAdminText();
  return (
    <Card>
      <AppText weight="semibold">{t(review.action.form)}</AppText>
      <AppText>{t('readBeforeWrite')}</AppText>
      {children}
      {review.action.sensitive ? <AppText>{t('hidden')}</AppText> : null}
      <Button
        label={t('confirm')}
        busy={s.busy}
        disabled={!!s.pending || !s.storageReady || s.retryAt !== 0}
        onPress={() => {
          onCancel();
          void s.model.commit(review);
        }}
      />
      <Button label={t('cancel')} tone="secondary" disabled={s.busy} onPress={onCancel} />
    </Card>
  );
}
export function Choice({
  label: heading,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  const { t } = useAdminText();
  const [search, setSearch] = useState('');
  const filtered = options.filter((x) =>
    x.label.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  const selected = options.find((x) => x.value === value);
  return (
    <View style={styles.group}>
      <AppText weight="semibold">{heading}</AppText>
      {selected ? (
        <DataText>
          {t('selection')}: {selected.label}
        </DataText>
      ) : null}
      {options.length > 12 ? (
        <Field
          label={`${heading} · ${t('optionsSearch')}`}
          value={search}
          onChangeText={setSearch}
          limit={120}
        />
      ) : null}
      {filtered.slice(0, 20).map((x) => (
        <Button
          key={x.value}
          label={x.label}
          tone="secondary"
          accessibilityRole="radio"
          accessibilityState={{ checked: value === x.value }}
          disabled={disabled}
          onPress={() => onChange(x.value)}
        />
      ))}
      {filtered.length > 20 ? <AppText>{t('moreChoices')}</AppText> : null}
      {!filtered.length ? <AppText>{t('empty')}</AppText> : null}
    </View>
  );
}
export function fingerprint(data: Data) {
  return JSON.stringify(data);
}
export function primitive(v: Value | undefined) {
  return v == null ? '' : String(v);
}
