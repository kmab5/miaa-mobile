import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@miaa/auth';
import { AppText, Button, Card, Icon, Notice, Pill } from '@miaa/ui';
import {
  ClientIssue,
  ClientLinks,
  ClientPage,
  DataText,
  Field,
  LunchCard,
  PendingOrder,
  ResourceControls,
  styles,
  useResource,
} from './components';
import { useClientText } from './text';
import { useOrder } from './provider';
import {
  choices,
  coordinates,
  eatDate,
  instructions,
  isDate,
  list,
  lunch,
  orderDetail,
  orderRow,
  profile,
  offering,
  dish,
  validateChoices,
} from './validation';
import type { ClientProfile, Dish, Offering, OrderPayload } from './contracts';
const lunches = (v: unknown) => list(v, lunch),
  orders = (v: unknown) => list(v, orderRow);
export function ClientHomeScreen() {
  const { t } = useClientText();
  const r = useResource('client/today', lunches);
  const router = useRouter();
  return (
    <ClientPage title={t('title')} home>
      <PendingOrder />
      <ClientLinks />
      <AppText variant="title" weight="semibold" accessibilityRole="header">
        {t('today')}
      </AppText>
      <ResourceControls resource={r} />
      {r.data?.length === 0 ? (
        <AppText>{t('emptyToday')}</AppText>
      ) : (
        r.data?.map((item) => <LunchCard key={item.deliveryId} item={item} />)
      )}
      <Button label={t('explore')} tone="secondary" onPress={() => router.push('/workspace')} />
    </ClientPage>
  );
}
export function ClientWorkspaceScreen() {
  const { t } = useClientText();
  const router = useRouter();
  return (
    <ClientPage title={t('workspace')} home>
      {(['today', 'browse', 'orders', 'profile', 'payments'] as const).map((path) => (
        <Pressable
          key={path}
          accessibilityRole="link"
          accessibilityLabel={t(path)}
          style={styles.menu}
          onPress={() => router.push(`/client/${path}`)}
        >
          <Icon
            name={path === 'profile' ? 'location' : path === 'orders' ? 'archive' : 'workspace'}
          />
          <AppText weight="semibold" style={styles.fill}>
            {t(path)}
          </AppText>
          <Icon name="arrow" />
        </Pressable>
      ))}
    </ClientPage>
  );
}
export function ClientTodayScreen() {
  const { t } = useClientText();
  const r = useResource('client/today', lunches);
  return (
    <ClientPage title={t('today')}>
      <ResourceControls resource={r} />
      {r.data?.length === 0 ? (
        <AppText>{t('emptyToday')}</AppText>
      ) : (
        r.data?.map((item) => <LunchCard key={item.deliveryId} item={item} />)
      )}
    </ClientPage>
  );
}
export function ClientProfileScreen() {
  const { t } = useClientText();
  const r = useResource('client/profile', profile);
  const { controller } = useAuth();
  const [lat, setLat] = useState(''),
    [lon, setLon] = useState(''),
    [note, setNote] = useState(''),
    [saved, setSaved] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const saving = useRef(false);
  const operation = useRef<AbortController | null>(null);
  useEffect(() => {
    if (r.data) {
      setLat(r.data.latitude === null ? '' : String(r.data.latitude));
      setLon(r.data.longitude === null ? '' : String(r.data.longitude));
      setNote(r.data.addressNote ?? '');
    }
  }, [r.data]);
  useEffect(() => () => operation.current?.abort(), []);
  async function save() {
    if (saving.current) return;
    saving.current = true;
    const ac = new AbortController();
    operation.current = ac;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const location = coordinates(lat, lon);
      profile(
        await controller.request('client/address', {
          method: 'PATCH',
          body: { ...location, addressNote: note.trim() },
          signal: ac.signal,
        }),
      );
      if (!ac.signal.aborted) {
        setSaved(true);
        r.load();
      }
    } catch (e) {
      if (!ac.signal.aborted) setError(e);
    } finally {
      saving.current = false;
      if (!ac.signal.aborted) setBusy(false);
    }
  }
  return (
    <ClientPage title={t('profile')}>
      <ResourceControls resource={r} />
      {r.data ? (
        <>
          <Card>
            <AppText>{t('name')}</AppText>
            <DataText>{r.data.name}</DataText>
            <AppText>{t('phone')}</AppText>
            <DataText>{r.data.phoneNumber}</DataText>
          </Card>
          <Notice title={t('profile')} body={t('addressNotice')} />
          <AppText>{t('addressHelp')}</AppText>
          <Field
            label={t('latitude')}
            value={lat}
            onChangeText={setLat}
            numeric
            maxLength={20}
            editable={!busy}
          />
          <Field
            label={t('longitude')}
            value={lon}
            onChangeText={setLon}
            numeric
            maxLength={20}
            editable={!busy}
          />
          <Field label={t('addressNote')} value={note} onChangeText={setNote} editable={!busy} />
          <ClientIssue error={error} />
          {saved ? <AppText accessibilityLiveRegion="polite">{t('saved')}</AppText> : null}
          <Button label={t('saveAddress')} busy={busy} onPress={() => void save()} />
        </>
      ) : null}
    </ClientPage>
  );
}
export function ClientPaymentsScreen() {
  const { t } = useClientText();
  const r = useResource('client/payment-instructions', instructions);
  return (
    <ClientPage title={t('payments')}>
      <Notice title={t('payments')} body={t('offPlatform')} />
      <ResourceControls resource={r} />
      {r.data ? <PaymentContent data={r.data} /> : null}
    </ClientPage>
  );
}
function PaymentContent({ data }: { data: ReturnType<typeof instructions> }) {
  const { t } = useClientText();
  return (
    <>
      {!Object.values(data).some(Boolean) ? <AppText>{t('instructionsEmpty')}</AppText> : null}
      {(['payTelebirr', 'payCbe', 'payChapa', 'payInstructions'] as const)
        .filter((k) => data[k])
        .map((key) => (
          <Card key={key}>
            <AppText weight="semibold">
              {t(
                key === 'payTelebirr'
                  ? 'telebirr'
                  : key === 'payCbe'
                    ? 'cbe'
                    : key === 'payChapa'
                      ? 'chapa'
                      : 'payments',
              )}
            </AppText>
            <DataText>{data[key]}</DataText>
          </Card>
        ))}
    </>
  );
}
export function ClientOrdersScreen() {
  const { t, locale } = useClientText();
  const r = useResource('client/orders', orders);
  const router = useRouter();
  return (
    <ClientPage title={t('orders')}>
      <AppText variant="small">{t('historyLimit')}</AppText>
      <PendingOrder />
      <ResourceControls resource={r} />
      {r.data?.length === 0 ? (
        <AppText>{t('emptyOrders')}</AppText>
      ) : (
        r.data?.map((order) => (
          <Card key={order.id}>
            <AppText variant="title" weight="semibold">
              {locale === 'am' ? order.labelAm : order.labelEn} · #{order.id}
            </AppText>
            <DataText>{order.motherName}</DataText>
            <Pill>{t(order.status)}</Pill>
            <AppText>
              {order.priceEtb} {t('price')} · {order.startDate} – {order.endDate}
            </AppText>
            <AppText>
              {t('progress')}: {order.delivered}/{order.total}
            </AppText>
            <AppText>
              {t(
                order.paymentStatus === 'confirmed'
                  ? 'confirmedPayment'
                  : order.paymentStatus === 'pending'
                    ? 'pendingPayment'
                    : order.paymentStatus === 'failed'
                      ? 'failedPayment'
                      : 'unknownPayment',
              )}
            </AppText>
            <Button
              label={`${t('viewOrder')} #${order.id}`}
              tone="secondary"
              onPress={() => router.push({ pathname: '/client/order', params: { id: order.id } })}
            />
          </Card>
        ))
      )}
    </ClientPage>
  );
}
export function ClientOrderScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const valid = typeof id === 'string' && /^[1-9]\d{0,14}$/.test(id);
  const { t, locale } = useClientText();
  const router = useRouter();
  const parse = useCallback(
    (raw: unknown) => {
      const value = orderDetail(raw);
      if (value.order.id !== Number(id)) throw new Error('Invalid order identity.');
      return value;
    },
    [id],
  );
  const r = useResource(valid ? `client/orders/${id}` : 'client/orders/0', parse, valid);
  const detail = valid ? r.data : null;
  return (
    <ClientPage title={t('viewOrder')}>
      {valid ? <ResourceControls resource={r} /> : <ClientIssue error="not_found" />}
      {detail ? (
        <>
          <Card>
            <AppText variant="title" weight="semibold">
              {locale === 'am' ? detail.order.labelAm : detail.order.labelEn} · #{detail.order.id}
            </AppText>
            <DataText>{detail.order.motherName}</DataText>
            <Pill>{t(detail.order.status)}</Pill>
            <AppText>
              {detail.order.priceEtb} {t('price')}
            </AppText>
            <AppText>
              {detail.order.startDate} – {detail.order.endDate}
            </AppText>
            <AppText>
              {t('progress')}: {detail.order.delivered}/{detail.order.total}
            </AppText>
            <AppText>{t('orderAddress')}</AppText>
            <DataText>{detail.addressNote || t('none')}</DataText>
            {detail.notes ? <DataText>{detail.notes}</DataText> : null}
          </Card>
          <Notice title={t('payments')} body={t('offPlatform')} />
          {detail.payment ? (
            <Card>
              <AppText>
                {t(
                  detail.payment.status === 'confirmed'
                    ? 'confirmedPayment'
                    : detail.payment.status === 'pending'
                      ? 'pendingPayment'
                      : 'failedPayment',
                )}
              </AppText>
              <DataText>
                {detail.payment.amountEtb} {t('price')} · {detail.payment.method}
              </DataText>
              {detail.payment.reference ? <DataText>{detail.payment.reference}</DataText> : null}
            </Card>
          ) : null}
          <Button
            label={t('payments')}
            tone="secondary"
            onPress={() => router.push('/client/payments')}
          />
          <AppText variant="title" weight="semibold">
            {t('deliveries')}
          </AppText>
          {detail.deliveries.map((item) => (
            <Card key={item.id}>
              <AppText>{item.deliveryDate}</AppText>
              <Pill>{t(item.status)}</Pill>
              <AppText>
                {(locale === 'am' ? item.dishNameAm : item.dishNameEn) || t('unavailable')}
              </AppText>
              <AppText>
                {t('sticker')}: {item.stickerId}
              </AppText>
              {item.isCompRedelivery ? <AppText>{t('replacement')}</AppText> : null}
            </Card>
          ))}
        </>
      ) : null}
    </ClientPage>
  );
}
type Catalog = {
  profile: ClientProfile;
  offerings: Offering[];
  dishes: Dish[];
  payments: ReturnType<typeof instructions>;
};
export function ClientBrowseScreen() {
  const { controller } = useAuth();
  const { t, locale } = useClientText();
  const router = useRouter();
  const order = useOrder();
  const [data, setData] = useState<Catalog | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<unknown>(null),
    [selected, setSelected] = useState<Offering | null>(null),
    [pattern, setPattern] = useState<Record<string, number>>({}),
    [date, setDate] = useState(''),
    [notes, setNotes] = useState(''),
    [reference, setReference] = useState(''),
    [method, setMethod] = useState<OrderPayload['paymentMethod']>('cash'),
    [review, setReview] = useState<OrderPayload | null>(null);
  const abort = useRef<AbortController | null>(null);
  const epoch = useRef(0);
  const [reviewRevision, setReviewRevision] = useState('null');
  const load = useCallback(() => {
    const version = ++epoch.current;
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    setLoading(true);
    setError(null);
    setData(null);
    setSelected(null);
    setReview(null);
    void (async () => {
      const p = profile(await controller.request('client/profile', { signal: ac.signal }));
      const [rawOfferings, rawDishes, rawPayments] = await Promise.all([
        p.hasLocation
          ? controller.request(`client/offerings?latitude=${p.latitude}&longitude=${p.longitude}`, {
              signal: ac.signal,
            })
          : Promise.resolve([]),
        controller.request('client/dishes', { signal: ac.signal }),
        controller.request('client/payment-instructions', { signal: ac.signal }),
      ]);
      if (!ac.signal.aborted && epoch.current === version)
        setData({
          profile: p,
          offerings: list(rawOfferings, offering),
          dishes: list(rawDishes, dish),
          payments: instructions(rawPayments),
        });
    })()
      .catch((e) => {
        if (!ac.signal.aborted && epoch.current === version) setError(e);
      })
      .finally(() => {
        if (!ac.signal.aborted && epoch.current === version) setLoading(false);
      });
  }, [controller]);
  useFocusEffect(
    useCallback(() => {
      load();
      return () => {
        abort.current?.abort();
      };
    }, [load]),
  );
  const blocked =
    order.busy || !order.ready || (order.pending !== null && order.pending.state !== 'confirmed');
  function select(o: Offering) {
    setSelected(o);
    setPattern({});
    setNotes('');
    setReference('');
    setMethod('cash');
    setDate('');
    setReview(null);
    setError(null);
  }
  function preview() {
    if (!data || !selected) return;
    setError(null);
    try {
      const body: OrderPayload = {
        motherOfferingId: selected.offeringId,
        latitude: data.profile.latitude!,
        longitude: data.profile.longitude!,
        addressNote: data.profile.addressNote ?? '',
        dishPattern: { ...pattern },
        paymentMethod: method,
        notes: notes.trim(),
        paymentReference: reference.trim(),
        ...(selected.duration === 'demo' ? { demoDate: date.trim() } : {}),
      };
      setReviewRevision(JSON.stringify(order.pending));
      setReview(validateChoices(body, selected, data.dishes, eatDate()));
    } catch (e) {
      setError(e);
    }
  }
  const days = selected?.duration === 'demo' ? [1] : [1, 2, 3, 4, 5];
  const labels = ['mon', 'tue', 'wed', 'thu', 'fri'] as const;
  return (
    <ClientPage title={t('browse')}>
      <PendingOrder />
      <AppText variant="small">{t('storageNotice')}</AppText>
      <ResourceControls resource={{ busy: loading, error, load }} />
      {data && !data.profile.hasLocation ? (
        <>
          <AppText>{t('addressFirst')}</AppText>
          <Button label={t('profile')} onPress={() => router.push('/client/profile')} />
        </>
      ) : null}
      {data?.profile.hasLocation && !selected ? (
        <>
          <AppText>{t('ready')}</AppText>
          <DataText>
            {data.profile.addressNote} · {data.profile.latitude}, {data.profile.longitude}
          </DataText>
          {data.offerings.length === 0 ? (
            <AppText>{t('emptyArea')}</AppText>
          ) : (
            data.offerings.map((o) => (
              <Card key={o.offeringId}>
                <AppText variant="title" weight="semibold">
                  {locale === 'am' ? o.labelAm : o.labelEn}
                </AppText>
                <DataText>{o.motherName}</DataText>
                <View style={styles.row}>
                  <Pill>{t(o.foodCategory)}</Pill>
                  <Pill>{t(o.duration)}</Pill>
                </View>
                <AppText>
                  {o.priceEtb} {t('price')}
                  {o.distanceKm !== undefined
                    ? ` · ${o.distanceKm.toFixed(1)} ${t('distance')}`
                    : ''}
                </AppText>
                <Button
                  label={`${t('choose')} · ${locale === 'am' ? o.labelAm : o.labelEn} · ${o.motherName}`}
                  disabled={blocked}
                  onPress={() => select(o)}
                />
              </Card>
            ))
          )}
        </>
      ) : null}
      {selected && data && !review ? (
        <>
          <Card>
            <AppText variant="title" weight="semibold">
              {locale === 'am' ? selected.labelAm : selected.labelEn}
            </AppText>
            <DataText>{selected.motherName}</DataText>
            <AppText>
              {selected.priceEtb} {t('price')}
            </AppText>
            <AppText>{t(selected.duration === 'demo' ? 'demoHelp' : 'nextMonday')}</AppText>
          </Card>
          <AppText variant="title" weight="semibold">
            {t('dishChoices')}
          </AppText>
          {selected.duration === 'demo' ? (
            <Field
              label={t('demoDate')}
              value={date}
              onChangeText={setDate}
              maxLength={10}
              editable={!blocked}
            />
          ) : null}
          {days.map((day) => {
            const weekday =
              selected.duration === 'demo' && isDate(date.trim())
                ? new Date(date.trim() + 'T12:00:00Z').getUTCDay()
                : day;
            const eligible = choices(data.dishes, selected.foodCategory, weekday);
            return (
              <Card key={day}>
                <AppText weight="semibold">
                  {selected.duration === 'demo' ? t('demoDish') : t(labels[day - 1]!)}
                </AppText>
                {!eligible.length ? (
                  <AppText>{t('noDishes')}</AppText>
                ) : (
                  eligible.map((d) => (
                    <Button
                      key={d.id}
                      label={locale === 'am' ? d.nameAm : d.nameEn}
                      accessibilityRole="radio"
                      accessibilityState={{
                        checked: pattern[String(day)] === d.id,
                        disabled: blocked,
                      }}
                      tone={pattern[String(day)] === d.id ? 'quiet' : 'secondary'}
                      disabled={blocked}
                      onPress={() => setPattern((p) => ({ ...p, [String(day)]: d.id }))}
                    />
                  ))
                )}
              </Card>
            );
          })}
          <AppText weight="semibold">{t('method')}</AppText>
          <View style={styles.row}>
            {(['cash', 'telebirr', 'cbe', 'chapa', 'other'] as const).map((m) => (
              <Button
                key={m}
                label={t(m)}
                tone={method === m ? 'quiet' : 'secondary'}
                accessibilityRole="radio"
                accessibilityState={{ checked: method === m, disabled: blocked }}
                disabled={blocked}
                onPress={() => setMethod(m)}
              />
            ))}
          </View>
          <Field
            label={t('reference')}
            value={reference}
            onChangeText={setReference}
            maxLength={120}
            editable={!blocked}
          />
          <Field
            label={t('notes')}
            value={notes}
            onChangeText={setNotes}
            maxLength={1000}
            multiline
            editable={!blocked}
          />
          <Notice title={t('payments')} body={t('offPlatform')} />
          <PaymentContent data={data.payments} />
          <Button label={t('review')} disabled={blocked} onPress={preview} />
          <Button
            label={t('change')}
            tone="secondary"
            disabled={order.busy}
            onPress={() => setSelected(null)}
          />
        </>
      ) : null}
      {review && selected && data ? (
        <>
          <AppText variant="title" weight="semibold" accessibilityRole="header">
            {t('reviewTitle')}
          </AppText>
          <Card>
            <AppText weight="semibold">
              {locale === 'am' ? selected.labelAm : selected.labelEn}
            </AppText>
            <DataText>{selected.motherName}</DataText>
            <AppText>
              {selected.priceEtb} {t('price')}
            </AppText>
            <DataText>
              {review.addressNote} · {review.latitude}, {review.longitude}
            </DataText>
            {review.demoDate ? <AppText>{review.demoDate}</AppText> : null}
            {Object.entries(review.dishPattern).map(([day, id]) => (
              <AppText key={day}>
                {selected.duration === 'demo' ? t('demoDish') : t(labels[Number(day) - 1]!)}:{' '}
                {locale === 'am'
                  ? data.dishes.find((d) => d.id === id)?.nameAm
                  : data.dishes.find((d) => d.id === id)?.nameEn}
              </AppText>
            ))}
            <AppText>{t(review.paymentMethod)}</AppText>
            {review.paymentReference ? <DataText>{review.paymentReference}</DataText> : null}
            {review.notes ? <DataText>{review.notes}</DataText> : null}
          </Card>
          <Notice title={t('reviewTitle')} body={t('confirmNotice')} />
          <Button
            label={t('place')}
            busy={order.busy}
            disabled={blocked || !order.retryReady}
            onPress={() => {
              setReview(null);
              setSelected(null);
              void order.model.create(review, reviewRevision);
            }}
          />
          <Button
            label={t('change')}
            tone="secondary"
            disabled={order.busy}
            onPress={() => setReview(null)}
          />
        </>
      ) : null}
      {order.result ? <Notice title={t('confirmed')} body={`#${order.result.order.id}`} /> : null}
    </ClientPage>
  );
}
