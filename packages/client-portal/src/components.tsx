import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Linking, StyleSheet, TextInput, View, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@miaa/auth';
import { MobileApiError } from '@miaa/api';
import {
  AppText,
  Brand,
  Button,
  Card,
  Notice,
  Page,
  Pill,
  colors,
  radius,
  typography,
  useBundledFonts,
} from '@miaa/ui';
import { useClientText } from './text';
import type { TodayLunch } from './contracts';
import { useOrder } from './provider';
export function useResource<T>(path: string, parse: (v: unknown) => T, enabled = true) {
  const { controller } = useAuth();
  const [state, set] = useState<{ path: string; data: T | null; busy: boolean; error: unknown }>({
    path,
    data: null,
    busy: true,
    error: null,
  });
  const abort = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const load = useCallback(() => {
    const revision = ++generation.current;
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    set({ path, data: null, busy: true, error: null });
    void controller
      .request<unknown>(path, { signal: ac.signal })
      .then((raw) => {
        if (!ac.signal.aborted && revision === generation.current)
          set({ path, data: parse(raw), busy: false, error: null });
      })
      .catch((error) => {
        if (!ac.signal.aborted && revision === generation.current)
          set({ path, data: null, busy: false, error });
      });
  }, [controller, path, parse]);
  useFocusEffect(
    useCallback(() => {
      if (enabled) load();
      return () => {
        generation.current++;
        abort.current?.abort();
      };
    }, [load, enabled]),
  );
  return { ...state, data: state.path === path ? state.data : null, load };
}
export function ClientPage({
  title,
  children,
  home = false,
}: {
  title: string;
  children: ReactNode;
  home?: boolean;
}) {
  const { t } = useClientText();
  const router = useRouter();
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
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
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
  maxLength = 300,
  numeric = false,
  multiline = false,
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  maxLength?: number;
  numeric?: boolean;
  multiline?: boolean;
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
        maxLength={maxLength}
        editable={editable}
        multiline={multiline}
        inputMode={numeric ? 'decimal' : 'text'}
        autoCapitalize="none"
        autoCorrect={false}
        style={[
          styles.input,
          fonts && { fontFamily: numeric ? typography.latinRegular : typography.ethiopicRegular },
        ]}
      />
    </View>
  );
}
export function ClientIssue({ error }: { error: unknown }) {
  const { t } = useClientText();
  if (!error) return null;
  const code =
    typeof error === 'string'
      ? error
      : error instanceof MobileApiError
        ? error.code
        : 'network_error';
  const message =
    code === 'invalid_input' || code === 'validation_error'
      ? t('invalid')
      : code === 'storage_error'
        ? t('storageError')
        : code === 'business_rule' || code === 'invalid_state'
          ? t('conflict')
          : code === 'not_found'
            ? t('notFound')
            : code === 'rate_limited'
              ? t('wait')
              : code === 'invalid_response'
                ? t('invalidResponse')
                : code === 'request_aborted'
                  ? t('cancelledRead')
                  : t('loadError');
  return <Notice title={t('unavailable')} body={message} tone="error" />;
}
export function ResourceControls({
  resource,
}: {
  resource: { busy: boolean; error: unknown; load: () => void };
}) {
  const { t } = useClientText();
  return (
    <>
      <ClientIssue error={resource.error} />
      <Button
        label={resource.busy ? t('loading') : t('refresh')}
        busy={resource.busy}
        tone="secondary"
        onPress={resource.load}
      />
    </>
  );
}
export function ClientLinks() {
  const { t } = useClientText();
  const router = useRouter();
  return (
    <View style={styles.group}>
      {(['browse', 'orders', 'profile', 'payments'] as const).map((path) => (
        <Button
          key={path}
          label={t(path)}
          tone={path === 'browse' ? 'primary' : 'secondary'}
          onPress={() => router.push(`/client/${path}`)}
        />
      ))}
    </View>
  );
}
export function PendingOrder() {
  const order = useOrder();
  const { t } = useClientText();
  const router = useRouter();
  const pending = order.pending;
  if (!order.ready)
    return (
      <>
        <ClientIssue error={order.issue} />
        <Button label={t('recover')} busy={order.busy} onPress={() => void order.model.recover()} />
      </>
    );
  if (!pending) return <ClientIssue error={order.issue} />;
  if (pending.state === 'confirmed')
    return (
      <Card>
        <Pill tone="positive">{t('confirmed')}</Pill>
        <Button
          label={`${t('viewOrder')} #${pending.orderId}`}
          tone="secondary"
          onPress={() =>
            router.push({ pathname: '/client/order', params: { id: pending.orderId } })
          }
        />
      </Card>
    );
  return (
    <Card>
      <AppText weight="semibold">{t('pending')}</AppText>
      <AppText>{t(pending.state)}</AppText>
      <DataText>
        #{pending.body.motherOfferingId} · {pending.body.latitude}, {pending.body.longitude}
        {pending.body.addressNote ? ` · ${pending.body.addressNote}` : ''}
      </DataText>
      <AppText selectable variant="small">
        {t('recoveryReference')}: {pending.key}
      </AppText>
      <DataText>
        {t(pending.body.paymentMethod)}
        {pending.body.demoDate ? ` · ${pending.body.demoDate}` : ''}
      </DataText>
      <AppText variant="small">{t('safeRetry')}</AppText>
      <ClientIssue error={order.issue} />
      {order.requestId ? (
        <AppText selectable variant="small">
          {t('requestId')}: {order.requestId}
        </AppText>
      ) : null}
      {pending.state === 'rejected' ? (
        <Button
          label={t('newOrder')}
          busy={order.busy}
          onPress={() => void order.model.discardRejected()}
        />
      ) : (
        <Button
          label={t('retryOrder')}
          busy={order.busy}
          disabled={!order.retryReady}
          onPress={() => void order.model.retry()}
        />
      )}
    </Card>
  );
}
export function LunchCard({ item }: { item: TodayLunch }) {
  const { locale, t } = useClientText();
  const [error, setError] = useState(false);
  const phone = item.cyclistPhone?.replace(/[ -]/g, '');
  return (
    <Card>
      <Pill tone={item.status === 'delivered' ? 'positive' : 'neutral'}>{t(item.status)}</Pill>
      <AppText variant="title" weight="semibold">
        {(locale === 'am' ? item.dishNameAm : item.dishNameEn) || t('unavailable')}
      </AppText>
      <AppText>
        {t('sticker')}: {item.stickerId}
      </AppText>
      {item.motherName ? <DataText>{item.motherName}</DataText> : null}
      {item.isCompRedelivery ? <AppText>{t('replacement')}</AppText> : null}
      {item.status === 'out_for_delivery' && phone && /^\+?\d{7,15}$/.test(phone) ? (
        <>
          <DataText>{item.cyclistName}</DataText>
          <Button
            label={t('call')}
            icon="support"
            tone="secondary"
            onPress={() => {
              setError(false);
              void Linking.openURL(`tel:${phone}`).catch(() => setError(true));
            }}
          />
          {error ? <AppText>{t('callFailed')}</AppText> : null}
        </>
      ) : null}
    </Card>
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
  menu: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    minHeight: 76,
  },
  fill: { flex: 1 },
  muted: { color: colors.inkSoft },
});
